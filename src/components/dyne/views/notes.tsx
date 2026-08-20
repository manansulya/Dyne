"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pin, Plus, StickyNote, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { CoursePill } from "@/components/dyne/course-pill";
import { format } from "date-fns";
import { useAppStore } from "@/store/app-store";

interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  icon: string | null;
}
interface Note {
  id: string;
  title: string;
  content: string;
  tags: string;
  pinned: boolean;
  updatedAt: string;
  courseId: string | null;
  assignmentId: string | null;
  examId: string | null;
  course?: Course | null;
  assignment?: { id: string; title: string } | null;
  exam?: { id: string; title: string } | null;
}

export function NotesView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { openNote } = useAppStore();

  const { data, isLoading, isError, refetch } = useQuery<{ notes: Note[] }>({
    queryKey: ["notes"],
    queryFn: () => api.get("/api/notes"),
  });
  const notes = data?.notes ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }, [notes, search]);

  const pinned = filtered.filter((n) => n.pinned);
  const rest = filtered.filter((n) => !n.pinned);

  const togglePin = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch(`/api/notes/${id}`, { pinned: !pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: () => toast.error("Could not pin note."),
  });

  return (
    <>
      <ViewHeader
        title="Notes"
        subtitle="Capture quick notes for courses, assignments, and exams — without recreating Notion."
        actions={
          <Button onClick={() => openNote("__new__")}>
            <Plus className="h-4 w-4 mr-1" /> New note
          </Button>
        }
      />
      <ViewContainer>
        <div className="relative mb-5 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <Loading label="Loading notes" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : notes.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={StickyNote}
                title="No notes yet"
                description="Add your first note. Notes can be linked to courses, assignments, or exams for context."
                action={
                  <Button onClick={() => openNote("__new__")}>
                    <Plus className="h-4 w-4 mr-1" /> Add note
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            {pinned.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Pin className="h-3.5 w-3.5" /> Pinned
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pinned.map((n) => (
                    <NoteCard
                      key={n.id}
                      note={n}
                      onOpen={() => openNote(n.id)}
                      onTogglePin={() => togglePin.mutate({ id: n.id, pinned: n.pinned })}
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              {pinned.length > 0 && (
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  All notes
                </h2>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rest.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onOpen={() => openNote(n.id)}
                    onTogglePin={() => togglePin.mutate({ id: n.id, pinned: n.pinned })}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </ViewContainer>
    </>
  );
}

function NoteCard({
  note,
  onOpen,
  onTogglePin,
}: {
  note: Note;
  onOpen: () => void;
  onTogglePin: () => void;
}) {
  return (
    <Card className="hover:dyne-card-shadow-lg transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <div className="font-medium text-base truncate">{note.title}</div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-1 -mt-1 shrink-0"
            onClick={onTogglePin}
            aria-label="Pin note"
          >
            <Pin className={`h-3.5 w-3.5 ${note.pinned ? "fill-current text-primary" : ""}`} />
          </Button>
        </div>
        <button onClick={onOpen} className="block text-left w-full">
          <div className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
            {note.content || "No content yet."}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {note.course && <CoursePill course={note.course} />}
            {note.assignment && (
              <Badge variant="outline" className="text-[10px]">
                ↳ {note.assignment.title}
              </Badge>
            )}
            {note.exam && (
              <Badge variant="outline" className="text-[10px]">
                🎓 {note.exam.title}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {format(new Date(note.updatedAt), "MMM d")}
            </span>
          </div>
        </button>
      </CardContent>
    </Card>
  );
}
