import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { publicAttachment } from "@/lib/attachments";

const listQuerySchema = z.object({
  conversationId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(30),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const url = new URL(_req.url);
    const parsed = listQuerySchema.safeParse({
      conversationId: id,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }
    const q = parsed.data;
    // Verify membership
    const conversation = await db.conversation.findFirst({
      where: {
        id: q.conversationId,
        OR: [{ memberOneId: userId }, { memberTwoId: userId }],
      },
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    const messages = await db.directMessage.findMany({
      where: { conversationId: q.conversationId },
      orderBy: { createdAt: "desc" },
      take: q.limit + 1,
      ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      },
    });
    const hasMore = messages.length > q.limit;
    const items = hasMore ? messages.slice(0, q.limit) : messages;
    return NextResponse.json({
      messages: items
        .map((m) => ({ ...m, attachments: m.attachments.map(publicAttachment) }))
        .reverse(),
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
    });
  }
);
