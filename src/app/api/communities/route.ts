import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const createCommunitySchema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(20, "Name must be at most 20 characters")
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Must start with a letter, only letters/numbers/underscores"),
  description: z.string().max(500).optional().nullable(),
  iconUrl: z.string().max(500_000).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  courseId: z.string().optional().nullable(),
});

export const GET = withUserId(async (userId) => {
  // Discover: subscribed + popular + all
  const [mine, popular, all] = await Promise.all([
    db.community.findMany({
      where: { members: { some: { userId } } },
      include: {
        _count: { select: { members: true, posts: true } },
        members: { where: { userId }, select: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.community.findMany({
      orderBy: { members: { _count: "desc" } },
      take: 10,
      include: { _count: { select: { members: true, posts: true } } },
    }),
    db.community.findMany({
      orderBy: { name: "asc" },
      take: 50,
      include: { _count: { select: { members: true, posts: true } } },
    }),
  ]);
  return NextResponse.json({ mine, popular, all });
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = createCommunitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  // Check name uniqueness
  const existing = await db.community.findUnique({ where: { name: data.name } });
  if (existing) {
    return NextResponse.json({ error: "Name already taken" }, { status: 409 });
  }
  // If courseId is provided, ensure the course belongs to this user.
  if (data.courseId) {
    const c = await db.course.findFirst({ where: { id: data.courseId, userId } });
    if (!c) return NextResponse.json({ error: "Invalid course" }, { status: 400 });
  }
  const community = await db.community.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      iconUrl: data.iconUrl ?? null,
      color: data.color ?? "#0d9488",
      createdBy: userId,
      courseId: data.courseId ?? null,
      members: {
        create: { userId, role: "ADMIN" },
      },
    },
    include: { _count: { select: { members: true, posts: true } } },
  });
  return NextResponse.json({ community });
});
