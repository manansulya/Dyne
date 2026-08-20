"use client";

import {
  BookOpen,
  Calculator,
  Atom,
  FlaskConical,
  Microscope,
  Brain,
  Globe,
  Code2,
  PenTool,
  Music,
  Palette,
  Landmark,
  Dna,
  FunctionSquare,
  Languages,
  HeartPulse,
  HelpCircle,
} from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Calculator,
  Atom,
  FlaskConical,
  Microscope,
  Brain,
  Globe,
  Code2,
  PenTool,
  Music,
  Palette,
  Landmark,
  Dna,
  FunctionSquare,
  Languages,
  HeartPulse,
};

export function CourseIcon({
  name,
  className,
  fallback,
}: {
  name?: string | null;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const Icon = (name && ICON_MAP[name]) || HelpCircle;
  return <Icon className={className} />;
}

export { ICON_MAP };
