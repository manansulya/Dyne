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
import { Heart, MessageSquare, Share2, Bookmark, Video, Plus, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Reel {
  id: string;
  videoUrl: string;
  posterUrl: string | null;
  caption: string;
  views: number;
  createdAt: string;
  user: { id: string; name: string; username: string; avatarUrl: string | null };
  _count: { likes: number; comments: number };
  hasLiked: boolean;
  hasViewed: boolean;
}

interface ReelsResponse {
  reels: Reel[];
  nextCursor: string | null;
}

export function ReelsView() {
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [posterUrl, setPosterUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery<ReelsResponse>({
    queryKey: ["reels"],
    queryFn: () => api.get("/api/reels"),
  });
  const reels = data?.reels ?? [];

  async function uploadReel() {
    if (!videoUrl.trim()) {
      toast.error("Video URL is required");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/reels", {
        videoUrl: videoUrl.trim(),
        posterUrl: posterUrl.trim() || null,
        caption: caption.trim(),
      });
      toast.success("Reel uploaded!");
      setVideoUrl("");
      setPosterUrl("");
      setCaption("");
      setUploading(false);
      refetch();
    } catch (err) {
      toast.error((err as Error).message || "Could not upload reel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ViewHeader
        title="Reels"
        subtitle="Short-form video. Scroll, watch, like, and share."
        actions={
          <Button onClick={() => setUploading(true)}>
            <Plus className="h-4 w-4 mr-1" /> Upload
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading reels" />
        ) : reels.length === 0 ? (
          <EmptyState
            icon={Video}
            title="No reels yet"
            description="Upload your first reel to start sharing short-form video content."
            action={<Button onClick={() => setUploading(true)}><Plus className="h-4 w-4 mr-1" /> Upload reel</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reels.map((r) => (
              <ReelCard key={r.id} reel={r} />
            ))}
          </div>
        )}
      </ViewContainer>

      {uploading && (
        <Dialog open onOpenChange={(o) => !o && setUploading(false)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload reel</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Video URL</label>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…/video.mp4" />
              </div>
              <div>
                <label className="text-sm font-medium">Poster image URL (optional)</label>
                <Input value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="https://…/poster.jpg" />
              </div>
              <div>
                <label className="text-sm font-medium">Caption</label>
                <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write a caption…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setUploading(false)}>Cancel</Button>
              <Button onClick={uploadReel} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Publish
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ReelCard({ reel }: { reel: Reel }) {
  const qc = useQueryClient();
  const { openUserProfile } = useAppStore();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const likeMutation = useMutation({
    mutationFn: () => api.post(`/api/reels/${reel.id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reels"] }),
  });

  const viewMutation = useMutation({
    mutationFn: () => api.post(`/api/reels/${reel.id}/view`),
  });

  // Track view on mount
  useEffect(() => {
    if (!reel.hasViewed) {
      viewMutation.mutate();
    }
  }, [reel.id]);

  const { data: commentsData } = useQuery({
    queryKey: ["reel-comments", reel.id],
    queryFn: () => api.get<{ comments: any[] }>(`/api/reels/${reel.id}/comments`),
    enabled: showComments,
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => api.post(`/api/reels/${reel.id}/comments`, { content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reel-comments", reel.id] });
      qc.invalidateQueries({ queryKey: ["reels"] });
      setCommentText("");
    },
  });

  return (
    <div className="relative aspect-[9/16] rounded-xl overflow-hidden bg-black group max-h-[600px]">
      <video
        ref={videoRef}
        src={reel.videoUrl}
        poster={reel.posterUrl ?? undefined}
        controls
        loop
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <Avatar className="h-8 w-8">
            {reel.user.avatarUrl ? <AvatarImage src={reel.user.avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[10px] bg-white/20 text-white">{reel.user.name?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <button
            className="text-sm font-medium text-white hover:underline"
            onClick={() => reel.user.username && openUserProfile(reel.user.username)}
          >
            @{reel.user.username || reel.user.name}
          </button>
          <span className="text-[10px] text-white/60">· {formatDistanceToNow(new Date(reel.createdAt), { addSuffix: true })}</span>
        </div>
        {reel.caption && <p className="text-xs text-white/90 line-clamp-2 mb-2">{reel.caption}</p>}
        <div className="flex items-center gap-4">
          <button
            onClick={() => likeMutation.mutate()}
            className={cn("flex items-center gap-1 text-white", reel.hasLiked && "text-rose-400")}
          >
            <Heart className={cn("h-5 w-5", reel.hasLiked && "fill-current")} />
            <span className="text-xs">{reel._count.likes}</span>
          </button>
          <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1 text-white">
            <MessageSquare className="h-5 w-5" />
            <span className="text-xs">{reel._count.comments}</span>
          </button>
          <span className="text-xs text-white/60">▶ {reel.views} views</span>
        </div>
      </div>

      {/* Comments panel */}
      {showComments && (
        <div className="absolute bottom-0 left-0 right-0 max-h-[50%] bg-black/90 backdrop-blur-sm p-3 overflow-y-auto">
          <div className="space-y-2 mb-3">
            {(commentsData?.comments ?? []).map((c: any) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  {c.author?.avatarUrl ? <AvatarImage src={c.author.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-[8px] bg-white/20 text-white">{c.author?.name?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-xs font-medium text-white">@{c.author?.username || c.author?.name}</span>
                  <span className="text-xs text-white/80 ml-1">{c.content}</span>
                </div>
              </div>
            ))}
            {(commentsData?.comments ?? []).length === 0 && (
              <p className="text-xs text-white/50 text-center py-2">No comments yet</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 h-8 bg-white/10 border-white/20 text-white text-xs placeholder:text-white/40"
              onKeyDown={(e) => {
                if (e.key === "Enter" && commentText.trim()) {
                  commentMutation.mutate(commentText.trim());
                }
              }}
            />
            <Button
              size="icon"
              className="h-8 w-8"
              onClick={() => commentText.trim() && commentMutation.mutate(commentText.trim())}
              disabled={commentMutation.isPending || !commentText.trim()}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
