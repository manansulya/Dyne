"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { useApiMutation, useApiQuery, api } from "@/lib/api-client";
import { PRIORITY, type Priority } from "@/lib/constants";
import { toast } from "sonner";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}

export function QuickAddTaskDialog() {
  const { quickAddOpen, setQuickAddOpen } = useAppStore();
  const { data: coursesData } = useApiQuery<{ courses: Course[] }>("courses", "/api/courses");
  const courses = coursesData?.courses ?? [];
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState<string>("");
  const [dueTime, setDueTime] = useState<string>("23:59");
  const [estimatedDuration, setEstimatedDuration] = useState<number | "">("");
  const [description, setDescription] = useState("");

  const createMutation = useApiMutation<
    {
      title: string;
      courseId?: string | null;
      priority?: Priority;
      dueDate?: string | null;
      dueTime?: string | null;
      estimatedDuration?: number | null;
      description?: string | null;
    },
    { task: { id: string } }
  >("/api/tasks", "POST", {
    successMessage: "Task added",
    invalidate: ["tasks", "dashboard"],
  });

  function reset() {
    setTitle("");
    setCourseId(null);
    setPriority("MEDIUM");
    setDueDate("");
    setDueTime("23:59");
    setEstimatedDuration("");
    setDescription("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Task title is required");
      return;
    }
    // Combine date+time into one dueDate if both provided.
    let finalDueDate: string | null = null;
    if (dueDate) {
      finalDueDate = dueTime ? `${dueDate}T${dueTime}` : `${dueDate}T09:00`;
    }
    await createMutation.mutateAsync({
      title: title.trim(),
      courseId: courseId ?? null,
      priority,
      dueDate: finalDueDate,
      dueTime: dueTime || null,
      estimatedDuration: estimatedDuration === "" ? null : Number(estimatedDuration),
      description: description.trim() || null,
    });
    reset();
    setQuickAddOpen(false);
  }

  return (
    <Dialog open={quickAddOpen} onOpenChange={(open) => { setQuickAddOpen(open); if (!open) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick add task</DialogTitle>
          <DialogDescription>
            Add a task fast. You can attach it to a course, set priority, and a due date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="title">Task</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What do you need to do?"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="course">Course (optional)</Label>
              <Select
                value={courseId ?? "__none__"}
                onValueChange={(v) => setCourseId(v === "__none__" ? null : v)}
              >
                <SelectTrigger id="course">
                  <SelectValue placeholder="No course" />
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
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="priority">
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
              <Label htmlFor="due">Due date</Label>
              <Input
                id="due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dur">Estimated duration (minutes)</Label>
            <Input
              id="dur"
              type="number"
              min={5}
              step={5}
              value={estimatedDuration}
              onChange={(e) => setEstimatedDuration(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g. 60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description (optional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, context, links…"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { reset(); setQuickAddOpen(false); }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
