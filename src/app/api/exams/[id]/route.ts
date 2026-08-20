import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { PRIORITY } from "@/lib/constants";

const examUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  courseId: z.string().optional().nullable(),
  date: z.string().optional(),
  time: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  topics: z.string().max(2000).optional(),
  importance: z.enum(PRIORITY).optional(),
  preparationProgress: z.number().int().min(0).max(100).optional(),
  studyNotes: z.string().max(8000).optional().nullable(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const exam = await db.exam.findFirst({
      where: { id, userId },
      include: {
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
        notes: { orderBy: { updatedAt: "desc" } },
      },
    });
    if (!exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    return NextResponse.json({ exam });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = examUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.exam.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    const data = parsed.data;
    if (data.courseId) {
      const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
      if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
    }
    const date = data.date === undefined ? undefined : new Date(data.date);
    const updated = await db.exam.update({
      where: { id },
      data: { ...data, date },
    });
    return NextResponse.json({ exam: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.exam.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }
    await db.exam.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
