import { NextResponse } from "next/server";

export const DEV_FIXTURES_FLAG = "ENABLE_DEV_FIXTURES";

/**
 * Development fixtures are additive sample content for a single account. They
 * are gated twice: never in a production build, and only when explicitly
 * enabled for the local/CI environment. Callers get a 404 so a deployed app
 * does not even admit the route exists.
 */
export function devFixturesEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env[DEV_FIXTURES_FLAG] === "true";
}

export function devFixturesDisabledResponse(): Response {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
