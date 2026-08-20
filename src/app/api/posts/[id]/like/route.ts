import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// Toggle like on a post (Instagram-style: simple like/unlike, no downvote)
export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const post = await db.post.findFirst({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const existing = await db.postLike.findUnique({
      where: { postId_userId: { postId: id, userId } },
    });
    if (existing) {
      await db.postLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }
    await db.postLike.create({ data: { postId: id, userId } });
    // Notify post owner
    if (post.authorId !== userId) {
      const liker = await db.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true },
      });
      const name = liker?.username || liker?.name || "Someone";
      await db.notification.create({
        data: {
          userId: post.authorId,
          title: `${name} liked your post`,
          message: post.title.slice(0, 60),
          type: "REACTION",
        },
      });
    }
    return NextResponse.json({ liked: true });
  }
);
