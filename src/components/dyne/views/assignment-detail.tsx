"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  CheckCircle2,
  Circle,
  Clock,
  CheckSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Loading, EmptyState } from "@/components/dyne/states";
import { PriorityChip } from "@/components/dyne/chips";
import { CoursePill } from "@/components/dyne/course-pill";
import { ASSIGNMENT_STATUS, PRIORITY, type AssignmentStatus, type Priority, type TaskStatus } from "@/lib/constants";
import { dueLabelWithTime, dueLabel, formatDuration } from "@/lib/dates";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface AssignmentDetail {
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
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: Priority;
    dueDate: string | null;
    dueTime: string | null;
    estimatedDuration: number | null;
  }>;
  notes: Array<{ id: string; title: string; content: string; updatedAt: string }>;
}

export function AssignmentDetailDialog() {
  const { openAssignmentId, closeAssignment, openNote } = useAppStore();
  const qc = useQueryClient();
  const open = Boolean(openAssignmentId);
  const { data, isLoading } = useQuery<{ assignment: AssignmentDetail }>({
    queryKey: ["assignment", openAssignmentId],
    queryFn: () => api.get(`/api/assignments/${openAssignmentId}`),
    enabled: Boolean(openAssignmentId),
  });
  const assignment = data?.assignment;

  const [newTaskTitle, setNewTaskTitle] = useState("");

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      return api.patch(`/api/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assignment", openAssignmentId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not update task."),
  });

  const addTask = useMutation({
    mutationFn: async (title: string) => {
      return api.post("/api/tasks", {
        title,
        assignmentId: openAssignmentId,
        courseId: assignment?.courseId ?? null,
        priority: assignment?.priority ?? "MEDIUM",
      });
    },
    onSuccess: () => {
      toast.success("Task added");
      setNewTaskTitle("");
      qc.invalidateQueries({ queryKey: ["assignment", openAssignmentId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not add task."),
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tasks/${id}`),
    onSuccess: () => {
      toast.success("Task removed");
      qc.invalidateQueries({ queryKey: ["assignment", openAssignmentId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete task."),
  });

  const setStatus = useMutation({
    mutationFn: async (status: AssignmentStatus) => {
      return api.patch(`/api/assignments/${openAssignmentId}`, { status });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["assignment", openAssignmentId] });
      qc.invalidateQueries({ queryKey: ["assignments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not update status."),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeAssignment()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>{assignment?.title || "Loading…"}</span>
          </DialogTitle>
          {assignment && (
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              <CoursePill course={assignment.course} />
              <PriorityChip priority={assignment.priority} />
              <span className="text-xs">
                Due {dueLabelWithTime(assignment.dueDate, assignment.dueTime)}
              </span>
              {assignment.estimatedEffort && (
                <span className="text-xs">· {formatDuration(assignment.estimatedEffort)}</span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>
        {isLoading || !assignment ? (
          <Loading />
        ) : (
          <ScrollArea className="flex-1 max-h-[70vh]">
            <div className="p-5 space-y-5">
              {/* Progress block */}
              <div className="p-4 rounded-md bg-muted">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Progress</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {assignment.tasks.filter((t) => t.status === "COMPLETED").length}/{assignment.tasks.length} tasks
                    </Badge>
                    <span className="text-sm font-semibold">{assignment.progress}%</span>
                  </div>
                </div>
                <Progress value={assignment.progress} className="h-2 mb-3" />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Select
                    value={assignment.status}
                    onValueChange={(v) => setStatus.mutate(v as AssignmentStatus)}
                  >
                    <SelectTrigger className="h-7 w-40 text-xs">
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
              </div>

              {assignment.description && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Description
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{assignment.description}</p>
                </div>
              )}

              {/* Tasks */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5" /> Tasks
                  <Badge variant="outline" className="text-[10px]">{assignment.tasks.length}</Badge>
                </h3>
                <div className="space-y-1 mb-3">
                  {assignment.tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">
                      No tasks yet — break this assignment into smaller steps below.
                    </p>
                  )}
                  {assignment.tasks.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/40 group"
                    >
                      <Checkbox
                        checked={t.status === "COMPLETED"}
                        onCheckedChange={(c) =>
                          toggleTask.mutate({
                            taskId: t.id,
                            status: c ? "COMPLETED" : "TODO",
                          })
                        }
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm truncate ${
                            t.status === "COMPLETED" ? "line-through text-muted-foreground" : ""
                          }`}
                        >
                          {t.title}
                        </div>
                        {t.dueDate && (
                          <div className="text-xs text-muted-foreground">
                            {dueLabelWithTime(t.dueDate, t.dueTime)}
                          </div>
                        )}
                      </div>
                      {t.dueDate && (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={() => deleteTask.mutate(t.id)}
                        aria-label="Remove task"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a task…"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newTaskTitle.trim()) addTask.mutate(newTaskTitle.trim());
                      }
                    }}
                  />
                  <Button
                    onClick={() => newTaskTitle.trim() && addTask.mutate(newTaskTitle.trim())}
                    disabled={!newTaskTitle.trim() || addTask.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
                  Notes
                  <Badge variant="outline" className="text-[10px]">{assignment.notes.length}</Badge>
                </h3>
                {assignment.notes.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No notes for this assignment yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {assignment.notes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          closeAssignment();
                          openNote(n.id);
                        }}
                        className="w-full text-left p-3 rounded-md border hover:bg-muted/40"
                      >
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">
                          {n.content || "Empty"}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
