import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { actAs } from "./session-state";

export { actAs };
export { db };

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** Creates a real user row with a real bcrypt hash. */
export async function createUser(overrides: { name?: string; password?: string } = {}): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`;
  const password = overrides.password ?? "Passw0rd!23";
  const user = await db.user.create({
    data: {
      email,
      name: overrides.name ?? "Test User",
      passwordHash: await hashPassword(password),
    },
  });
  return { id: user.id, email, password };
}

/** Builds a Request the App Router handlers accept. */
export function jsonRequest(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  body?: unknown
): Request {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Route context shape for dynamic segments (`ctx.params` is a promise in Next 15+). */
export function params<T extends Record<string, string>>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}

export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
