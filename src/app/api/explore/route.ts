import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// GET /api/explore — discover posts, reels, users, hashtags
export const GET = withUserId(async (userId) => {
  // Trending posts (most liked in last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [trendingPosts, recentReels, suggestedUsers, trendingHashtags] = await Promise.all([
    db.post.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { likes: { _count: "desc" } },
      take: 12,
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        community: { select: { id: true, name: true, color: true } },
        _count: { select: { likes: true, comments: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    }),
    db.reel.findMany({
      orderBy: { views: "desc" },
      take: 6,
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    // Suggested users: users that the current user doesn't follow, ordered by follower count
    db.user.findMany({
      where: {
        id: { not: userId },
        NOT: { followers: { some: { followerId: userId } } },
      },
      take: 6,
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        bio: true,
        _count: { select: { followers: true, posts: true } },
      },
      orderBy: { followers: { _count: "desc" } },
    }),
    // Trending hashtags from post hashtags field
    db.post.findMany({
      where: { content: { contains: "#" } },
      select: { content: true },
      take: 100,
    }),
  ]);

  // Extract hashtags from post content
  const hashtagCounts = new Map<string, number>();
  for (const p of trendingHashtags) {
    const matches = p.content.match(/#[\w]+/g);
    if (matches) {
      for (const tag of matches) {
        const normalized = tag.toLowerCase();
        hashtagCounts.set(normalized, (hashtagCounts.get(normalized) ?? 0) + 1);
      }
    }
  }
  const hashtags = Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const posts = trendingPosts.map((p) => ({
    ...p,
    hasLiked: p.likes.length > 0,
    likes: [],
  }));

  return NextResponse.json({
    posts,
    reels: recentReels,
    users: suggestedUsers,
    hashtags,
  });
});
