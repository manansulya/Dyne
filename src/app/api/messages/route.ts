import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastChannelMessage } from "@/lib/realtime-server";

const listQuerySchema = z.object({
  channelId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

const createSchema = z.object({
  channelId: z.string().min(1),
  content: z.string().max(5000).optional().default(""),
  fileUrl: z.string().max(500_000).optional().nullable(),
  fileKind: z.enum(["IMAGE", "PDF", "OTHER"]).optional().nullable(),
  replyToId: z.string().optional().nullable(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  // Validate membership
  const channel = await db.channel.findFirst({
    where: { id: q.channelId },
    include: { space: { include: { members: { where: { userId } } } } },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!channel.space.members[0]) {
    return NextResponse.json({ error: "Not a member of this space" }, { status: 403 });
  }
  const messages = await db.message.findMany({
    where: { channelId: q.channelId },
    orderBy: { createdAt: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
    },
  });
  const hasMore = messages.length > q.limit;
  const items = hasMore ? messages.slice(0, q.limit) : messages;
  return NextResponse.json({
    messages: items.reverse(), // back to chronological order
    nextCursor: hasMore ? items[items.length - 1]?.id : null,
  });
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
  // Validate membership
  const channel = await db.channel.findFirst({
    where: { id: data.channelId },
    include: { space: { include: { members: { where: { userId } } } } },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!channel.space.members[0]) {
    return NextResponse.json({ error: "Not a member of this space" }, { status: 403 });
  }

  const message = await db.message.create({
    data: {
      channelId: data.channelId,
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

  // Real-time broadcast
  broadcastChannelMessage(data.channelId, message);

  return NextResponse.json({ message });
});
