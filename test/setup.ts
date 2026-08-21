import { vi } from "vitest";
import { TEST_DATABASE_URL, TEST_STORAGE_ROOT } from "./db-path";

// Must be set before `@/lib/db` is imported by any route module.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NEXTAUTH_SECRET ??= "test-secret";
// Uploads in tests go to a throwaway root of the local storage driver, so no
// test ever needs (or reaches) real S3/R2 credentials.
process.env.STORAGE_DRIVER = "local";
process.env.STORAGE_LOCAL_ROOT = TEST_STORAGE_ROOT;
process.env.NEXTAUTH_URL ??= "http://localhost:3000";

// Route handlers go through the real `withUserId` / `requireUserId` code; only
// the NextAuth session lookup is replaced, so authorization logic is genuinely
// under test.
vi.mock("next-auth", async () => {
  const { currentSession } = await import("./session-state");
  return {
    default: () => undefined,
    getServerSession: async () =>
      currentSession.userId ? { user: { id: currentSession.userId } } : null,
  };
});

// The realtime service is not running during tests; broadcasts must not fail
// a request, and tests assert on DB state rather than socket traffic.
vi.mock("@/lib/realtime-server", () => ({
  broadcastChannelMessage: vi.fn(),
  broadcastChannelMessageUpdate: vi.fn(),
  broadcastDM: vi.fn(),
  broadcastDMUpdate: vi.fn(),
  broadcastCommunityPost: vi.fn(),
  broadcastCommunityComment: vi.fn(),
  broadcastNotification: vi.fn(),
}));
