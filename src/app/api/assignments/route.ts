import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { ASSIGNMENT_STATUS, PRIORITY } from "@/lib/constants";

const assignmentCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(8000).optional().nullable(),
  courseId: z.string().optional().nullable(),
  dueDate: z.string().min(1, "Due date is required"),
  dueTime: z.string().optional().nullable(),
  status: z.enum(ASSIGNMENT_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  estimatedEffort: z.number().int().min(0).max(1440).optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
});

const assignmentListQuerySchema = z.object({
  courseId: z.string().optional(),
  status: z.enum(ASSIGNMENT_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  upcoming: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = assignmentListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams)
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const where: {
    userId: string;
    courseId?: string;
    status?: string;
    priority?: string;
    dueDate?: { gte: Date };
  } = { userId };
  if (q.courseId) where.courseId = q.courseId;
  if (q.status) where.status = q.status;
  if (q.priority) where.priority = q.priority;
  if (q.upcoming === "1") where.dueDate = { gte: new Date() };

  const assignments = await db.assignment.findMany({
    where,
    orderBy: { dueDate: "asc" },
    take: q.limit ?? 500,
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      _count: { select: { tasks: true } },
    },
  });
  return NextResponse.json({ assignments });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = assignmentCreateSchema.safeParse(body);
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
  const dueDate = new Date(data.dueDate);
  const assignment = await db.assignment.create({
    data: {
      userId,
      title: data.title,
      description: data.description ?? null,
      courseId: data.courseId ?? null,
      dueDate,
      dueTime: data.dueTime ?? null,
      status: data.status ?? "TODO",
      priority: data.priority ?? "MEDIUM",
      estimatedEffort: data.estimatedEffort ?? null,
      progress: data.progress ?? 0,
    },
  });
  return NextResponse.json({ assignment });
});
