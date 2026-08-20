import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(
  async (currentUserId, _req: Request, ctx: { params: Promise<{ username: string }> }) => {
    const { username } = await ctx.params;
    const user = await db.user.findFirst({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatarUrl: true,
        institution: true,
        createdAt: true,
        isOnline: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const [postsCount, commentsCount] = await Promise.all([
      db.post.count({ where: { authorId: user.id } }),
      db.comment.count({ where: { authorId: user.id } }),
    ]);
    const postReactions = await db.reaction.findMany({
      where: { userId: { not: user.id }, post: { authorId: user.id } },
      select: { isUpvote: true },
    });
    const commentReactions = await db.reaction.findMany({
      where: { userId: { not: user.id }, comment: { authorId: user.id } },
      select: { isUpvote: true },
    });
    const postKarma =
      postReactions.filter((r) => r.isUpvote).length -
      postReactions.filter((r) => !r.isUpvote).length;
    const commentKarma =
      commentReactions.filter((r) => r.isUpvote).length -
      commentReactions.filter((r) => !r.isUpvote).length;
    const karma = postKarma + commentKarma;
    const isFollowing = (await db.follow.findUnique({
      where: { followerId_followedId: { followerId: currentUserId, followedId: user.id } },
    }))
      ? true
      : false;

    return NextResponse.json({
      user: {
        ...user,
        postsCount,
        commentsCount,
        karma,
        postKarma,
        commentKarma,
        isFollowing,
      },
    });
  }
);
