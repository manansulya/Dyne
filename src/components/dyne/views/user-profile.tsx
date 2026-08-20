"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Loader2,
  Calendar,
  Award,
  FileText,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { format } from "date-fns";

interface PublicUser {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  avatarUrl: string | null;
  institution: string | null;
  createdAt: string;
  isOnline: boolean;
  postsCount: number;
  commentsCount: number;
  karma: number;
  postKarma: number;
  commentKarma: number;
  isFollowing: boolean;
}

export function UserProfileDialog() {
  const { openUsername, closeUserProfile } = useAppStore();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ user: PublicUser }>({
    queryKey: ["profile", openUsername],
    queryFn: () => api.get(`/api/profile/${openUsername}`),
    enabled: Boolean(openUsername),
  });
  const user = data?.user;

  const followMutation = useMutation({
    mutationFn: (action: "follow" | "unfollow") =>
      action === "follow"
        ? api.post(`/api/follow/${user?.id}`, {})
        : api.delete(`/api/follow/${user?.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", openUsername] });
      toast.success("Updated");
    },
    onError: () => toast.error("Could not update"),
  });

  async function startDM() {
    if (!user) return;
    try {
      const res = await api.post<{ conversation: { id: string } }>("/api/conversations", {
        otherUserId: user.id,
      });
      useAppStore.getState().openConversation(res.conversation.id);
      useAppStore.getState().setView("messages");
      closeUserProfile();
    } catch (err) {
      toast.error((err as Error).message || "Could not start conversation");
    }
  }

  return (
    <Dialog open={Boolean(openUsername)} onOpenChange={(o) => !o && closeUserProfile()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User profile</DialogTitle>
          <DialogDescription>Public profile for @{openUsername}</DialogDescription>
        </DialogHeader>
        {isLoading || !user ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-16 w-16">
                {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                  {(user.username || user.name || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">{user.name || "Anonymous"}</h3>
                {user.username && <div className="text-sm text-muted-foreground">@{user.username}</div>}
                {user.isOnline && <Badge variant="outline" className="text-emerald-600 border-emerald-600 text-[10px] mt-1">Online</Badge>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                  {user.institution && (
                    <span>{user.institution}</span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(user.createdAt), "MMM yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {user.karma} karma
                  </span>
                </div>
              </div>
            </div>

            {user.bio && (
              <p className="text-sm whitespace-pre-wrap">{user.bio}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted p-3 text-center">
                <FileText className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-lg font-semibold">{user.postsCount}</div>
                <div className="text-[10px] text-muted-foreground">posts</div>
              </div>
              <div className="rounded-md bg-muted p-3 text-center">
                <MessageSquare className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <div className="text-lg font-semibold">{user.commentsCount}</div>
                <div className="text-[10px] text-muted-foreground">comments</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant={user.isFollowing ? "outline" : "default"}
                className="flex-1"
                onClick={() => followMutation.mutate(user.isFollowing ? "unfollow" : "follow")}
              >
                {user.isFollowing ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-1" /> Following
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-1" /> Follow
                  </>
                )}
              </Button>
              <Button variant="outline" className="flex-1" onClick={startDM}>
                <MessageSquare className="h-4 w-4 mr-1" /> Message
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
