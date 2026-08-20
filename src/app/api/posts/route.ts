import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastCommunityPost } from "@/lib/realtime-server";

const createPostSchema = z.object({
  communityId: z.string().min(1),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().max(20_000).default(""),
  mediaUrl: z.string().max(500_000).optional().nullable(),
  mediaKind: z.enum(["IMAGE", "VIDEO", "LINK"]).optional().nullable(),
  linkUrl: z.string().url().optional().nullable(),
  courseId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  examId: z.string().optional().nullable(),
});

const listQuerySchema = z.object({
  communityId: z.string().optional(),
  sortby: z.enum(["top", "new", "hot"]).optional().default("new"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  cursor: z.string().optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const limit = q.limit;
  const where: {
    communityId?: string;
    community?: { members: { some: { userId: string } } };
  } = {};
  if (q.communityId) {
    where.communityId = q.communityId;
  } else {
    // Home feed: posts from communities the user is a member of
    where.community = { members: { some: { userId } } };
  }

  const orderBy: Prisma.PostOrderByWithRelationInput =
    q.sortby === "top"
      ? { reactions: { _count: "desc" } }
      : q.sortby === "hot"
      ? { comments: { _count: "desc" } }
      : { createdAt: "desc" };

  const posts = await db.post.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(q.cursor ? { skip: 1, cursor: { id: q.cursor } } : {}),
    include: {
      author: {
        select: { id: true, name: true, username: true, avatarUrl: true },
      },
      community: { select: { id: true, name: true, color: true, iconUrl: true } },
      _count: { select: { comments: true, reactions: true } },
      reactions: { where: { userId }, select: { isUpvote: true } },
      bookmarks: { where: { userId }, select: { id: true } },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  // Attach computed fields
  const out = items.map((p) => ({
    ...p,
    upvotes: p.reactions.filter((r) => r.isUpvote).length,
    downvotes: p.reactions.filter((r) => !r.isUpvote).length,
    score:
      p.reactions.filter((r) => r.isUpvote).length -
      p.reactions.filter((r) => !r.isUpvote).length,
    myVote:
      p.reactions.find((r) => r.isUpvote) ? "UP" : p.reactions.find((r) => !r.isUpvote) ? "DOWN" : null,
    isBookmarked: p.bookmarks.length > 0,
  }));

  return NextResponse.json({ posts: out, nextCursor });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  // Validate membership
  const membership = await db.communityMember.findUnique({
    where: { communityId_userId: { communityId: data.communityId, userId } },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "You must join this community before posting" },
      { status: 403 }
    );
  }
  if (data.courseId) {
    const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
    if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  }

  const post = await db.post.create({
    data: {
      communityId: data.communityId,
      authorId: userId,
      title: data.title,
      content: data.content,
      mediaUrl: data.mediaUrl ?? null,
      mediaKind: data.mediaKind ?? null,
      linkUrl: data.linkUrl ?? null,
      courseId: data.courseId ?? null,
      assignmentId: data.assignmentId ?? null,
      examId: data.examId ?? null,
    },
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true } },
      community: { select: { id: true, name: true, color: true, iconUrl: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  // Broadcast to community subscribers (real-time)
  const postWithExtras = {
    ...post,
    upvotes: 0,
    downvotes: 0,
    score: 0,
    myVote: null,
    isBookmarked: false,
  };
  broadcastCommunityPost(data.communityId, postWithExtras);

  return NextResponse.json({ post: postWithExtras });
});
