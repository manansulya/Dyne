import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  isToday,
  isThisWeek,
} from "date-fns";
import { expandEventInstances } from "@/lib/dates";

export const GET = withUserId(async (userId) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const next7DaysEnd = endOfDay(addDays(now, 7));

  // User basics
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, institution: true, semesterName: true },
  });

  // Tasks
  const allTasks = await db.task.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      dueTime: true,
      courseId: true,
      assignmentId: true,
      estimatedDuration: true,
      createdAt: true,
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
      assignment: { select: { id: true, title: true } },
    },
  });
  const todaysTasks = allTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate);
    return d >= todayStart && d <= todayEnd;
  });
  const overdueTasks = allTasks.filter(
    (t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate).getTime() < todayStart.getTime()
  );
  const tasksCompletedToday = allTasks.filter(
    (t) => t.status === "COMPLETED" // approximation: completed tasks count
  ).length;
  const tasksCompletedThisWeek = allTasks.filter((t) => t.status === "COMPLETED").length;

  // Assignments
  const assignments = await db.assignment.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      dueDate: true,
      dueTime: true,
      status: true,
      priority: true,
      progress: true,
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
    },
    orderBy: { dueDate: "asc" },
  });
  const upcomingAssignments = assignments.filter(
    (a) => a.status !== "COMPLETED" && new Date(a.dueDate) >= now && new Date(a.dueDate) <= next7DaysEnd
  );
  const overdueAssignments = assignments.filter(
    (a) => a.status !== "COMPLETED" && new Date(a.dueDate).getTime() < now.getTime()
  );
  const dueSoonAssignments = assignments.filter(
    (a) => a.status !== "COMPLETED" && new Date(a.dueDate) >= now && new Date(a.dueDate) <= tomorrowEnd
  );

  // Exams
  const exams = await db.exam.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      date: true,
      time: true,
      location: true,
      importance: true,
      preparationProgress: true,
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
    },
    orderBy: { date: "asc" },
  });
  const upcomingExams = exams.filter((e) => new Date(e.date).getTime() >= todayStart.getTime());

  // Events (today + next 7 days)
  const eventsRaw = await db.event.findMany({
    where: {
      userId,
      OR: [
        { startDate: { gte: subDays(todayStart, 1), lte: next7DaysEnd } },
        { endDate: { gte: subDays(todayStart, 1), lte: next7DaysEnd } },
      ],
    },
    include: {
      course: { select: { id: true, name: true, code: true, color: true, icon: true } },
    },
  });
  const rangeStart = subDays(todayStart, 1);
  const rangeEnd = next7DaysEnd;
  const expandedEvents: Array<{
    id: string;
    instanceId: string;
    title: string;
    type: string;
    startDate: Date;
    endDate: Date;
    location: string | null;
    description: string | null;
    recurrence: string | null;
    course: { id: string; name: string; code: string; color: string; icon: string | null } | null;
  }> = [];
  for (const ev of eventsRaw) {
    const instances = expandEventInstances(ev, rangeStart, rangeEnd);
    for (const inst of instances) {
      expandedEvents.push({
        id: ev.id,
        instanceId: `${ev.id}-${inst.startDate.toISOString()}`,
        title: ev.title,
        type: ev.type,
        startDate: inst.startDate,
        endDate: inst.endDate,
        location: ev.location ?? null,
        description: ev.description ?? null,
        recurrence: ev.recurrence ?? null,
        course: ev.course
          ? {
              id: ev.course.id,
              name: ev.course.name,
              code: ev.course.code,
              color: ev.course.color,
              icon: ev.course.icon ?? null,
            }
          : null,
      });
    }
  }
  expandedEvents.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const todaysEvents = expandedEvents.filter(
    (e) => e.startDate >= todayStart && e.startDate <= todayEnd
  );

  // Goals progress (active)
  const goals = await db.goal.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });

  // Study sessions this week
  const studySessions = await db.studySession.findMany({
    where: { userId, startTime: { gte: weekStart, lte: weekEnd } },
    select: { duration: true, courseId: true, startTime: true },
  });
  const studyMinutesThisWeek = studySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  const studyMinutesToday = studySessions
    .filter((s) => isToday(new Date(s.startTime)))
    .reduce((acc, s) => acc + (s.duration || 0), 0);

  // Habits (today)
  const habits = await db.habit.findMany({
    where: { userId },
    include: {
      habitLogs: { where: { date: { gte: todayStart, lte: todayEnd } } },
    },
  });
  const habitsCompletedToday = habits.filter((h) => h.habitLogs.length > 0).length;

  // Courses summary
  const courses = await db.course.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      icon: true,
      _count: { select: { assignments: true, exams: true, tasks: true } },
    },
  });

  // Notifications
  const notifications = await db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  // Stats summary
  const stats = {
    tasksCompletedToday,
    tasksCompletedThisWeek,
    overdueTasksCount: overdueTasks.length,
    overdueAssignmentsCount: overdueAssignments.length,
    upcomingAssignmentsCount: upcomingAssignments.length,
    upcomingExamsCount: upcomingExams.length,
    studyMinutesThisWeek,
    studyMinutesToday,
    habitsCompletedToday,
    habitsTotal: habits.length,
  };

  return NextResponse.json({
    user,
    stats,
    todaysTasks,
    overdueTasks,
    todaysEvents,
    upcomingAssignments,
    overdueAssignments,
    dueSoonAssignments,
    upcomingExams,
    goals,
    courses,
    notifications,
    unreadNotifications,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });
});
