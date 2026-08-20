import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const noteCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().max(50000).optional().default(""),
  courseId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  examId: z.string().optional().nullable(),
  tags: z.string().max(500).optional().default(""),
  pinned: z.boolean().optional(),
});

const noteListQuerySchema = z.object({
  courseId: z.string().optional(),
  assignmentId: z.string().optional(),
  examId: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = noteListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const where: {
    userId: string;
    courseId?: string;
    assignmentId?: string;
    examId?: string;
    OR?: Array<{ title?: { contains: string }; content?: { contains: string } }>;
  } = { userId };
  if (q.courseId) where.courseId = q.courseId;
  if (q.assignmentId) where.assignmentId = q.assignmentId;
  if (q.examId) where.examId = q.examId;
  if (q.q) {
    where.OR = [
      { title: { contains: q.q } },
      { content: { contains: q.q } },
    ];
  }
  const notes = await db.note.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: q.limit ?? 200,
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      assignment: { select: { id: true, title: true } },
      exam: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({ notes });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = noteCreateSchema.safeParse(body);
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
  if (data.assignmentId) {
    const a = await db.assignment.findFirst({ where: { id: data.assignmentId, userId } });
    if (!a) return NextResponse.json({ error: "Invalid assignment" }, { status: 400 });
  }
  if (data.examId) {
    const e = await db.exam.findFirst({ where: { id: data.examId, userId } });
    if (!e) return NextResponse.json({ error: "Invalid exam" }, { status: 400 });
  }
  const note = await db.note.create({
    data: {
      userId,
      title: data.title,
      content: data.content ?? "",
      courseId: data.courseId ?? null,
      assignmentId: data.assignmentId ?? null,
      examId: data.examId ?? null,
      tags: data.tags ?? "",
      pinned: data.pinned ?? false,
    },
  });
  return NextResponse.json({ note });
});
