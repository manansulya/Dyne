import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const session = await db.studySession.findFirst({
      where: { id, userId },
      include: {
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ session });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.studySession.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    await db.studySession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
