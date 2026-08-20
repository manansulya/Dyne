import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// Track a reel view (idempotent — one view per user per reel)
export const POST = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const reel = await db.reel.findFirst({ where: { id } });
    if (!reel) {
      return NextResponse.json({ error: "Reel not found" }, { status: 404 });
    }
    // Upsert view (prevents duplicate views)
    const isNew = !(await db.reelView.findUnique({
      where: { reelId_userId: { reelId: id, userId } },
    }));
    if (isNew) {
      await db.reelView.create({ data: { reelId: id, userId } });
      // Increment view count
      await db.reel.update({
        where: { id },
        data: { views: { increment: 1 } },
      });
    }
    return NextResponse.json({ ok: true, isNewView: isNew });
  }
);
