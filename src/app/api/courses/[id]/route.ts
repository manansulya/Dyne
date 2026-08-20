import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const updateCourseSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: z.string().max(40).optional(),
  professor: z.string().max(120).optional().nullable(),
  semesterId: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().optional(),
  location: z.string().max(200).optional().nullable(),
  credits: z.number().min(0).max(20).optional().nullable(),
  syllabus: z.string().optional().nullable(),
});

export const GET = withUserId(async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const course = await db.course.findFirst({
    where: { id, userId },
    include: {
      assignments: {
        orderBy: { dueDate: "asc" },
        include: { _count: { select: { tasks: true } } },
      },
      exams: { orderBy: { date: "asc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { updatedAt: "desc" } },
      events: { orderBy: { startDate: "asc" } },
      studySessions: { orderBy: { startTime: "desc" } },
      semester: true,
    },
  });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  return NextResponse.json({ course });
});

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = updateCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.course.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    const updated = await db.course.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ course: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.course.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }
    await db.course.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
