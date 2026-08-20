import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user;
}

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user.id;
}

/**
 * Wraps an API handler with auth + standard error handling.
 * Returns 401 when not authenticated, 500 on unexpected errors.
 */
export function withUserId<TArgs extends unknown[]>(
  fn: (userId: string, ...args: TArgs) => Promise<Response>
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    try {
      const userId = await requireUserId();
      return await fn(userId, ...args);
    } catch (err) {
      if (err instanceof Error && err.message === "UNAUTHORIZED") {
        return NextResponse.json(
          { error: "You must be signed in to do this." },
          { status: 401 }
        );
      }
      console.error("[api] error", err);
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

// re-export for convenience
import { NextResponse } from "next/server";

export { db };
