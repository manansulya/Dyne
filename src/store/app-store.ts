"use client";

import { create } from "zustand";

export type DyneView =
  // Academic
  | "dashboard"
  | "tasks"
  | "assignments"
  | "courses"
  | "calendar"
  | "exams"
  | "notes"
  | "goals"
  | "habits"
  | "study"
  | "analytics"
  // Social
  | "community"
  | "communities"
  | "bookmarks"
  | "explore"
  | "reels"
  | "stories"
  // Communication
  | "messages"
  | "spaces"
  | "spaces-list"
  // Profile
  | "profile"
  | "settings";

export interface NavItem {
  id: DyneView;
  label: string;
  icon: string;
  section: "academic" | "social" | "communication" | "personal";
}

export const NAV_ITEMS: NavItem[] = [
  // Academic
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", section: "academic" },
  { id: "tasks", label: "Tasks", icon: "CheckSquare", section: "academic" },
  { id: "assignments", label: "Assignments", icon: "FileText", section: "academic" },
  { id: "courses", label: "Courses", icon: "BookOpen", section: "academic" },
  { id: "calendar", label: "Calendar", icon: "Calendar", section: "academic" },
  { id: "exams", label: "Exams", icon: "GraduationCap", section: "academic" },
  { id: "notes", label: "Notes", icon: "StickyNote", section: "academic" },
  { id: "goals", label: "Goals", icon: "Target", section: "academic" },
  { id: "habits", label: "Habits", icon: "Repeat", section: "academic" },
  { id: "study", label: "Study Sessions", icon: "Timer", section: "academic" },
  { id: "analytics", label: "Analytics", icon: "BarChart3", section: "academic" },
  // Social
  { id: "community", label: "Community Feed", icon: "Newspaper", section: "social" },
  { id: "explore", label: "Explore", icon: "Compass", section: "social" },
  { id: "reels", label: "Reels", icon: "Video", section: "social" },
  { id: "stories", label: "Stories", icon: "CircleDot", section: "social" },
  { id: "communities", label: "Communities", icon: "Users", section: "social" },
  { id: "bookmarks", label: "Saved Posts", icon: "Bookmark", section: "social" },
  // Communication
  { id: "spaces", label: "Spaces", icon: "Server", section: "communication" },
  { id: "messages", label: "Messages", icon: "MessageSquare", section: "communication" },
  // Personal
  { id: "profile", label: "Profile", icon: "User", section: "personal" },
  { id: "settings", label: "Settings", icon: "Settings", section: "personal" },
];

interface AppState {
  view: DyneView;
  // context-specific params
  contextId: string | null;
  setView: (view: DyneView, opts?: { contextId?: string | null }) => void;
  // community context
  openCommunityId: string | null;
  openCommunity: (id: string) => void;
  closeCommunity: () => void;
  openPostId: string | null;
  openPost: (id: string) => void;
  closePost: () => void;
  // course context
  openCourseId: string | null;
  openCourse: (id: string) => void;
  closeCourse: () => void;
  openAssignmentId: string | null;
  openAssignment: (id: string) => void;
  closeAssignment: () => void;
  openExamId: string | null;
  openExam: (id: string) => void;
  closeExam: () => void;
  openNoteId: string | null;
  openNote: (id: string) => void;
  closeNote: () => void;
  // space context
  openSpaceId: string | null;
  openChannelId: string | null;
  openSpace: (spaceId: string, channelId?: string) => void;
  closeSpace: () => void;
  setActiveChannel: (channelId: string) => void;
  // messages context
  openConversationId: string | null;
  openConversation: (id: string) => void;
  closeConversation: () => void;
  // user context (for profile lookup)
  openUsername: string | null;
  openUserProfile: (username: string) => void;
  closeUserProfile: () => void;
  // Quick-add task dialog
  quickAddOpen: boolean;
  setQuickAddOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: "dashboard",
  contextId: null,
  setView: (view, opts) =>
    set({ view, contextId: opts?.contextId ?? null }),
  openCommunityId: null,
  openCommunity: (id) => set({ openCommunityId: id }),
  closeCommunity: () => set({ openCommunityId: null }),
  openPostId: null,
  openPost: (id) => set({ openPostId: id }),
  closePost: () => set({ openPostId: null }),
  openCourseId: null,
  openCourse: (id) => set({ openCourseId: id }),
  closeCourse: () => set({ openCourseId: null }),
  openAssignmentId: null,
  openAssignment: (id) => set({ openAssignmentId: id }),
  closeAssignment: () => set({ openAssignmentId: null }),
  openExamId: null,
  openExam: (id) => set({ openExamId: id }),
  closeExam: () => set({ openExamId: null }),
  openNoteId: null,
  openNote: (id) => set({ openNoteId: id }),
  closeNote: () => set({ openNoteId: null }),
  openSpaceId: null,
  openChannelId: null,
  openSpace: (spaceId, channelId) => set({ openSpaceId: spaceId, openChannelId: channelId ?? null }),
  closeSpace: () => set({ openSpaceId: null, openChannelId: null }),
  setActiveChannel: (channelId) => set({ openChannelId: channelId }),
  openConversationId: null,
  openConversation: (id) => set({ openConversationId: id }),
  closeConversation: () => set({ openConversationId: null }),
  openUsername: null,
  openUserProfile: (username) => set({ openUsername: username }),
  closeUserProfile: () => set({ openUsername: null }),
  quickAddOpen: false,
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
}));
