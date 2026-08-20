"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  Plus,
  Loader2,
  Globe,
  Users as UsersIcon,
  Flame,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState, ErrorState } from "@/components/dyne/states";
import { useCommunityRealtime } from "@/lib/realtime-client";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Author {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
}
interface Community {
  id: string;
  name: string;
  color: string;
  iconUrl: string | null;
}
interface Post {
  id: string;
  title: string;
  content: string;
  mediaUrl: string | null;
  mediaKind: string | null;
  linkUrl: string | null;
  isEdited: boolean;
  createdAt: string;
  author: Author;
  community: Community;
  _count: { comments: number; reactions: number };
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: "UP" | "DOWN" | null;
  isBookmarked: boolean;
}

interface FeedResponse {
  posts: Post[];
  nextCursor: string | null;
}

export function CommunityFeedView() {
  const qc = useQueryClient();
  const { contextId, openCommunity, openPost } = useAppStore();
  const [sortby, setSortby] = useState<"new" | "top" | "hot">("new");
  const [composing, setComposing] = useState(false);

  // Load communities the user has joined (for posting context)
  const { data: commData } = useQuery<{ mine: Array<{ id: string; name: string; color: string }> }>({
    queryKey: ["communities"],
    queryFn: () => api.get("/api/communities"),
  });
  const joinedCommunities = useMemo(
    () => (commData?.mine ?? []).map((c) => c.id),
    [commData?.mine]
  );

  // If a community context is selected (contextId), narrow to that community
  const feedEndpoint = contextId
    ? `/api/posts?communityId=${contextId}&sortby=${sortby}`
    : `/api/feed?sortby=${sortby}`;

  // Real-time subscriptions for joined communities
  useCommunityRealtime(contextId, {
    onPost: (post) => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onComment: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
  });

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery<FeedResponse>({
      queryKey: ["feed", feedEndpoint],
      queryFn: ({ pageParam }) =>
        api.get<FeedResponse>(
          pageParam ? `${feedEndpoint}${feedEndpoint.includes("?") ? "&" : "?"}cursor=${pageParam}` : feedEndpoint
        ),
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      initialPageParam: undefined as string | undefined,
    });

  const posts = data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <>
      <ViewHeader
        title={contextId ? `${commData?.mine.find((c) => c.id === contextId)?.name ?? "Community"}` : "Community Feed"}
        subtitle={
          contextId
            ? "Posts from this community."
            : "Posts from your communities and people you follow."
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCommunity(contextId ?? "")}
              disabled={!contextId}
            >
              <UsersIcon className="h-4 w-4 mr-1" /> About
            </Button>
            <Button onClick={() => setComposing(true)}>
              <Plus className="h-4 w-4 mr-1" /> New post
            </Button>
          </>
        }
      />
      <ViewContainer>
        {/* Sort tabs */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex bg-muted rounded-md p-0.5">
            {(
              [
                { v: "new", label: "New", icon: Clock },
                { v: "top", label: "Top", icon: ArrowBigUp },
                { v: "hot", label: "Hot", icon: Flame },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => setSortby(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5",
                  sortby === v
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {contextId && (
            <Button variant="ghost" size="sm" onClick={() => useAppStore.getState().setView("community")}>
              <Globe className="h-3.5 w-3.5 mr-1" /> All
            </Button>
          )}
        </div>

        {isLoading ? (
          <Loading label="Loading feed" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Globe}
                title={contextId ? "No posts in this community yet" : "No posts to show"}
                description={
                  contextId
                    ? "Be the first to share something with this community."
                    : "Join communities or follow people to see their posts here."
                }
                action={
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => useAppStore.getState().setView("communities")}>
                      Discover communities
                    </Button>
                    <Button onClick={() => setComposing(true)}>
                      <Plus className="h-4 w-4 mr-1" /> New post
                    </Button>
                  </div>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onOpen={() => openPost(p.id)} />
            ))}
            {hasNextPage && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </ViewContainer>

      {composing && (
        <NewPostDialog
          communities={commData?.mine ?? []}
          defaultCommunityId={contextId}
          onClose={() => setComposing(false)}
        />
      )}
    </>
  );
}

function PostCard({ post, onOpen }: { post: Post; onOpen: () => void }) {
  const qc = useQueryClient();
  const voteMutation = useMutation({
    mutationFn: (vote: "UP" | "DOWN" | "NONE") =>
      api.post(`/api/posts/${post.id}/vote`, { vote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => toast.error("Could not register vote"),
  });
  const bookmarkMutation = useMutation({
    mutationFn: (action: "save" | "unsave") =>
      action === "save"
        ? api.put(`/api/posts/${post.id}/bookmark`, {})
        : api.delete(`/api/posts/${post.id}/bookmark`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
    },
    onError: () => toast.error("Could not bookmark"),
  });

  function share() {
    const url = `${window.location.origin}/?view=community&contextId=${post.community.id}&postId=${post.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
  }

  const authorName = post.author.username || post.author.name || "Anonymous";
  return (
    <Card className="hover:dyne-card-shadow-lg transition-shadow">
      <CardContent className="p-4 sm:p-5">
        {/* Header: community + author */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
            style={{
              backgroundColor: `${post.community.color}1a`,
              color: post.community.color,
            }}
          >
            {post.community.name.slice(0, 2)}
          </div>
          <button
            onClick={() => useAppStore.getState().setView("community", { contextId: post.community.id })}
            className="text-sm font-semibold hover:underline"
            style={{ color: post.community.color }}
          >
            {post.community.name}
          </button>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            Posted by{" "}
            <button
              className="hover:underline"
              onClick={() => post.author.username && useAppStore.getState().openUserProfile(post.author.username!)}
            >
              @{authorName}
            </button>{" "}
            · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            {post.isEdited && " (edited)"}
          </span>
        </div>

        {/* Title */}
        <button onClick={onOpen} className="block text-left w-full">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-1 hover:text-primary transition-colors">
            {post.title}
          </h2>

          {/* Content */}
          {post.content && (
            <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap mb-2">
              {post.content}
            </div>
          )}

          {/* Media */}
          {post.mediaKind === "IMAGE" && post.mediaUrl && (
            <img
              src={post.mediaUrl}
              alt=""
              className="rounded-md max-h-96 object-cover w-full mb-2"
            />
          )}
          {post.linkUrl && (
            <a
              href={post.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-block mb-2"
              onClick={(e) => e.stopPropagation()}
            >
              {post.linkUrl}
            </a>
          )}
        </button>

        {/* Actions row */}
        <div className="flex items-center gap-1 mt-3 -ml-1">
          <div className="flex items-center bg-muted rounded-md">
            <button
              onClick={() => voteMutation.mutate(post.myVote === "UP" ? "NONE" : "UP")}
              className={cn(
                "p-1.5 hover:bg-muted-foreground/10 transition-colors rounded-l-md",
                post.myVote === "UP" && "text-emerald-600"
              )}
              aria-label="Upvote"
            >
              <ArrowBigUp className={cn("h-4 w-4", post.myVote === "UP" && "fill-current")} />
            </button>
            <span className="text-xs font-semibold px-1.5 min-w-6 text-center">
              {post.score}
            </span>
            <button
              onClick={() => voteMutation.mutate(post.myVote === "DOWN" ? "NONE" : "DOWN")}
              className={cn(
                "p-1.5 hover:bg-muted-foreground/10 transition-colors rounded-r-md",
                post.myVote === "DOWN" && "text-rose-600"
              )}
              aria-label="Downvote"
            >
              <ArrowBigDown className={cn("h-4 w-4", post.myVote === "DOWN" && "fill-current")} />
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpen}
            className="text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            {post._count.comments}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={share}
            className="text-muted-foreground hover:text-foreground"
          >
            <Share2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => bookmarkMutation.mutate(post.isBookmarked ? "unsave" : "save")}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              post.isBookmarked && "text-primary"
            )}
          >
            <Bookmark className={cn("h-4 w-4 mr-1", post.isBookmarked && "fill-current")} />
            <span className="hidden sm:inline">{post.isBookmarked ? "Saved" : "Save"}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function NewPostDialog({
  communities,
  defaultCommunityId,
  onClose,
}: {
  communities: Array<{ id: string; name: string; color: string }>;
  defaultCommunityId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [communityId, setCommunityId] = useState<string>(
    defaultCommunityId ?? communities[0]?.id ?? ""
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-redirect to discover if no communities joined (rendered effect)
  // (Cannot use useEffect here because of setState-in-effect rule — handled at parent level via early return)

  async function submit() {
    if (!communityId) {
      toast.error("Please select a community");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/posts", {
        communityId,
        title: title.trim(),
        content: content.trim(),
        linkUrl: linkUrl.trim() || null,
        mediaUrl: mediaUrl.trim() || null,
        mediaKind: mediaUrl.trim() ? "IMAGE" : null,
      });
      toast.success("Post published");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not publish post");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New post</DialogTitle>
          <DialogDescription>
            Share something with a community you've joined.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Community</Label>
            <Select value={communityId} onValueChange={setCommunityId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a community" />
              </SelectTrigger>
              <SelectContent>
                {communities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-title">Title</Label>
            <Input
              id="p-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="An interesting title"
              autoFocus
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-content">Body (markdown allowed)</Label>
            <Textarea
              id="p-content"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your post content…"
              maxLength={20_000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-link">Link (optional)</Label>
            <Input
              id="p-link"
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-image">Image URL (optional)</Label>
            <Input
              id="p-image"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://…/image.jpg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
