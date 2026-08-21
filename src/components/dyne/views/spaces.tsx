"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Server,
  Hash,
  Plus,
  Send,
  Loader2,
  Trash2,
  Pencil,
  Users as UsersIcon,
  Crown,
  Shield,
  LogOut,
  Copy,
  ArrowLeft,
  Smile,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { useUploads, type UploadedAttachment } from "@/lib/use-uploads";
import { AttachButton, AttachmentList, DropZone, UploadTray } from "@/components/dyne/attachments";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { useChannelRealtime, useUserPresence } from "@/lib/realtime-client";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

interface Space {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  color: string;
  inviteCode: string;
  ownerId: string;
  course: { id: string; name: string; code: string; color: string; icon: string | null } | null;
  channels: Channel[];
  members: SpaceMember[];
  _count: { members: number };
}
interface Channel {
  id: string;
  name: string;
  type: string;
  description: string | null;
  position: number;
}
interface SpaceMember {
  id: string;
  role: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    isOnline: boolean;
  };
}
interface ChatMessage {
  id: string;
  content: string;
  attachments?: UploadedAttachment[];
  fileUrl: string | null;
  fileKind: string | null;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    isOnline: boolean;
  };
}

export function SpacesView() {
  const { openSpaceId, openChannelId, openSpace, closeSpace, setActiveChannel } = useAppStore();
  const [creating, setCreating] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const { data, isLoading } = useQuery<{ spaces: Space[] }>({
    queryKey: ["spaces"],
    queryFn: () => api.get("/api/spaces"),
  });
  const spaces = data?.spaces ?? [];

  // If we have an openSpaceId, render the SpaceRoom instead
  if (openSpaceId) {
    const space = spaces.find((s) => s.id === openSpaceId);
    if (space) {
      // Auto-select first channel if none selected
      const channelId = openChannelId ?? space.channels[0]?.id ?? null;
      return (
        <SpaceRoom
          space={space}
          channelId={channelId}
          onBack={() => closeSpace()}
          onSelectChannel={setActiveChannel}
        />
      );
    }
    // Space not loaded yet
    return (
      <ViewContainer>
        <Loading />
      </ViewContainer>
    );
  }

  return (
    <>
      <ViewHeader
        title="Spaces"
        subtitle="Real-time study groups, course servers, and student communities."
        actions={
          <>
            <Button variant="outline" onClick={() => setJoinOpen(true)}>
              Join
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create
            </Button>
          </>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading spaces" />
        ) : spaces.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={Server}
                title="No spaces yet"
                description="Create or join a space to chat with classmates in real time."
                action={
                  <div className="flex gap-2">
                    <Button onClick={() => setCreating(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Create space
                    </Button>
                    <Button variant="outline" onClick={() => setJoinOpen(true)}>
                      Join with code
                    </Button>
                  </div>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((s) => (
              <Card key={s.id} className="hover:dyne-card-shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <button onClick={() => openSpace(s.id)} className="block w-full text-left">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="h-12 w-12 rounded-lg flex items-center justify-center text-base font-bold uppercase shrink-0"
                        style={{
                          backgroundColor: `${s.color}1a`,
                          color: s.color,
                        }}
                      >
                        {s.iconUrl ? (
                          <img src={s.iconUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          s.name.slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {s.course ? `${s.course.code} · ` : ""}{s._count.members} members · {s.channels.length} channels
                        </div>
                      </div>
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    )}
                  </button>
                  <Button size="sm" className="w-full mt-3" onClick={() => openSpace(s.id)}>
                    Open space
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ViewContainer>

      {creating && <CreateSpaceDialog onClose={() => setCreating(false)} />}
      {joinOpen && <JoinSpaceDialog onClose={() => setJoinOpen(false)} />}
    </>
  );
}

function SpaceRoom({
  space,
  channelId,
  onBack,
  onSelectChannel,
}: {
  space: Space;
  channelId: string | null;
  onBack: () => void;
  onSelectChannel: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [membersOpen, setMembersOpen] = useState(false);
  const activeChannel = space.channels.find((c) => c.id === channelId) ?? null;

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Space sidebar */}
      <aside className="hidden sm:flex w-60 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="h-12 border-b border-sidebar-border px-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack} aria-label="Back to spaces">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div
            className="h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold uppercase"
            style={{ backgroundColor: `${space.color}1a`, color: space.color }}
          >
            {space.iconUrl ? (
              <img src={space.iconUrl} alt="" className="h-full w-full rounded-md object-cover" />
            ) : (
              space.name.slice(0, 2)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-sm truncate">{space.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {space._count.members} members
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-2 mb-1">
              Text Channels
            </div>
            {space.channels.map((c) => (
              <button
                key={c.id}
                onClick={() => onSelectChannel(c.id)}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full hover:bg-sidebar-accent transition-colors",
                  c.id === channelId && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                )}
              >
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t border-sidebar-border p-2">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setMembersOpen(!membersOpen)}>
            <UsersIcon className="h-4 w-4 mr-1" /> Members
          </Button>
        </div>
      </aside>

      {/* Channel content */}
      <div className="flex-1 flex min-w-0">
        {activeChannel ? (
          <ChannelView
            space={space}
            channel={activeChannel}
            membersOpen={membersOpen}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Select a channel to start chatting
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelView({
  space,
  channel,
  membersOpen,
}: {
  space: Space;
  channel: Channel;
  membersOpen: boolean;
}) {
  const qc = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; username: string | null }>>({});

  // Load messages with infinite scroll (channel messages endpoint)
  const {
    data: msgsData,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery<{ messages: ChatMessage[]; nextCursor: string | null }>({
    queryKey: ["messages-channel", channel.id],
    queryFn: ({ pageParam }) =>
      api.get(`/api/messages?channelId=${channel.id}${pageParam ? `&cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });
  const messages = msgsData?.pages.flatMap((p) => p.messages) ?? [];

  // Real-time: append new messages, update edits/deletes, show typing
  const { sendTyping } = useChannelRealtime(channel.id, {
    onMessage: (msg) => {
      const message = msg as ChatMessage;
      // Optimistic append via setQueryData
      qc.setQueryData<{ pages: Array<{ messages: ChatMessage[]; nextCursor: string | null }> }>(
        ["messages-channel", channel.id],
        (old) => {
          if (!old) return old;
          const newPages = [...old.pages];
          if (newPages.length === 0) {
            newPages.push({ messages: [message], nextCursor: null });
          } else {
            // Avoid duplicates
            const exists = newPages.some((p) => p.messages.some((m) => m.id === message.id));
            if (!exists) {
              newPages[newPages.length - 1] = {
                ...newPages[newPages.length - 1],
                messages: [...newPages[newPages.length - 1].messages, message],
              };
            }
          }
          return { ...old, pages: newPages };
        }
      );
    },
    onMessageUpdate: (msg) => {
      const message = msg as ChatMessage;
      qc.setQueryData<{ pages: Array<{ messages: ChatMessage[]; nextCursor: string | null }> }>(
        ["messages-channel", channel.id],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              messages: p.messages.map((m) => (m.id === message.id ? message : m)),
            })),
          };
        }
      );
    },
    onTyping: (data) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) {
          next[data.userId] = { userId: data.userId, username: data.username };
        } else {
          delete next[data.userId];
        }
        return next;
      });
      // Auto-clear after 3s if no "stop" event arrives
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, 3000);
    },
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const uploads = useUploads();
  const sendMutation = useMutation({
    mutationFn: (data: {
      content: string;
      replyToId?: string | null;
      attachmentIds: string[];
    }) =>
      api.post("/api/messages", {
        channelId: channel.id,
        content: data.content,
        replyToId: data.replyToId ?? null,
        attachmentIds: data.attachmentIds,
      }),
    onSuccess: () => {
      setMessageText("");
      setReplyTo(null);
      uploads.clear();
      sendTyping(false);
    },
    onError: (err) => toast.error((err as Error).message || "Could not send message"),
  });

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setMessageText(e.target.value);
    sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000);
  }

  function handleSend() {
    if (!messageText.trim() && uploads.readyIds.length === 0) return;
    if (uploads.isUploading) return;
    sendMutation.mutate({
      content: messageText.trim(),
      replyToId: replyTo?.id ?? null,
      attachmentIds: uploads.readyIds,
    });
  }

  // Group messages by date for date dividers
  const groupedMessages = useMemo(() => {
    const groups: Array<{ date: string; messages: ChatMessage[] }> = [];
    for (const m of messages) {
      const dateKey = format(new Date(m.createdAt), "yyyy-MM-dd");
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === dateKey) {
        lastGroup.messages.push(m);
      } else {
        groups.push({ date: dateKey, messages: [m] });
      }
    }
    return groups;
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-card">
      {/* Channel header */}
      <div className="h-12 border-b border-border px-4 flex items-center gap-2 shrink-0">
        <Hash className="h-5 w-5 text-muted-foreground" />
        <span className="font-semibold">{channel.name}</span>
        {channel.description && (
          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline truncate">
            · {channel.description}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 flex min-h-0">
        <ScrollArea className="flex-1">
          <div ref={scrollRef} className="px-4 py-3 max-h-[calc(100vh-3.5rem-3rem-5rem)] overflow-y-auto">
            {hasNextPage && (
              <div className="flex justify-center pb-3">
                <Button variant="ghost" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                  {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Load older messages
                </Button>
              </div>
            )}
            {groupedMessages.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {isToday(new Date(group.date))
                      ? "Today"
                      : isYesterday(new Date(group.date))
                      ? "Yesterday"
                      : format(new Date(group.date), "MMM d, yyyy")}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                {group.messages.map((m, idx) => {
                  const prevMessage = idx > 0 ? group.messages[idx - 1] : null;
                  const showHeader =
                    !prevMessage ||
                    prevMessage.author.id !== m.author.id ||
                    new Date(m.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 5 * 60 * 1000;
                  return (
                    <MessageItem
                      key={m.id}
                      message={m}
                      showHeader={showHeader}
                      onReply={() => setReplyTo(m)}
                    />
                  );
                })}
              </div>
            ))}
            {/* Typing indicator */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="text-xs text-muted-foreground italic px-2 py-1">
                {Object.values(typingUsers)
                  .map((u) => u.username || "someone")
                  .join(", ")}{" "}
                {Object.keys(typingUsers).length === 1 ? "is" : "are"} typing…
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Members panel */}
        {membersOpen && (
          <aside className="hidden md:flex w-56 shrink-0 border-l border-border bg-sidebar/50 flex-col">
            <div className="h-12 border-b border-border px-3 flex items-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Members ({space.members.length})
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {space.members
                  .slice()
                  .sort((a, b) => {
                    const roleOrder = { ADMIN: 0, MODERATOR: 1, MEMBER: 2 };
                    return roleOrder[a.role as keyof typeof roleOrder] - roleOrder[b.role as keyof typeof roleOrder];
                  })
                  .map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent"
                    >
                      <div className="relative">
                        <Avatar className="h-7 w-7">
                          {m.user.avatarUrl ? <AvatarImage src={m.user.avatarUrl} alt="" /> : null}
                          <AvatarFallback className="text-[10px] bg-muted">
                            {(m.user.username || m.user.name || "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                            m.user.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                          )}
                        />
                      </div>
                      <span className="text-xs truncate flex-1">
                        {m.user.username || m.user.name || "anonymous"}
                      </span>
                      {m.role === "ADMIN" && <Crown className="h-3 w-3 text-amber-500" />}
                      {m.role === "MODERATOR" && <Shield className="h-3 w-3 text-sky-500" />}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </aside>
        )}
      </div>

      {/* Composer */}
      <DropZone onFiles={uploads.add} className="border-t border-border p-3 shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
            <span>Replying to</span>
            <span className="font-medium text-foreground">
              {replyTo.author.username || replyTo.author.name || "anonymous"}
            </span>
            <span className="line-clamp-1 flex-1">: {replyTo.content.slice(0, 80)}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyTo(null)}>
              ×
            </Button>
          </div>
        )}
        <UploadTray
          items={uploads.items}
          onCancel={uploads.cancel}
          onRetry={uploads.retry}
          onRemove={uploads.remove}
        />
        <div className="flex gap-2 items-end">
          <AttachButton onFiles={uploads.add} />
          <Input
            value={messageText}
            onChange={handleInputChange}
            placeholder={`Message #${channel.name}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={
              sendMutation.isPending ||
              uploads.isUploading ||
              (!messageText.trim() && uploads.readyIds.length === 0)
            }
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DropZone>
    </div>
  );
}

function MessageItem({
  message,
  showHeader,
  onReply,
}: {
  message: ChatMessage;
  showHeader: boolean;
  onReply: () => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/messages/${message.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages-channel"] }),
    onError: () => toast.error("Could not delete"),
  });
  const editMutation = useMutation({
    mutationFn: () => api.patch(`/api/messages/${message.id}`, { content: editText }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["messages-channel"] });
    },
  });

  return (
    <div
      className={cn(
        "group flex gap-3 px-2 py-1 hover:bg-muted/40 rounded-md",
        showHeader && "mt-3"
      )}
    >
      <Avatar className="h-9 w-9 shrink-0">
        {message.author.avatarUrl ? <AvatarImage src={message.author.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xs bg-muted">
          {(message.author.username || message.author.name || "?")[0]?.toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {message.author.username || message.author.name || "anonymous"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.createdAt), "h:mm a")}
            </span>
          </div>
        )}
        {editing ? (
          <div className="flex gap-1">
            <Textarea
              rows={1}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  editMutation.mutate();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditText(message.content);
                }
              }}
            />
            <Button size="sm" onClick={() => editMutation.mutate()}>Save</Button>
          </div>
        ) : message.isDeleted ? (
          <div className="text-sm italic text-muted-foreground">{message.content}</div>
        ) : (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        )}
        {!message.isDeleted && <AttachmentList attachments={message.attachments ?? []} />}
        {message.isEdited && !message.isDeleted && (
          <span className="text-[10px] text-muted-foreground ml-2">(edited)</span>
        )}
      </div>
      {/* Hover actions */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReply}>
          <Send className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => deleteMutation.mutate()}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
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
    setLoading(true);
    try {
      const res = await api.post<{ space: Space }>("/api/spaces", {
        name: name.trim(),
        description: description.trim() || null,
        color,
      });
      toast.success("Space created");
      qc.invalidateQueries({ queryKey: ["spaces"] });
      useAppStore.getState().openSpace(res.space.id);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not create space");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a space</DialogTitle>
          <DialogDescription>
            Spaces are real-time chat rooms for study groups, course discussions, or friend circles.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="s-name">Name</Label>
            <Input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Calculus II Study Group"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-desc">Description</Label>
            <Textarea
              id="s-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this space about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-color">Color</Label>
            <Input
              id="s-color"
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

function JoinSpaceDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!inviteCode.trim()) {
      toast.error("Paste an invite code or URL");
      return;
    }
    setLoading(true);
    try {
      // Extract code from URL if pasted as URL
      let code = inviteCode.trim();
      if (code.includes("inviteCode=")) {
        code = new URL(code).searchParams.get("inviteCode") ?? code;
      }
      const res = await api.post<{ ok: boolean; spaceId: string }>("/api/spaces/unknown/join", {
        inviteCode: code,
      });
      toast.success("Joined space");
      qc.invalidateQueries({ queryKey: ["spaces"] });
      useAppStore.getState().openSpace(res.spaceId);
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a space</DialogTitle>
          <DialogDescription>Paste an invite code or invite URL.</DialogDescription>
        </DialogHeader>
        <Input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="Paste invite code or URL"
          autoFocus
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Join
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
