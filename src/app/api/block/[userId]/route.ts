import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// Block a user
export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId: targetUserId } = await ctx.params;
    if (targetUserId === userId) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
    }
    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    // Block (idempotent)
    await db.block.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
      update: {},
      create: { blockerId: userId, blockedId: targetUserId },
    });
    // Also unfollow if currently following
    await db.follow.deleteMany({
      where: { OR: [
        { followerId: userId, followedId: targetUserId },
        { followerId: targetUserId, followedId: userId },
      ] },
    });
    return NextResponse.json({ ok: true, blocked: true });
  }
);

// Unblock a user
export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId: targetUserId } = await ctx.params;
    await db.block.deleteMany({
      where: { blockerId: userId, blockedId: targetUserId },
    });
    return NextResponse.json({ ok: true, blocked: false });
  }
);

// Check block status
export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId: targetUserId } = await ctx.params;
    const blocked = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
    });
    const blockedBy = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: targetUserId, blockedId: userId } },
    });
    return NextResponse.json({ blocked: !!blocked, blockedBy: !!blockedBy });
  }
);
