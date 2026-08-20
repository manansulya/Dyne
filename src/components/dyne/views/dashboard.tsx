"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  TrendingUp,
  Target as TargetIcon,
  Calendar as CalendarIcon,
  ArrowRight,
  Flame,
  GraduationCap,
  FileText,
  Loader2,
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { dueLabel, dueLabelWithTime, formatDuration, toDate } from "@/lib/dates";
import { PriorityChip, StatusChip } from "@/components/dyne/chips";
import { CoursePill } from "@/components/dyne/course-pill";
import { ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useEffect } from "react";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  dueTime: string | null;
  courseId: string | null;
  assignmentId: string | null;
  estimatedDuration: number | null;
  course?: { id: string; name: string; code: string; color: string; icon: string | null } | null;
  assignment?: { id: string; title: string } | null;
}

interface DashboardData {
  user: { name: string | null; email: string; institution: string | null } | null;
  stats: {
    tasksCompletedToday: number;
    tasksCompletedThisWeek: number;
    overdueTasksCount: number;
    overdueAssignmentsCount: number;
    upcomingAssignmentsCount: number;
    upcomingExamsCount: number;
    studyMinutesThisWeek: number;
    studyMinutesToday: number;
    habitsCompletedToday: number;
    habitsTotal: number;
  };
  todaysTasks: Task[];
  overdueTasks: Task[];
  todaysEvents: Array<{
    id: string;
    instanceId: string;
    title: string;
    type: string;
    startDate: string;
    endDate: string;
    location: string | null;
    course: { id: string; name: string; code: string; color: string; icon: string | null } | null;
  }>;
  upcomingAssignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    dueTime: string | null;
    status: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    progress: number;
    course: { id: string; name: string; code: string; color: string; icon: string | null } | null;
  }>;
  overdueAssignments: Array<{ id: string; title: string; dueDate: string }>;
  dueSoonAssignments: Array<{ id: string; title: string; dueDate: string }>;
  upcomingExams: Array<{
    id: string;
    title: string;
    date: string;
    time: string | null;
    location: string | null;
    importance: string;
    preparationProgress: number;
    course: { id: string; name: string; code: string; color: string; icon: string | null } | null;
  }>;
  goals: Array<{
    id: string;
    title: string;
    target: number;
    current: number;
    unit: string;
    deadline: string | null;
    status: string;
  }>;
  courses: Array<{
    id: string;
    name: string;
    code: string;
    color: string;
    icon: string | null;
    _count: { assignments: number; exams: number; tasks: number };
  }>;
  notifications: Array<{ id: string; title: string; read: boolean }>;
  unreadNotifications: number;
  weekStart: string;
  weekEnd: string;
}

export function DashboardView() {
  const { setView, setQuickAddOpen, openAssignment, openExam } = useAppStore();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard"),
    refetchInterval: 60 * 1000,
  });

  const toggleTask = useMutation({
    mutationFn: async ({ id, complete }: { id: string; complete: boolean }) => {
      return api.patch(`/api/tasks/${id}`, { status: complete ? "COMPLETED" : "TODO" });
    },
    onMutate: async ({ id, complete }) => {
      await qc.cancelQueries({ queryKey: ["dashboard"] });
      const prev = qc.getQueryData<DashboardData>(["dashboard"]);
      if (prev) {
        qc.setQueryData<DashboardData>(["dashboard"], {
          ...prev,
          todaysTasks: prev.todaysTasks.map((t) =>
            t.id === id ? { ...t, status: complete ? "COMPLETED" : "TODO" } : t
          ),
        });
      }
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["dashboard"], ctx.prev);
      toast.error("Could not update task. Please try again.");
    },
  });

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }

  if (isLoading || !data) {
    return (
      <div>
        <ViewContainer>
          <Loading label="Loading dashboard" />
        </ViewContainer>
      </div>
    );
  }

  const stats = data.stats;

  return (
    <div>
      <ViewContainer>
        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            {greeting()}{data.user?.name ? `, ${data.user.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            {data.user?.institution ? ` · ${data.user.institution}` : ""}
          </p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Tasks completed today"
            value={stats.tasksCompletedToday}
            sub={`${stats.tasksCompletedThisWeek} this week`}
            tone="emerald"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Study time this week"
            value={formatDuration(stats.studyMinutesThisWeek)}
            sub={`${formatDuration(stats.studyMinutesToday)} today`}
            tone="sky"
          />
          <StatCard
            icon={<AlertCircle className="h-4 w-4" />}
            label="Overdue work"
            value={`${stats.overdueTasksCount + stats.overdueAssignmentsCount}`}
            sub={`${stats.overdueTasksCount} tasks · ${stats.overdueAssignmentsCount} assignments`}
            tone={stats.overdueTasksCount + stats.overdueAssignmentsCount > 0 ? "rose" : "emerald"}
          />
          <StatCard
            icon={<Flame className="h-4 w-4" />}
            label="Habits today"
            value={`${stats.habitsCompletedToday}/${stats.habitsTotal}`}
            sub="Stay on streak"
            tone="amber"
          />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button size="sm" onClick={() => setQuickAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New task
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("assignments")}>
            <FileText className="h-4 w-4 mr-1" /> New assignment
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("courses")}>
            <Plus className="h-4 w-4 mr-1" /> New course
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("calendar")}>
            <Plus className="h-4 w-4 mr-1" /> New event
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView("study")}>
            <Flame className="h-4 w-4 mr-1" /> Start study session
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Today column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Overdue tasks */}
            {data.overdueTasks.length > 0 && (
              <Card className="border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500" />
                    Overdue
                    <Badge variant="outline" className="text-rose-600 dark:text-rose-400">
                      {data.overdueTasks.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {data.overdueTasks.slice(0, 5).map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={(c) => toggleTask.mutate({ id: t.id, complete: c })}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Today's tasks */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Today's Tasks
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setView("tasks")}
                  >
                    View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {data.todaysTasks.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p className="mb-3 font-medium text-foreground">No tasks due today.</p>
                    <Button size="sm" variant="outline" onClick={() => setQuickAddOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Add a task
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data.todaysTasks.slice(0, 8).map((t) => (
                      <TaskRow
                        key={t.id}
                        task={t}
                        onToggle={(c) => toggleTask.mutate({ id: t.id, complete: c })}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Today's schedule */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    Today's Schedule
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setView("calendar")}
                  >
                    Open calendar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {data.todaysEvents.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p>Nothing scheduled for today.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.todaysEvents.map((e) => {
                      const start = new Date(e.startDate);
                      const end = new Date(e.endDate);
                      return (
                        <button
                          key={e.instanceId}
                          onClick={() => e.course && useAppStore.getState().openCourse(e.course!.id)}
                          className="flex items-center gap-3 w-full text-left hover:bg-muted/40 px-2 py-2 rounded-md transition-colors"
                        >
                          <div className="text-xs font-mono w-12 shrink-0">
                            {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div
                            className="h-9 w-1 rounded-full shrink-0"
                            style={{ backgroundColor: e.course?.color || "#94a3b8" }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {e.title}
                            </div>
                            {e.location && (
                              <div className="text-xs text-muted-foreground">
                                {e.location}
                              </div>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upcoming assignments */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Upcoming Assignments
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setView("assignments")}
                  >
                    View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {data.upcomingAssignments.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <p>No upcoming assignments.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.upcomingAssignments.slice(0, 5).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => openAssignment(a.id)}
                        className="flex items-center gap-3 w-full text-left hover:bg-muted/40 px-2 py-2 rounded-md transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{a.title}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <CoursePill course={a.course} />
                            <span className="text-xs text-muted-foreground">
                              {dueLabelWithTime(a.dueDate, a.dueTime)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <PriorityChip priority={a.priority} />
                          <div className="w-20">
                            <Progress value={a.progress} className="h-1.5" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Priority / next exam */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  Next Exam
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {data.upcomingExams.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No upcoming exams.</p>
                ) : (
                  (() => {
                    const e = data.upcomingExams[0];
                    const examDate = new Date(e.date);
                    const daysLeft = Math.ceil(
                      (examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <button
                        onClick={() => openExam(e.id)}
                        className="text-left w-full hover:bg-muted/40 -mx-2 -my-1 px-2 py-1 rounded-md transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <CoursePill course={e.course} />
                        </div>
                        <div className="font-medium text-base">{e.title}</div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {examDate.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                          {e.time ? ` · ${e.time}` : ""}
                          {e.location ? ` · ${e.location}` : ""}
                        </div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">Preparation</span>
                          <span className="text-xs font-medium">
                            {e.preparationProgress}%
                          </span>
                        </div>
                        <Progress value={e.preparationProgress} className="h-1.5" />
                        <div
                          className={`mt-2 text-xs font-medium ${
                            daysLeft <= 3
                              ? "text-rose-500"
                              : daysLeft <= 7
                              ? "text-amber-500"
                              : "text-muted-foreground"
                          }`}
                        >
                          {daysLeft <= 0
                            ? "Today"
                            : daysLeft === 1
                            ? "Tomorrow"
                            : `In ${daysLeft} days`}
                        </div>
                      </button>
                    );
                  })()
                )}
              </CardContent>
            </Card>

            {/* Active goals */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TargetIcon className="h-4 w-4 text-primary" />
                    Active Goals
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setView("goals")}
                  >
                    View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {data.goals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No active goals yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.goals.slice(0, 4).map((g) => {
                      const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                      return (
                        <div key={g.id}>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-medium truncate">{g.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {g.current}/{g.target}{g.unit ? ` ${g.unit}` : ""}
                            </span>
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Courses */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Your Courses
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setView("courses")}
                  >
                    View <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {data.courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">No courses yet.</p>
                ) : (
                  <div className="space-y-1">
                    {data.courses.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => useAppStore.getState().openCourse(c.id)}
                        className="flex items-center gap-2 w-full text-left hover:bg-muted/40 px-2 py-1.5 rounded-md transition-colors"
                      >
                        <div
                          className="h-7 w-1 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {c.code || c.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {c._count.assignments}A · {c._count.exams}E · {c._count.tasks}T
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ViewContainer>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
}: {
  task: Task;
  onToggle: (complete: boolean) => void;
}) {
  const isCompleted = task.status === "COMPLETED";
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && !isCompleted && due.getTime() < Date.now();
  return (
    <div className="flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/40 transition-colors">
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(c) => onToggle(Boolean(c))}
        className="shrink-0"
      />
      <button
        className="flex-1 min-w-0 text-left"
        onClick={() => useAppStore.getState().openAssignment(task.assignment?.id || "")}
        disabled={!task.assignmentId}
      >
        <div
          className={`text-sm truncate ${
            isCompleted ? "line-through text-muted-foreground" : ""
          }`}
        >
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.course && <CoursePill course={task.course} />}
          {due && (
            <span
              className={`text-xs ${
                overdue ? "text-rose-500 font-medium" : "text-muted-foreground"
              }`}
            >
              {dueLabel(due)}
              {task.dueTime ? ` · ${task.dueTime}` : ""}
            </span>
          )}
          {task.estimatedDuration && (
            <span className="text-xs text-muted-foreground">
              · {formatDuration(task.estimatedDuration)}
            </span>
          )}
        </div>
      </button>
      <PriorityChip priority={task.priority} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone: "emerald" | "sky" | "rose" | "amber";
}) {
  const toneClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-7 w-7 rounded-md flex items-center justify-center ${toneClasses[tone]}`}>
            {icon}
          </div>
          <span className="text-xs text-muted-foreground truncate">{label}</span>
        </div>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
