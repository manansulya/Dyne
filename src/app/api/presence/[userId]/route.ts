import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

// PATCH /api/presence/[userId] — set online/offline for the given user
export const PATCH = withUserId(
  async (currentUserId, req: Request, ctx: { params: Promise<{ userId: string }> }) => {
    const { userId } = await ctx.params;
    if (userId !== currentUserId) {
      return NextResponse.json({ error: "Can only update your own presence" }, { status: 403 });
    }
    const body = await (req as Request).json().catch(() => ({}));
    const isOnline = Boolean(body.isOnline);
    await db.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeen: new Date(),
      },
    });
    return NextResponse.json({ ok: true, isOnline });
  }
);
