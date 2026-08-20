"use client";

import { cn } from "@/lib/utils";
import { PRIORITY_META, TASK_STATUS_META, type Priority, type TaskStatus } from "@/lib/constants";

export function PriorityChip({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
        meta.chip,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

export function StatusChip({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const meta = TASK_STATUS_META[status];
  if (!meta) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded",
        meta.chip,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
