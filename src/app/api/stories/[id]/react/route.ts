import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const reactSchema = z.object({
  emoji: z.string().min(1).max(10).default("❤️"),
});

export const POST = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await req.json();
    const parsed = reactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const story = await db.story.findFirst({ where: { id } });
    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
    // Toggle reaction
    const existing = await db.storyReaction.findUnique({
      where: { storyId_userId: { storyId: id, userId } },
    });
    if (existing) {
      await db.storyReaction.delete({ where: { id: existing.id } });
      return NextResponse.json({ reacted: false });
    }
    await db.storyReaction.create({
      data: { storyId: id, userId, emoji: parsed.data.emoji },
    });
    // Notify story owner
    if (story.userId !== userId) {
      const reactor = await db.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true },
      });
      const name = reactor?.username || reactor?.name || "Someone";
      await db.notification.create({
        data: {
          userId: story.userId,
          title: `${name} reacted to your story`,
          message: parsed.data.emoji,
          type: "REACTION",
          actionUrl: `?view=profile`,
        },
      });
    }
    return NextResponse.json({ reacted: true });
  }
);
