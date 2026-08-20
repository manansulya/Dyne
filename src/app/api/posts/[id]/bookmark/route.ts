import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// PUT = bookmark, DELETE = un-bookmark
export const PUT = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const post = await db.post.findFirst({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    await db.bookmark.upsert({
      where: { userId_postId: { userId, postId: id } },
      update: {},
      create: { userId, postId: id },
    });
    return NextResponse.json({ ok: true, isBookmarked: true });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    await db.bookmark.deleteMany({
      where: { userId, postId: id },
    });
    return NextResponse.json({ ok: true, isBookmarked: false });
  }
);
