import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const noteUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(50000).optional(),
  courseId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  examId: z.string().optional().nullable(),
  tags: z.string().max(500).optional(),
  pinned: z.boolean().optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const note = await db.note.findFirst({
      where: { id, userId },
      include: {
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
        assignment: { select: { id: true, title: true } },
        exam: { select: { id: true, title: true } },
      },
    });
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    return NextResponse.json({ note });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = noteUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.note.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
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
    const updated = await db.note.update({
      where: { id },
      data,
    });
    return NextResponse.json({ note: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.note.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    await db.note.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
