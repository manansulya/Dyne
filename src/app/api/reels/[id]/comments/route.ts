import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { LIMITERS } from "@/lib/rate-limit";

const commentSchema = z.object({
  content: z.string().min(1).max(2000),
  parentId: z.string().optional().nullable(),
});

export const GET = withUserId(
  async (_userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const comments = await db.reelComment.findMany({
      where: { reelId: id, parentId: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        replies: {
          include: {
            author: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return NextResponse.json({ comments });
  }
);

export const POST = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    if (!LIMITERS.createComment(userId)) {
      return NextResponse.json({ error: "Rate limited" }, { status: 429 });
    }
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const reel = await db.reel.findFirst({ where: { id } });
    if (!reel) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }
    const comment = await db.reelComment.create({
      data: {
        reelId: id,
        authorId: userId,
        content: parsed.data.content,
        parentId: parsed.data.parentId ?? null,
      },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
    });
    // Notify reel owner
    if (reel.userId !== userId) {
      const commenter = await db.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true },
      });
      const name = commenter?.username || commenter?.name || "Someone";
      await db.notification.create({
        data: {
          userId: reel.userId,
          title: `${name} commented on your reel`,
          message: parsed.data.content.slice(0, 60),
          type: "COMMENT",
        },
      });
    }
    return NextResponse.json({ comment });
  }
);
