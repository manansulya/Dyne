import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const E2E_DATABASE_URL = `file:${path.resolve(process.cwd(), "db/e2e.db")}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  globalSetup: "./e2e/global-setup.ts",
  webServer: {
    // Runs against a production build on a dedicated database so E2E runs never
    // touch the development data.
    command: `next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      NEXTAUTH_URL: baseURL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? "e2e-secret",
    },
  },
});
