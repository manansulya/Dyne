import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// GET /api/feed — posts from communities the user has joined + posts from users they follow
export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const sortby = url.searchParams.get("sortby") ?? "new";

  const followedUserIds = (
    await db.follow.findMany({
      where: { followerId: userId },
      select: { followedId: true },
    })
  ).map((f) => f.followedId);

  const where = {
    OR: [
      { community: { members: { some: { userId } } } },
      { authorId: { in: [...followedUserIds, userId] } },
    ],
  };

  const orderBy: Record<string, "asc" | "desc"> =
    sortby === "top"
      ? { reactions: { _count: "desc" } }
      : sortby === "hot"
      ? { comments: { _count: "desc" } }
      : { createdAt: "desc" };

  const posts = await db.post.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true } },
      community: { select: { id: true, name: true, color: true, iconUrl: true } },
      _count: { select: { comments: true, reactions: true } },
      reactions: { where: { userId }, select: { isUpvote: true } },
      bookmarks: { where: { userId }, select: { id: true } },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  const out = items.map((p) => {
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
      isBookmarked: p.bookmarks.length > 0,
    };
  });

  return NextResponse.json({ posts: out, nextCursor });
});
