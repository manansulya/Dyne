"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "next-themes";
import { Sun, Moon, Loader2, LogOut, Sparkles, Trash2, User, Shield } from "lucide-react";
import { toast } from "sonner";
import { ViewHeader, ViewContainer } from "./view-header";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SettingsView() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { data: meData } = useQuery<{ user: { id: string; name: string; email: string; institution: string | null; semesterName: string | null; createdAt: string } }>({
    queryKey: ["me"],
    queryFn: () => api.get("/api/me"),
  });
  const user = meData?.user;
  const [name, setName] = useState(user?.name ?? "");
  const [institution, setInstitution] = useState(user?.institution ?? "");
  const [semesterName, setSemesterName] = useState(user?.semesterName ?? "");
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Sync when user data loads
  useState(() => {
    if (user) {
      setName(user.name);
      setInstitution(user.institution ?? "");
      setSemesterName(user.semesterName ?? "");
    }
  });

  async function saveProfile() {
    setSaving(true);
    try {
      await api.patch("/api/onboarding", {
        name,
        institution,
        semesterName,
      });
      await updateSession();
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error((err as Error).message || "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function seedDemoData() {
    setSeeding(true);
    try {
      const res = await api.post<{ ok: boolean; courses: number }>("/api/seed", {});
      toast.success(`Seeded ${res.courses} demo courses with assignments, exams, notes, and habits.`);
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message || "Could not seed data");
    } finally {
      setSeeding(false);
    }
  }

  async function resetAllData() {
    setResetting(true);
    try {
      await api.post("/api/seed", {});
      // The seed endpoint clears existing data first, then seeds.
      toast.success("All data has been reset to demo seed.");
      qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message || "Could not reset data");
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <ViewHeader title="Settings" subtitle="Manage your profile, theme, and demo data." />
      <ViewContainer>
        <div className="max-w-2xl space-y-5">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" /> Profile
              </CardTitle>
              <CardDescription>
                Update your personal information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="s-name">Full name</Label>
                <Input
                  id="s-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email</Label>
                <Input
                  id="s-email"
                  value={session?.user?.email ?? ""}
                  disabled
                  className="bg-muted/40"
                />
                <p className="text-[11px] text-muted-foreground">Email cannot be changed.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-inst">Institution</Label>
                <Input
                  id="s-inst"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="University of Somewhere"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-sem">Semester</Label>
                <Input
                  id="s-sem"
                  value={semesterName}
                  onChange={(e) => setSemesterName(e.target.value)}
                  placeholder="Fall 2025"
                />
              </div>
              <Button onClick={saveProfile} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save profile
              </Button>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                Appearance
              </CardTitle>
              <CardDescription>
                Choose between light and dark themes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    theme === "light"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Sun className="h-6 w-6" />
                  <span className="text-sm font-medium">Light</span>
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                    theme === "dark"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <Moon className="h-6 w-6" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Demo data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Demo data
              </CardTitle>
              <CardDescription>
                Generate realistic demo data (6 courses, assignments, exams, notes, habits, goals) to explore Dyne.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">Tip</Badge>
                Seeding clears your existing data and replaces it with demo content.
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={seedDemoData} disabled={seeding}>
                  {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
                  Seed demo data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Account
              </CardTitle>
              <CardDescription>
                Your data is isolated to your account. Sign out anytime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => signOut({ redirect: false }).then(() => window.location.reload())}
              >
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> Danger zone
              </CardTitle>
              <CardDescription>
                Reset all your data and reseed with demo content. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                    <Trash2 className="h-4 w-4 mr-2" /> Reset all data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset all your data?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your courses, assignments, tasks, exams, notes, goals, habits, and study sessions, then reseed with demo data. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={resetAllData}
                      disabled={resetting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {resetting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Reset everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </ViewContainer>
    </>
  );
}
