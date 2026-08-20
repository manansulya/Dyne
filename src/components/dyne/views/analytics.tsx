"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  FileText,
  Target as TargetIcon,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { formatDuration } from "@/lib/dates";
import {
  SimpleBarChart,
  SimpleLineChart,
  SimpleDonutChart,
} from "@/components/dyne/simple-charts";

interface Analytics {
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
    byPriority: { LOW: number; MEDIUM: number; HIGH: number; URGENT: number };
    completedByDay: Array<{ date: string; count: number }>;
    completionRate: number;
  };
  study: {
    totalMinutesThisWeek: number;
    minutesByDay: Array<{ date: string; minutes: number }>;
    byCourse: Array<{ id: string; name: string; code: string; color: string; minutes: number }>;
  };
  assignments: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
  };
  goals: {
    total: number;
    active: number;
    completed: number;
    list: Array<{ id: string; title: string; current: number; target: number; unit: string; status: string }>;
  };
  habits: Array<{
    id: string;
    name: string;
    color: string;
    completedThisWeek: number;
    targetPerWeek: number;
    rate: number;
  }>;
  workload: Array<{
    id: string;
    name: string;
    code: string;
    color: string;
    upcomingAssignments: number;
    upcomingExams: number;
    total: number;
  }>;
}

export function AnalyticsView() {
  const { data, isLoading } = useQuery<Analytics>({
    queryKey: ["analytics"],
    queryFn: () => api.get("/api/analytics"),
  });

  if (isLoading) {
    return (
      <ViewContainer>
        <Loading label="Crunching numbers" />
      </ViewContainer>
    );
  }

  if (!data) {
    return (
      <ViewContainer>
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Once you have data, analytics will appear here."
        />
      </ViewContainer>
    );
  }

  const priorityData = [
    { name: "Low", value: data.tasks.byPriority.LOW, color: "#94a3b8" },
    { name: "Medium", value: data.tasks.byPriority.MEDIUM, color: "#f59e0b" },
    { name: "High", value: data.tasks.byPriority.HIGH, color: "#f97316" },
    { name: "Urgent", value: data.tasks.byPriority.URGENT, color: "#ef4444" },
  ];

  const completionRate = data.tasks.completionRate;
  const assignmentCompletionRate = data.assignments.completionRate;
  const studyHoursThisWeek = data.study.totalMinutesThisWeek / 60;

  return (
    <>
      <ViewHeader
        title="Analytics"
        subtitle="Honest metrics from your data. No fabricated numbers — empty states where there's nothing yet."
      />
      <ViewContainer>
        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Tasks completed"
            value={`${data.tasks.completed}/${data.tasks.total}`}
            sub={`${completionRate}% completion`}
            tone="emerald"
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Study this week"
            value={formatDuration(data.study.totalMinutesThisWeek)}
            sub={`${studyHoursThisWeek.toFixed(1)}h total`}
            tone="sky"
          />
          <StatCard
            icon={<FileText className="h-4 w-4" />}
            label="Assignments done"
            value={`${data.assignments.completed}/${data.assignments.total}`}
            sub={`${assignmentCompletionRate}% completion`}
            tone="amber"
          />
          <StatCard
            icon={<TargetIcon className="h-4 w-4" />}
            label="Goals"
            value={`${data.goals.completed}/${data.goals.total}`}
            sub={`${data.goals.active} active`}
            tone="violet"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          {/* Tasks completed last 14 days */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Tasks completed (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.tasks.completedByDay.every((d) => d.count === 0) ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No completed tasks yet"
                  description="Mark tasks as completed to see trends."
                />
              ) : (
                <SimpleBarChart data={data.tasks.completedByDay} height={200} />
              )}
            </CardContent>
          </Card>

          {/* Tasks by priority */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Tasks by priority
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.tasks.total === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No tasks"
                  description="Add tasks to see breakdowns."
                />
              ) : (
                <SimpleDonutChart data={priorityData} height={200} />
              )}
            </CardContent>
          </Card>

          {/* Study minutes last 14 days */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Study time (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.study.minutesByDay.every((d) => d.minutes === 0) ? (
                <EmptyState
                  icon={Clock}
                  title="No study sessions yet"
                  description="Run a focus timer to track your study time."
                />
              ) : (
                <SimpleLineChart data={data.study.minutesByDay} height={200} />
              )}
            </CardContent>
          </Card>

          {/* Study time by course */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Study time by course (30d)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.study.byCourse.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No per-course study time"
                  description="Pick a course when starting a focus timer."
                />
              ) : (
                <div className="space-y-3 py-2">
                  {data.study.byCourse.slice(0, 6).map((c) => {
                    const max = data.study.byCourse[0]?.minutes || 1;
                    const pct = Math.round((c.minutes / max) * 100);
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{c.code || c.name}</span>
                          <span className="text-muted-foreground">{formatDuration(c.minutes)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Course workload */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Course workload
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.workload.length === 0 || data.workload.every((c) => c.total === 0) ? (
                <EmptyState
                  icon={BarChart3}
                  title="No upcoming work"
                  description="Add assignments and exams to see workload."
                />
              ) : (
                <div className="space-y-3 py-2">
                  {data.workload.map((c) => {
                    const max = data.workload[0]?.total || 1;
                    const pct = Math.round((c.total / max) * 100);
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{c.code || c.name}</span>
                          <span className="text-muted-foreground">
                            {c.upcomingAssignments}A · {c.upcomingExams}E
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Habits */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Habits (last 7 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {data.habits.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No habits"
                  description="Add habits to see consistency rates."
                />
              ) : (
                <div className="space-y-3 py-2">
                  {data.habits.map((h) => (
                    <div key={h.id}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{h.name}</span>
                        <span className="text-muted-foreground">
                          {h.completedThisWeek}/{h.targetPerWeek}
                        </span>
                      </div>
                      <Progress value={h.rate} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ViewContainer>
    </>
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
  tone: "emerald" | "sky" | "amber" | "violet";
}) {
  const toneClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  };
  return (
    <Card>
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
