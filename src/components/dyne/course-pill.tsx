"use client";

import { cn } from "@/lib/utils";
import { CourseIcon } from "./course-icon";

interface CoursePillProps {
  course?: {
    id: string;
    name: string;
    code?: string | null;
    color: string;
    icon?: string | null;
  } | null;
  className?: string;
  withIcon?: boolean;
  variant?: "default" | "subtle";
}

export function CoursePill({
  course,
  className,
  withIcon = true,
  variant = "default",
}: CoursePillProps) {
  if (!course) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
          className
        )}
      >
        No course
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-1.5 py-0.5 rounded",
        variant === "default" && "bg-muted text-foreground",
        className
      )}
      style={
        variant === "subtle"
          ? {
              backgroundColor: `${course.color}1a`,
              color: course.color,
            }
          : undefined
      }
    >
      {withIcon && (
        <CourseIcon
          name={course.icon}
          className="h-3 w-3"
          fallback={<span className="h-3 w-3 rounded-full" style={{ backgroundColor: course.color }} />}
        />
      )}
      <span>{course.code || course.name}</span>
    </span>
  );
}
