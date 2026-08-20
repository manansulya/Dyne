import { expect, test, type Page } from "@playwright/test";

/**
 * Golden path against a real server and a real database: register → onboard →
 * create a task → verify it survives a full reload → sign out → sign back in.
 */

const password = "Passw0rd!23";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function register(page: Page, email: string, name: string) {
  await page.goto("/");
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  // Onboarding is the first authenticated screen.
  await expect(page.getByText(/Step 1 of 3/)).toBeVisible({ timeout: 30_000 });
}

async function skipOnboarding(page: Page) {
  await page.getByRole("button", { name: "Skip all" }).click();
  // Onboarding finishes with a hard navigation to "/"; wait for the app shell.
  await expect(page.getByRole("button", { name: "Quick add task" }).first()).toBeVisible({
    timeout: 60_000,
  });
}

test("registers, onboards, and persists a task across a reload", async ({ page }) => {
  const email = uniqueEmail("e2e");
  await register(page, email, "E2E User");
  await skipOnboarding(page);

  // A brand-new account must show genuine empty state, not seeded content.
  await page.getByRole("button", { name: "Tasks", exact: true }).first().click();
  await expect(page.getByText(/Add your first task/i)).toBeVisible({ timeout: 30_000 });

  const title = `E2E task ${Date.now()}`;
  const created = await page.evaluate(async (taskTitle) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: taskTitle }),
    });
    return { status: res.status };
  }, title);
  expect(created.status).toBe(200);

  await page.reload();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 30_000 });
});

test("rejects a wrong password and accepts the right one", async ({ page }) => {
  const email = uniqueEmail("e2e-login");
  await register(page, email, "Login User");
  await skipOnboarding(page);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("tab", { name: "Sign in" })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("totally-wrong-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/Invalid email or password/i)).toBeVisible({ timeout: 30_000 });

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("tab", { name: "Sign in" })).toBeHidden({ timeout: 30_000 });
});
