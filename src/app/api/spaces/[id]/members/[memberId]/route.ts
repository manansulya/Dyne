import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// PATCH /api/spaces/[id]/members/[memberId] — change role (admin only)
// DELETE /api/spaces/[id]/members/[memberId] — kick (admin only, can't kick self/owner)

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string; memberId: string }> }) => {
    const { id, memberId } = await ctx.params;
    const body = await (req as Request).json().catch(() => ({}));
    const newRole = String(body.role ?? "").toUpperCase();
    if (!["MEMBER", "MODERATOR", "ADMIN"].includes(newRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const me = await db.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId } },
    });
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const target = await db.spaceMember.findUnique({ where: { id: memberId } });
    if (!target || target.spaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    const space = await db.space.findFirst({ where: { id } });
    if (target.userId === space?.ownerId) {
      return NextResponse.json({ error: "Cannot change owner's role" }, { status: 400 });
    }
    const updated = await db.spaceMember.update({
      where: { id: memberId },
      data: { role: newRole as "MEMBER" | "MODERATOR" | "ADMIN" },
    });
    return NextResponse.json({ member: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string; memberId: string }> }) => {
    const { id, memberId } = await ctx.params;
    const me = await db.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId } },
    });
    if (!me || me.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const target = await db.spaceMember.findUnique({ where: { id: memberId } });
    if (!target || target.spaceId !== id) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (target.userId === userId) {
      return NextResponse.json({ error: "Cannot kick yourself" }, { status: 400 });
    }
    const space = await db.space.findFirst({ where: { id } });
    if (target.userId === space?.ownerId) {
      return NextResponse.json({ error: "Cannot kick owner" }, { status: 400 });
    }
    await db.spaceMember.delete({ where: { id: memberId } });
    return NextResponse.json({ ok: true });
  }
);
