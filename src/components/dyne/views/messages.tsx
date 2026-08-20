"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  Loader2,
  Trash2,
  Pencil,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Loading, EmptyState } from "@/components/dyne/states";
import { useAppStore } from "@/store/app-store";
import { useConversationRealtime } from "@/lib/realtime-client";
import { useUploads, type UploadedAttachment } from "@/lib/use-uploads";
import { AttachButton, AttachmentList, DropZone, UploadTray } from "@/components/dyne/attachments";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";

interface User {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  isOnline: boolean;
}
interface ConversationListItem {
  id: string;
  other: User;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    authorId: string;
    fileUrl: string | null;
    fileKind: string | null;
  } | null;
  updatedAt: string;
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
  author: User;
}

export function MessagesView() {
  const { openConversationId, openConversation, closeConversation } = useAppStore();
  const [composing, setComposing] = useState(false);

  // Read ?conversationId from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const cid = url.searchParams.get("conversationId");
    if (cid) openConversation(cid);
  }, []);

  const { data, isLoading } = useQuery<{ conversations: ConversationListItem[] }>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/api/conversations"),
    refetchInterval: 30_000,
  });
  const conversations = data?.conversations ?? [];

  if (openConversationId) {
    const conv = conversations.find((c) => c.id === openConversationId);
    return (
      <ConversationView
        conversationId={openConversationId}
        other={conv?.other}
        onBack={closeConversation}
      />
    );
  }

  return (
    <>
      <ViewHeader
        title="Messages"
        subtitle="Direct messages with other Dyne students."
        actions={
          <Button onClick={() => setComposing(true)}>
            <Plus className="h-4 w-4 mr-1" /> New
          </Button>
        }
      />
      <ViewContainer>
        {isLoading ? (
          <Loading label="Loading conversations" />
        ) : conversations.length === 0 ? (
          <Card>
            <CardContent className="py-0">
              <EmptyState
                icon={MessageSquare}
                title="No conversations yet"
                description="Start a conversation by searching for someone in the global search bar (⌘K)."
                action={
                  <Button variant="outline" onClick={() => useAppStore.getState().setView("community")}>
                    Browse community feed
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {conversations.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 text-left transition-colors"
                  >
                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        {c.other.avatarUrl ? <AvatarImage src={c.other.avatarUrl} alt="" /> : null}
                        <AvatarFallback className="bg-muted">
                          {(c.other.username || c.other.name || "?")[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
                          c.other.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">
                          {c.other.username ? `@${c.other.username}` : c.other.name || "Anonymous"}
                        </span>
                        {c.lastMessage && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(c.lastMessage.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.lastMessage
                          ? (c.lastMessage.authorId === c.other.id ? "" : "You: ") + c.lastMessage.content
                          : "No messages yet"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </ViewContainer>

      {composing && <NewConversationDialog onClose={() => setComposing(false)} />}
    </>
  );
}

function ConversationView({
  conversationId,
  other: otherProp,
  onBack,
}: {
  conversationId: string;
  other?: User;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const myUserId = session?.user?.id;
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; username: string | null }>>({});

  // Load conversation details
  const { data: convData } = useQuery<{ conversations: ConversationListItem[] }>({
    queryKey: ["conversations"],
    queryFn: () => api.get("/api/conversations"),
  });
  const conv = convData?.conversations.find((c) => c.id === conversationId);
  const other = otherProp ?? conv?.other ?? null;

  // Load messages
  const { data: msgsData, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery<{ messages: ChatMessage[]; nextCursor: string | null }>({
    queryKey: ["direct-messages", conversationId],
    queryFn: ({ pageParam }) =>
      api.get(`/api/conversations/${conversationId}${pageParam ? `?cursor=${pageParam}` : ""}`),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });
  const messages = msgsData?.pages.flatMap((p) => p.messages) ?? [];

  // Real-time
  const { sendTyping } = useConversationRealtime(conversationId, {
    onMessage: (msg) => {
      const message = msg as ChatMessage;
      qc.setQueryData<{ pages: Array<{ messages: ChatMessage[]; nextCursor: string | null }> }>(
        ["direct-messages", conversationId],
        (old) => {
          if (!old) return old;
          const newPages = [...old.pages];
          if (newPages.length === 0) {
            newPages.push({ messages: [message], nextCursor: null });
          } else {
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
      // Also invalidate conversations list to refresh preview
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
    onMessageUpdate: (msg) => {
      const message = msg as ChatMessage;
      qc.setQueryData<{ pages: Array<{ messages: ChatMessage[]; nextCursor: string | null }> }>(
        ["direct-messages", conversationId],
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
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[data.userId];
          return next;
        });
      }, 3000);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const uploads = useUploads();
  const sendMutation = useMutation({
    mutationFn: (data: { content: string; attachmentIds: string[] }) =>
      api.post("/api/direct-messages", {
        conversationId,
        content: data.content,
        attachmentIds: data.attachmentIds,
      }),
    onSuccess: () => {
      setMessageText("");
      uploads.clear();
      sendTyping(false);
    },
    onError: (err) => toast.error((err as Error).message || "Could not send"),
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
    sendMutation.mutate({ content: messageText.trim(), attachmentIds: uploads.readyIds });
  }

  // Group messages by date
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
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="h-14 border-b border-border px-4 flex items-center gap-3 shrink-0 bg-background">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {other && (
          <>
            <div className="relative">
              <Avatar className="h-8 w-8">
                {other.avatarUrl ? <AvatarImage src={other.avatarUrl} alt="" /> : null}
                <AvatarFallback className="bg-muted text-xs">
                  {(other.username || other.name || "?")[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                  other.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                )}
              />
            </div>
            <div>
              <div className="font-semibold text-sm">
                {other.username ? `@${other.username}` : other.name || "Anonymous"}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {other.isOnline ? "Online" : "Offline"}
              </div>
            </div>
          </>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="px-4 py-3 max-h-[calc(100vh-3.5rem-3.5rem-5rem)] overflow-y-auto">
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
              {group.messages.map((m) => (
                <DMMessageItem
                  key={m.id}
                  message={m}
                  isOwn={m.author.id === myUserId}
                />
              ))}
            </div>
          ))}
          {Object.keys(typingUsers).length > 0 && (
            <div className="text-xs text-muted-foreground italic px-2 py-1">
              {Object.values(typingUsers).map((u) => u.username).join(", ")} is typing…
            </div>
          )}
        </div>
      </ScrollArea>

      <DropZone onFiles={uploads.add} className="border-t border-border p-3 shrink-0">
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
            placeholder="Write a message…"
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

function DMMessageItem({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/direct-messages/${message.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-messages"] }),
  });
  const editMutation = useMutation({
    mutationFn: () => api.patch(`/api/direct-messages/${message.id}`, { content: editText }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["direct-messages"] });
    },
  });

  return (
    <div className={cn("group flex mb-1", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%] flex flex-col", isOwn ? "items-end" : "items-start")}>
        {!isOwn && (
          <div className="flex items-center gap-2 mb-0.5">
            <Avatar className="h-5 w-5">
              {message.author.avatarUrl ? <AvatarImage src={message.author.avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[9px] bg-muted">
                {(message.author.username || message.author.name || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.createdAt), "h:mm a")}
            </span>
          </div>
        )}
        {editing ? (
          <div className="flex gap-1">
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="text-sm flex-1 h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  editMutation.mutate();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditText(message.content);
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={() => editMutation.mutate()}>Save</Button>
          </div>
        ) : (
          <div
            className={cn(
              "rounded-2xl px-3 py-1.5 text-sm",
              message.isDeleted
                ? "italic text-muted-foreground bg-muted/60"
                : isOwn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            )}
          >
            {message.isDeleted ? "This message has been deleted." : message.content}
            {!message.isDeleted && <AttachmentList attachments={message.attachments ?? []} />}
            {message.isEdited && !message.isDeleted && (
              <span className="text-[10px] opacity-60 ml-1">(edited)</span>
            )}
          </div>
        )}
        {isOwn && !editing && (
          <div className="flex items-center gap-1 mt-0.5 opacity-0 group-hover:opacity-100">
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.createdAt), "h:mm a")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground hover:text-destructive"
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function NewConversationDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const { data: results } = useQuery<{ results: Array<{ id: string; title: string; subtitle?: string; avatarUrl?: string | null; type: string }> }>({
    queryKey: ["search", query],
    queryFn: () => api.get(`/api/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 1,
  });
  const users = (results?.results ?? []).filter((r) => r.type === "user");

  async function start(userId: string) {
    try {
      const res = await api.post<{ conversation: { id: string } }>("/api/conversations", { otherUserId: userId });
      useAppStore.getState().openConversation(res.conversation.id);
      useAppStore.getState().setView("messages");
      onClose();
    } catch (err) {
      toast.error((err as Error).message || "Could not start conversation");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>Search for a user by name or username.</DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or @username…"
          autoFocus
        />
        <ScrollArea className="max-h-64">
          <div className="space-y-1 mt-2">
            {users.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {query.length === 0 ? "Type to search…" : "No users found"}
              </p>
            ) : (
              users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => start(u.id)}
                  className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-muted text-left"
                >
                  <Avatar className="h-8 w-8">
                    {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="bg-muted text-xs">
                      {u.title[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{u.title}</div>
                    {u.subtitle && <div className="text-xs text-muted-foreground truncate">{u.subtitle}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
