import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json().catch(() => ({}));
    const existing = await db.notification.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    const updated = await db.notification.update({
      where: { id },
      data: { read: Boolean(body.read) },
    });
    return NextResponse.json({ notification: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.notification.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }
    await db.notification.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
