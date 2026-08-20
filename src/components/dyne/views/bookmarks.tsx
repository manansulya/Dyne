"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
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

export function BookmarksView() {
  const qc = useQueryClient();
  const { openPost } = useAppStore();
  const { data, isLoading } = useQuery<{ posts: Post[] }>({
    queryKey: ["bookmarks"],
    queryFn: () => api.get("/api/bookmarks"),
  });
  const posts = data?.posts ?? [];

  const removeMutation = useMutation({
    mutationFn: (postId: string) => api.delete(`/api/posts/${postId}/bookmark`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookmarks"] });
      toast.success("Removed from saved");
    },
  });

  return (
    <>
      <ViewHeader
        title="Saved Posts"
        subtitle="Your bookmarked posts from communities."
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading saved posts" />
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Bookmark}
                title="No saved posts"
                description="Bookmark posts from communities to find them here later."
                action={
                  <Button onClick={() => useAppStore.getState().setView("community")}>
                    Browse community feed
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <Card key={p.id} className="hover:dyne-card-shadow-lg transition-shadow">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: `${p.community.color}1a`,
                        color: p.community.color,
                      }}
                    >
                      {p.community.name.slice(0, 2)}
                    </div>
                    <button
                      onClick={() => useAppStore.getState().setView("community", { contextId: p.community.id })}
                      className="text-sm font-semibold hover:underline"
                      style={{ color: p.community.color }}
                    >
                      {p.community.name}
                    </button>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">
                      Saved {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto text-destructive"
                      onClick={() => removeMutation.mutate(p.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <button onClick={() => openPost(p.id)} className="block text-left w-full">
                    <h2 className="text-lg font-semibold tracking-tight mb-1 hover:text-primary transition-colors">
                      {p.title}
                    </h2>
                    {p.content && (
                      <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap mb-2">
                        {p.content}
                      </div>
                    )}
                    {p.mediaKind === "IMAGE" && p.mediaUrl && (
                      <img src={p.mediaUrl} alt="" className="rounded-md max-h-72 object-cover w-full mb-2" />
                    )}
                  </button>
                  <div className="flex items-center gap-1 mt-2 -ml-1">
                    <div className="flex items-center bg-muted rounded-md px-1 py-0.5">
                      <ArrowBigUp className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-xs font-semibold px-1.5 min-w-6 text-center">{p.score}</span>
                      <ArrowBigDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => openPost(p.id)}>
                      <MessageSquare className="h-4 w-4 mr-1" />
                      {p._count.comments}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ViewContainer>
    </>
  );
}
