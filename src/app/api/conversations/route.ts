import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { getOrCreateConversation } from "@/lib/conversation";

export const GET = withUserId(async (userId, req: Request) => {
  // Return list of conversations for the current user with last message preview
  const conversations = await db.conversation.findMany({
    where: {
      OR: [{ memberOneId: userId }, { memberTwoId: userId }],
    },
    include: {
      directMessages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        },
      },
      memberOne: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
      memberTwo: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const out = conversations.map((c) => {
    const isOne = c.memberOneId === userId;
    const other = isOne ? c.memberTwo : c.memberOne;
    const lastMessage = c.directMessages[0];
    // Unread count: messages where authorId != userId and createdAt > lastSeenAt (not stored, so use simple isDeleted=false && byOther)
    return {
      id: c.id,
      other,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.isDeleted ? "Message deleted" : lastMessage.content,
            createdAt: lastMessage.createdAt,
            authorId: lastMessage.authorId,
            fileUrl: lastMessage.fileUrl,
            fileKind: lastMessage.fileKind,
          }
        : null,
      updatedAt: c.updatedAt,
    };
  });

  return NextResponse.json({ conversations: out });
});

export const POST = withUserId(async (userId, req: Request) => {
  // Start (or fetch) a conversation with another user.
  // Body: { otherUserId: string }
  const body = await (req as Request).json();
  const otherUserId = String(body?.otherUserId ?? "");
  if (!otherUserId) {
    return NextResponse.json({ error: "otherUserId is required" }, { status: 400 });
  }
  if (otherUserId === userId) {
    return NextResponse.json({ error: "Cannot start conversation with yourself" }, { status: 400 });
  }
  const other = await db.user.findUnique({ where: { id: otherUserId } });
  if (!other) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const conversation = await getOrCreateConversation(userId, otherUserId);
  return NextResponse.json({ conversation });
});
