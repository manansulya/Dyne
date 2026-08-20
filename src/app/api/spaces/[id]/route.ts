import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().max(500_000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const space = await db.space.findFirst({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, username: true, avatarUrl: true } },
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
        channels: { orderBy: { position: "asc" } },
        members: {
          include: {
            user: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
          },
        },
        _count: { select: { members: true } },
      },
    });
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    const myMembership = space.members.find((m) => m.userId === userId);
    if (!myMembership) {
      return NextResponse.json({ error: "You are not a member of this space" }, { status: 403 });
    }
    return NextResponse.json({ space, myRole: myMembership.role });
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
    const space = await db.space.findFirst({ where: { id } });
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    const me = await db.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId } },
    });
    if (!me || (me.role !== "ADMIN" && me.role !== "MODERATOR")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const updated = await db.space.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ space: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const space = await db.space.findFirst({ where: { id } });
    if (!space) {
      return NextResponse.json({ error: "Space not found" }, { status: 404 });
    }
    if (space.ownerId !== userId) {
      return NextResponse.json({ error: "Only the owner can delete this space" }, { status: 403 });
    }
    await db.space.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
