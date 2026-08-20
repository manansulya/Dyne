"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Users as UsersIcon,
  Search,
  Plus,
  Loader2,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { formatDistanceToNow } from "date-fns";

interface Community {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  color: string;
  createdAt: string;
  _count: { members: number; posts: number };
}

export function CommunitiesView() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const { setView, openCommunity } = useAppStore();

  const { data, isLoading } = useQuery<{ mine: Community[]; popular: Community[]; all: Community[] }>({
    queryKey: ["communities"],
    queryFn: () => api.get("/api/communities"),
  });

  const { data: searchData } = useQuery<{ communities: Community[] }>({
    queryKey: ["communities-search", search],
    queryFn: () => api.get(`/api/communities/search?q=${encodeURIComponent(search)}`),
    enabled: search.length >= 1,
  });

  const joinMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/communities/${id}/join`, {}),
    onSuccess: () => {
      toast.success("Joined community");
      qc.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (err) => toast.error((err as Error).message || "Could not join"),
  });

  return (
    <>
      <ViewHeader
        title="Communities"
        subtitle="Discover student communities, ask questions, share resources."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create
          </Button>
        }
      />
      <ViewContainer>
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search communities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {search.trim() ? (
          // Search results
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Search results
            </h2>
            {isLoading ? (
              <Loading />
            ) : (searchData?.communities ?? []).length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No communities found matching "{search}".{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setCreating(true)}
                  >
                    Create one →
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(searchData?.communities ?? []).map((c) => (
                  <CommunityCard key={c.id} community={c} onJoin={() => joinMutation.mutate(c.id)} onOpen={() => { openCommunity(c.id); setView("community", { contextId: c.id }); }} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {data?.mine && data.mine.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4" /> Your communities ({data.mine.length})
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.mine.map((c) => (
                    <CommunityCard key={c.id} community={c} onOpen={() => { openCommunity(c.id); setView("community", { contextId: c.id }); }} joined />
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Popular communities
              </h2>
              {isLoading ? (
                <Loading />
              ) : (data?.popular ?? []).length === 0 ? (
                <Card>
                  <CardContent className="py-0">
                    <EmptyState
                      icon={UsersIcon}
                      title="No communities yet"
                      description="Be the first to create a community for your university or course."
                      action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> Create community</Button>}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(data?.popular ?? []).map((c) => (
                    <CommunityCard
                      key={c.id}
                      community={c}
                      onJoin={() => joinMutation.mutate(c.id)}
                      onOpen={() => { openCommunity(c.id); setView("community", { contextId: c.id }); }}
                      joined={data?.mine?.some((m) => m.id === c.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </ViewContainer>

      {creating && <CreateCommunityDialog onClose={() => setCreating(false)} />}
    </>
  );
}

// CommunitiesView is above.

function CommunityCard({
  community,
  onJoin,
  onOpen,
  joined,
}: {
  community: Community;
  onJoin?: () => void;
  onOpen: () => void;
  joined?: boolean;
}) {
  return (
    <Card className="hover:dyne-card-shadow-lg transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2 mb-1">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center text-xs font-bold uppercase shrink-0"
                style={{
                  backgroundColor: `${community.color}1a`,
                  color: community.color,
                }}
              >
                {community.iconUrl ? (
                  <img src={community.iconUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  community.name.slice(0, 2)
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{community.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  Created {formatDistanceToNow(new Date(community.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
            {community.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{community.description}</p>
            )}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <UsersIcon className="h-3 w-3" />
            {community._count.members} members
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {community._count.posts} posts
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onOpen}>
            Open
          </Button>
          {!joined && onJoin && (
            <Button size="sm" onClick={onJoin}>
              Join
            </Button>
          )}
          {joined && <Badge variant="secondary" className="text-xs">Joined</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateCommunityDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#0d9488");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
      toast.error("Name must start with a letter and contain only letters/numbers/underscores");
      return;
    }
    setLoading(true);
    try {
      await api.post("/api/communities", { name: name.trim(), description: description.trim() || null, color });
      toast.success("Community created");
      qc.invalidateQueries({ queryKey: ["communities"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not create community");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create community</DialogTitle>
          <DialogDescription>
            Communities are spaces for students to discuss shared interests or courses.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. cs_students"
              autoFocus
              maxLength={20}
            />
            <p className="text-[10px] text-muted-foreground">
              Must start with a letter, 3–20 chars, letters/numbers/underscores only.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-desc">Description (optional)</Label>
            <Textarea
              id="c-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What is this community about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-color">Color</Label>
            <Input
              id="c-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-20 p-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
