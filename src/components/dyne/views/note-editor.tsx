"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { StickyNote, Loader2, Trash2, Pin } from "lucide-react";
import { toast } from "sonner";
import { Loading } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface Assignment {
  id: string;
  title: string;
}
interface Exam {
  id: string;
  title: string;
}
interface NoteDetail {
  id: string;
  title: string;
  content: string;
  tags: string;
  pinned: boolean;
  courseId: string | null;
  assignmentId: string | null;
  examId: string | null;
  course?: Course | null;
  assignment?: Assignment | null;
  exam?: Exam | null;
}

export function NoteEditorDialog() {
  const { openNoteId, closeNote } = useAppStore();
  const qc = useQueryClient();
  const isNew = openNoteId === "__new__";
  const open = Boolean(openNoteId);
  const { data, isLoading } = useQuery<{ note: NoteDetail }>({
    queryKey: ["note", openNoteId],
    queryFn: () => api.get(`/api/notes/${openNoteId}`),
    enabled: Boolean(openNoteId) && !isNew,
  });
  const note = data?.note;

  const { data: coursesData } = useQuery<{ courses: Course[] }>({
    queryKey: ["courses"],
    queryFn: () => api.get("/api/courses"),
    enabled: open,
  });
  const { data: assignmentsData } = useQuery<{ assignments: Assignment[] }>({
    queryKey: ["assignments"],
    queryFn: () => api.get("/api/assignments"),
    enabled: open,
  });
  const { data: examsData } = useQuery<{ exams: Exam[] }>({
    queryKey: ["exams"],
    queryFn: () => api.get("/api/exams"),
    enabled: open,
  });

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [courseId, setCourseId] = useState<string>("__none__");
  const [assignmentId, setAssignmentId] = useState<string>("__none__");
  const [examId, setExamId] = useState<string>("__none__");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags);
      setPinned(note.pinned);
      setCourseId(note.courseId ?? "__none__");
      setAssignmentId(note.assignmentId ?? "__none__");
      setExamId(note.examId ?? "__none__");
    } else if (isNew) {
      setTitle("");
      setContent("");
      setTags("");
      setPinned(false);
      setCourseId("__none__");
      setAssignmentId("__none__");
      setExamId("__none__");
    }
  }, [note?.id, isNew]);

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        content,
        tags,
        pinned,
        courseId: courseId === "__none__" ? null : courseId,
        assignmentId: assignmentId === "__none__" ? null : assignmentId,
        examId: examId === "__none__" ? null : examId,
      };
      if (isNew) {
        const res = await api.post<{ note: { id: string } }>("/api/notes", body);
        toast.success("Note created");
        qc.invalidateQueries({ queryKey: ["notes"] });
        closeNote();
      } else if (note) {
        await api.patch(`/api/notes/${note.id}`, body);
        toast.success("Note saved");
        qc.invalidateQueries({ queryKey: ["notes"] });
        qc.invalidateQueries({ queryKey: ["note", note.id] });
        closeNote();
      }
    } catch (err) {
      toast.error((err as Error).message || "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!note) return;
    setSaving(true);
    try {
      await api.delete(`/api/notes/${note.id}`);
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: ["notes"] });
      closeNote();
    } catch (err) {
      toast.error((err as Error).message || "Could not delete note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeNote()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="text-lg flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-primary" />
            <span>{isNew ? "New note" : "Edit note"}</span>
            {!isNew && note && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-1"
                onClick={() => setPinned(!pinned)}
                aria-label="Pin note"
              >
                <Pin className={`h-3.5 w-3.5 ${pinned ? "fill-current text-primary" : ""}`} />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {isLoading && !isNew ? (
          <Loading />
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            <div className="space-y-2">
              <Label htmlFor="n-title">Title</Label>
              <Input
                id="n-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="n-content">Content</Label>
              <Textarea
                id="n-content"
                rows={10}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your note here…"
                className="font-mono text-sm resize-y"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Course</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(coursesData?.courses ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assignment</Label>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(assignmentsData?.assignments ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Exam</Label>
                <Select value={examId} onValueChange={setExamId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(examsData?.exams ?? []).map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="n-tags">Tags (comma-separated)</Label>
              <Input
                id="n-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="lecture, important, review"
              />
            </div>
            <div className="flex items-center justify-between gap-2 pt-2">
              {!isNew && note ? (
                <Button variant="ghost" onClick={remove} disabled={saving} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeNote}>Cancel</Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  {isNew ? "Create" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
