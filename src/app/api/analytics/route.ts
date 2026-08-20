import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  addDays,
  subDays,
  eachDayOfInterval,
  format,
  isSameDay,
} from "date-fns";

export const GET = withUserId(async (userId) => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = addDays(weekStart, 6);
  const last14Days = eachDayOfInterval({
    start: subDays(now, 13),
    end: now,
  });

  // Tasks completed per day (last 14 days). We approximate by updatedAt for COMPLETED tasks.
  const tasksWithUpdated = await db.task.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      priority: true,
      dueDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const tasksCompletedByDay = last14Days.map((day) => {
    const count = tasksWithUpdated.filter(
      (t) => t.status === "COMPLETED" && isSameDay(new Date(t.updatedAt), day)
    ).length;
    return { date: format(day, "MMM d"), count };
  });

  const tasksByPriority = {
    LOW: tasksWithUpdated.filter((t) => t.priority === "LOW").length,
    MEDIUM: tasksWithUpdated.filter((t) => t.priority === "MEDIUM").length,
    HIGH: tasksWithUpdated.filter((t) => t.priority === "HIGH").length,
    URGENT: tasksWithUpdated.filter((t) => t.priority === "URGENT").length,
  };

  const totalTasks = tasksWithUpdated.length;
  const completedTasks = tasksWithUpdated.filter((t) => t.status === "COMPLETED").length;
  const inProgressTasks = tasksWithUpdated.filter((t) => t.status === "IN_PROGRESS").length;
  const todoTasks = tasksWithUpdated.filter((t) => t.status === "TODO").length;
  const overdueTasks = tasksWithUpdated.filter(
    (t) => t.status !== "COMPLETED" && t.dueDate && new Date(t.dueDate).getTime() < now.getTime()
  ).length;

  // Study sessions (last 14 days)
  const studySessions = await db.studySession.findMany({
    where: { userId, startTime: { gte: subDays(now, 13), lte: now } },
    select: { duration: true, startTime: true, courseId: true, focusStatus: true },
  });
  const studyMinutesByDay = last14Days.map((day) => {
    const minutes = studySessions
      .filter((s) => isSameDay(new Date(s.startTime), day))
      .reduce((acc, s) => acc + (s.duration || 0), 0);
    return { date: format(day, "MMM d"), minutes };
  });
  const totalStudyMinutesThisWeek = studySessions
    .filter((s) => new Date(s.startTime) >= weekStart && new Date(s.startTime) <= weekEnd)
    .reduce((acc, s) => acc + (s.duration || 0), 0);

  // Study time by course
  const courses = await db.course.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      studySessions: {
        where: { startTime: { gte: subDays(now, 30) } },
        select: { duration: true },
      },
    },
  });
  const studyTimeByCourse = courses
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      color: c.color,
      minutes: c.studySessions.reduce((acc, s) => acc + (s.duration || 0), 0),
    }))
    .filter((c) => c.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  // Assignments
  const assignments = await db.assignment.findMany({
    where: { userId },
    select: { status: true, progress: true, dueDate: true },
  });
  const totalAssignments = assignments.length;
  const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length;
  const inProgressAssignments = assignments.filter((a) => a.status === "IN_PROGRESS").length;
  const overdueAssignments = assignments.filter(
    (a) => a.status !== "COMPLETED" && new Date(a.dueDate).getTime() < now.getTime()
  ).length;

  // Goals
  const goals = await db.goal.findMany({
    where: { userId },
    select: { id: true, title: true, current: true, target: true, status: true, type: true, unit: true },
  });
  const goalsActive = goals.filter((g) => g.status === "ACTIVE").length;
  const goalsCompleted = goals.filter((g) => g.status === "COMPLETED").length;

  // Habits (last 7 days completion rate)
  const habits = await db.habit.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      color: true,
      targetPerWeek: true,
      habitLogs: { where: { date: { gte: subDays(now, 6) } }, select: { date: true } },
    },
  });
  const habitsSummary = habits.map((h) => ({
    id: h.id,
    name: h.name,
    color: h.color,
    completedThisWeek: h.habitLogs.length,
    targetPerWeek: h.targetPerWeek,
    rate: h.targetPerWeek > 0 ? Math.min(100, Math.round((h.habitLogs.length / h.targetPerWeek) * 100)) : 0,
  }));

  // Course workload (count of upcoming assignments + exams per course)
  const coursesWorkload = await db.course.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      code: true,
      color: true,
      assignments: {
        where: { status: { not: "COMPLETED" } },
        select: { id: true, dueDate: true },
      },
      exams: {
        where: { date: { gte: now } },
        select: { id: true, date: true },
      },
    },
  });
  const workload = coursesWorkload
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      color: c.color,
      upcomingAssignments: c.assignments.length,
      upcomingExams: c.exams.length,
      total: c.assignments.length + c.exams.length,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  return NextResponse.json({
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      todo: todoTasks,
      overdue: overdueTasks,
      byPriority: tasksByPriority,
      completedByDay: tasksCompletedByDay,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    study: {
      totalMinutesThisWeek: totalStudyMinutesThisWeek,
      minutesByDay: studyMinutesByDay,
      byCourse: studyTimeByCourse,
    },
    assignments: {
      total: totalAssignments,
      completed: completedAssignments,
      inProgress: inProgressAssignments,
      overdue: overdueAssignments,
      completionRate:
        totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0,
    },
    goals: {
      total: goals.length,
      active: goalsActive,
      completed: goalsCompleted,
      list: goals,
    },
    habits: habitsSummary,
    workload,
  });
});
