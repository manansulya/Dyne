"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  User as UserIcon,
  Loader2,
  Pencil,
  Calendar,
  Award,
  Users as UsersIcon,
  Server,
  FileText,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { format } from "date-fns";
// All imports above; component definitions below.

export function ProfileView() {
  const { data: session } = useSession();
  const { data, isLoading } = useQuery<{
    user: {
      id: string;
      name: string | null;
      username: string | null;
      email: string;
      bio: string | null;
      avatarUrl: string | null;
      institution: string | null;
      semesterName: string | null;
      createdAt: string;
      postsCount: number;
      commentsCount: number;
      joinedCommunities: number;
      joinedSpaces: number;
      karma: number;
      postKarma: number;
      commentKarma: number;
    };
  }>({
    queryKey: ["profile-me"],
    queryFn: () => api.get("/api/profile/me"),
  });
  const user = data?.user;
  const [editing, setEditing] = useState(false);

  return (
    <>
      <ViewHeader title="Profile" subtitle="Your public profile and account details." />
      <ViewContainer>
        {isLoading || !user ? (
          <Loading />
        ) : (
          <div className="max-w-3xl space-y-5">
            {/* Profile card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-20 w-20">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name ?? "User"} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                      {(user.username || user.name || "?")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">{user.name || "Anonymous"}</h2>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    </div>
                    {user.username && (
                      <div className="text-sm text-muted-foreground">@{user.username}</div>
                    )}
                    {user.bio && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{user.bio}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
                      {user.institution && (
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {user.institution}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Joined {format(new Date(user.createdAt), "MMM yyyy")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="h-3 w-3" />
                        {user.karma} karma
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
                  <Stat icon={<FileText className="h-4 w-4" />} label="Posts" value={user.postsCount} />
                  <Stat icon={<MessageSquare className="h-4 w-4" />} label="Comments" value={user.commentsCount} />
                  <Stat icon={<UsersIcon className="h-4 w-4" />} label="Communities" value={user.joinedCommunities} />
                  <Stat icon={<Server className="h-4 w-4" />} label="Spaces" value={user.joinedSpaces} />
                </div>
              </CardContent>
            </Card>

            {/* Account details */}
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>Your account information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="text-sm">{user.email}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Institution</Label>
                  <div className="text-sm">{user.institution || "—"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Semester</Label>
                  <div className="text-sm">{user.semesterName || "—"}</div>
                </div>
              </CardContent>
            </Card>

            {/* Karma breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Karma breakdown</CardTitle>
                <CardDescription>Reputation earned from posts and comments.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Post karma</span>
                  <span className="text-sm font-semibold">{user.postKarma}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Comment karma</span>
                  <span className="text-sm font-semibold">{user.commentKarma}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-medium">Total</span>
                  <span className="text-sm font-bold">{user.karma}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </ViewContainer>

      {editing && user && <EditProfileDialog user={user} onClose={() => setEditing(false)} />}
    </>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/60 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold text-lg">{value}</div>
    </div>
  );
}

function EditProfileDialog({
  user,
  onClose,
}: {
  user: {
    name: string | null;
    username: string | null;
    bio: string | null;
    avatarUrl: string | null;
    institution: string | null;
  };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const [institution, setInstitution] = useState(user.institution ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      await api.patch("/api/profile/me", {
        name: name.trim() || null,
        username: username.trim() || undefined,
        bio: bio.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        institution: institution.trim() || null,
      });
      toast.success("Profile updated. Sign out and back in to refresh your session.");
      qc.invalidateQueries({ queryKey: ["profile-me"] });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not update profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>Update your public profile.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="p-name">Full name</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-username">Username</Label>
            <Input
              id="p-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username (3-20 chars, letters/numbers/underscore)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-bio">Bio</Label>
            <Textarea
              id="p-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself…"
              maxLength={500}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-institution">Institution</Label>
            <Input
              id="p-institution"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="University of Somewhere"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-avatar">Avatar URL</Label>
            <Input
              id="p-avatar"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…/avatar.jpg"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
