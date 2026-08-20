import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastDM } from "@/lib/realtime-server";
import { broadcastNotification } from "@/lib/realtime-server";

const createSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().max(5000).optional().default(""),
  fileUrl: z.string().max(500_000).optional().nullable(),
  fileKind: z.enum(["IMAGE", "PDF", "OTHER"]).optional().nullable(),
  replyToId: z.string().optional().nullable(),
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (!data.content.trim() && !data.fileUrl) {
    return NextResponse.json({ error: "Message must have content or a file" }, { status: 400 });
  }
  const conversation = await db.conversation.findFirst({
    where: {
      id: data.conversationId,
      OR: [{ memberOneId: userId }, { memberTwoId: userId }],
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  const message = await db.directMessage.create({
    data: {
      conversationId: data.conversationId,
      authorId: userId,
      content: data.content,
      fileUrl: data.fileUrl ?? null,
      fileKind: data.fileKind ?? null,
      replyToId: data.replyToId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
    },
  });
  // Update conversation's updatedAt for sorting
  await db.conversation.update({
    where: { id: data.conversationId },
    data: { updatedAt: new Date() },
  });

  // Real-time broadcast to conversation room
  broadcastDM(data.conversationId, message);

  // Notify the other party
  const otherId =
    conversation.memberOneId === userId ? conversation.memberTwoId : conversation.memberOneId;
  const me = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, username: true },
  });
  const name = me?.username || me?.name || "Someone";
  await db.notification.create({
    data: {
      userId: otherId,
      title: `${name} sent you a message`,
      message: data.content.slice(0, 100),
      type: "MESSAGE",
      actionUrl: `?view=messages&conversationId=${data.conversationId}`,
    },
  });
  // Also push to the user's socket room so the notif bell updates live
  broadcastNotification(otherId, {
    title: `${name} sent you a message`,
    message: data.content.slice(0, 100),
    type: "MESSAGE",
    actionUrl: `?view=messages&conversationId=${data.conversationId}`,
  });

  return NextResponse.json({ message });
});
