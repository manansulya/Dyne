"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { AuthScreen } from "@/components/dyne/auth-screen";
import { OnboardingScreen } from "@/components/dyne/onboarding-screen";
import { AppShell } from "@/components/dyne/app-shell";
import { FullPageLoading } from "@/components/dyne/states";
import { QuickAddTaskDialog } from "@/components/dyne/quick-add-dialog";
import { DashboardView } from "@/components/dyne/views/dashboard";
import { TasksView } from "@/components/dyne/views/tasks";
import { AssignmentsView } from "@/components/dyne/views/assignments";
import { CoursesView } from "@/components/dyne/views/courses";
import { CalendarView } from "@/components/dyne/views/calendar";
import { ExamsView } from "@/components/dyne/views/exams";
import { NotesView } from "@/components/dyne/views/notes";
import { GoalsView } from "@/components/dyne/views/goals";
import { HabitsView } from "@/components/dyne/views/habits";
import { StudyView } from "@/components/dyne/views/study";
import { AnalyticsView } from "@/components/dyne/views/analytics";
import { SettingsView } from "@/components/dyne/views/settings";
import { CommunityFeedView } from "@/components/dyne/views/community-feed";
import { CommunitiesView } from "@/components/dyne/views/communities";
import { BookmarksView } from "@/components/dyne/views/bookmarks";
import { ExploreView } from "@/components/dyne/views/explore";
import { ReelsView } from "@/components/dyne/views/reels";
import { StoriesView } from "@/components/dyne/views/stories";
import { SpacesView } from "@/components/dyne/views/spaces";
import { MessagesView } from "@/components/dyne/views/messages";
import { ProfileView } from "@/components/dyne/views/profile";
import { CourseDetailDialog } from "@/components/dyne/views/course-detail";
import { AssignmentDetailDialog } from "@/components/dyne/views/assignment-detail";
import { ExamDetailDialog } from "@/components/dyne/views/exam-detail";
import { NoteEditorDialog } from "@/components/dyne/views/note-editor";
import { PostDetailDialog } from "@/components/dyne/views/post-detail";
import { UserProfileDialog } from "@/components/dyne/views/user-profile";
import { useAppStore } from "@/store/app-store";

export default function Home() {
  const { data: session, status } = useSession();
  const view = useAppStore((s) => s.view);
  const contextId = useAppStore((s) => s.contextId);
  const openUsername = useAppStore((s) => s.openUsername);

  // On initial mount, sync URL → state
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const viewParam = url.searchParams.get("view");
    const ctxId = url.searchParams.get("contextId");
    const username = url.searchParams.get("username");
    if (viewParam) {
      useAppStore.getState().setView(viewParam as any, ctxId ? { contextId: ctxId } : undefined);
    }
    if (username) {
      useAppStore.getState().openUserProfile(username);
    }
  }, []);

  // Sync state → URL whenever view/contextId changes
  useEffect(() => {
    if (typeof window === "undefined" || !session?.user) return;
    const url = new URL(window.location.href);
    if (view !== "dashboard") {
      url.searchParams.set("view", view);
    } else {
      url.searchParams.delete("view");
    }
    if (contextId) {
      url.searchParams.set("contextId", contextId);
    } else {
      url.searchParams.delete("contextId");
    }
    window.history.replaceState({}, "", url.toString());
  }, [view, contextId, session?.user]);

  if (status === "loading") return <FullPageLoading />;
  if (!session) return <AuthScreen />;
  if (!session.user.onboarded) return <OnboardingScreen />;

  return (
    <>
      <AppShell>
        <ViewRouter />
      </AppShell>
      <QuickAddTaskDialog />
      <CourseDetailDialog />
      <AssignmentDetailDialog />
      <ExamDetailDialog />
      <NoteEditorDialog />
      <PostDetailDialog />
      {openUsername && <UserProfileDialog />}
    </>
  );
}

function ViewRouter() {
  const view = useAppStore((s) => s.view);
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "tasks":
      return <TasksView />;
    case "assignments":
      return <AssignmentsView />;
    case "courses":
      return <CoursesView />;
    case "calendar":
      return <CalendarView />;
    case "exams":
      return <ExamsView />;
    case "notes":
      return <NotesView />;
    case "goals":
      return <GoalsView />;
    case "habits":
      return <HabitsView />;
    case "study":
      return <StudyView />;
    case "analytics":
      return <AnalyticsView />;
    case "settings":
      return <SettingsView />;
    case "community":
      return <CommunityFeedView />;
    case "communities":
      return <CommunitiesView />;
    case "bookmarks":
      return <BookmarksView />;
    case "explore":
      return <ExploreView />;
    case "reels":
      return <ReelsView />;
    case "stories":
      return <StoriesView />;
    case "spaces":
      return <SpacesView />;
    case "messages":
      return <MessagesView />;
    case "profile":
      return <ProfileView />;
    default:
      return <DashboardView />;
  }
}
