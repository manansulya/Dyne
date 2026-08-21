import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastCommunityPost } from "@/lib/realtime-server";
import { publicAttachment } from "@/lib/attachments";

const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(20_000).optional(),
  mediaUrl: z.string().url().max(2048).optional().nullable(),
  mediaKind: z.enum(["IMAGE", "VIDEO", "LINK"]).optional().nullable(),
  linkUrl: z.string().url().optional().nullable(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const post = await db.post.findFirst({
      where: { id },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        community: { select: { id: true, name: true, color: true, iconUrl: true } },
        _count: { select: { comments: true, reactions: true } },
        reactions: { where: { userId }, select: { isUpvote: true } },
        bookmarks: { where: { userId }, select: { id: true } },
        attachments: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
      },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const upvotes = post.reactions.filter((r) => r.isUpvote).length;
    const downvotes = post.reactions.filter((r) => !r.isUpvote).length;
    return NextResponse.json({
      post: {
        ...post,
        attachments: post.attachments.map(publicAttachment),
        upvotes,
        downvotes,
        score: upvotes - downvotes,
        myVote:
          post.reactions.find((r) => r.isUpvote)
            ? "UP"
            : post.reactions.find((r) => !r.isUpvote)
            ? "DOWN"
            : null,
        isBookmarked: post.bookmarks.length > 0,
      },
    });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.post.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (existing.authorId !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const updated = await db.post.update({
      where: { id },
      data: { ...parsed.data, isEdited: true },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        community: { select: { id: true, name: true, color: true, iconUrl: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });
    broadcastCommunityPost(updated.communityId, { ...updated, isEdited: true });
    return NextResponse.json({ post: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const post = await db.post.findFirst({
      where: { id },
      include: { community: { include: { members: { where: { userId } } } } },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    const isAuthor = post.authorId === userId;
    const myMembership = post.community.members[0];
    const isModOrAdmin = myMembership && (myMembership.role === "ADMIN" || myMembership.role === "MODERATOR");
    if (!isAuthor && !isModOrAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    await db.post.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
