"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  MoreVertical,
  Calendar as CalendarIcon,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { PriorityChip } from "@/components/dyne/chips";
import { CoursePill } from "@/components/dyne/course-pill";
import { ASSIGNMENT_STATUS, PRIORITY, type AssignmentStatus, type Priority } from "@/lib/constants";
import { dueLabel, dueLabelWithTime, formatDuration } from "@/lib/dates";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface Assignment {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  dueTime: string | null;
  status: AssignmentStatus;
  priority: Priority;
  estimatedEffort: number | null;
  progress: number;
  courseId: string | null;
  course?: Course | null;
  _count?: { tasks: number };
}

export function AssignmentsView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [filterStatus, setFilterStatus] = useState<AssignmentStatus | "ALL">("ALL");
  const [filterCourse, setFilterCourse] = useState<string | "ALL">("ALL");
  const { openAssignment } = useAppStore();

  const { data: assignmentsData, isLoading, isError, refetch } = useQuery<{ assignments: Assignment[] }>({
    queryKey: ["assignments"],
    queryFn: () => api.get("/api/assignments"),
  });
  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
  });
  const courses = coursesData?.courses ?? [];
  const assignments = assignmentsData?.assignments ?? [];

  const filtered = useMemo(() => {
    let out = assignments;
    if (filterStatus !== "ALL") out = out.filter((a) => a.status === filterStatus);
    if (filterCourse !== "ALL") out = out.filter((a) => a.courseId === filterCourse);
    return out;
  }, [assignments, filterStatus, filterCourse]);

  const grouped = useMemo(() => {
    const now = Date.now();
    const overdue: Assignment[] = [];
    const dueSoon: Assignment[] = [];
    const upcoming: Assignment[] = [];
    const completed: Assignment[] = [];
    for (const a of filtered) {
      if (a.status === "COMPLETED") {
        completed.push(a);
        continue;
      }
      const due = new Date(a.dueDate).getTime();
      if (due < now) overdue.push(a);
      else if (due - now < 1000 * 60 * 60 * 24 * 3) dueSoon.push(a);
      else upcoming.push(a);
    }
    overdue.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    dueSoon.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    completed.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    return { overdue, dueSoon, upcoming, completed };
  }, [filtered]);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/assignments/${id}`),
    onSuccess: () => {
      toast.success("Assignment deleted");
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete assignment."),
  });

  return (
    <>
      <ViewHeader
        title="Assignments"
        subtitle="Track assignments across courses, break them into tasks, and watch progress update automatically."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New assignment
          </Button>
        }
      />
      <ViewContainer>
        <div className="flex flex-wrap gap-2 mb-5">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as AssignmentStatus | "ALL")}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {ASSIGNMENT_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "TODO" ? "To Do" : s === "IN_PROGRESS" ? "In Progress" : "Completed"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {courses.length > 0 && (
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <Loading label="Loading assignments" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : assignments.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={FileText}
                title="No assignments yet"
                description="Add your first assignment. You can attach it to a course and break it down into tasks."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add assignment
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No assignments match your filters.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.overdue.length > 0 && (
              <AssignmentGroup
                title="Overdue"
                accent="rose"
                assignments={grouped.overdue}
                onClick={(a) => openAssignment(a.id)}
                onEdit={(a) => setEditing(a)}
                onDelete={(id) => remove.mutate(id)}
              />
            )}
            {grouped.dueSoon.length > 0 && (
              <AssignmentGroup
                title="Due soon (next 3 days)"
                accent="amber"
                assignments={grouped.dueSoon}
                onClick={(a) => openAssignment(a.id)}
                onEdit={(a) => setEditing(a)}
                onDelete={(id) => remove.mutate(id)}
              />
            )}
            {grouped.upcoming.length > 0 && (
              <AssignmentGroup
                title="Upcoming"
                accent="default"
                assignments={grouped.upcoming}
                onClick={(a) => openAssignment(a.id)}
                onEdit={(a) => setEditing(a)}
                onDelete={(id) => remove.mutate(id)}
              />
            )}
            {grouped.completed.length > 0 && (
              <AssignmentGroup
                title="Completed"
                accent="emerald"
                assignments={grouped.completed}
                onClick={(a) => openAssignment(a.id)}
                onEdit={(a) => setEditing(a)}
                onDelete={(id) => remove.mutate(id)}
              />
            )}
          </div>
        )}
      </ViewContainer>

      {(creating || editing) && (
        <AssignmentEditDialog
          assignment={editing}
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

function AssignmentGroup({
  title,
  accent,
  assignments,
  onClick,
  onEdit,
  onDelete,
}: {
  title: string;
  accent: "default" | "rose" | "amber" | "emerald";
  assignments: Assignment[];
  onClick: (a: Assignment) => void;
  onEdit: (a: Assignment) => void;
  onDelete: (id: string) => void;
}) {
  const accentText = {
    default: "text-muted-foreground",
    rose: "text-rose-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  };
  if (assignments.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarIcon className={`h-4 w-4 ${accentText[accent]}`} />
        <span>{title}</span>
        <Badge variant="outline" className="text-[10px] font-mono">
          {assignments.length}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {assignments.map((a) => (
          <Card key={a.id} className="hover:dyne-card-shadow transition-shadow cursor-pointer group">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <button onClick={() => onClick(a)} className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-base group-hover:text-primary transition-colors">
                    {a.title}
                  </div>
                  {a.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {a.description}
                    </div>
                  )}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1" aria-label="Options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onClick(a)}>
                      <ChevronRight className="h-3.5 w-3.5 mr-2" /> Open
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(a)}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(a.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <CoursePill course={a.course} />
                <PriorityChip priority={a.priority} />
                <span
                  className={`text-xs ${
                    accent === "rose" ? "text-rose-500 font-medium" : "text-muted-foreground"
                  }`}
                >
                  {dueLabelWithTime(a.dueDate, a.dueTime)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Progress value={a.progress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground w-9 text-right">{a.progress}%</span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                {typeof a._count?.tasks === "number" && (
                  <span className="flex items-center gap-1">
                    <ListChecks className="h-3 w-3" /> {a._count.tasks} tasks
                  </span>
                )}
                {a.estimatedEffort && (
                  <span>· {formatDuration(a.estimatedEffort)}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AssignmentEditDialog({
  assignment,
  courses,
  onClose,
}: {
  assignment: Assignment | null;
  courses: Course[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(assignment);
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [description, setDescription] = useState(assignment?.description ?? "");
  const [courseId, setCourseId] = useState<string>(assignment?.courseId ?? "__none__");
  const [priority, setPriority] = useState<Priority>(assignment?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<AssignmentStatus>(assignment?.status ?? "TODO");
  const [dueDate, setDueDate] = useState(assignment ? toDateInput(assignment.dueDate) : "");
  const [dueTime, setDueTime] = useState(assignment?.dueTime ?? "23:59");
  const [estimatedEffort, setEstimatedEffort] = useState<string>(
    assignment?.estimatedEffort ? String(assignment.estimatedEffort) : ""
  );
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
    if (!dueDate) {
      toast.error("Due date is required");
      return;
    }
    setLoading(true);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      courseId: courseId === "__none__" ? null : courseId,
      priority,
      status,
      dueDate: `${dueDate}T${dueTime || "23:59"}`,
      dueTime: dueTime || null,
      estimatedEffort: estimatedEffort === "" ? null : Number(estimatedEffort),
    };
    try {
      if (isEdit && assignment) {
        await api.patch(`/api/assignments/${assignment.id}`, body);
        toast.success("Assignment updated");
      } else {
        await api.post("/api/assignments", body);
        toast.success("Assignment created");
      }
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save assignment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit assignment" : "New assignment"}</DialogTitle>
          <DialogDescription>
            Assignments are linked to courses and can be broken into tasks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="a-title">Title</Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-desc">Description</Label>
            <Textarea
              id="a-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
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
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AssignmentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "TODO" ? "To Do" : s === "IN_PROGRESS" ? "In Progress" : "Completed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-effort">Estimated effort (min)</Label>
              <Input
                id="a-effort"
                type="number"
                min={5}
                step={5}
                value={estimatedEffort}
                onChange={(e) => setEstimatedEffort(e.target.value)}
                placeholder="120"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="a-date">Due date</Label>
              <Input
                id="a-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-time">Time</Label>
              <Input
                id="a-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
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
