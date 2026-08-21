import { describe, expect, it, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { POST as register } from "@/app/api/auth/register/route";
import { GET as getMe } from "@/app/api/me/route";
import { verifyPassword } from "@/lib/password";
import { actAs, createUser, db, jsonRequest, readJson } from "./helpers";

describe("registration", () => {
  beforeEach(() => actAs(null));

  it("creates a user with a bcrypt hash and never stores the plaintext", async () => {
    const email = `reg-${randomUUID()}@example.com`;
    const res = await register(
      jsonRequest("/api/auth/register", "POST", {
        name: "Reg User",
        email,
        password: "Passw0rd!23",
      })
    );
    expect(res.status).toBe(200);
    const { userId } = await readJson<{ userId: string }>(res);

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.email).toBe(email.toLowerCase());
    expect(user.passwordHash).not.toContain("Passw0rd!23");
    expect(await verifyPassword("Passw0rd!23", user.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-password", user.passwordHash)).toBe(false);
  });

  it("normalizes the email and rejects a duplicate registration", async () => {
    const email = `dup-${randomUUID()}@example.com`;
    const first = await register(
      jsonRequest("/api/auth/register", "POST", { name: "A", email, password: "Passw0rd!23" })
    );
    expect(first.status).toBe(200);

    const second = await register(
      jsonRequest("/api/auth/register", "POST", {
        name: "B",
        email: email.toUpperCase(),
        password: "Passw0rd!23",
      })
    );
    expect(second.status).toBe(409);
  });

  it("rejects a short password and an invalid email", async () => {
    const short = await register(
      jsonRequest("/api/auth/register", "POST", {
        name: "A",
        email: `short-${randomUUID()}@example.com`,
        password: "short",
      })
    );
    expect(short.status).toBe(400);

    const bad = await register(
      jsonRequest("/api/auth/register", "POST", {
        name: "A",
        email: "not-an-email",
        password: "Passw0rd!23",
      })
    );
    expect(bad.status).toBe(400);
  });
});

describe("session gate", () => {
  it("returns 401 for an unauthenticated request", async () => {
    actAs(null);
    const res = await getMe();
    expect(res.status).toBe(401);
  });

  it("returns the signed-in user", async () => {
    const user = await createUser();
    actAs(user.id);
    const res = await getMe();
    expect(res.status).toBe(200);
    const body = await readJson<{ user: { id: string; email: string } }>(res);
    expect(body.user.id).toBe(user.id);
    expect(body.user.email).toBe(user.email);
  });
});
