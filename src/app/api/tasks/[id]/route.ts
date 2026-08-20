import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { PRIORITY, TASK_STATUS } from "@/lib/constants";
import { recomputeAssignmentProgress } from "@/app/api/tasks/route";

const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional().nullable(),
  courseId: z.string().optional().nullable(),
  assignmentId: z.string().optional().nullable(),
  status: z.enum(TASK_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  dueDate: z.string().optional().nullable(),
  dueTime: z.string().optional().nullable(),
  estimatedDuration: z.number().int().min(0).max(1440).optional().nullable(),
  tags: z.string().max(500).optional(),
  order: z.number().int().optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const task = await db.task.findFirst({
      where: { id, userId },
      include: {
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
        assignment: { select: { id: true, title: true } },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    return NextResponse.json({ task });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = taskUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.task.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
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
    const dueDate = data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null;
    const updated = await db.task.update({
      where: { id },
      data: { ...data, dueDate },
    });
    // Recompute progress for the old and/or new assignment.
    if (existing.assignmentId) {
      await recomputeAssignmentProgress(existing.assignmentId);
    }
    if (data.assignmentId && data.assignmentId !== existing.assignmentId) {
      await recomputeAssignmentProgress(data.assignmentId);
    }
    return NextResponse.json({ task: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.task.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    await db.task.delete({ where: { id } });
    if (existing.assignmentId) {
      await recomputeAssignmentProgress(existing.assignmentId);
    }
    return NextResponse.json({ ok: true });
  }
);
