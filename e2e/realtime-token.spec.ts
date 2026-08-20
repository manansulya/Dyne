import { expect, test, type Page } from "@playwright/test";

/**
 * The browser can only obtain a realtime identity from the authenticated
 * session: anonymous requests get 401, and the minted token's subject is the
 * signed-in user, never a value the page supplied.
 */

const password = "Passw0rd!23";

async function tokenStatus(page: Page) {
  return page.evaluate(async () => {
    const res = await fetch("/api/realtime/token", { cache: "no-store" });
    const body = res.ok ? ((await res.json()) as { token?: string; expiresAt?: number }) : null;
    return { status: res.status, token: body?.token ?? null, expiresAt: body?.expiresAt ?? null };
  });
}

test("only an authenticated session can mint a realtime token", async ({ page }) => {
  await page.goto("/");
  const anonymous = await tokenStatus(page);
  expect(anonymous.status).toBe(401);
  expect(anonymous.token).toBeNull();

  const email = `e2e-realtime-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Full name").fill("Realtime User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Step 1 of 3/)).toBeVisible({ timeout: 30_000 });

  const authenticated = await tokenStatus(page);
  expect(authenticated.status).toBe(200);
  expect(authenticated.token).toBeTruthy();
  expect(authenticated.expiresAt).toBeGreaterThan(Date.now());

  // The token's subject is the session's user id, decided server-side.
  const sessionUserId = await page.evaluate(async () => {
    const res = await fetch("/api/auth/session");
    const body = (await res.json()) as { user?: { id?: string } };
    return body.user?.id ?? null;
  });
  const [payload] = (authenticated.token as string).split(".");
  const decoded = JSON.parse(
    Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
  ) as { sub: string };
  expect(decoded.sub).toBe(sessionUserId);
});
