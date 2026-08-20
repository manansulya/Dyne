import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// Toggle like on a reel
export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const reel = await db.reel.findFirst({ where: { id } });
    if (!reel) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }
    const existing = await db.reelLike.findUnique({
      where: { reelId_userId: { reelId: id, userId } },
    });
    if (existing) {
      await db.reelLike.delete({ where: { id: existing.id } });
      return NextResponse.json({ liked: false });
    }
    await db.reelLike.create({ data: { reelId: id, userId } });
    // Notify reel owner
    if (reel.userId !== userId) {
      const liker = await db.user.findUnique({
        where: { id: userId },
        select: { username: true, name: true },
      });
      const name = liker?.username || liker?.name || "Someone";
      await db.notification.create({
        data: {
          userId: reel.userId,
          title: `${name} liked your reel`,
          message: reel.caption.slice(0, 60) || "",
          type: "REACTION",
        },
      });
    }
    return NextResponse.json({ liked: true });
  }
);
