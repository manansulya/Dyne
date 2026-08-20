import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { HABIT_COLORS } from "@/lib/constants";

const habitCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(1000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  frequency: z.string().max(20).optional(),
  targetPerWeek: z.number().int().min(1).max(7).optional(),
});

export const GET = withUserId(async (userId) => {
  const habits = await db.habit.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      habitLogs: {
        orderBy: { date: "desc" },
        take: 60,
      },
    },
  });
  return NextResponse.json({ habits });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = habitCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const habit = await db.habit.create({
    data: {
      userId,
      name: data.name,
      description: data.description ?? null,
      color: data.color ?? HABIT_COLORS[Math.floor(Math.random() * HABIT_COLORS.length)],
      frequency: data.frequency ?? "DAILY",
      targetPerWeek: data.targetPerWeek ?? 7,
    },
  });
  return NextResponse.json({ habit });
});
