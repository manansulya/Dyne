"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, GraduationCap, Clock, MapPin, FileText, StickyNote, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Loading, EmptyState } from "@/components/dyne/states";
import { PriorityChip } from "@/components/dyne/chips";
import { CoursePill } from "@/components/dyne/course-pill";
import { PRIORITY, type Priority } from "@/lib/constants";
import { dueLabelWithTime, format } from "@/lib/dates";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface ExamDetail {
  id: string;
  title: string;
  date: string;
  time: string | null;
  location: string | null;
  topics: string;
  importance: Priority;
  preparationProgress: number;
  studyNotes: string | null;
  courseId: string | null;
  course?: Course | null;
  notes: Array<{ id: string; title: string; content: string; updatedAt: string }>;
}

export function ExamDetailDialog() {
  const { openExamId, closeExam, openNote } = useAppStore();
  const qc = useQueryClient();
  const open = Boolean(openExamId);
  const { data, isLoading } = useQuery<{ exam: ExamDetail }>({
    queryKey: ["exam", openExamId],
    queryFn: () => api.get(`/api/exams/${openExamId}`),
    enabled: Boolean(openExamId),
  });
  const exam = data?.exam;

  const [prep, setPrep] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (exam) {
      setPrep(exam.preparationProgress);
      setNotes(exam.studyNotes ?? "");
    }
  }, [exam?.id, exam?.preparationProgress, exam?.studyNotes]);

  async function saveProgress() {
    setSaving(true);
    try {
      await api.patch(`/api/exams/${openExamId}`, {
        preparationProgress: prep,
        studyNotes: notes,
      });
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["exam", openExamId] });
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err) {
      toast.error((err as Error).message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeExam()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span>{exam?.title || "Loading…"}</span>
          </DialogTitle>
          {exam && (
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              <CoursePill course={exam.course} />
              <PriorityChip priority={exam.importance} />
              <span className="text-xs">
                {format(new Date(exam.date), "EEE, MMM d, yyyy")}
                {exam.time ? ` · ${exam.time}` : ""}
              </span>
              {exam.location && <span className="text-xs">· {exam.location}</span>}
            </DialogDescription>
          )}
        </DialogHeader>
        {isLoading || !exam ? (
          <Loading />
        ) : (
          <ScrollArea className="flex-1 max-h-[70vh]">
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium">Preparation progress</h3>
                  <span className="text-sm font-semibold">{prep}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={prep}
                  onChange={(e) => setPrep(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <Progress value={prep} className="h-2 mt-2" />
              </div>

              {exam.topics && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Topics to cover
                  </h3>
                  <p className="text-sm whitespace-pre-wrap">{exam.topics}</p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Study notes
                </h3>
                <Textarea
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Key formulas, last-minute reminders…"
                />
              </div>

              {exam.notes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Linked notes
                  </h3>
                  <div className="space-y-2">
                    {exam.notes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          closeExam();
                          openNote(n.id);
                        }}
                        className="w-full text-left p-3 rounded-md border hover:bg-muted/40"
                      >
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-wrap">
                          {n.content || "Empty"}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={saveProgress} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save progress
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
