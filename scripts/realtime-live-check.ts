/**
 * Live check for the realtime service against a running app instance: it
 * exercises the real HTTP authorization endpoint rather than the in-process
 * authorizer used by the Vitest suite.
 *
 *   bun scripts/realtime-live-check.ts
 *
 * Requires the app (NEXTAUTH_URL) and the realtime service (REALTIME_URL) to be
 * running against the same database and REALTIME_SECRET.
 */
import { io, type Socket } from "socket.io-client";
import { db } from "../src/lib/db";
import { signRealtimeToken } from "../src/lib/realtime-token";

const REALTIME_URL = process.env.REALTIME_URL ?? "http://localhost:3003";

function connect(auth: Record<string, unknown>): Promise<Socket> {
  const socket = io(REALTIME_URL, { path: "/", transports: ["websocket"], auth, reconnection: false });
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", (err) => reject(err));
  });
}

function joinDecision(socket: Socket, event: string, id: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no decision")), 5000);
    socket.once("realtime:joined", () => {
      clearTimeout(timer);
      resolve("joined");
    });
    socket.once("realtime:denied", () => {
      clearTimeout(timer);
      resolve("denied");
    });
    socket.emit(event, id);
  });
}

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"} ${label} (expected ${String(expected)}, got ${String(actual)})`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const conversation = await db.conversation.findFirst({
    select: { id: true, memberOneId: true, memberTwoId: true },
  });
  if (!conversation) throw new Error("no conversation in the database to probe");
  const outsider = await db.user.findFirst({
    where: { id: { notIn: [conversation.memberOneId, conversation.memberTwoId] } },
    select: { id: true },
  });
  if (!outsider) throw new Error("no third user in the database to probe");

  let anonymousError: string | null = null;
  try {
    await connect({});
    anonymousError = null;
  } catch (err) {
    anonymousError = (err as Error).message;
  }
  check("anonymous socket rejected", anonymousError, "unauthorized");

  const member = await connect({ token: signRealtimeToken(conversation.memberOneId).token });
  check("member joins own conversation", await joinDecision(member, "join:conversation", conversation.id), "joined");
  member.close();

  const other = await connect({ token: signRealtimeToken(outsider.id).token });
  check("outsider denied the conversation", await joinDecision(other, "join:conversation", conversation.id), "denied");
  other.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
