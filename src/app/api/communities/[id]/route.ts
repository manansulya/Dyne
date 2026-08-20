import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const updateSchema = z.object({
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().max(500_000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const community = await db.community.findFirst({
      where: { id },
      include: {
        _count: { select: { members: true, posts: true } },
        members: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      },
    });
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }
    const myMembership = community.members.find((m) => m.userId === userId);
    return NextResponse.json({ community, myRole: myMembership?.role ?? null });
  }
);

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
    const community = await db.community.findFirst({ where: { id } });
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }
    const me = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId } },
    });
    if (!me || (me.role !== "ADMIN" && me.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const updated = await db.community.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ community: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const community = await db.community.findFirst({ where: { id } });
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }
    if (community.createdBy !== userId) {
      return NextResponse.json({ error: "Only the creator can delete this community" }, { status: 403 });
    }
    await db.community.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
