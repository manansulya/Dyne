import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const logSchema = z.object({
  habitId: z.string().min(1),
  date: z.string().min(1), // YYYY-MM-DD (interpreted as UTC midnight)
  completed: z.boolean().optional(),
});

// Toggle behavior: if a log exists for [habitId, date], delete it (un-complete).
// Otherwise, create it (mark complete).
export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = logSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const { habitId, date } = parsed.data;
  const habit = await db.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) {
    return NextResponse.json({ error: "Habit not found" }, { status: 404 });
  }
  const dateObj = new Date(date + "T00:00:00.000Z");
  const existing = await db.habitLog.findUnique({
    where: { habitId_date: { habitId, date: dateObj } },
  });
  if (existing) {
    await db.habitLog.delete({ where: { id: existing.id } });
    return NextResponse.json({ completed: false });
  }
  await db.habitLog.create({
    data: {
      habitId,
      userId,
      date: dateObj,
      completed: parsed.data.completed ?? true,
    },
  });
  return NextResponse.json({ completed: true });
});

const listQuerySchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const where: { userId: string; date?: { gte?: Date; lte?: Date } } = { userId };
  if (parsed.data.start) where.date = { gte: new Date(parsed.data.start + "T00:00:00.000Z") };
  if (parsed.data.end) {
    where.date = { ...where.date, lte: new Date(parsed.data.end + "T23:59:59.999Z") };
  }
  const logs = await db.habitLog.findMany({
    where,
    orderBy: { date: "asc" },
    take: 1000,
  });
  return NextResponse.json({ logs });
});
