import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { GOAL_TYPE, GOAL_STATUS } from "@/lib/constants";

const goalUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(GOAL_TYPE).optional(),
  target: z.number().min(0).optional(),
  current: z.number().min(0).optional(),
  unit: z.string().max(40).optional(),
  deadline: z.string().optional().nullable(),
  status: z.enum(GOAL_STATUS).optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const goal = await db.goal.findFirst({ where: { id, userId } });
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ goal });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = goalUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.goal.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    const data = parsed.data;
    const deadline = data.deadline === undefined ? undefined : data.deadline ? new Date(data.deadline) : null;
    // Auto-mark as COMPLETED if current >= target
    let status = data.status;
    if (data.current !== undefined && data.target !== undefined && data.current >= data.target) {
      status = "COMPLETED";
    } else if (data.current !== undefined && existing.target && data.current >= existing.target) {
      status = "COMPLETED";
    }
    const updated = await db.goal.update({
      where: { id },
      data: { ...data, deadline, status },
    });
    return NextResponse.json({ goal: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.goal.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    await db.goal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
