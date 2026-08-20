"use client";

import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  Send,
  Loader2,
  Trash2,
  Pencil,
  Reply,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { useCommunityRealtime } from "@/lib/realtime-client";
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
interface PostDetail {
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
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: "UP" | "DOWN" | null;
  isBookmarked: boolean;
  _count: { comments: number; reactions: number };
}
interface CommentNode {
  id: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  parentId: string | null;
  author: Author;
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: "UP" | "DOWN" | null;
  replies: CommentNode[];
}

export function PostDetailDialog() {
  const { openPostId, closePost, openCommunity } = useAppStore();
  const open = Boolean(openPostId);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ post: PostDetail; comments: CommentNode[] }>({
    queryKey: ["post", openPostId],
    queryFn: () => api.get(`/api/comments/post/${openPostId}`),
    enabled: Boolean(openPostId),
  });

  const post = data?.post;
  const comments = data?.comments ?? [];

  // Subscribe to community realtime for new comments on this post
  useCommunityRealtime(post?.community.id, {
    onComment: (c) => {
      const comment = c as CommentNode;
      if (comment.postId === openPostId || !comment.postId) {
        // Always invalidate to be safe — comments API gives the full tree
        qc.invalidateQueries({ queryKey: ["post", openPostId] });
      }
    },
    onPost: () => {},
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closePost()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="px-5 py-4 border-b">
          <DialogTitle className="text-lg">{post?.title || "Loading…"}</DialogTitle>
          {post && (
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  closePost();
                  openCommunity(post.community.id);
                  useAppStore.getState().setView("community", { contextId: post.community.id });
                }}
                className="font-semibold hover:underline"
                style={{ color: post.community.color }}
              >
                {post.community.name}
              </button>
              <span className="text-xs">·</span>
              <span className="text-xs">
                Posted by{" "}
                <button
                  className="hover:underline"
                  onClick={() => post.author.username && useAppStore.getState().openUserProfile(post.author.username!)}
                >
                  @{post.author.username || post.author.name || "anonymous"}
                </button>{" "}
                · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                {post.isEdited && " (edited)"}
              </span>
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading || !post ? (
          <Loading />
        ) : (
          <>
            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="px-5 py-4 space-y-4">
                {/* Post body */}
                <div className="text-sm whitespace-pre-wrap">{post.content}</div>
                {post.mediaKind === "IMAGE" && post.mediaUrl && (
                  <img src={post.mediaUrl} alt="" className="rounded-md max-h-96 object-cover w-full" />
                )}
                {post.linkUrl && (
                  <a
                    href={post.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-block"
                  >
                    {post.linkUrl}
                  </a>
                )}

                {/* Action bar */}
                <PostActions post={post} />
              </div>
            </ScrollArea>

            {/* Comments section */}
            <div className="border-t bg-muted/20 px-5 py-4 max-h-[40vh] overflow-hidden flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Comments ({comments.length})</h3>
              </div>
              <CommentEditor postId={post.id} />
              <ScrollArea className="flex-1 mt-3 -mx-1">
                <div className="px-1 space-y-2">
                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3">
                      No comments yet. Be the first to reply!
                    </p>
                  ) : (
                    comments.map((c) => <CommentItem key={c.id} comment={c} postId={post.id} depth={0} />)
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PostActions({ post }: { post: PostDetail }) {
  const qc = useQueryClient();
  const voteMutation = useMutation({
    mutationFn: (vote: "UP" | "DOWN" | "NONE") => api.post(`/api/posts/${post.id}/vote`, { vote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post", post.id] }),
    onError: () => toast.error("Could not vote"),
  });
  const bookmarkMutation = useMutation({
    mutationFn: (action: "save" | "unsave") =>
      action === "save"
        ? api.put(`/api/posts/${post.id}/bookmark`, {})
        : api.delete(`/api/posts/${post.id}/bookmark`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post", post.id] }),
    onError: () => toast.error("Could not bookmark"),
  });
  function share() {
    const url = `${window.location.origin}/?view=community&contextId=${post.community.id}&postId=${post.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
  }

  return (
    <div className="flex items-center gap-1 -ml-1">
      <div className="flex items-center bg-muted rounded-md">
        <button
          onClick={() => voteMutation.mutate(post.myVote === "UP" ? "NONE" : "UP")}
          className={cn("p-1.5 hover:bg-muted-foreground/10 rounded-l-md", post.myVote === "UP" && "text-emerald-600")}
        >
          <ArrowBigUp className={cn("h-4 w-4", post.myVote === "UP" && "fill-current")} />
        </button>
        <span className="text-xs font-semibold px-1.5 min-w-6 text-center">{post.score}</span>
        <button
          onClick={() => voteMutation.mutate(post.myVote === "DOWN" ? "NONE" : "DOWN")}
          className={cn("p-1.5 hover:bg-muted-foreground/10 rounded-r-md", post.myVote === "DOWN" && "text-rose-600")}
        >
          <ArrowBigDown className={cn("h-4 w-4", post.myVote === "DOWN" && "fill-current")} />
        </button>
      </div>
      <Button variant="ghost" size="sm" onClick={share}>
        <Share2 className="h-4 w-4 mr-1" />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => bookmarkMutation.mutate(post.isBookmarked ? "unsave" : "save")}
        className={cn(post.isBookmarked && "text-primary")}
      >
        <Bookmark className={cn("h-4 w-4 mr-1", post.isBookmarked && "fill-current")} />
        <span className="hidden sm:inline">{post.isBookmarked ? "Saved" : "Save"}</span>
      </Button>
    </div>
  );
}

function CommentEditor({ postId, parentId }: { postId: string; parentId?: string | null }) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await api.post(`/api/comments/post/${postId}`, {
        postId,
        content: content.trim(),
        parentId: parentId ?? null,
      });
      setContent("");
      qc.invalidateQueries({ queryKey: ["post", postId] });
      toast.success("Comment added");
    } catch (err) {
      toast.error((err as Error).message || "Could not add comment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Textarea
        rows={2}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? "Write a reply…" : "Write a comment…"}
        className="flex-1 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <Button size="sm" onClick={submit} disabled={loading || !content.trim()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function CommentItem({
  comment,
  postId,
  depth,
}: {
  comment: CommentNode;
  postId: string;
  depth: number;
}) {
  const qc = useQueryClient();
  const [replyOpen, setReplyOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [collapsed, setCollapsed] = useState(false);

  const voteMutation = useMutation({
    mutationFn: (vote: "UP" | "DOWN" | "NONE") =>
      api.post(`/api/comments/${comment.id}/vote`, { vote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post", postId] }),
    onError: () => toast.error("Could not vote"),
  });
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/comments/${comment.id}`),
    onSuccess: () => {
      toast.success("Comment deleted");
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
    onError: () => toast.error("Could not delete"),
  });
  const editMutation = useMutation({
    mutationFn: () => api.patch(`/api/comments/${comment.id}`, { content: editContent }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["post", postId] });
      toast.success("Comment updated");
    },
    onError: () => toast.error("Could not update"),
  });

  // Color-code by depth for visual distinction of nested replies
  const borderColor = ["#0d9488", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899", "#10b981"][depth % 6];

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="text-xs text-muted-foreground hover:underline"
        style={{ borderLeft: `2px solid ${borderColor}`, paddingLeft: 8 }}
      >
        [+] {comment.author.username || comment.author.name || "anonymous"} · {comment.score} points · {comment.replies.length} replies
      </button>
    );
  }

  return (
    <div
      className="rounded-md p-2 hover:bg-muted/40"
      style={{ borderLeft: `2px solid ${borderColor}`, paddingLeft: 8 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Avatar className="h-5 w-5">
          {comment.author.avatarUrl ? <AvatarImage src={comment.author.avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[9px] bg-muted">
            {(comment.author.username || comment.author.name || "?")[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <button
          className="text-xs font-semibold hover:underline"
          onClick={() => comment.author.username && useAppStore.getState().openUserProfile(comment.author.username!)}
        >
          @{comment.author.username || comment.author.name || "anonymous"}
        </button>
        <span className="text-[10px] text-muted-foreground">
          · {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
          {comment.isEdited && " (edited)"}
        </span>
        {comment.replies.length > 0 && (
          <button
            onClick={() => setCollapsed(true)}
            className="text-[10px] text-muted-foreground hover:underline ml-auto"
          >
            [−] collapse
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex gap-2 mb-1">
          <Textarea
            rows={2}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="flex-1 text-sm"
          />
          <div className="flex flex-col gap-1">
            <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-sm whitespace-pre-wrap">{comment.content}</div>
      )}

      <div className="flex items-center gap-1 mt-1 -ml-1">
        <button
          onClick={() => voteMutation.mutate(comment.myVote === "UP" ? "NONE" : "UP")}
          className={cn("p-1 hover:bg-muted-foreground/10 rounded", comment.myVote === "UP" && "text-emerald-600")}
        >
          <ArrowBigUp className={cn("h-3.5 w-3.5", comment.myVote === "UP" && "fill-current")} />
        </button>
        <span className="text-[10px] font-semibold px-1">{comment.score}</span>
        <button
          onClick={() => voteMutation.mutate(comment.myVote === "DOWN" ? "NONE" : "DOWN")}
          className={cn("p-1 hover:bg-muted-foreground/10 rounded", comment.myVote === "DOWN" && "text-rose-600")}
        >
          <ArrowBigDown className={cn("h-3.5 w-3.5", comment.myVote === "DOWN" && "fill-current")} />
        </button>
        <button
          onClick={() => setReplyOpen(!replyOpen)}
          className="ml-2 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Reply className="h-3 w-3" /> Reply
        </button>
        <button
          onClick={() => setEditing(true)}
          className="ml-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          className="ml-1 text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
      </div>

      {replyOpen && (
        <div className="mt-2">
          <CommentEditor postId={postId} parentId={comment.id} />
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="mt-2 ml-2 space-y-1">
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} postId={postId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
