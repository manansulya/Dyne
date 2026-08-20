import {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isYesterday,
  isThisWeek,
  isThisMonth,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  subDays,
  subWeeks,
  subMonths,
} from "date-fns";

export {
  format,
  parseISO,
  isToday,
  isTomorrow,
  isYesterday,
  isThisWeek,
  isThisMonth,
  differenceInCalendarDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  subDays,
  subWeeks,
  subMonths,
};

// Convert datetime stored in DB (ISO string from SQLite) to JS Date.
export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  return parseISO(value);
}

// Format a date as a friendly "due label"
export function dueLabel(date: Date | string | null | undefined): string {
  const d = toDate(date);
  if (!d) return "No date";
  const days = differenceInCalendarDays(d, new Date());
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  if (isYesterday(d)) return "Yesterday";
  if (days > 0 && days < 7) return `In ${days} days`;
  if (days < 0 && days > -7) return `${Math.abs(days)} days ago`;
  return format(d, "MMM d");
}

export function dueLabelWithTime(
  date: Date | string | null | undefined,
  time?: string | null
): string {
  const base = dueLabel(date);
  if (time) return `${base} · ${time}`;
  return base;
}

// Format minutes as "1h 30m" or "45m"
export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Parse "HH:MM" to {h, m} or null
export function parseTime(s: string | null | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

// Combine a date with "HH:MM" into a Date
export function combineDateTime(
  date: Date | string | null | undefined,
  time?: string | null
): Date | null {
  const d = toDate(date);
  if (!d) return null;
  const t = parseTime(time);
  if (!t) return startOfDay(d);
  const out = new Date(d);
  out.setHours(t.h, t.m, 0, 0);
  return out;
}

// Convert "2025-08-08" + "HH:MM" to ISO
export function combineISO(dateStr: string, time?: string | null): string | null {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  const combined = combineDateTime(date, time);
  return combined ? combined.toISOString() : null;
}

export function toDateInput(d: Date | string | null | undefined): string {
  const date = toDate(d) ?? new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isOverdue(
  date: Date | string | null | undefined,
  status?: string | null
): boolean {
  if (status === "COMPLETED") return false;
  const d = toDate(date);
  if (!d) return false;
  return d.getTime() < Date.now();
}

// Expand recurring events into instances within [start, end]
export function expandEventInstances(
  ev: {
    id: string;
    startDate: Date | string;
    endDate: Date | string;
    recurrence?: string | null;
  },
  rangeStart: Date,
  rangeEnd: Date
): { id: string; startDate: Date; endDate: Date }[] {
  const start = toDate(ev.startDate);
  const end = toDate(ev.endDate);
  if (!start || !end) return [];
  const durationMs = end.getTime() - start.getTime();
  if (!ev.recurrence) {
    if (
      (start >= rangeStart && start <= rangeEnd) ||
      (end >= rangeStart && end <= rangeEnd) ||
      (start <= rangeStart && end >= rangeEnd)
    ) {
      return [{ id: ev.id, startDate: start, endDate: end }];
    }
    return [];
  }
  const instances: { id: string; startDate: Date; endDate: Date }[] = [];
  let cursor = new Date(start);
  // safety cap to prevent infinite loops
  let iters = 0;
  while (cursor <= rangeEnd && iters < 500) {
    iters++;
    const cursorEnd = new Date(cursor.getTime() + durationMs);
    if (cursor >= rangeStart || cursorEnd >= rangeStart) {
      if (cursor <= rangeEnd) {
        instances.push({ id: ev.id, startDate: new Date(cursor), endDate: cursorEnd });
      }
    }
    if (ev.recurrence === "DAILY") cursor = addDays(cursor, 1);
    else if (ev.recurrence === "WEEKLY") cursor = addWeeks(cursor, 1);
    else if (ev.recurrence === "MONTHLY") cursor = addMonths(cursor, 1);
    else break;
    if (cursor > rangeEnd && instances.length > 0) break;
  }
  return instances;
}

export function pluralize(n: number, word: string): string {
  if (n === 1) return `${n} ${word}`;
  return `${n} ${word}s`;
}
