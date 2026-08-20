"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GraduationCap,
  MoreVertical,
  MapPin,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { PRIORITY, type Priority } from "@/lib/constants";
import { CoursePill } from "@/components/dyne/course-pill";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface Exam {
  id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  topics: string;
  importance: Priority;
  preparationProgress: number;
  studyNotes: string | null;
  courseId: string | null;
  course?: Course | null;
}

export function ExamsView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const { openExam } = useAppStore();

  const { data, isLoading, isError, refetch } = useQuery<{ exams: Exam[] }>({
    queryKey: ["exams"],
    queryFn: () => api.get("/api/exams"),
  });
  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
  });
  const courses = coursesData?.courses ?? [];
  const exams = data?.exams ?? [];

  const now = Date.now();
  const upcoming = exams.filter((e) => new Date(e.date).getTime() >= now);
  const past = exams.filter((e) => new Date(e.date).getTime() < now);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/exams/${id}`),
    onSuccess: () => {
      toast.success("Exam deleted");
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete exam."),
  });

  return (
    <>
      <ViewHeader
        title="Exams"
        subtitle="Plan ahead — every exam visible far enough in advance to prepare calmly."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New exam
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading exams" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : exams.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={GraduationCap}
                title="No exams yet"
                description="Add upcoming exams to plan your preparation. Each exam links to a course and tracks your preparation progress."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add exam
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Upcoming
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {upcoming.map((e) => (
                    <ExamCard
                      key={e.id}
                      exam={e}
                      onOpen={() => openExam(e.id)}
                      onEdit={() => setEditing(e)}
                      onDelete={() => remove.mutate(e.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Past
                </h2>
                <div className="grid sm:grid-cols-2 gap-4 opacity-60">
                  {past.map((e) => (
                    <ExamCard
                      key={e.id}
                      exam={e}
                      onOpen={() => openExam(e.id)}
                      onEdit={() => setEditing(e)}
                      onDelete={() => remove.mutate(e.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ViewContainer>

      {(creating || editing) && (
        <ExamEditDialog
          exam={editing}
          courses={courses}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ExamCard({
  exam,
  onOpen,
  onEdit,
  onDelete,
}: {
  exam: Exam;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = new Date(exam.date);
  const daysLeft = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return (
    <Card className="hover:dyne-card-shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <div className="font-semibold text-base">{exam.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {date.toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <CoursePill course={exam.course} />
          {exam.time && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> {exam.time}
            </span>
          )}
          {exam.location && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {exam.location}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mb-1 text-xs">
          <span className="text-muted-foreground">Preparation</span>
          <span className="font-medium">
            {exam.preparationProgress}% ·{" "}
            <span
              className={
                daysLeft <= 0
                  ? "text-muted-foreground"
                  : daysLeft <= 3
                  ? "text-rose-500"
                  : daysLeft <= 7
                  ? "text-amber-500"
                  : "text-emerald-500"
              }
            >
              {daysLeft <= 0 ? "Today" : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}
            </span>
          </span>
        </div>
        <Progress value={exam.preparationProgress} className="h-1.5" />
        {exam.topics && (
          <div className="text-xs text-muted-foreground mt-3 line-clamp-2">
            <span className="font-medium text-foreground">Topics: </span>
            {exam.topics}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExamEditDialog({
  exam,
  courses,
  onClose,
}: {
  exam: Exam | null;
  courses: Course[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(exam);
  const [title, setTitle] = useState(exam?.title ?? "");
  const [courseId, setCourseId] = useState<string>(exam?.courseId ?? "__none__");
  const [date, setDate] = useState(exam ? toDateInput(exam.date) : "");
  const [time, setTime] = useState(exam?.time ?? "09:00");
  const [location, setLocation] = useState(exam?.location ?? "");
  const [topics, setTopics] = useState(exam?.topics ?? "");
  const [importance, setImportance] = useState<Priority>(exam?.importance ?? "HIGH");
  const [preparationProgress, setPreparationProgress] = useState(exam?.preparationProgress ?? 0);
  const [studyNotes, setStudyNotes] = useState(exam?.studyNotes ?? "");
  const [loading, setLoading] = useState(false);

  function toDateInput(iso: string) {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!date) {
      toast.error("Exam date is required");
      return;
    }
    setLoading(true);
    const body = {
      title: title.trim(),
      courseId: courseId === "__none__" ? null : courseId,
      date: `${date}T${time || "09:00"}`,
      time: time || null,
      location: location.trim() || null,
      topics: topics.trim(),
      importance,
      preparationProgress,
      studyNotes: studyNotes.trim() || null,
    };
    try {
      if (isEdit && exam) {
        await api.patch(`/api/exams/${exam.id}`, body);
        toast.success("Exam updated");
      } else {
        await api.post("/api/exams", body);
        toast.success("Exam created");
      }
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save exam");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit exam" : "New exam"}</DialogTitle>
          <DialogDescription>
            Add an upcoming exam and track your preparation progress.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="e-title">Title</Label>
            <Input
              id="e-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Midterm Exam"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No course</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                        <span>{c.code || c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Importance</Label>
              <Select value={importance} onValueChange={(v) => setImportance(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="e-date">Date</Label>
              <Input
                id="e-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-time">Time</Label>
              <Input
                id="e-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-loc">Location</Label>
            <Input
              id="e-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Exam Hall A"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-topics">Topics (one per line or comma-separated)</Label>
            <Textarea
              id="e-topics"
              rows={3}
              value={topics}
              onChange={(e) => setTopics(e.target.value)}
              placeholder="Calculus, Series, Applications"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="e-prep">Preparation progress</Label>
              <span className="text-xs font-medium">{preparationProgress}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={preparationProgress}
              onChange={(e) => setPreparationProgress(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-notes">Study notes</Label>
            <Textarea
              id="e-notes"
              rows={3}
              value={studyNotes}
              onChange={(e) => setStudyNotes(e.target.value)}
              placeholder="Key formulas, last-minute reminders…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
