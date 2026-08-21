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
  Repeat,
  MoreVertical,
  Flame,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { HABIT_COLORS } from "@/lib/constants";
import {
  eachDayOfInterval,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  subDays,
} from "date-fns";
import { cn } from "@/lib/utils";

interface Habit {
  id: string;
  name: string;
  description: string | null;
  color: string;
  frequency: string;
  targetPerWeek: number;
  habitLogs: Array<{ id: string; date: string; completed: boolean }>;
}

export function HabitsView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<{ habits: Habit[] }>({
    queryKey: ["habits"],
    queryFn: () => api.get("/api/habits"),
  });
  const habits = data?.habits ?? [];

  const toggle = useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      api.post<{ completed: boolean }>("/api/habit-logs", { habitId: id, date }),
    onSuccess: (res) => {
      toast.success(res.completed ? "Habit completed for today" : "Habit unchecked");
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not update habit."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/habits/${id}`),
    onSuccess: () => {
      toast.success("Habit deleted");
      qc.invalidateQueries({ queryKey: ["habits"] });
    },
    onError: () => toast.error("Could not delete habit."),
  });

  const last7Days = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
  const todayStr = format(new Date(), "yyyy-MM-dd");

  return (
    <>
      <ViewHeader
        title="Habits"
        subtitle="Lightweight habit tracking. Check in daily, see your streaks."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New habit
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading habits" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : habits.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Repeat}
                title="No habits yet"
                description="Track small daily habits like reading, exercise, or revision."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add habit
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Header row: weekday names */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid grid-cols-[1fr_repeat(7,2.5rem)_1.5rem] sm:grid-cols-[1fr_repeat(7,3rem)_2rem]">
                  <div className="px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground border-b">
                    Habit
                  </div>
                  {last7Days.map((d) => (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        "text-center text-[10px] uppercase tracking-wide text-muted-foreground py-2 border-b",
                        isToday(d) && "bg-primary/10 font-semibold text-primary"
                      )}
                    >
                      {format(d, "EEE")}
                      <div className="text-[10px]">{format(d, "d")}</div>
                    </div>
                  ))}
                  <div className="border-b" />
                </div>
                {habits.map((h) => {
                  const week = h.habitLogs.filter((l) => {
                    const d = new Date(l.date);
                    return last7Days.some((ld) => isSameDay(ld, d));
                  });
                  const weekRate = Math.min(100, Math.round((week.length / h.targetPerWeek) * 100));
                  const todayLog = h.habitLogs.find((l) => isSameDay(new Date(l.date), new Date()));
                  return (
                    <div
                      key={h.id}
                      className="grid grid-cols-[1fr_repeat(7,2.5rem)_1.5rem] sm:grid-cols-[1fr_repeat(7,3rem)_2rem] items-stretch border-b last:border-b-0"
                    >
                      <div className="px-4 py-3 flex items-center gap-2 min-w-0">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: h.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{h.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {week.length}/{h.targetPerWeek} this week
                          </div>
                        </div>
                      </div>
                      {last7Days.map((d) => {
                        const dateStr = format(d, "yyyy-MM-dd");
                        const done = week.some((l) => isSameDay(new Date(l.date), d));
                        const isFuture = d > new Date();
                        return (
                          <div key={dateStr} className="flex items-center justify-center">
                            <button
                              disabled={isFuture && !isToday(d)}
                              onClick={() => toggle.mutate({ id: h.id, date: dateStr })}
                              className={cn(
                                "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                                done
                                  ? "text-white"
                                  : "border border-input hover:bg-muted text-transparent",
                                !done && isToday(d) && "border-primary",
                                isFuture && !isToday(d) && "opacity-30 cursor-not-allowed"
                              )}
                              style={done ? { backgroundColor: h.color } : undefined}
                              aria-label={`Toggle ${h.name} on ${dateStr}`}
                            >
                              {done && <Check className="h-4 w-4" />}
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Options">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setEditing(h)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(h.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </ViewContainer>

      {(creating || editing) && (
        <HabitEditDialog habit={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </>
  );
}

function HabitEditDialog({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = Boolean(habit);
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [color, setColor] = useState(habit?.color ?? HABIT_COLORS[0]);
  const [targetPerWeek, setTargetPerWeek] = useState<string>(habit ? String(habit.targetPerWeek) : "7");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Habit name is required");
      return;
    }
    setLoading(true);
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      targetPerWeek: Number(targetPerWeek),
    };
    try {
      if (isEdit && habit) {
        await api.patch(`/api/habits/${habit.id}`, body);
        toast.success("Habit updated");
      } else {
        await api.post("/api/habits", body);
        toast.success("Habit created");
      }
      qc.invalidateQueries({ queryKey: ["habits"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save habit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit habit" : "New habit"}</DialogTitle>
          <DialogDescription>
            Keep habits simple. Daily check-ins build streaks.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="h-name">Name</Label>
            <Input
              id="h-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily reading"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="h-desc">Description</Label>
            <Textarea
              id="h-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HABIT_COLORS.map((col) => (
                    <SelectItem key={col} value={col}>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded" style={{ backgroundColor: col }} />
                        <span>{col}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="h-target">Target / week</Label>
              <Input
                id="h-target"
                type="number"
                min={1}
                max={7}
                value={targetPerWeek}
                onChange={(e) => setTargetPerWeek(e.target.value)}
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
