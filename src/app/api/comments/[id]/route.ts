import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const updateSchema = z.object({
  content: z.string().min(1).max(10_000),
});

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.comment.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    if (existing.authorId !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const updated = await db.comment.update({
      where: { id },
      data: { content: parsed.data.content, isEdited: true },
    });
    return NextResponse.json({ comment: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const comment = await db.comment.findFirst({
      where: { id },
      include: {
        post: { include: { community: { include: { members: { where: { userId } } } } } },
      },
    });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    const isAuthor = comment.authorId === userId;
    const myMembership = comment.post.community.members[0];
    const isModOrAdmin =
      myMembership && (myMembership.role === "ADMIN" || myMembership.role === "MODERATOR");
    if (!isAuthor && !isModOrAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    // Recursive delete: also remove replies (SQLite doesn't cascade self-relations automatically)
    const replies = await db.comment.findMany({ where: { parentId: id } });
    if (replies.length > 0) {
      await db.comment.deleteMany({ where: { parentId: id } });
    }
    await db.comment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
