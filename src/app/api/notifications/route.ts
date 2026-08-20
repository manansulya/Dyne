import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(async (userId) => {
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unreadCount = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unreadCount });
});

// Mark all as read.
export const PATCH = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json().catch(() => ({}));
  if (body.markAllRead) {
    await db.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unsupported" }, { status: 400 });
});
