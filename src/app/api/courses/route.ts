import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUserId, withUserId } from "@/lib/server-auth";
import { COURSE_COLORS } from "@/lib/constants";

const createCourseSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  code: z.string().max(40).default(""),
  professor: z.string().max(120).optional().nullable(),
  semesterId: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().optional(),
  location: z.string().max(200).optional().nullable(),
  credits: z.number().min(0).max(20).optional().nullable(),
  syllabus: z.string().optional().nullable(),
});

export const GET = withUserId(async (userId: string) => {
  const courses = await db.course.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          assignments: true,
          exams: true,
          tasks: true,
          notes: true,
        },
      },
    },
  });
  return NextResponse.json({ courses });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = createCourseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  // Validate semesterId belongs to user if provided
  if (data.semesterId) {
    const sem = await db.semester.findFirst({
      where: { id: data.semesterId, userId },
    });
    if (!sem) {
      return NextResponse.json({ error: "Invalid semester" }, { status: 400 });
    }
  }
  const course = await db.course.create({
    data: {
      userId,
      semesterId: data.semesterId ?? null,
      name: data.name,
      code: data.code,
      professor: data.professor ?? null,
      color: data.color ?? COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)],
      icon: data.icon ?? "BookOpen",
      location: data.location ?? null,
      credits: data.credits ?? null,
      syllabus: data.syllabus ?? null,
    },
  });
  return NextResponse.json({ course });
});
