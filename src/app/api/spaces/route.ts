import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().max(500_000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  courseId: z.string().optional().nullable(),
});

export const GET = withUserId(async (userId) => {
  const spaces = await db.space.findMany({
    where: { members: { some: { userId } } },
    include: {
      _count: { select: { members: true, channels: true } },
      owner: { select: { id: true, name: true, username: true, avatarUrl: true } },
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      channels: { orderBy: { position: "asc" }, take: 50 },
      members: {
        include: {
          user: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ spaces });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.courseId) {
    const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
    if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  }
  // Create space + default "general" text channel + ADMIN membership
  const space = await db.space.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      iconUrl: data.iconUrl ?? null,
      color: data.color ?? "#0d9488",
      ownerId: userId,
      courseId: data.courseId ?? null,
      members: { create: { userId, role: "ADMIN" } },
      channels: {
        create: [
          { name: "general", type: "TEXT", createdById: userId, position: 0 },
          { name: "announcements", type: "TEXT", createdById: userId, position: 1 },
          { name: "study-group", type: "TEXT", createdById: userId, position: 2 },
        ],
      },
    },
    include: { _count: { select: { members: true, channels: true } } },
  });
  return NextResponse.json({ space });
});
