"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  FileText,
  GraduationCap,
  CheckSquare,
  StickyNote,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
} from "lucide-react";
import { CourseIcon } from "@/components/dyne/course-icon";
import { PriorityChip, StatusChip } from "@/components/dyne/chips";
import { dueLabelWithTime, formatDuration, format } from "@/lib/dates";
import { useAppStore } from "@/store/app-store";
import { Loading, EmptyState } from "@/components/dyne/states";
import { Badge } from "@/components/ui/badge";

interface CourseDetail {
  id: string;
  name: string;
  code: string;
  professor: string | null;
  color: string;
  icon: string | null;
  location: string | null;
  credits: number | null;
  syllabus: string | null;
  semester: { id: string; name: string } | null;
  assignments: Array<{
    id: string;
    title: string;
    dueDate: string;
    dueTime: string | null;
    status: string;
    priority: string;
    progress: number;
    _count: { tasks: number };
  }>;
  exams: Array<{
    id: string;
    title: string;
    date: string;
    time: string | null;
    location: string | null;
    importance: string;
    preparationProgress: number;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    dueTime: string | null;
  }>;
  notes: Array<{ id: string; title: string; content: string; updatedAt: string; pinned: boolean }>;
  events: Array<{
    id: string;
    title: string;
    type: string;
    startDate: string;
    endDate: string;
    location: string | null;
    recurrence: string | null;
  }>;
  studySessions: Array<{ id: string; startTime: string; duration: number; focusStatus: string }>;
}

export function CourseDetailDialog() {
  const { openCourseId, closeCourse, openAssignment, openExam, openNote } = useAppStore();
  const open = Boolean(openCourseId);
  const { data, isLoading } = useQuery<{ course: CourseDetail }>({
    queryKey: ["course", openCourseId],
    queryFn: () => api.get(`/api/courses/${openCourseId}`),
    enabled: Boolean(openCourseId),
  });

  const course = data?.course;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeCourse()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="flex items-center gap-3">
            {course && (
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${course.color}1a`, color: course.color }}
              >
                <CourseIcon name={course.icon} className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="text-lg">{course?.name || "Loading…"}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {course?.code}{course?.professor ? ` · ${course.professor}` : ""}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        {isLoading || !course ? (
          <Loading />
        ) : (
          <Tabs defaultValue="overview" className="flex flex-col max-h-[70vh]">
            <div className="px-5 pt-3 border-b">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="assignments">Assignments ({course.assignments.length})</TabsTrigger>
                <TabsTrigger value="exams">Exams ({course.exams.length})</TabsTrigger>
                <TabsTrigger value="tasks">Tasks ({course.tasks.length})</TabsTrigger>
                <TabsTrigger value="notes">Notes ({course.notes.length})</TabsTrigger>
                <TabsTrigger value="schedule">Schedule ({course.events.length})</TabsTrigger>
              </TabsList>
            </div>
            <ScrollArea className="flex-1 max-h-[60vh]">
              <TabsContent value="overview" className="p-5 m-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <Stat label="Assignments" value={course.assignments.length} icon={<FileText className="h-4 w-4" />} />
                  <Stat label="Exams" value={course.exams.length} icon={<GraduationCap className="h-4 w-4" />} />
                  <Stat label="Tasks" value={course.tasks.length} icon={<CheckSquare className="h-4 w-4" />} />
                  <Stat
                    label="Study time"
                    value={formatDuration(
                      course.studySessions.reduce((acc, s) => acc + (s.duration || 0), 0)
                    )}
                    icon={<Clock className="h-4 w-4" />}
                  />
                </div>
                <div className="space-y-3">
                  {course.location && (
                    <DetailRow icon={<MapPin className="h-4 w-4" />} label="Location" value={course.location} />
                  )}
                  {course.credits !== null && (
                    <DetailRow icon={<User className="h-4 w-4" />} label="Credits" value={String(course.credits)} />
                  )}
                  {course.semester && (
                    <DetailRow icon={<CalendarIcon className="h-4 w-4" />} label="Semester" value={course.semester.name} />
                  )}
                  {course.syllabus && (
                    <DetailRow icon={<FileText className="h-4 w-4" />} label="Syllabus" value={course.syllabus} multiline />
                  )}
                </div>
              </TabsContent>
              <TabsContent value="assignments" className="p-5 m-0">
                {course.assignments.length === 0 ? (
                  <EmptyState icon={FileText} title="No assignments for this course" />
                ) : (
                  <div className="space-y-2">
                    {course.assignments.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => {
                          closeCourse();
                          openAssignment(a.id);
                        }}
                        className="w-full text-left p-3 rounded-md border hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{a.title}</div>
                          <PriorityChip priority={a.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT"} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span>{dueLabelWithTime(a.dueDate, a.dueTime)}</span>
                          <span>· {a._count.tasks} tasks</span>
                          <span>· {a.progress}% done</span>
                        </div>
                        <Progress value={a.progress} className="h-1 mt-2" />
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="exams" className="p-5 m-0">
                {course.exams.length === 0 ? (
                  <EmptyState icon={GraduationCap} title="No exams for this course" />
                ) : (
                  <div className="space-y-2">
                    {course.exams.map((e) => (
                      <button
                        key={e.id}
                        onClick={() => {
                          closeCourse();
                          openExam(e.id);
                        }}
                        className="w-full text-left p-3 rounded-md border hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{e.title}</div>
                          <PriorityChip priority={e.importance as "LOW" | "MEDIUM" | "HIGH" | "URGENT"} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {format(new Date(e.date), "EEE, MMM d")}{e.time ? ` · ${e.time}` : ""}
                          {e.location ? ` · ${e.location}` : ""}
                          {" · "}{e.preparationProgress}% prepared
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="tasks" className="p-5 m-0">
                {course.tasks.length === 0 ? (
                  <EmptyState icon={CheckSquare} title="No tasks for this course" />
                ) : (
                  <div className="space-y-1">
                    {course.tasks.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className={`text-sm truncate ${t.status === "COMPLETED" ? "line-through text-muted-foreground" : ""}`}>
                            {t.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t.dueDate ? dueLabelWithTime(t.dueDate, t.dueTime) : "No due date"}
                          </div>
                        </div>
                        <StatusChip status={t.status as "TODO" | "IN_PROGRESS" | "COMPLETED"} />
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="notes" className="p-5 m-0">
                {course.notes.length === 0 ? (
                  <EmptyState icon={StickyNote} title="No notes for this course" />
                ) : (
                  <div className="space-y-2">
                    {course.notes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          closeCourse();
                          openNote(n.id);
                        }}
                        className="w-full text-left p-3 rounded-md border hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-sm truncate">{n.title}</div>
                          <span className="text-xs text-muted-foreground">{format(new Date(n.updatedAt), "MMM d")}</span>
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">
                          {n.content || "Empty"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="schedule" className="p-5 m-0">
                {course.events.length === 0 ? (
                  <EmptyState icon={CalendarIcon} title="No scheduled sessions" />
                ) : (
                  <div className="space-y-2">
                    {course.events.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-3 rounded-md border">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{e.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(e.startDate), "EEE h:mm a")}
                            {" – "}
                            {format(new Date(e.endDate), "h:mm a")}
                            {e.recurrence === "WEEKLY" ? " · Weekly" : e.recurrence === "DAILY" ? " · Daily" : ""}
                            {e.location ? ` · ${e.location}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-md bg-muted/60">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={`text-sm ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</div>
      </div>
    </div>
  );
}
