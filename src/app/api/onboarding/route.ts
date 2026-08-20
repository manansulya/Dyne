import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { COURSE_COLORS } from "@/lib/constants";

const onboardingSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  institution: z.string().max(200).optional().nullable(),
  semesterName: z.string().max(120).optional().nullable(),
  semesterStart: z.string().optional().nullable(),
  semesterEnd: z.string().optional().nullable(),
  courses: z.array(
    z.object({
      name: z.string().min(1).max(120),
      code: z.string().max(40).optional().default(""),
      professor: z.string().max(120).optional().nullable(),
      color: z.string().optional(),
      icon: z.string().optional(),
      schedule: z
        .array(
          z.object({
            day: z.number().int().min(0).max(6),
            startTime: z.string(),
            endTime: z.string(),
            location: z.string().optional().nullable(),
          })
        )
        .optional()
        .default([]),
    })
  ).optional().default([]),
  goals: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        target: z.number().min(0),
        unit: z.string().max(40).optional().default(""),
        type: z.string().optional().default("CUSTOM"),
        deadline: z.string().optional().nullable(),
      })
    )
    .optional()
    .default([]),
  habits: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        color: z.string().optional(),
        targetPerWeek: z.number().int().min(1).max(7).optional(),
      })
    )
    .optional()
    .default([]),
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      name: data.name ?? undefined,
      institution: data.institution ?? null,
      semesterName: data.semesterName ?? null,
      onboarded: true,
    },
  });

  let semesterId: string | null = null;
  if (data.semesterStart && data.semesterEnd) {
    const sem = await db.semester.create({
      data: {
        userId,
        name: data.semesterName || "Current Semester",
        startDate: new Date(data.semesterStart),
        endDate: new Date(data.semesterEnd),
      },
    });
    semesterId = sem.id;
  }

  // Create courses + their schedule
  for (let i = 0; i < data.courses.length; i++) {
    const c = data.courses[i];
    const color = c.color ?? COURSE_COLORS[i % COURSE_COLORS.length];
    const course = await db.course.create({
      data: {
        userId,
        semesterId,
        name: c.name,
        code: c.code,
        professor: c.professor ?? null,
        color,
        icon: c.icon ?? "BookOpen",
      },
    });
    // Schedule events
    for (const sch of c.schedule ?? []) {
      const today = new Date();
      today.setDate(today.getDate() - today.getDay() + 1 + sch.day); // this week's day
      const [sh, sm] = sch.startTime.split(":").map((x) => parseInt(x, 10));
      const [eh, em] = sch.endTime.split(":").map((x) => parseInt(x, 10));
      const start = new Date(today);
      start.setHours(sh, sm, 0, 0);
      const end = new Date(today);
      end.setHours(eh, em, 0, 0);
      await db.event.create({
        data: {
          userId,
          courseId: course.id,
          title: `${course.code || course.name}`,
          type: "CLASS",
          startDate: start,
          endDate: end,
          recurrence: "WEEKLY",
          location: sch.location ?? null,
        },
      });
    }
  }

  for (const g of data.goals ?? []) {
    await db.goal.create({
      data: {
        userId,
        title: g.title,
        target: g.target,
        unit: g.unit,
        type: g.type as "STUDY_HOURS" | "TASKS_COMPLETED" | "ATTENDANCE" | "CUSTOM",
        current: 0,
        deadline: g.deadline ? new Date(g.deadline) : null,
        status: "ACTIVE",
      },
    });
  }

  for (const h of data.habits ?? []) {
    await db.habit.create({
      data: {
        userId,
        name: h.name,
        color: h.color,
        targetPerWeek: h.targetPerWeek ?? 7,
        frequency: "DAILY",
      },
    });
  }

  return NextResponse.json({ ok: true, user: updated });
});

export const GET = withUserId(async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      institution: true,
      semesterName: true,
      onboarded: true,
    },
  });
  return NextResponse.json({ user });
});

export const PATCH = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json().catch(() => ({}));
  const data: {
    name?: string;
    institution?: string | null;
    semesterName?: string | null;
    onboarded?: boolean;
  } = {};
  if (typeof body.name === "string") data.name = body.name;
  if (typeof body.institution === "string") data.institution = body.institution;
  if (typeof body.semesterName === "string") data.semesterName = body.semesterName;
  if (typeof body.onboarded === "boolean") data.onboarded = body.onboarded;
  const updated = await db.user.update({ where: { id: userId }, data });
  return NextResponse.json({ user: updated });
});
