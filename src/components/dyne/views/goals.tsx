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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Pencil, Trash2, Loader2, Target, MoreVertical, Minus, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { GOAL_TYPE, GOAL_STATUS, type GoalType, type GoalStatus } from "@/lib/constants";
import { dueLabel } from "@/lib/dates";

interface Goal {
  id: string;
  title: string;
  description: string | null;
  type: GoalType;
  target: number;
  current: number;
  unit: string;
  deadline: string | null;
  status: GoalStatus;
  createdAt: string;
}

export function GoalsView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ goals: Goal[] }>({
    queryKey: ["goals"],
    queryFn: () => api.get("/api/goals"),
  });
  const goals = data?.goals ?? [];

  const active = goals.filter((g) => g.status === "ACTIVE");
  const completed = goals.filter((g) => g.status === "COMPLETED");
  const paused = goals.filter((g) => g.status === "PAUSED");

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/goals/${id}`),
    onSuccess: () => {
      toast.success("Goal deleted");
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete goal."),
  });

  const adjust = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) =>
      api.patch(`/api/goals/${id}`, { current: Math.max(0, (goals.find((g) => g.id === id)?.current ?? 0) + delta) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not update goal."),
  });

  return (
    <>
      <ViewHeader
        title="Goals"
        subtitle="Define measurable goals. Update progress as you go — and watch them complete automatically."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New goal
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading goals" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : goals.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Target}
                title="No goals yet"
                description="Set a measurable goal like 'Study 15 hours this week' or 'Read 2 books this month'."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add goal
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {active.length > 0 && (
              <GoalGroup title="Active" goals={active} onEdit={setEditing} onDelete={(id) => remove.mutate(id)} onAdjust={(id, d) => adjust.mutate({ id, delta: d })} />
            )}
            {paused.length > 0 && (
              <GoalGroup title="Paused" goals={paused} onEdit={setEditing} onDelete={(id) => remove.mutate(id)} onAdjust={(id, d) => adjust.mutate({ id, delta: d })} />
            )}
            {completed.length > 0 && (
              <GoalGroup title="Completed" goals={completed} onEdit={setEditing} onDelete={(id) => remove.mutate(id)} onAdjust={(id, d) => adjust.mutate({ id, delta: d })} />
            )}
          </div>
        )}
      </ViewContainer>

      {(creating || editing) && (
        <GoalEditDialog goal={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </>
  );
}

function GoalGroup({
  title,
  goals,
  onEdit,
  onDelete,
  onAdjust,
}: {
  title: string;
  goals: Goal[];
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  onAdjust: (id: string, delta: number) => void;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {title} ({goals.length})
      </h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {goals.map((g) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
          return (
            <Card key={g.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-base truncate">{g.title}</div>
                    {g.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {g.description}
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Options">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => onEdit(g)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(g.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center justify-between gap-2 mb-1 text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">
                    {g.current}/{g.target}
                    {g.unit ? ` ${g.unit}` : ""}
                    {" · "}
                    <span className={pct === 100 ? "text-emerald-500" : ""}>{pct}%</span>
                  </span>
                </div>
                <Progress value={pct} className="h-1.5 mb-3" />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onAdjust(g.id, -1)}
                      aria-label="Decrease"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAdjust(g.id, 1)}
                    >
                      +1 {g.unit || ""}
                    </Button>
                    {g.type === "STUDY_HOURS" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAdjust(g.id, 0.5)}
                      >
                        +0.5h
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {g.deadline && (
                      <span className="text-[10px] text-muted-foreground">
                        {dueLabel(g.deadline)}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      {g.status === "ACTIVE" ? "Active" : g.status === "PAUSED" ? "Paused" : "Done"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function GoalEditDialog({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = Boolean(goal);
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [type, setType] = useState<GoalType>(goal?.type ?? "CUSTOM");
  const [target, setTarget] = useState<string>(goal ? String(goal.target) : "10");
  const [current, setCurrent] = useState<string>(goal ? String(goal.current) : "0");
  const [unit, setUnit] = useState(goal?.unit ?? "");
  const [deadline, setDeadline] = useState(goal?.deadline ? goal.deadline.split("T")[0] : "");
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "ACTIVE");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setLoading(true);
    const body = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      target: Number(target),
      current: Number(current),
      unit: unit.trim(),
      deadline: deadline ? `${deadline}T23:59` : null,
      status,
    };
    try {
      if (isEdit && goal) {
        await api.patch(`/api/goals/${goal.id}`, body);
        toast.success("Goal updated");
      } else {
        await api.post("/api/goals", body);
        toast.success("Goal created");
      }
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save goal");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            Define a measurable goal. Choose a type to enable auto-tracking later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="g-title">Title</Label>
            <Input
              id="g-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Study 15 hours this week"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-desc">Description</Label>
            <Textarea
              id="g-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as GoalType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPE.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === "STUDY_HOURS" ? "Study hours" : t === "TASKS_COMPLETED" ? "Tasks completed" : t === "ATTENDANCE" ? "Attendance" : "Custom"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as GoalStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0) + s.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="g-target">Target</Label>
              <Input
                id="g-target"
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-current">Current</Label>
              <Input
                id="g-current"
                type="number"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-unit">Unit</Label>
              <Input
                id="g-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="hours"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="g-deadline">Deadline</Label>
            <Input
              id="g-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
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
