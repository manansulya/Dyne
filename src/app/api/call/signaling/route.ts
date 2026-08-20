import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastNotification, broadcastDM } from "@/lib/realtime-server";

const initiateCallSchema = z.object({
  conversationId: z.string().min(1),
  callType: z.enum(["VOICE", "VIDEO"]).default("VOICE"),
});

// POST /api/call/signaling — initiate a call
export const POST = withUserId(async (userId, req: Request) => {
  const body = await req.json();
  const parsed = initiateCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { conversationId, callType } = parsed.data;

  // Verify conversation membership
  const conversation = await db.conversation.findFirst({
    where: {
      id: conversationId,
      OR: [{ memberOneId: userId }, { memberTwoId: userId }],
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const calleeId = conversation.memberOneId === userId ? conversation.memberTwoId : conversation.memberOneId;

  // Check if either party is already in a call
  const activeCall = await db.call.findFirst({
    where: {
      OR: [
        { callerId: userId, isEnded: false },
        { calleeId: userId, isEnded: false },
        { callerId: calleeId, isEnded: false },
        { calleeId: calleeId, isEnded: false },
      ],
    },
  });
  if (activeCall) {
    return NextResponse.json({ error: "A call is already in progress" }, { status: 409 });
  }

  // Create call record
  const call = await db.call.create({
    data: {
      conversationId,
      callerId: userId,
      calleeId,
    },
  });

  // Notify callee via realtime
  const caller = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true, avatarUrl: true },
  });
  const callData = {
    callId: call.id,
    callerId: userId,
    callerName: caller?.name || caller?.username || "Unknown",
    callerAvatar: caller?.avatarUrl,
    conversationId,
    callType,
  };
  broadcastNotification(calleeId, {
    title: "Incoming call",
    message: `${caller?.name || caller?.username || "Someone"} is calling you`,
    type: "CALL",
    actionUrl: `?view=messages&conversationId=${conversationId}&callId=${call.id}&callType=${callType}`,
    callData,
  });

  return NextResponse.json({ call, callType });
});

const updateCallSchema = z.object({
  callId: z.string().min(1),
  action: z.enum(["accept", "reject", "end", "cancel"]),
  sdpOffer: z.string().optional(),
  sdpAnswer: z.string().optional(),
  iceCandidate: z.string().optional(),
});

// PATCH /api/call/signaling — update call state (accept/reject/end/cancel)
export const PATCH = withUserId(async (userId, req: Request) => {
  const body = await req.json();
  const parsed = updateCallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { callId, action } = parsed.data;

  const call = await db.call.findFirst({ where: { id: callId } });
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  // Verify the user is part of this call
  const isCaller = call.callerId === userId;
  const isCallee = call.calleeId === userId;
  if (!isCaller && !isCallee) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const otherId = isCaller ? call.calleeId : call.callerId;

  switch (action) {
    case "accept": {
      if (!isCallee) {
        return NextResponse.json({ error: "Only the callee can accept" }, { status: 403 });
      }
      await db.call.update({
        where: { id: callId },
        data: { isAccepted: true },
      });
      broadcastNotification(otherId!, {
        title: "Call accepted",
        type: "CALL",
        callAction: "accepted",
        callId,
      });
      return NextResponse.json({ ok: true, action: "accepted" });
    }
    case "reject": {
      if (!isCallee) {
        return NextResponse.json({ error: "Only the callee can reject" }, { status: 403 });
      }
      await db.call.update({
        where: { id: callId },
        data: { isRejected: true, isEnded: true, endedAt: new Date() },
      });
      broadcastNotification(otherId!, {
        title: "Call rejected",
        type: "CALL",
        callAction: "rejected",
        callId,
      });
      return NextResponse.json({ ok: true, action: "rejected" });
    }
    case "cancel": {
      if (!isCaller) {
        return NextResponse.json({ error: "Only the caller can cancel" }, { status: 403 });
      }
      await db.call.update({
        where: { id: callId },
        data: { isCanceled: true, isEnded: true, endedAt: new Date() },
      });
      broadcastNotification(otherId!, {
        title: "Call canceled",
        type: "CALL",
        callAction: "canceled",
        callId,
      });
      return NextResponse.json({ ok: true, action: "canceled" });
    }
    case "end": {
      await db.call.update({
        where: { id: callId },
        data: { isEnded: true, endedAt: new Date() },
      });
      broadcastNotification(otherId!, {
        title: "Call ended",
        type: "CALL",
        callAction: "ended",
        callId,
      });
      return NextResponse.json({ ok: true, action: "ended" });
    }
  }
});

// GET /api/call/signaling?callId=... — get call state
export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const callId = url.searchParams.get("callId");
  if (!callId) {
    // Get pending incoming call for this user
    const pendingCall = await db.call.findFirst({
      where: {
        calleeId: userId,
        isAccepted: false,
        isRejected: false,
        isCanceled: false,
        isEnded: false,
      },
      include: {
        caller: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });
    return NextResponse.json({ pendingCall });
  }
  const call = await db.call.findFirst({
    where: { id: callId },
    include: {
      caller: { select: { id: true, name: true, username: true, avatarUrl: true } },
      callee: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  });
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }
  if (call.callerId !== userId && call.calleeId !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return NextResponse.json({ call });
});
