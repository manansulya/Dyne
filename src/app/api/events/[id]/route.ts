import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { EVENT_TYPE, RECURRENCE } from "@/lib/constants";

const eventUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.enum(EVENT_TYPE).optional(),
  courseId: z.string().optional().nullable(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  recurrence: z.enum(RECURRENCE).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const event = await db.event.findFirst({
      where: { id, userId },
      include: {
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ event });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = eventUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.event.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    const data = parsed.data;
    if (data.courseId) {
      const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
      if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
    }
    const startDate = data.startDate ? new Date(data.startDate) : undefined;
    const endDate = data.endDate ? new Date(data.endDate) : undefined;
    if (startDate && endDate && endDate < startDate) {
      return NextResponse.json({ error: "End must be after start" }, { status: 400 });
    }
    const updated = await db.event.update({
      where: { id },
      data: { ...data, startDate, endDate },
    });
    return NextResponse.json({ event: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.event.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    await db.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
