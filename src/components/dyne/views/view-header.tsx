"use client";

import { cn } from "@/lib/utils";

interface ViewHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function ViewHeader({ title, subtitle, actions, className }: ViewHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-5 px-4 sm:px-6 pt-6",
        className
      )}
    >
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function ViewContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-4 sm:px-6 pb-12 max-w-7xl mx-auto w-full", className)}>
      {children}
    </div>
  );
}
