import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const joinSchema = z.object({
  inviteCode: z.string().min(1).max(100).optional(),
});

// POST /api/spaces/[id]/join — join via inviteCode OR direct (id) join
export const POST = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json().catch(() => ({}));
    const parsed = joinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    // Lookup space — either by id OR by inviteCode
    const space = parsed.data.inviteCode
      ? await db.space.findFirst({ where: { inviteCode: parsed.data.inviteCode } })
      : await db.space.findFirst({ where: { id } });
    if (!space) {
      return NextResponse.json({ error: "Space not found or invalid invite code" }, { status: 404 });
    }
    await db.spaceMember.upsert({
      where: { spaceId_userId: { spaceId: space.id, userId } },
      update: {},
      create: { spaceId: space.id, userId, role: "MEMBER" },
    });
    return NextResponse.json({ ok: true, spaceId: space.id });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const membership = await db.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "You are not a member" }, { status: 400 });
    }
    const space = await db.space.findFirst({ where: { id } });
    if (space?.ownerId === userId) {
      return NextResponse.json(
        { error: "Owner cannot leave — transfer ownership or delete the space" },
        { status: 400 }
      );
    }
    await db.spaceMember.delete({
      where: { spaceId_userId: { spaceId: id, userId } },
    });
    return NextResponse.json({ ok: true });
  }
);
