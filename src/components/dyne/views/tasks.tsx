"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Loader2,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { PriorityChip } from "@/components/dyne/chips";
import { CoursePill } from "@/components/dyne/course-pill";
import { PRIORITY, TASK_STATUS, type Priority, type TaskStatus } from "@/lib/constants";
import { dueLabel, dueLabelWithTime, formatDuration, toDate } from "@/lib/dates";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  estimatedDuration: number | null;
  tags: string;
  courseId: string | null;
  assignmentId: string | null;
  course?: Course | null;
  assignment?: { id: string; title: string } | null;
  createdAt: string;
}

export function TasksView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "ALL">("ALL");
  const [filterPriority, setFilterPriority] = useState<Priority | "ALL">("ALL");
  const [filterCourse, setFilterCourse] = useState<string | "ALL">("ALL");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const { setQuickAddOpen } = useAppStore();

  const { data: tasksData, isLoading, isError, refetch } = useQuery<{ tasks: Task[] }>({
    queryKey: ["tasks"],
    queryFn: () => api.get("/api/tasks"),
  });
  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
  });
  const courses = coursesData?.courses ?? [];
  const tasks = tasksData?.tasks ?? [];

  const filtered = useMemo(() => {
    let out = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
      );
    }
    if (filterStatus !== "ALL") out = out.filter((t) => t.status === filterStatus);
    if (filterPriority !== "ALL") out = out.filter((t) => t.priority === filterPriority);
    if (filterCourse !== "ALL") out = out.filter((t) => t.courseId === filterCourse);
    return out;
  }, [tasks, search, filterStatus, filterPriority, filterCourse]);

  // Group by status
  const grouped = useMemo(() => {
    const overdue: Task[] = [];
    const todo: Task[] = [];
    const inProgress: Task[] = [];
    const completed: Task[] = [];
    for (const t of filtered) {
      if (
        t.status !== "COMPLETED" &&
        t.dueDate &&
        new Date(t.dueDate).getTime() < Date.now()
      ) {
        overdue.push(t);
      } else if (t.status === "TODO") todo.push(t);
      else if (t.status === "IN_PROGRESS") inProgress.push(t);
      else if (t.status === "COMPLETED") completed.push(t);
    }
    overdue.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    todo.sort(
      (a, b) =>
        (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) -
        (b.dueDate ? new Date(b.dueDate).getTime() : Infinity)
    );
    completed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return { overdue, todo, inProgress, completed };
  }, [filtered]);

  const toggle = useMutation({
    mutationFn: async ({ task, complete }: { task: Task; complete: boolean }) => {
      return api.patch(`/api/tasks/${task.id}`, {
        status: complete ? "COMPLETED" : "TODO",
      });
    },
    onMutate: async ({ task, complete }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const prev = qc.getQueryData<{ tasks: Task[] }>(["tasks"]);
      if (prev) {
        qc.setQueryData<{ tasks: Task[] }>(["tasks"], {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === task.id ? { ...t, status: complete ? "COMPLETED" : "TODO" } : t
          ),
        });
      }
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
      toast.error("Could not update task.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tasks/${id}`),
    onSuccess: () => {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete task."),
  });

  return (
    <>
      <ViewHeader
        title="Tasks"
        subtitle="Everything you need to do, organized by what's most important."
        actions={
          <>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> New task
            </Button>
          </>
        }
      />
      <ViewContainer>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as TaskStatus | "ALL")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {TASK_STATUS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "TODO" ? "To Do" : s === "IN_PROGRESS" ? "In Progress" : "Completed"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={(v) => setFilterPriority(v as Priority | "ALL")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              {PRIORITY.map((p) => (
                <SelectItem key={p} value={p}>
                  {p.charAt(0) + p.slice(1).toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {courses.length > 0 && (
            <Select value={filterCourse} onValueChange={(v) => setFilterCourse(v)}>
              <SelectTrigger className="w-[180px]">
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
          <Loading label="Loading tasks" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={ListTodo}
                title="No tasks yet"
                description="Add your first task to start planning what you need to do. Tasks can be linked to courses or assignments."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add a task
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No tasks match your filters.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {grouped.overdue.length > 0 && (
              <TaskGroup
                title="Overdue"
                icon={<CalendarIcon className="h-4 w-4 text-rose-500" />}
                tasks={grouped.overdue}
                onToggle={(t, c) => toggle.mutate({ task: t, complete: c })}
                onEdit={(t) => setEditing(t)}
                onDelete={(id) => remove.mutate(id)}
                accent="rose"
              />
            )}
            {grouped.inProgress.length > 0 && (
              <TaskGroup
                title="In Progress"
                icon={<Loader2 className="h-4 w-4 text-sky-500" />}
                tasks={grouped.inProgress}
                onToggle={(t, c) => toggle.mutate({ task: t, complete: c })}
                onEdit={(t) => setEditing(t)}
                onDelete={(id) => remove.mutate(id)}
                accent="sky"
              />
            )}
            <TaskGroup
              title="To Do"
              icon={<Circle className="h-4 w-4 text-muted-foreground" />}
              tasks={grouped.todo}
              onToggle={(t, c) => toggle.mutate({ task: t, complete: c })}
              onEdit={(t) => setEditing(t)}
              onDelete={(id) => remove.mutate(id)}
              accent="default"
            />
            {grouped.completed.length > 0 && (
              <TaskGroup
                title="Completed"
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                tasks={grouped.completed}
                onToggle={(t, c) => toggle.mutate({ task: t, complete: c })}
                onEdit={(t) => setEditing(t)}
                onDelete={(id) => remove.mutate(id)}
                accent="emerald"
                collapsedDefault
              />
            )}
          </div>
        )}
      </ViewContainer>

      {(creating || editing) && (
        <TaskEditDialog
          task={editing}
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

function TaskGroup({
  title,
  icon,
  tasks,
  onToggle,
  onEdit,
  onDelete,
  accent,
  collapsedDefault,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  onToggle: (task: Task, complete: boolean) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  accent: "default" | "rose" | "sky" | "emerald";
  collapsedDefault?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(Boolean(collapsedDefault));
  if (tasks.length === 0) return null;
  return (
    <div>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
      >
        {icon}
        <span>{title}</span>
        <Badge variant="outline" className="text-[10px] font-mono">
          {tasks.length}
        </Badge>
      </button>
      {!collapsed && (
        <div className="space-y-1">
          {tasks.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onToggle={(c) => onToggle(t, c)}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t.id)}
              accent={accent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  accent,
}: {
  task: Task;
  onToggle: (complete: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  accent: "default" | "rose" | "sky" | "emerald";
}) {
  const isCompleted = task.status === "COMPLETED";
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && !isCompleted && due.getTime() < Date.now();
  const accentBorder = {
    default: "",
    rose: "border-l-rose-400 dark:border-l-rose-700",
    sky: "border-l-sky-400 dark:border-l-sky-700",
    emerald: "border-l-emerald-400 dark:border-l-emerald-700",
  };
  return (
    <Card
      className={`border-l-2 ${accentBorder[accent]} ${
        isCompleted ? "opacity-60" : ""
      }`}
    >
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={(c) => onToggle(Boolean(c))}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0">
          <button
            onClick={() => task.assignmentId && useAppStore.getState().openAssignment(task.assignmentId!)}
            disabled={!task.assignmentId}
            className="block text-left w-full"
          >
            <div
              className={`text-sm font-medium truncate ${
                isCompleted ? "line-through text-muted-foreground" : ""
              }`}
            >
              {task.title}
            </div>
            {task.description && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {task.description}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {task.course && <CoursePill course={task.course} />}
              {task.assignment && (
                <Badge variant="outline" className="text-[10px]">
                  ↳ {task.assignment.title}
                </Badge>
              )}
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
        </div>
        <PriorityChip priority={task.priority} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Task options">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function TaskEditDialog({
  task,
  courses,
  onClose,
}: {
  task: Task | null;
  courses: Course[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [courseId, setCourseId] = useState<string>(task?.courseId ?? "__none__");
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "MEDIUM");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "TODO");
  const [dueDate, setDueDate] = useState(task?.dueDate ? toDateInputLocal(task.dueDate) : "");
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [estimatedDuration, setEstimatedDuration] = useState<string>(
    task?.estimatedDuration ? String(task.estimatedDuration) : ""
  );
  const [tags, setTags] = useState(task?.tags ?? "");
  const [loading, setLoading] = useState(false);

  function toDateInputLocal(iso: string) {
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
    setLoading(true);
    let finalDueDate: string | null = null;
    if (dueDate) {
      finalDueDate = `${dueDate}T${dueTime || "09:00"}`;
    }
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      courseId: courseId === "__none__" ? null : courseId,
      priority,
      status,
      dueDate: finalDueDate,
      dueTime: dueTime || null,
      estimatedDuration: estimatedDuration === "" ? null : Number(estimatedDuration),
      tags,
    };
    try {
      if (isEdit && task) {
        await api.patch(`/api/tasks/${task.id}`, body);
        toast.success("Task updated");
      } else {
        await api.post("/api/tasks", body);
        toast.success("Task created");
      }
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save task");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>
            Set the task's details. You can attach it to a course or assignment later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
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
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "TODO" ? "To Do" : s === "IN_PROGRESS" ? "In Progress" : "Completed"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-dur">Estimated (min)</Label>
              <Input
                id="t-dur"
                type="number"
                min={5}
                step={5}
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="60"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-date">Due date</Label>
              <Input
                id="t-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-time">Time</Label>
              <Input
                id="t-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-tags">Tags (comma-separated)</Label>
            <Input
              id="t-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. study, important, revision"
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
