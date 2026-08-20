import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }
  const [
    courses,
    tasks,
    assignments,
    exams,
    notes,
    users,
    communities,
    spaces,
    posts,
  ] = await Promise.all([
    db.course.findMany({
      where: { userId, OR: [{ name: { contains: q } }, { code: { contains: q } }, { professor: { contains: q } }] },
      take: 5,
      select: { id: true, name: true, code: true, color: true, icon: true },
    }),
    db.task.findMany({
      where: { userId, OR: [{ title: { contains: q } }, { description: { contains: q } }] },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        priority: true,
        course: { select: { id: true, name: true, color: true } },
      },
    }),
    db.assignment.findMany({
      where: { userId, title: { contains: q } },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        priority: true,
        course: { select: { id: true, name: true, color: true } },
      },
    }),
    db.exam.findMany({
      where: { userId, OR: [{ title: { contains: q } }, { topics: { contains: q } }] },
      take: 5,
      select: {
        id: true,
        title: true,
        date: true,
        location: true,
        course: { select: { id: true, name: true, color: true } },
      },
    }),
    db.note.findMany({
      where: { userId, OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      take: 5,
      select: {
        id: true,
        title: true,
        updatedAt: true,
        course: { select: { id: true, name: true, color: true } },
      },
    }),
    db.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { email: { contains: q } },
            ],
          },
        ],
      },
      take: 5,
      select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true },
    }),
    db.community.findMany({
      where: { name: { contains: q } },
      take: 5,
      select: { id: true, name: true, description: true, color: true, iconUrl: true },
    }),
    db.space.findMany({
      where: { name: { contains: q } },
      take: 5,
      select: { id: true, name: true, description: true, color: true, iconUrl: true, inviteCode: true },
    }),
    db.post.findMany({
      where: {
        AND: [
          {
            OR: [
              { community: { members: { some: { userId } } } },
              { authorId: userId },
            ],
          },
          { title: { contains: q } },
        ],
      },
      take: 5,
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        community: { select: { id: true, name: true, color: true, iconUrl: true } },
      },
    }),
  ]);
  const results: Array<{
    type:
      | "course"
      | "task"
      | "assignment"
      | "exam"
      | "note"
      | "user"
      | "community"
      | "space"
      | "post";
    id: string;
    title: string;
    subtitle?: string;
    color?: string;
    icon?: string | null;
    meta?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
    inviteCode?: string;
  }> = [];
  for (const c of courses) {
    results.push({
      type: "course",
      id: c.id,
      title: c.name,
      subtitle: c.code,
      color: c.color,
      icon: c.icon,
    });
  }
  for (const t of tasks) {
    results.push({
      type: "task",
      id: t.id,
      title: t.title,
      subtitle: t.course?.name,
      color: t.course?.color,
      meta: t.status,
    });
  }
  for (const a of assignments) {
    results.push({
      type: "assignment",
      id: a.id,
      title: a.title,
      subtitle: a.course?.name,
      color: a.course?.color,
      meta: a.status,
    });
  }
  for (const e of exams) {
    results.push({
      type: "exam",
      id: e.id,
      title: e.title,
      subtitle: e.course?.name,
      color: e.course?.color,
      meta: e.date.toISOString(),
    });
  }
  for (const n of notes) {
    results.push({
      type: "note",
      id: n.id,
      title: n.title,
      subtitle: n.course?.name,
      color: n.course?.color,
    });
  }
  for (const u of users) {
    results.push({
      type: "user",
      id: u.id,
      title: u.name || u.username || "User",
      subtitle: u.username ? `@${u.username}` : undefined,
      avatarUrl: u.avatarUrl,
      isOnline: u.isOnline,
    });
  }
  for (const c of communities) {
    results.push({
      type: "community",
      id: c.id,
      title: c.name,
      subtitle: c.description ?? undefined,
      color: c.color,
    });
  }
  for (const s of spaces) {
    results.push({
      type: "space",
      id: s.id,
      title: s.name,
      subtitle: s.description ?? undefined,
      color: s.color,
      inviteCode: s.inviteCode,
    });
  }
  for (const p of posts) {
    results.push({
      type: "post",
      id: p.id,
      title: p.title,
      subtitle: p.community.name,
      color: p.community.color,
    });
  }
  return NextResponse.json({ results });
});
