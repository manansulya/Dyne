import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const community = await db.community.findFirst({ where: { id } });
    if (!community) {
      return NextResponse.json({ error: "Community not found" }, { status: 404 });
    }
    // Upsert membership (idempotent — joining twice is fine)
    await db.communityMember.upsert({
      where: { communityId_userId: { communityId: id, userId } },
      update: {},
      create: { communityId: id, userId, role: "MEMBER" },
    });
    return NextResponse.json({ ok: true });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const membership = await db.communityMember.findUnique({
      where: { communityId_userId: { communityId: id, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "You are not a member" }, { status: 400 });
    }
    if (membership.role === "ADMIN") {
      const community = await db.community.findFirst({ where: { id } });
      if (community?.createdBy === userId) {
        return NextResponse.json(
          { error: "Creator cannot leave — transfer ownership or delete the community" },
          { status: 400 }
        );
      }
    }
    await db.communityMember.delete({
      where: { communityId_userId: { communityId: id, userId } },
    });
    return NextResponse.json({ ok: true });
  }
);
