import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { LIMITERS } from "@/lib/rate-limit";

const createReelSchema = z.object({
  videoUrl: z.string().min(1).max(500_000),
  posterUrl: z.string().max(500_000).optional().nullable(),
  caption: z.string().max(2000).default(""),
  audioTitle: z.string().max(200).optional().nullable(),
  hashtags: z.string().max(500).optional().default(""),
});

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).optional().default(10),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;

  const reels = await db.reel.findMany({
    orderBy: { createdAt: "desc" },
    take: q.limit + 1,
    ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      _count: { select: { likes: true, comments: true } },
      likes: { where: { userId }, select: { id: true } },
      reelViews: { where: { userId }, select: { id: true } },
    },
  });

  const hasMore = reels.length > q.limit;
  const items = hasMore ? reels.slice(0, q.limit) : reels;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  const out = items.map((r) => ({
    ...r,
    hasLiked: r.likes.length > 0,
    hasViewed: r.reelViews.length > 0,
    likes: [],
    reelViews: [],
  }));

  return NextResponse.json({ reels: out, nextCursor });
});

export const POST = withUserId(async (userId, req: Request) => {
  if (!LIMITERS.createPost(userId)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const body = await req.json();
  const parsed = createReelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const reel = await db.reel.create({
    data: {
      userId,
      videoUrl: data.videoUrl,
      posterUrl: data.posterUrl ?? null,
      caption: data.caption,
      audioTitle: data.audioTitle ?? null,
      hashtags: data.hashtags ?? "",
    },
    include: {
      user: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  });
  return NextResponse.json({ reel });
});
