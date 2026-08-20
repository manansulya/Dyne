"use client";

import { useState } from "react";
import { AuthForm } from "./auth-form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <div className="min-h-screen w-full flex">
      {/* Left panel: branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 w-96 h-96 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary-foreground text-primary flex items-center justify-center font-bold text-lg">
              D
            </div>
            <span className="text-xl font-semibold tracking-tight">Dyne</span>
          </div>
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-semibold leading-tight text-balance">
              Your academic and personal life, finally in one place.
            </h1>
            <p className="text-primary-foreground/80 text-lg leading-relaxed">
              Dyne unifies your tasks, assignments, courses, calendar, goals, habits, and study analytics into a single, calm workspace — built for students.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-4">
              {[
                { label: "Courses", icon: "📚" },
                { label: "Assignments", icon: "📝" },
                { label: "Calendar", icon: "📅" },
                { label: "Habits", icon: "🔄" },
                { label: "Goals", icon: "🎯" },
                { label: "Analytics", icon: "📊" },
              ].map((f) => (
                <div
                  key={f.label}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 backdrop-blur-sm text-sm"
                >
                  <span className="text-lg">{f.icon}</span>
                  <span>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-primary-foreground/60 text-sm">
            Built for focus. Designed for clarity.
          </p>
        </div>
      </div>

      {/* Right panel: auth form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
              D
            </div>
            <span className="text-xl font-semibold tracking-tight">Dyne</span>
          </div>
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "login"
                ? "Sign in to continue to your dashboard."
                : "Start organizing your student life in minutes."}
            </p>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Create account</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <AuthForm mode="login" />
            </TabsContent>
            <TabsContent value="register">
              <AuthForm mode="register" />
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground text-center mt-6">
            By continuing you agree to use Dyne for personal productivity only.
          </p>
        </div>
      </div>
    </div>
  );
}
