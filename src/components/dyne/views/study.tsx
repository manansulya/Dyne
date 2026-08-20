"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Play,
  Pause,
  Square,
  Timer as TimerIcon,
  Loader2,
  Trash2,
  History,
  Brain,
  Coffee,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { CoursePill } from "@/components/dyne/course-pill";
import { formatDuration } from "@/lib/dates";
import { format } from "date-fns";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface StudySession {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  focusStatus: string;
  notes: string | null;
  courseId: string | null;
  course?: Course | null;
}

export function StudyView() {
  const qc = useQueryClient();
  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
  });
  const courses = coursesData?.courses ?? [];

  const { data: sessionsData, isLoading } = useQuery<{ sessions: StudySession[] }>({
    queryKey: ["study-sessions"],
    queryFn: () => api.get("/api/study-sessions"),
  });
  const sessions = sessionsData?.sessions ?? [];

  // Timer state (kept in localStorage so it survives refresh).
  // Lazy initial state — reads from localStorage on first client render only.
  type TimerSnapshot = {
    courseId: string;
    running: boolean;
    startTime: number | null;
    elapsed: number;
  };
  const initial = useRef<TimerSnapshot | null>(null);
  if (initial.current === null) {
    let snap: TimerSnapshot = {
      courseId: "__none__",
      running: false,
      startTime: null,
      elapsed: 0,
    };
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dyne-study-timer");
      if (saved) {
        try {
          const obj = JSON.parse(saved);
          if (obj.running && obj.startTime) {
            snap = {
              courseId: obj.courseId ?? "__none__",
              running: true,
              startTime: obj.startTime,
              elapsed: Math.floor((Date.now() - obj.startTime) / 1000),
            };
          }
        } catch {
          localStorage.removeItem("dyne-study-timer");
        }
      }
    }
    initial.current = snap;
  }

  const [courseId, setCourseId] = useState<string>(initial.current.courseId);
  const [running, setRunning] = useState(initial.current.running);
  const [startTime, setStartTime] = useState<number | null>(initial.current.startTime);
  const [elapsed, setElapsed] = useState(initial.current.elapsed); // seconds
  const [focusMode, setFocusMode] = useState<"FOCUSED" | "DISTRACTED">("FOCUSED");

  // Ticking
  useEffect(() => {
    if (!running || !startTime) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running, startTime]);

  // Persist
  useEffect(() => {
    if (running && startTime) {
      localStorage.setItem(
        "dyne-study-timer",
        JSON.stringify({ running: true, startTime, courseId })
      );
    } else {
      localStorage.removeItem("dyne-study-timer");
    }
  }, [running, startTime, courseId]);

  const startTimer = () => {
    setStartTime(Date.now());
    setElapsed(0);
    setRunning(true);
  };

  const pauseTimer = () => {
    setRunning(false);
  };

  const resumeTimer = () => {
    if (startTime) {
      setStartTime(Date.now() - elapsed * 1000);
      setRunning(true);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const minutes = Math.max(1, Math.round(elapsed / 60));
      return api.post("/api/study-sessions", {
        courseId: courseId === "__none__" ? null : courseId,
        startTime: new Date(startTime!).toISOString(),
        endTime: new Date().toISOString(),
        duration: minutes,
        focusStatus: focusMode,
      });
    },
    onSuccess: () => {
      toast.success(`Study session saved (${Math.round(elapsed / 60)} min)`);
      setRunning(false);
      setStartTime(null);
      setElapsed(0);
      localStorage.removeItem("dyne-study-timer");
      qc.invalidateQueries({ queryKey: ["study-sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: () => toast.error("Could not save study session."),
  });

  const discardTimer = () => {
    setRunning(false);
    setStartTime(null);
    setElapsed(0);
    localStorage.removeItem("dyne-study-timer");
    toast.info("Study session discarded");
  };

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/study-sessions/${id}`),
    onSuccess: () => {
      toast.success("Session deleted");
      qc.invalidateQueries({ queryKey: ["study-sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: () => toast.error("Could not delete session."),
  });

  const totalMinutesToday = useMemo(() => {
    const today = new Date();
    return sessions
      .filter((s) => {
        const d = new Date(s.startTime);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      })
      .reduce((acc, s) => acc + (s.duration || 0), 0);
  }, [sessions]);

  const totalMinutesThisWeek = useMemo(() => {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return sessions
      .filter((s) => new Date(s.startTime) >= weekStart)
      .reduce((acc, s) => acc + (s.duration || 0), 0);
  }, [sessions]);

  // Format elapsed as HH:MM:SS
  function fmt(elapsedSec: number) {
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <>
      <ViewHeader
        title="Study Sessions"
        subtitle="Start a focus timer, track study time per course, and watch it accumulate in your analytics."
      />
      <ViewContainer>
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Timer card */}
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TimerIcon className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">Focus Timer</h2>
                </div>
                <Badge variant="outline">
                  {totalMinutesToday >= 60
                    ? `${(totalMinutesToday / 60).toFixed(1)}h`
                    : `${totalMinutesToday}m`}{" "}
                  today
                </Badge>
              </div>
              <div className="flex flex-col items-center py-6">
                <div className="text-5xl sm:text-6xl font-mono font-semibold tracking-tight tabular-nums mb-2">
                  {fmt(elapsed)}
                </div>
                <div className="text-xs text-muted-foreground mb-6">
                  {running ? "Recording study time" : startTime ? "Paused" : "Ready to start"}
                </div>
                <div className="grid sm:grid-cols-2 gap-3 w-full max-w-md">
                  <div className="space-y-2">
                    <Label>Course (optional)</Label>
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
                    <Label>Focus mode</Label>
                    <Select value={focusMode} onValueChange={(v) => setFocusMode(v as "FOCUSED" | "DISTRACTED")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOCUSED">
                          <div className="flex items-center gap-2">
                            <Brain className="h-3.5 w-3.5" /> Focused
                          </div>
                        </SelectItem>
                        <SelectItem value="DISTRACTED">
                          <div className="flex items-center gap-2">
                            <Coffee className="h-3.5 w-3.5" /> Distracted
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 mt-6">
                  {!startTime && (
                    <Button onClick={startTimer} size="lg">
                      <Play className="h-5 w-5 mr-1" /> Start session
                    </Button>
                  )}
                  {running && (
                    <Button onClick={pauseTimer} size="lg" variant="outline">
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </Button>
                  )}
                  {startTime && !running && (
                    <Button onClick={resumeTimer} size="lg">
                      <Play className="h-4 w-4 mr-1" /> Resume
                    </Button>
                  )}
                  {startTime && (
                    <>
                      <Button
                        onClick={() => saveMutation.mutate()}
                        size="lg"
                        disabled={saveMutation.isPending || elapsed < 30}
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Square className="h-4 w-4 mr-1" />
                        )}
                        Stop & save
                      </Button>
                      <Button onClick={discardTimer} size="lg" variant="ghost">
                        Discard
                      </Button>
                    </>
                  )}
                </div>
                {elapsed < 30 && startTime && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Need at least 30 seconds to save a session.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats card */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Recent Activity</h2>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-md bg-muted">
                  <div className="text-xs text-muted-foreground">Today</div>
                  <div className="text-2xl font-semibold">
                    {formatDuration(totalMinutesToday)}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted">
                  <div className="text-xs text-muted-foreground">This week</div>
                  <div className="text-2xl font-semibold">
                    {formatDuration(totalMinutesThisWeek)}
                  </div>
                </div>
                <div className="p-3 rounded-md bg-muted">
                  <div className="text-xs text-muted-foreground">Total sessions</div>
                  <div className="text-2xl font-semibold">{sessions.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card className="mt-5">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h2 className="font-semibold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> Session history
              </h2>
            </div>
            {isLoading ? (
              <Loading />
            ) : sessions.length === 0 ? (
              <EmptyState
                icon={TimerIcon}
                title="No study sessions yet"
                description="Start a focus timer above to track your first session."
              />
            ) : (
              <div className="divide-y max-h-96 overflow-y-auto">
                {sessions.slice(0, 30).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {format(new Date(s.startTime), "EEE, MMM d · h:mm a")}
                      </div>
                      {s.course && (
                        <div className="mt-0.5">
                          <CoursePill course={s.course} />
                        </div>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {s.focusStatus === "FOCUSED" ? "Focused" : s.focusStatus === "DISTRACTED" ? "Distracted" : "Interrupted"}
                    </Badge>
                    <span className="text-sm font-medium">{formatDuration(s.duration)}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(s.id)}
                      aria-label="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ViewContainer>
    </>
  );
}
