import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId: targetUserId } = await ctx.params;
    if (targetUserId === userId) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }
    const target = await db.user.findUnique({ where: { id: targetUserId } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await db.follow.upsert({
      where: { followerId_followedId: { followerId: userId, followedId: targetUserId } },
      update: {},
      create: { followerId: userId, followedId: targetUserId },
    });
    // Notify the followed user
    const follower = await db.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true, avatarUrl: true },
    });
    if (follower) {
      const name = follower.username || follower.name || "Someone";
      await db.notification.create({
        data: {
          userId: targetUserId,
          title: `${name} started following you`,
          message: "",
          type: "INFO",
          actionUrl: `?view=profile&username=${follower.username ?? ""}`,
        },
      });
    }
    return NextResponse.json({ ok: true, isFollowing: true });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId: targetUserId } = await ctx.params;
    await db.follow.deleteMany({
      where: { followerId: userId, followedId: targetUserId },
    });
    return NextResponse.json({ ok: true, isFollowing: false });
  }
);

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId: targetUserId } = await ctx.params;
    const isFollowing = (await db.follow.findUnique({
      where: { followerId_followedId: { followerId: userId, followedId: targetUserId } },
    }))
      ? true
      : false;
    return NextResponse.json({ isFollowing });
  }
);
