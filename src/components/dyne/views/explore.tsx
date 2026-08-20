"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Compass, Heart, MessageSquare, Users, Hash, Video } from "lucide-react";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

interface ExploreData {
  posts: Array<{
    id: string;
    title: string;
    content: string;
    mediaUrl: string | null;
    mediaKind: string | null;
    createdAt: string;
    author: { id: string; name: string; username: string; avatarUrl: string | null };
    community: { id: string; name: string; color: string } | null;
    _count: { likes: number; comments: number };
    hasLiked: boolean;
  }>;
  reels: Array<{
    id: string;
    videoUrl: string;
    posterUrl: string | null;
    caption: string;
    views: number;
    user: { id: string; name: string; username: string; avatarUrl: string | null };
    _count: { likes: number; comments: number };
  }>;
  users: Array<{
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    _count: { followers: number; posts: number };
  }>;
  hashtags: Array<{ tag: string; count: number }>;
}

export function ExploreView() {
  const { data, isLoading } = useQuery<ExploreData>({
    queryKey: ["explore"],
    queryFn: () => api.get("/api/explore"),
  });
  const { openPost, setView, openUserProfile } = useAppStore();
  const qc = useQueryClient();

  const likeMutation = useMutation({
    mutationFn: (postId: string) => api.post(`/api/posts/${postId}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["explore"] }),
  });

  if (isLoading) {
    return (
      <ViewContainer>
        <Loading label="Discovering content" />
      </ViewContainer>
    );
  }

  if (!data) {
    return (
      <ViewContainer>
        <EmptyState icon={Compass} title="Nothing to explore yet" description="Create posts and reels to see them here." />
      </ViewContainer>
    );
  }

  return (
    <>
      <ViewHeader title="Explore" subtitle="Discover posts, reels, people, and trending hashtags across Dyne." />
      <ViewContainer>
        <div className="space-y-8">
          {/* Trending Posts */}
          {data.posts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Trending Posts</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.posts.map((p) => (
                  <Card key={p.id} className="hover:dyne-card-shadow-lg transition-shadow cursor-pointer" >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="h-8 w-8">
                          {p.author.avatarUrl ? <AvatarImage src={p.author.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-[10px] bg-muted">{p.author.name?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{p.author.name}</div>
                          <div className="text-[10px] text-muted-foreground truncate">@{p.author.username || "user"}</div>
                        </div>
                      </div>
                      <button onClick={() => openPost(p.id)} className="block text-left w-full">
                        <div className="font-medium text-sm mb-1 line-clamp-2">{p.title}</div>
                        {p.content && <div className="text-xs text-muted-foreground line-clamp-2">{p.content}</div>}
                      </button>
                      {p.mediaUrl && p.mediaKind === "IMAGE" && (
                        <img src={p.mediaUrl} alt="" className="rounded-md max-h-48 object-cover w-full mt-2" />
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => likeMutation.mutate(p.id)}
                          className={cn("flex items-center gap-1 text-xs", p.hasLiked && "text-rose-500")}
                        >
                          <Heart className={cn("h-3.5 w-3.5", p.hasLiked && "fill-current")} />
                          {p._count.likes}
                        </button>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {p._count.comments}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Trending Reels */}
          {data.reels.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Trending Reels</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {data.reels.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setView("reels")}
                    className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted group"
                  >
                    {r.posterUrl ? (
                      <img src={r.posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Video className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                      <div className="text-[10px] text-white font-medium truncate">@{r.user.username || r.user.name}</div>
                      <div className="text-[10px] text-white/80 flex items-center gap-2">
                        <span>▶ {r.views}</span>
                        <span>❤ {r._count.likes}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Suggested Users */}
          {data.users.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Suggested Users</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.users.map((u) => (
                  <Card key={u.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="bg-muted">{u.name?.[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <button
                          className="font-medium text-sm hover:underline"
                          onClick={() => u.username && openUserProfile(u.username)}
                        >
                          {u.name}
                        </button>
                        <div className="text-xs text-muted-foreground truncate">
                          @{u.username} · {u._count.followers} followers
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Trending Hashtags */}
          {data.hashtags.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Trending Hashtags</h2>
              <div className="flex flex-wrap gap-2">
                {data.hashtags.map((h) => (
                  <Badge key={h.tag} variant="secondary" className="cursor-pointer hover:bg-muted">
                    <Hash className="h-3 w-3 mr-1" />
                    {h.tag.slice(1)} · {h.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.posts.length === 0 && data.reels.length === 0 && data.users.length === 0 && (
            <EmptyState icon={Compass} title="Nothing to explore yet" description="Start creating posts and reels to populate the explore page." />
          )}
        </div>
      </ViewContainer>
    </>
  );
}
