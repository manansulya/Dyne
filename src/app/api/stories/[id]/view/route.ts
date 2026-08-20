import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// Mark a story as viewed
export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const story = await db.story.findFirst({ where: { id } });
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    // Upsert view (idempotent — viewing twice doesn't create duplicate)
    await db.storyView.upsert({
      where: { storyId_userId: { storyId: id, userId } },
      update: {},
      create: { storyId: id, userId },
    });
    return NextResponse.json({ ok: true });
  }
);

// Get story viewers
export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const story = await db.story.findFirst({ where: { id, userId } });
    if (!story) {
      return NextResponse.json({ error: "Story not found or not yours" }, { status: 404 });
    }
    const views = await db.storyView.findMany({
      where: { storyId: id },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true } },
      },
      orderBy: { viewedAt: "desc" },
    });
    return NextResponse.json({ viewers: views });
  }
);
