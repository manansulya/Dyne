import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";

const taskCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(4000).optional().nullable(),
  courseId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  estimatedDuration: z.number().int().min(0).max(1440).optional().nullable(),
  tags: z.string().max(500).optional().default(""),
});

const taskListQuerySchema = z.object({
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  courseId: z.string().optional(),
  assignmentId: z.string().optional(),
  dueDate: z.string().optional(), // YYYY-MM-DD
  overdue: z.string().optional(), // "1"
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = taskListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const where: {
    userId: string;
    status?: string;
    priority?: string;
    courseId?: string;
    assignmentId?: string;
    dueDate?: { gte: Date; lt: Date };
  } = { userId };
  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.courseId) where.courseId = q.courseId;
  if (q.assignmentId) where.assignmentId = q.assignmentId;
  if (q.dueDate) {
    const start = new Date(q.dueDate + "T00:00:00.000Z");
    const end = new Date(q.dueDate + "T23:59:59.999Z");
    where.dueDate = { gte: start, lt: end };
  }

  let tasks = await db.task.findMany({
    where,
    orderBy: [{ order: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: q.limit ?? 500,
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      assignment: { select: { id: true, title: true } },
    },
  });

  if (q.overdue === "1") {
    tasks = tasks.filter(
      (t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate).getTime() < Date.now()
    );
  }

  return NextResponse.json({ tasks });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = taskCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  // Verify course / assignment belong to user
  if (data.courseId) {
    const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
    if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  }
  if (data.assignmentId) {
    const a = await db.assignment.findFirst({ where: { id: data.assignmentId, userId } });
    if (!a) return NextResponse.json({ error: "Invalid assignment" }, { status: 400 });
  }
  const dueDate = data.dueDate ? new Date(data.dueDate) : null;
  const task = await db.task.create({
    data: {
      userId,
      title: data.title,
      description: data.description ?? null,
      courseId: data.courseId ?? null,
      assignmentId: data.assignmentId ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      dueDate,
      dueTime: data.dueTime ?? null,
      estimatedDuration: data.estimatedDuration ?? null,
      tags: data.tags ?? "",
    },
  });
  // If this task belongs to an assignment, recompute progress.
  if (data.assignmentId) {
    await recomputeAssignmentProgress(data.assignmentId);
  }
  return NextResponse.json({ task });
});

export async function recomputeAssignmentProgress(assignmentId: string) {
  const tasks = await db.task.findMany({
    where: { assignmentId },
    select: { status: true },
  });
  if (tasks.length === 0) {
    await db.assignment.update({
      where: { id: assignmentId },
      data: { progress: 0, status: "TODO" },
    });
    return;
  }
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  const progress = Math.round((completed / tasks.length) * 100);
  let status: string = "TODO";
  if (progress === 100) status = "COMPLETED";
  else if (progress > 0) status = "IN_PROGRESS";
  await db.assignment.update({
    where: { id: assignmentId },
    data: { progress, status },
  });
}
