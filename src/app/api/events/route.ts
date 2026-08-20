import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { EVENT_TYPE, RECURRENCE } from "@/lib/constants";

const eventCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  type: z.enum(EVENT_TYPE).optional(),
  courseId: z.string().optional().nullable(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  recurrence: z.enum(RECURRENCE).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

const eventListQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  courseId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = eventListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const where: {
    userId: string;
    courseId?: string;
    OR?: Array<{ startDate: { gte?: Date; lte?: Date } } | { endDate: { gte?: Date; lte?: Date } }>;
  } = { userId };
  if (q.courseId) where.courseId = q.courseId;
  if (q.start && q.end) {
    const start = new Date(q.start);
    const end = new Date(q.end);
    // Events that overlap the [start, end] window OR have recurrence (we expand those client-side too).
    where.OR = [
      { startDate: { gte: start, lte: end } },
      { endDate: { gte: start, lte: end } },
      { AND: [{ startDate: { lte: start } }, { endDate: { gte: end } }] },
    ];
  }
  const events = await db.event.findMany({
    where,
    orderBy: { startDate: "asc" },
    take: q.limit ?? 1000,
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
    },
  });
  return NextResponse.json({ events });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.courseId) {
    const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
    if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  }
  const startDate = new Date(data.startDate);
  const endDate = data.endDate ? new Date(data.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000);
  if (endDate < startDate) {
    return NextResponse.json({ error: "End must be after start" }, { status: 400 });
  }
  const event = await db.event.create({
    data: {
      userId,
      title: data.title,
      type: data.type ?? "PERSONAL",
      courseId: data.courseId ?? null,
      startDate,
      endDate,
      recurrence: data.recurrence ?? null,
      location: data.location ?? null,
      description: data.description ?? null,
    },
  });
  return NextResponse.json({ event });
});
