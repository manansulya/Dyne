// Domain enums & shared constants

export const TASK_STATUS = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUS)[number];

export const ASSIGNMENT_STATUS = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUS)[number];

export const PRIORITY = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITY)[number];

export const EVENT_TYPE = [
  "CLASS",
  "ASSIGNMENT",
  "EXAM",
  "TASK",
  "STUDY",
  "PERSONAL",
] as const;
export type EventType = (typeof EVENT_TYPE)[number];

export const GOAL_TYPE = [
  "STUDY_HOURS",
  "TASKS_COMPLETED",
  "ATTENDANCE",
  "CUSTOM",
] as const;
export type GoalType = (typeof GOAL_TYPE)[number];

export const GOAL_STATUS = ["ACTIVE", "COMPLETED", "PAUSED"] as const;
export type GoalStatus = (typeof GOAL_STATUS)[number];

export const RECURRENCE = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type Recurrence = (typeof RECURRENCE)[number];

export const FOCUS_STATUS = ["FOCUSED", "DISTRACTED", "INTERRUPTED"] as const;
export type FocusStatus = (typeof FOCUS_STATUS)[number];

export const NOTIFICATION_TYPE = [
  "ASSIGNMENT_DUE",
  "EXAM_REMINDER",
  "TASK_OVERDUE",
  "GOAL_BEHIND",
  "UPCOMING_CLASS",
  "INFO",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPE)[number];

// ---------------- UI helpers ----------------

export const PRIORITY_META: Record<
  Priority,
  { label: string; dot: string; chip: string; weight: number }
> = {
  LOW: {
    label: "Low",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    weight: 1,
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    weight: 2,
  },
  HIGH: {
    label: "High",
    dot: "bg-orange-500",
    chip: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    weight: 3,
  },
  URGENT: {
    label: "Urgent",
    dot: "bg-rose-500",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
    weight: 4,
  },
};

export const TASK_STATUS_META: Record<TaskStatus, { label: string; chip: string }> = {
  TODO: {
    label: "To Do",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  },
  COMPLETED: {
    label: "Completed",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
};

export const EVENT_TYPE_META: Record<
  EventType,
  { label: string; color: string; bg: string; text: string }
> = {
  CLASS: {
    label: "Class",
    color: "#0ea5e9",
    bg: "bg-sky-100 dark:bg-sky-950/50",
    text: "text-sky-700 dark:text-sky-300",
  },
  ASSIGNMENT: {
    label: "Assignment",
    color: "#f59e0b",
    bg: "bg-amber-100 dark:bg-amber-950/50",
    text: "text-amber-700 dark:text-amber-300",
  },
  EXAM: {
    label: "Exam",
    color: "#ef4444",
    bg: "bg-rose-100 dark:bg-rose-950/50",
    text: "text-rose-700 dark:text-rose-300",
  },
  TASK: {
    label: "Task",
    color: "#8b5cf6",
    bg: "bg-violet-100 dark:bg-violet-950/50",
    text: "text-violet-700 dark:text-violet-300",
  },
  STUDY: {
    label: "Study",
    color: "#10b981",
    bg: "bg-emerald-100 dark:bg-emerald-950/50",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  PERSONAL: {
    label: "Personal",
    color: "#ec4899",
    bg: "bg-pink-100 dark:bg-pink-950/50",
    text: "text-pink-700 dark:text-pink-300",
  },
};

// Default course color palette (warm + cool, avoids indigo/blue defaults)
export const COURSE_COLORS = [
  "#0ea5e9", // sky
  "#14b8a6", // teal
  "#10b981", // emerald
  "#84cc16", // lime
  "#f59e0b", // amber
  "#f97316", // orange
  "#ef4444", // red
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#6366f1", // indigo
  "#06b6d4", // cyan
  "#a855f7", // purple
];

export const HABIT_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#f97316",
  "#14b8a6",
  "#ef4444",
];

// Lucide icon names available to choose from for course icons.
export const COURSE_ICONS = [
  "BookOpen",
  "Calculator",
  "Atom",
  "FlaskConical",
  "Microscope",
  "Brain",
  "Globe",
  "Code2",
  "PenTool",
  "Music",
  "Palette",
  "Landmark",
  "Dna",
  "FunctionSquare",
  "Languages",
  "HeartPulse",
] as const;
