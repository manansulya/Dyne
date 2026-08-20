import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { ASSIGNMENT_STATUS, PRIORITY } from "@/lib/constants";
import { recomputeAssignmentProgress } from "@/app/api/tasks/route";

const assignmentUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(8000).optional().nullable(),
  courseId: z.string().optional().nullable(),
  dueDate: z.string().optional(),
  dueTime: z.string().optional().nullable(),
  status: z.enum(ASSIGNMENT_STATUS).optional(),
  priority: z.enum(PRIORITY).optional(),
  estimatedEffort: z.number().int().min(0).max(1440).optional().nullable(),
  progress: z.number().int().min(0).max(100).optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const assignment = await db.assignment.findFirst({
      where: { id, userId },
      include: {
        course: { select: { id: true, name: true, code: true, color: true, icon: true } },
        tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        notes: { orderBy: { updatedAt: "desc" } },
      },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    return NextResponse.json({ assignment });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = assignmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.assignment.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    const data = parsed.data;
    if (data.courseId) {
      const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
      if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
    }
    const dueDate = data.dueDate === undefined ? undefined : new Date(data.dueDate);
    const updated = await db.assignment.update({
      where: { id },
      data: { ...data, dueDate },
    });
    return NextResponse.json({ assignment: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.assignment.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }
    await db.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);

// Re-export for convenience
export { recomputeAssignmentProgress };
