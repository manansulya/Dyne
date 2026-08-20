import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { GOAL_TYPE, GOAL_STATUS } from "@/lib/constants";

const goalCreateSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(GOAL_TYPE).optional(),
  target: z.number().min(0),
  current: z.number().min(0).optional(),
  unit: z.string().max(40).optional().default(""),
  deadline: z.string().optional().nullable(),
  status: z.enum(GOAL_STATUS).optional(),
});

export const GET = withUserId(async (userId) => {
  const goals = await db.goal.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ goals });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = goalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const deadline = data.deadline ? new Date(data.deadline) : null;
  const goal = await db.goal.create({
    data: {
      userId,
      title: data.title,
      description: data.description ?? null,
      type: data.type ?? "CUSTOM",
      target: data.target,
      current: data.current ?? 0,
      unit: data.unit ?? "",
      deadline,
      status: data.status ?? "ACTIVE",
    },
  });
  return NextResponse.json({ goal });
});
