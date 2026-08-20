"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Loader2,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading } from "@/components/dyne/states";
import { EVENT_TYPE, EVENT_TYPE_META, RECURRENCE, type EventType, type Recurrence } from "@/lib/constants";
import { expandEventInstances, toDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface EventRow {
  id: string;
  title: string;
  type: EventType;
  startDate: string;
  endDate: string;
  recurrence: string | null;
  location: string | null;
  description: string | null;
  courseId: string | null;
  course?: Course | null;
}

export function CalendarView() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [newEventOpen, setNewEventOpen] = useState(false);

  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
  });
  const courses = coursesData?.courses ?? [];

  // Build the date range for the current view
  const range = useMemo(() => {
    if (view === "day") {
      return { start: startOfDay(cursor), end: cursor };
    }
    if (view === "week") {
      return { start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) };
    }
    return { start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) };
  }, [view, cursor]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("start", range.start.toISOString());
    params.set("end", range.end.toISOString());
    return params.toString();
  }, [range]);

  const { data: eventsData, isLoading } = useQuery<{ events: EventRow[] }>({
    queryKey: ["events", queryString],
    queryFn: () => api.get(`/api/events?${queryString}`),
  });
  const events = eventsData?.events ?? [];

  // Expand events into instances for the current range
  const expanded = useMemo(() => {
    const out: Array<{
      id: string;
      instanceId: string;
      title: string;
      type: EventType;
      startDate: Date;
      endDate: Date;
      location: string | null;
      description: string | null;
      recurrence: string | null;
      course: Course | null;
    }> = [];
    for (const ev of events) {
      const instances = expandEventInstances(ev, range.start, range.end);
      for (const inst of instances) {
        out.push({
          id: ev.id,
          instanceId: `${ev.id}-${inst.startDate.toISOString()}`,
          title: ev.title,
          type: ev.type as EventType,
          startDate: inst.startDate,
          endDate: inst.endDate,
          location: ev.location,
          description: ev.description,
          recurrence: ev.recurrence,
          course: ev.course ?? null,
        });
      }
    }
    out.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    return out;
  }, [events, range]);

  function movePrev() {
    if (view === "day") setCursor((c) => subDays(c, 1));
    else if (view === "week") setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => subMonths(c, 1));
  }
  function moveNext() {
    if (view === "day") setCursor((c) => addDays(c, 1));
    else if (view === "week") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addMonths(c, 1));
  }
  function moveToday() {
    setCursor(new Date());
  }

  const title =
    view === "day"
      ? format(cursor, "EEEE, MMM d, yyyy")
      : view === "week"
      ? `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`
      : format(cursor, "MMMM yyyy");

  const { openCourse } = useAppStore();

  return (
    <>
      <ViewHeader
        title="Calendar"
        subtitle="Classes, exams, study sessions, and personal events in one view."
        actions={
          <Button onClick={() => setNewEventOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New event
          </Button>
        }
      />
      <ViewContainer>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-b">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={movePrev} aria-label="Previous">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={moveNext} aria-label="Next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={moveToday}>
                  Today
                </Button>
                <span className="font-semibold text-base ml-2">{title}</span>
              </div>
              <div className="flex bg-muted rounded-md p-0.5 self-end sm:self-auto">
                {(["day", "week", "month"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors",
                      view === v
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <Loading label="Loading calendar" />
            ) : view === "day" ? (
              <DayView date={cursor} events={expanded} onCourseClick={openCourse} />
            ) : view === "week" ? (
              <WeekView start={range.start} events={expanded} onCourseClick={openCourse} />
            ) : (
              <MonthView cursor={cursor} events={expanded} onCourseClick={openCourse} onSelectDay={(d) => { setCursor(d); setView("day"); }} />
            )}
          </CardContent>
        </Card>
      </ViewContainer>

      {newEventOpen && (
        <EventEditDialog
          courses={courses}
          onClose={() => setNewEventOpen(false)}
        />
      )}
    </>
  );
}

function DayView({
  date,
  events,
  onCourseClick,
}: {
  date: Date;
  events: Array<{ id: string; instanceId: string; title: string; type: EventType; startDate: Date; endDate: Date; location: string | null; course: Course | null }>;
  onCourseClick: (id: string) => void;
}) {
  const dayEvents = events.filter((e) => isSameDay(e.startDate, date));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="p-3">
      {dayEvents.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No events on {format(date, "MMM d")}.
        </div>
      ) : (
        <div className="relative">
          {hours.map((h) => {
            const inHour = dayEvents.filter(
              (e) => e.startDate.getHours() <= h && e.endDate.getHours() > h
            );
            return (
              <div key={h} className="flex gap-3 min-h-[60px] border-t first:border-t-0">
                <div className="w-14 text-[10px] text-muted-foreground pt-1 font-mono">
                  {h === 0 ? "" : format(new Date().setHours(h, 0, 0, 0), "h a")}
                </div>
                <div className="flex-1 flex flex-col gap-1 py-1">
                  {inHour.map((e) => (
                    <EventChip key={e.instanceId} ev={e} onClick={() => e.course && onCourseClick(e.course.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekView({
  start,
  events,
  onCourseClick,
}: {
  start: Date;
  events: Array<{ id: string; instanceId: string; title: string; type: EventType; startDate: Date; endDate: Date; location: string | null; course: Course | null }>;
  onCourseClick: (id: string) => void;
}) {
  const days = eachDayOfInterval({ start, end: addDays(start, 6) });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-px bg-border">
      {days.map((day) => {
        const dayEvents = events
          .filter((e) => isSameDay(e.startDate, day))
          .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
        return (
          <div
            key={day.toISOString()}
            className={cn(
              "bg-card min-h-[160px] sm:min-h-[220px] flex flex-col",
              isToday(day) && "ring-2 ring-primary ring-inset"
            )}
          >
            <div className="px-2 py-1.5 text-xs border-b flex items-center justify-between">
              <span className="font-medium">
                {format(day, "EEE")}
              </span>
              <span
                className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5",
                  isToday(day)
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </span>
            </div>
            <div className="flex-1 p-1.5 space-y-1 overflow-y-auto">
              {dayEvents.map((e) => (
                <EventChip
                  key={e.instanceId}
                  ev={e}
                  compact
                  onClick={() => e.course && onCourseClick(e.course.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  cursor,
  events,
  onCourseClick,
  onSelectDay,
}: {
  cursor: Date;
  events: Array<{ id: string; instanceId: string; title: string; type: EventType; startDate: Date; endDate: Date; location: string | null; course: Course | null }>;
  onCourseClick: (id: string) => void;
  onSelectDay: (d: Date) => void;
}) {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });

  return (
    <div>
      <div className="grid grid-cols-7 border-b">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground py-2 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {days.map((day) => {
          const dayEvents = events
            .filter((e) => isSameDay(e.startDate, day))
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
          const inMonth = isSameMonth(day, cursor);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "bg-card min-h-[100px] p-1.5 text-left flex flex-col gap-0.5 hover:bg-muted/40 transition-colors",
                !inMonth && "opacity-40",
                isToday(day) && "ring-1 ring-primary ring-inset"
              )}
            >
              <div
                className={cn(
                  "text-[10px] rounded-full w-5 h-5 flex items-center justify-center",
                  isToday(day)
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground"
                )}
              >
                {format(day, "d")}
              </div>
              <div className="space-y-0.5 overflow-hidden">
                {dayEvents.slice(0, 3).map((e) => {
                  const meta = EVENT_TYPE_META[e.type];
                  return (
                    <div
                      key={e.instanceId}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        if (e.course) onCourseClick(e.course.id);
                      }}
                      className="text-[10px] px-1 py-0.5 rounded truncate"
                      style={{
                        backgroundColor: `${meta.color}1a`,
                        color: meta.color,
                      }}
                    >
                      {e.startDate.getHours() > 0
                        ? format(e.startDate, "h:mma") + " "
                        : ""}
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventChip({
  ev,
  compact,
  onClick,
}: {
  ev: { id: string; instanceId: string; title: string; type: EventType; startDate: Date; endDate: Date; location: string | null; course: Course | null };
  compact?: boolean;
  onClick?: () => void;
}) {
  const meta = EVENT_TYPE_META[ev.type];
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded px-1.5 py-1 text-xs transition-colors hover:brightness-95",
        compact ? "" : "flex items-center gap-1.5",
        meta.bg,
        meta.text
      )}
      style={ev.course ? { borderLeft: `3px solid ${ev.course.color}` } : undefined}
    >
      <span className="font-medium truncate">{ev.title}</span>
      {!compact && (
        <span className="ml-auto text-[10px] opacity-80 shrink-0">
          {format(ev.startDate, "h:mma")}–{format(ev.endDate, "h:mma")}
        </span>
      )}
      {compact && (
        <div className="text-[10px] opacity-80">
          {format(ev.startDate, "h:mma")}
        </div>
      )}
    </button>
  );
}

function EventEditDialog({
  courses,
  onClose,
}: {
  courses: Course[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("PERSONAL");
  const [courseId, setCourseId] = useState<string>("__none__");
  const [date, setDate] = useState(toDateInput(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [recurrence, setRecurrence] = useState<string>("__none__");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  function toDateInput(d: Date) {
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
    const startDate = `${date}T${startTime}:00`;
    const endDate = `${date}T${endTime}:00`;
    try {
      await api.post("/api/events", {
        title: title.trim(),
        type,
        courseId: courseId === "__none__" ? null : courseId,
        startDate,
        endDate,
        recurrence: recurrence === "__none__" ? null : recurrence,
        location: location.trim() || null,
        description: description.trim() || null,
      });
      toast.success("Event created");
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New calendar event</DialogTitle>
          <DialogDescription>
            Add a class, study session, exam, or personal event. Recurring events repeat weekly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ev-title">Title</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Study group, Gym session, Office hours"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as EventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-date">Date</Label>
            <Input
              id="ev-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ev-start">Start</Label>
              <Input
                id="ev-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-end">End</Label>
              <Input
                id="ev-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Recurrence</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">One-time</SelectItem>
                  {RECURRENCE.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r.charAt(0) + r.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-loc">Location</Label>
              <Input
                id="ev-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
