import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const habitUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  frequency: z.string().max(20).optional(),
  targetPerWeek: z.number().int().min(1).max(7).optional(),
});

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const habit = await db.habit.findFirst({
      where: { id, userId },
      include: { habitLogs: { orderBy: { date: "desc" }, take: 200 } },
    });
    if (!habit) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    return NextResponse.json({ habit });
  }
);

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = habitUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const existing = await db.habit.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    const updated = await db.habit.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ habit: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const existing = await db.habit.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }
    await db.habit.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
