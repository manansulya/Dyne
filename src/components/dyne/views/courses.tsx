"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
  MoreVertical,
  FileText,
  GraduationCap,
  CheckSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { CourseIcon } from "@/components/dyne/course-icon";
import { COURSE_COLORS, COURSE_ICONS } from "@/lib/constants";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  professor: string | null;
  color: string;
  icon: string | null;
  location: string | null;
  credits: number | null;
  syllabus: string | null;
  createdAt: string;
  _count: { assignments: number; exams: number; tasks: number; notes: number };
}

export function CoursesView() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const { openCourse } = useAppStore();

  const { data, isLoading, isError, refetch } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
  });
  const courses = data?.courses ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/api/courses/${id}`),
    onSuccess: () => {
      toast.success("Course deleted");
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Could not delete course."),
  });

  return (
    <>
      <ViewHeader
        title="Courses"
        subtitle="Your academic context — courses, schedules, professors, and the work attached to each."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New course
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading courses" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : courses.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={BookOpen}
                title="No courses yet"
                description="Add your first course to start organizing your academic work. Courses are containers for assignments, exams, notes, and schedules."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Add course
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <Card key={c.id} className="overflow-hidden hover:dyne-card-shadow-lg transition-all">
                <div className="h-1" style={{ backgroundColor: c.color }} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <button
                      onClick={() => openCourse(c.id)}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left"
                    >
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${c.color}1a`, color: c.color }}
                      >
                        <CourseIcon name={c.icon} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.code}</div>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1 -mt-1" aria-label="Options">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openCourse(c.id)}>
                          <BookOpen className="h-3.5 w-3.5 mr-2" /> Open
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditing(c)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove.mutate(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {c.professor && (
                    <div className="text-xs text-muted-foreground mb-3">
                      <span className="font-medium text-foreground">{c.professor}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <Stat icon={<FileText className="h-3 w-3" />} count={c._count.assignments} label="Asgn" />
                    <Stat icon={<GraduationCap className="h-3 w-3" />} count={c._count.exams} label="Exams" />
                    <Stat icon={<CheckSquare className="h-3 w-3" />} count={c._count.tasks} label="Tasks" />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => openCourse(c.id)}
                  >
                    Open course →
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ViewContainer>

      {(creating || editing) && (
        <CourseEditDialog
          course={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function Stat({ icon, count, label }: { icon: React.ReactNode; count: number; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-2 rounded-md bg-muted/60">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-sm mt-0.5">{count}</div>
    </div>
  );
}

function CourseEditDialog({
  course,
  onClose,
}: {
  course: Course | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = Boolean(course);
  const [name, setName] = useState(course?.name ?? "");
  const [code, setCode] = useState(course?.code ?? "");
  const [professor, setProfessor] = useState(course?.professor ?? "");
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[0]);
  const [icon, setIcon] = useState(course?.icon ?? "BookOpen");
  const [location, setLocation] = useState(course?.location ?? "");
  const [credits, setCredits] = useState<string>(course?.credits ? String(course.credits) : "");
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!name.trim()) {
      toast.error("Course name is required");
      return;
    }
    setLoading(true);
    const body = {
      name: name.trim(),
      code: code.trim(),
      professor: professor.trim() || null,
      color,
      icon,
      location: location.trim() || null,
      credits: credits === "" ? null : Number(credits),
    };
    try {
      if (isEdit && course) {
        await api.patch(`/api/courses/${course.id}`, body);
        toast.success("Course updated");
      } else {
        await api.post("/api/courses", body);
        toast.success("Course created");
      }
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not save course");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit course" : "New course"}</DialogTitle>
          <DialogDescription>
            Courses group your academic work. Pick a color and icon to spot them quickly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Calculus II"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-code">Code</Label>
              <Input
                id="c-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="MATH 152"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-credits">Credits</Label>
              <Input
                id="c-credits"
                type="number"
                min={0}
                max={20}
                step={0.5}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="3"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-prof">Professor</Label>
            <Input
              id="c-prof"
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              placeholder="Dr. Sarah Chen"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-loc">Default location</Label>
            <Input
              id="c-loc"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Hall A-201"
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
                  {COURSE_COLORS.map((col) => (
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
              <Label>Icon</Label>
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_ICONS.map((ic) => (
                    <SelectItem key={ic} value={ic}>
                      {ic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Label className="text-xs text-muted-foreground">Preview:</Label>
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}1a`, color }}
            >
              <CourseIcon name={icon} className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">{name || "Course name"}</span>
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
