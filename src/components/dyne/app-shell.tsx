"use client";

import { useState, useEffect, useMemo } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  BookOpen,
  Calendar,
  GraduationCap,
  StickyNote,
  Target,
  Repeat,
  Timer,
  BarChart3,
  Settings,
  Plus,
  Search,
  Bell,
  LogOut,
  Menu,
  Moon,
  Sun,
  CommandIcon,
  Newspaper,
  Users,
  Bookmark,
  Server,
  MessageSquare,
  User,
  ChevronDown,
  Compass,
  Video,
  CircleDot,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAppStore, NAV_ITEMS, type DyneView } from "@/store/app-store";
import { api } from "@/lib/api-client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dueLabel } from "@/lib/dates";
import { useRealtimeSocket, useNotificationRealtime } from "@/lib/realtime-client";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  CheckSquare,
  FileText,
  BookOpen,
  Calendar,
  GraduationCap,
  StickyNote,
  Target,
  Repeat,
  Timer,
  BarChart3,
  Settings,
  Newspaper,
  Users,
  Bookmark,
  Server,
  MessageSquare,
  User,
  Compass,
  Video,
  CircleDot,
};

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  actionUrl?: string | null;
  createdAt: string;
}

interface SearchResponse {
  results: Array<{
    type: string;
    id: string;
    title: string;
    subtitle?: string;
    color?: string;
    icon?: string | null;
    meta?: string;
    avatarUrl?: string | null;
    isOnline?: boolean;
    inviteCode?: string;
  }>;
}

interface DashboardData {
  notifications: Notification[];
  unreadNotifications: number;
}

function useUnreadCount() {
  const qc = useQueryClient();
  const { data } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/api/dashboard"),
    refetchInterval: 60 * 1000,
  });
  // Live notifications via socket
  const handleNotification = useMemo(() => {
    return (n: unknown) => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      const note = n as Notification;
      if (note?.title) toast(note.title);
    };
  }, [qc]);
  useNotificationRealtime(handleNotification);
  return { unreadCount: data?.unreadNotifications ?? 0, notifications: data?.notifications ?? [] };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { view, setView, setQuickAddOpen } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const { socket: realtimeSocket, isConnected: realtimeConnected } = useRealtimeSocket();

  // Mark online on mount, offline on unmount
  useEffect(() => {
    if (!session?.user?.id) return;
    api.patch(`/api/presence/${session.user.id}`, { isOnline: true }).catch(() => {});
    const onBeforeUnload = () => {
      // Fire-and-forget; navigator.sendBeacon works for POST but our endpoint expects PATCH.
      // Use fetch with keepalive=true which is supported in modern browsers.
      fetch(`/api/presence/${session.user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOnline: false }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      api.patch(`/api/presence/${session.user.id}`, { isOnline: false }).catch(() => {});
    };
  }, [session?.user?.id]);

  const userName = session?.user?.name || "Student";
  const username = session?.user?.username;
  const avatarUrl = session?.user?.avatarUrl;
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function NavSection({
    title,
    items,
  }: {
    title: string;
    items: typeof NAV_ITEMS;
  }) {
    return (
      <div className="px-3 py-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold px-3 mb-1">
          {title}
        </div>
        {items.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setView(item.id as DyneView);
                setMobileOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active
                  ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function NavList() {
    const academic = NAV_ITEMS.filter((i) => i.section === "academic");
    const social = NAV_ITEMS.filter((i) => i.section === "social");
    const communication = NAV_ITEMS.filter((i) => i.section === "communication");
    const personal = NAV_ITEMS.filter((i) => i.section === "personal");
    return (
      <nav className="flex flex-col">
        <NavSection title="Academic" items={academic} />
        <NavSection title="Community" items={social} />
        <NavSection title="Communication" items={communication} />
        <NavSection title="Personal" items={personal} />
      </nav>
    );
  }

  function Brand() {
    return (
      <div className="flex items-center gap-2 px-5 h-14 border-b border-sidebar-border">
        <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-base">
          D
        </div>
        <span className="font-semibold text-base tracking-tight">Dyne</span>
        <span className="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/60 ml-1 hidden sm:inline">
          Student Life OS
        </span>
      </div>
    );
  }

  function Header() {
    const { unreadCount, notifications } = useUnreadCount();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const { data: searchResults } = useQuery<SearchResponse>({
      queryKey: ["search", searchQuery],
      queryFn: () => api.get(`/api/search?q=${encodeURIComponent(searchQuery)}`),
      enabled: searchQuery.length >= 1,
    });

    const qc = useQueryClient();
    const markAllRead = useMutation({
      mutationFn: () => api.patch("/api/notifications", { markAllRead: true }),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["notifications"] });
      },
    });

    return (
      <header className="h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 flex items-center px-3 sm:px-5 gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <div className="h-full flex flex-col bg-sidebar">
              <Brand />
              <ScrollArea className="flex-1">
                <NavList />
              </ScrollArea>
              <div className="border-t border-sidebar-border p-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => signOut({ redirect: false }).then(() => (window.location.href = "/"))}
                >
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <button
              className="flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-muted/40 text-sm text-muted-foreground hover:bg-muted transition-colors w-full max-w-md"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search tasks, posts, people…</span>
              <span className="sm:hidden">Search</span>
              <kbd className="ml-auto hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border bg-background">
                <CommandIcon className="h-3 w-3" />K
              </kbd>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)] sm:w-[480px]"
            align="start"
          >
            <Command shouldFilter={false} className="rounded-lg">
              <CommandInput
                placeholder="Type to search across Dyne…"
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                {searchResults?.results && searchResults.results.length > 0 && (
                  <CommandGroup heading="Results">
                    {searchResults.results.map((r) => (
                      <CommandItem
                        key={`${r.type}-${r.id}`}
                        onSelect={() => {
                          setSearchOpen(false);
                          setSearchQuery("");
                          handleSearchResultClick(r);
                        }}
                        className="flex items-center gap-2"
                      >
                        {r.avatarUrl ? (
                          <img src={r.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: r.color || "#94a3b8" }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{r.title}</div>
                          {r.subtitle && (
                            <div className="text-xs text-muted-foreground truncate">
                              {r.subtitle}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {r.type}
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setQuickAddOpen(true)}
            className="hidden sm:inline-flex"
            aria-label="Quick add task"
            title="Quick add task (⌘N)"
          >
            <Plus className="h-5 w-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 dark:hidden" />
            <Moon className="h-4 w-4 hidden dark:block" />
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center px-1 font-semibold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => markAllRead.mutate()}
                  >
                    Mark all as read
                  </button>
                )}
              </div>
              <ScrollArea className="max-h-80">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    You're all caught up.
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={cn(
                          "px-3 py-2.5 flex gap-2 hover:bg-muted/40 cursor-pointer",
                          !n.read && "bg-primary/5"
                        )}
                        onClick={() => {
                          if (n.actionUrl) {
                            const url = new URL(n.actionUrl, window.location.href);
                            const view = url.searchParams.get("view") as DyneView;
                            const contextId = url.searchParams.get("conversationId") || url.searchParams.get("communityId");
                            if (view) setView(view, contextId ? { contextId } : undefined);
                          }
                        }}
                      >
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full mt-1.5 shrink-0",
                            n.read ? "bg-transparent" : "bg-primary"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{n.title}</div>
                          {n.message && (
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {n.message}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {dueLabel(n.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Account menu"
            onClick={() => setView("profile")}
          >
            <Avatar className="h-8 w-8">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={userName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </div>
      </header>
    );
  }

  function handleSearchResultClick(r: SearchResponse["results"][number]) {
    if (r.type === "course") useAppStore.getState().openCourse(r.id);
    else if (r.type === "task") useAppStore.getState().setView("tasks", { contextId: r.id });
    else if (r.type === "assignment") useAppStore.getState().openAssignment(r.id);
    else if (r.type === "exam") useAppStore.getState().openExam(r.id);
    else if (r.type === "note") useAppStore.getState().openNote(r.id);
    else if (r.type === "user") {
      // Start a conversation with this user
      api.post("/api/conversations", { otherUserId: r.id }).then(({ conversation }) => {
        useAppStore.getState().openConversation(conversation.id);
        useAppStore.getState().setView("messages");
      });
    }
    else if (r.type === "community") {
      useAppStore.getState().openCommunity(r.id);
      useAppStore.getState().setView("community", { contextId: r.id });
    }
    else if (r.type === "space") {
      // Try to join via inviteCode, then open the space
      api.post(`/api/spaces/${r.id}/join`, {}).then(() => {
        useAppStore.getState().openSpace(r.id);
        useAppStore.getState().setView("spaces");
      });
    }
    else if (r.type === "post") {
      useAppStore.getState().openPost(r.id);
    }
  }

  // Cmd+K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const trigger = document.querySelector<HTMLButtonElement>(
          "[aria-label='Search']"
        );
        trigger?.click();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setQuickAddOpen(true);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setQuickAddOpen]);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border">
        <Brand />
        <ScrollArea className="flex-1">
          <NavList />
        </ScrollArea>
        <div className="border-t border-sidebar-border p-3 space-y-2">
          <Button
            className="w-full"
            onClick={() => setQuickAddOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Quick add task
          </Button>
          <div className="flex items-center gap-2 px-1 pt-1">
            <Avatar className="h-6 w-6 shrink-0">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={userName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-xs flex-1 min-w-0">
              <div className="font-medium truncate">{userName}</div>
              <div className="text-muted-foreground truncate text-[10px]">
                {username ? `@${username}` : session?.user?.email}
              </div>
            </div>
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                realtimeConnected ? "bg-emerald-500" : "bg-amber-400"
              )}
              title={realtimeConnected ? "Real-time connected" : "Connecting…"}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              aria-label="Sign out"
              onClick={() => signOut({ redirect: false }).then(() => (window.location.href = "/"))}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 min-h-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
