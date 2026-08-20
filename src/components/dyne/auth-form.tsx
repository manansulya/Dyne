"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        if (!name.trim()) {
          toast.error("Please enter your name");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data?.error ?? "Registration failed");
          setLoading(false);
          return;
        }
        // Sign in automatically after successful registration
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (!result || result.error || result.status === 401) {
          // Registration succeeded but auto-login failed — show the login tab
          toast.error("Account created! Please sign in with your credentials.");
          setLoading(false);
          return;
        }
        toast.success("Welcome to Dyne");
        // Brief delay to ensure the session cookie is set before navigation
        await new Promise((resolve) => setTimeout(resolve, 300));
        window.location.href = "/";
      } else {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });
        if (!result || result.error || result.status === 401) {
          toast.error("Invalid email or password");
          setLoading(false);
          return;
        }
        toast.success("Welcome back");
        await new Promise((resolve) => setTimeout(resolve, 300));
        window.location.href = "/";
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "register" && (
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Johnson"
            autoComplete="name"
            required
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@university.edu"
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={8}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {mode === "login" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
