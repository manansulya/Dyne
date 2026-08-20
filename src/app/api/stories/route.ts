import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { LIMITERS } from "@/lib/rate-limit";
import { addHours } from "date-fns";

const createStorySchema = z.object({
  mediaUrl: z.string().min(1).max(500_000),
  mediaKind: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  caption: z.string().max(500).optional().nullable(),
  duration: z.number().int().min(1).max(30).optional().default(5),
});

export const GET = withUserId(async (userId) => {
  // Get active stories (not expired) from the user and their followings
  const now = new Date();
  const followingIds = (
    await db.follow.findMany({
      where: { followerId: userId },
      select: { followedId: true },
    })
  ).map((f) => f.followedId);

  const userIds = [userId, ...followingIds];

  const stories = await db.story.findMany({
    where: {
      userId: { in: userIds },
      expiresAt: { gt: now },
    },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      views: { where: { userId }, select: { id: true } },
      _count: { select: { views: true, reactions: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Group by user
  const byUser = new Map<string, { user: any; stories: any[] }>();
  for (const s of stories) {
    const key = s.userId;
    if (!byUser.has(key)) {
      byUser.set(key, { user: s.user, stories: [] });
    }
    byUser.get(key)!.stories.push({
      ...s,
      hasViewed: s.views.length > 0,
    });
  }

  return NextResponse.json({ storyGroups: Array.from(byUser.values()) });
});

export const POST = withUserId(async (userId, req: Request) => {
  if (!LIMITERS.createPost(userId)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const body = await req.json();
  const parsed = createStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const story = await db.story.create({
    data: {
      userId,
      mediaUrl: data.mediaUrl,
      mediaKind: data.mediaKind,
      caption: data.caption ?? null,
      duration: data.duration,
      expiresAt: addHours(new Date(), 24), // Stories expire after 24 hours
    },
  });
  return NextResponse.json({ story });
});
