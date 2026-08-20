import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastCommunityComment } from "@/lib/realtime-server";

const createCommentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1, "Content is required").max(10_000),
  parentId: z.string().optional().nullable(),
});

// GET /api/comments/post/[postId] — returns the post + nested comment tree
export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ postId: string }> }) => {
    const { postId } = await ctx.params;
    const post = await db.post.findFirst({
      where: { id: postId },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        community: { select: { id: true, name: true, color: true, iconUrl: true } },
        _count: { select: { comments: true, reactions: true } },
        reactions: { where: { userId }, select: { isUpvote: true } },
        bookmarks: { where: { userId }, select: { id: true } },
      },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const comments = await db.comment.findMany({
      where: { postId },
      orderBy: { createdAt: "asc" },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        reactions: { where: { userId }, select: { isUpvote: true } },
      },
    });

    // Build nested tree
    type CommentNode = (typeof comments)[number] & {
      replies: CommentNode[];
      upvotes: number;
      downvotes: number;
      score: number;
      myVote: "UP" | "DOWN" | null;
    };
    const byId = new Map<string, CommentNode>();
    for (const c of comments) {
      const upvotes = c.reactions.filter((r) => r.isUpvote).length;
      const downvotes = c.reactions.filter((r) => !r.isUpvote).length;
      byId.set(c.id, {
        ...c,
        replies: [],
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        myVote: c.reactions.find((r) => r.isUpvote)
          ? "UP"
          : c.reactions.find((r) => !r.isUpvote)
          ? "DOWN"
          : null,
      });
    }
    const roots: CommentNode[] = [];
    for (const c of byId.values()) {
      if (c.parentId && byId.has(c.parentId)) {
        byId.get(c.parentId)!.replies.push(c);
      } else {
        roots.push(c);
      }
    }

    const upvotes = post.reactions.filter((r) => r.isUpvote).length;
    const downvotes = post.reactions.filter((r) => !r.isUpvote).length;
    return NextResponse.json({
      post: {
        ...post,
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        myVote: post.reactions.find((r) => r.isUpvote)
          ? "UP"
          : post.reactions.find((r) => !r.isUpvote)
          ? "DOWN"
          : null,
        isBookmarked: post.bookmarks.length > 0,
      },
      comments: roots,
    });
  }
);

export const POST = withUserId(async (userId, req: Request, ctx: { params: Promise<{ postId: string }> }) => {
  const { postId } = await ctx.params;
  const body = await (req as Request).json();
  // body may include postId OR we use the URL param
  const payload = { ...body, postId };
  const parsed = createCommentSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { content, parentId } = parsed.data;
  const post = await db.post.findFirst({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }
  if (parentId) {
    const parent = await db.comment.findFirst({ where: { id: parentId, postId } });
    if (!parent) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
  }

  const comment = await db.comment.create({
    data: {
      postId,
      authorId: userId,
      parentId: parentId ?? null,
      content,
    },
    include: {
      author: { select: { id: true, name: true, username: true, avatarUrl: true } },
    },
  });

  // Notify the post author (unless they're commenting on their own post)
  if (post.authorId !== userId) {
    const author = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true },
    });
    const name = author?.username || author?.name || "Someone";
    await db.notification.create({
      data: {
        userId: post.authorId,
        title: `${name} commented on your post`,
        message: post.title,
        type: "COMMENT",
        actionUrl: `?view=community&communityId=${post.communityId}&postId=${post.id}`,
      },
    });
  }

  // Broadcast to community subscribers (real-time)
  broadcastCommunityComment(post.communityId, {
    ...comment,
    upvotes: 0,
    downvotes: 0,
    score: 0,
    myVote: null,
    replies: [],
  });

  return NextResponse.json({ comment });
});
