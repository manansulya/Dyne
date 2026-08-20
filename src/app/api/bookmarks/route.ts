import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(async (userId) => {
  const bookmarks = await db.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      post: {
        include: {
          author: { select: { id: true, name: true, username: true, avatarUrl: true } },
          community: { select: { id: true, name: true, color: true, iconUrl: true } },
          _count: { select: { comments: true, reactions: true } },
          reactions: { where: { userId }, select: { isUpvote: true } },
          bookmarks: { where: { userId }, select: { id: true } },
        },
      },
    },
  });
  const posts = bookmarks.map((b) => {
    const p = b.post;
    const upvotes = p.reactions.filter((r) => r.isUpvote).length;
    const downvotes = p.reactions.filter((r) => !r.isUpvote).length;
    return {
      ...p,
      upvotes,
      downvotes,
      score: upvotes - downvotes,
      myVote:
        p.reactions.find((r) => r.isUpvote)
          ? "UP"
          : p.reactions.find((r) => !r.isUpvote)
          ? "DOWN"
          : null,
      isBookmarked: true,
    };
  });
  return NextResponse.json({ posts });
});
