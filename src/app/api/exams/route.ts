import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { PRIORITY } from "@/lib/constants";

const examCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  courseId: z.string().optional().nullable(),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  topics: z.string().max(2000).optional().default(""),
  importance: z.enum(PRIORITY).optional(),
  preparationProgress: z.number().int().min(0).max(100).optional(),
  studyNotes: z.string().max(8000).optional().nullable(),
});

const examListQuerySchema = z.object({
  courseId: z.string().optional(),
  upcoming: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = examListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const q = parsed.data;
  const where: { userId: string; courseId?: string; date?: { gte: Date } } = { userId };
  if (q.courseId) where.courseId = q.courseId;
  if (q.upcoming === "1") where.date = { gte: new Date() };

  const exams = await db.exam.findMany({
    where,
    orderBy: { date: "asc" },
    take: q.limit ?? 500,
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
    },
  });
  return NextResponse.json({ exams });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = examCreateSchema.safeParse(body);
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
  const exam = await db.exam.create({
    data: {
      userId,
      title: data.title,
      courseId: data.courseId ?? null,
      date: new Date(data.date),
      time: data.time ?? null,
      location: data.location ?? null,
      topics: data.topics ?? "",
      importance: data.importance ?? "HIGH",
      preparationProgress: data.preparationProgress ?? 0,
      studyNotes: data.studyNotes ?? null,
    },
  });
  return NextResponse.json({ exam });
});
