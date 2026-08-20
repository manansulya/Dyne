"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CircleDot, Plus, Loader2, X, Heart, Eye } from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

interface StoryGroup {
  user: { id: string; name: string; username: string; avatarUrl: string | null };
  stories: Array<{
    id: string;
    mediaUrl: string;
    mediaKind: string;
    caption: string | null;
    duration: number;
    createdAt: string;
    hasViewed: boolean;
    _count: { views: number; reactions: number };
  }>;
}

export function StoriesView() {
  const [uploading, setUploading] = useState(false);
  const [mediaUrl, setMediaUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [viewingIndex, setViewingIndex] = useState(0);

  const { data, isLoading, refetch } = useQuery<{ storyGroups: StoryGroup[] }>({
    queryKey: ["stories"],
    queryFn: () => api.get("/api/stories"),
  });
  const storyGroups = data?.storyGroups ?? [];

  async function uploadStory() {
    if (!mediaUrl.trim()) {
      toast.error("Media URL is required");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/stories", {
        mediaUrl: mediaUrl.trim(),
        caption: caption.trim() || null,
      });
      toast.success("Story created! It will expire in 24 hours.");
      setMediaUrl("");
      setCaption("");
      setUploading(false);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || "Could not create story");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ViewHeader
        title="Stories"
        subtitle="Share moments that disappear after 24 hours."
        actions={
          <Button onClick={() => setUploading(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Story
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading stories" />
        ) : storyGroups.length === 0 ? (
          <EmptyState
            icon={CircleDot}
            title="No active stories"
            description="Create a story to share a moment with your followers. Stories expire after 24 hours."
            action={<Button onClick={() => setUploading(true)}><Plus className="h-4 w-4 mr-1" /> Add story</Button>}
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {storyGroups.map((group) => (
              <button
                key={group.user.id}
                onClick={() => {
                  setViewingGroup(group);
                  setViewingIndex(0);
                }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className={cn(
                  "relative h-20 w-20 rounded-full p-0.5",
                  group.stories.some(s => !s.hasViewed)
                    ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600"
                    : "bg-muted"
                )}>
                  <div className="h-full w-full rounded-full bg-background p-0.5">
                    <Avatar className="h-full w-full">
                      {group.user.avatarUrl ? <AvatarImage src={group.user.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="bg-muted">{group.user.name?.[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
                <span className="text-xs font-medium truncate max-w-20">
                  {group.user.username || group.user.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </ViewContainer>

      {/* Story viewer */}
      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          index={viewingIndex}
          onIndexChange={setViewingIndex}
          onClose={() => {
            setViewingGroup(null);
            refetch();
          }}
        />
      )}

      {/* Upload dialog */}
      {uploading && (
        <Dialog open onOpenChange={(o) => !o && setUploading(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add to your story</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Image/Video URL</label>
                <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…/image.jpg" />
                <p className="text-[10px] text-muted-foreground mt-1">Stories expire after 24 hours.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Caption (optional)</label>
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Add a caption…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setUploading(false)}>Cancel</Button>
              <Button onClick={uploadStory} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Share
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function StoryViewer({
  group,
  index,
  onIndexChange,
  onClose,
}: {
  group: StoryGroup;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const story = group.stories[index];
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mark as viewed
  useEffect(() => {
    if (story && !story.hasViewed) {
      api.post(`/api/stories/${story.id}/view`).then(() => {
        qc.invalidateQueries({ queryKey: ["stories"] });
      });
    }
  }, [story?.id]);

  // Auto-advance timer — uses a ref to avoid setState in effect body
  const progressRef = useRef(0);
  useEffect(() => {
    if (!story) return;
    progressRef.current = 0;
    const duration = story.duration * 1000;
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      progressRef.current = pct;
      setProgress(pct);
      if (pct >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        if (index < group.stories.length - 1) {
          onIndexChange(index + 1);
        } else {
          onClose();
        }
      }
    }, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [story?.id, index]);

  if (!story) return null;

  // Check if this is the current user's story group (for showing viewer list)
  // contextId is set when navigating from profile; otherwise we check via session
  const isOwn = false; // Viewer list is fetched server-side via GET /api/stories/[id]/view

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" onClick={onClose}>
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-4 z-10">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all"
              style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-8 left-4 right-4 flex items-center gap-3 z-10" onClick={(e) => e.stopPropagation()}>
        <Avatar className="h-10 w-10">
          {group.user.avatarUrl ? <AvatarImage src={group.user.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-white/20 text-white">{group.user.name?.[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="text-sm font-medium text-white">{group.user.username || group.user.name}</div>
          <div className="text-[10px] text-white/60">{story._count.views} views · {story._count.reactions} reactions</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto text-white hover:bg-white/10"
          onClick={onClose}
          aria-label="Close story"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Media */}
      <div className="max-w-md w-full h-full max-h-[80vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {story.mediaKind === "VIDEO" ? (
          <video src={story.mediaUrl} autoPlay className="max-w-full max-h-full object-contain" />
        ) : (
          <img src={story.mediaUrl} alt="" className="max-w-full max-h-full object-contain" />
        )}
        {story.caption && (
          <div className="absolute bottom-20 left-4 right-4 text-center">
            <p className="text-white text-sm bg-black/50 rounded-lg p-2">{story.caption}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      {index > 0 && (
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index - 1); }}
        >
          ‹
        </button>
      )}
      {index < group.stories.length - 1 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index + 1); }}
        >
          ›
        </button>
      )}

      {/* Reaction button */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={async () => {
            await api.post(`/api/stories/${story.id}/react`, { emoji: "❤️" });
            toast.success("Reacted ❤️");
            qc.invalidateQueries({ queryKey: ["stories"] });
          }}
        >
          <Heart className="h-6 w-6" />
        </Button>
      </div>
    </div>
  );
}
