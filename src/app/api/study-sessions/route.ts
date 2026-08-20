import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { FOCUS_STATUS } from "@/lib/constants";

const sessionCreateSchema = z.object({
  courseId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  startTime: z.string().min(1),
  endTime: z.string().optional().nullable(),
  duration: z.number().int().min(0).max(1440).optional(),
  focusStatus: z.enum(FOCUS_STATUS).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const listQuerySchema = z.object({
  courseId: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const where: {
    userId: string;
    courseId?: string;
    startTime?: { gte?: Date; lte?: Date };
  } = { userId };
  if (q.courseId) where.courseId = q.courseId;
  if (q.start) where.startTime = { gte: new Date(q.start + "T00:00:00.000Z") };
  if (q.end) where.startTime = { ...where.startTime, lte: new Date(q.end + "T23:59:59.999Z") };

  const sessions = await db.studySession.findMany({
    where,
    orderBy: { startTime: "desc" },
    take: q.limit ?? 500,
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
    },
  });
  return NextResponse.json({ sessions });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = sessionCreateSchema.safeParse(body);
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
  const startTime = new Date(data.startTime);
  const endTime = data.endTime ? new Date(data.endTime) : null;
  let duration = data.duration ?? 0;
  if (!duration && endTime) {
    duration = Math.max(0, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  }
  const session = await db.studySession.create({
    data: {
      userId,
      courseId: data.courseId ?? null,
      taskId: data.taskId ?? null,
      startTime,
      endTime,
      duration,
      focusStatus: data.focusStatus ?? "FOCUSED",
      notes: data.notes ?? null,
    },
  });
  // If this session belongs to a goal of type STUDY_HOURS, update that goal's current.
  await updateStudyGoals(userId, duration);

  return NextResponse.json({ session });
});

async function updateStudyGoals(userId: string, addedMinutes: number) {
  if (addedMinutes <= 0) return;
  const addedHours = addedMinutes / 60;
  // Get the active STUDY_HOURS goals (deadline in the future or null)
  const goals = await db.goal.findMany({
    where: { userId, type: "STUDY_HOURS", status: "ACTIVE" },
  });
  if (goals.length === 0) return;
  // We consider goals whose deadline is null OR whose deadline is in the future
  const now = new Date();
  for (const g of goals) {
    const within = !g.deadline || new Date(g.deadline).getTime() >= now.getTime();
    if (!within) continue;
    const newCurrent = Math.min(g.target, g.current + addedHours);
    const status = newCurrent >= g.target ? "COMPLETED" : "ACTIVE";
    await db.goal.update({
      where: { id: g.id },
      data: { current: newCurrent, status },
    });
  }
}
