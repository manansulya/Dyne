import { createRealtimeServer } from "./server";
import { roomName, type Room } from "../../src/lib/realtime-rooms";

const PORT = Number(process.env.REALTIME_PORT ?? 3003);
const APP_URL = process.env.APP_INTERNAL_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const SECRET = process.env.REALTIME_SECRET || process.env.NEXTAUTH_SECRET;

if (!SECRET) {
  console.error(
    "[realtime] refusing to start without REALTIME_SECRET (or NEXTAUTH_SECRET): " +
      "unauthenticated sockets would be able to impersonate users"
  );
  process.exit(1);
}

/**
 * Room membership lives in the app's database, so the service asks the app.
 * The request is authenticated with the shared secret; the app never trusts the
 * user id from a browser because it only ever comes from a verified token here.
 */
async function authorizeRoom(userId: string, room: Room): Promise<boolean> {
  const res = await fetch(`${APP_URL}/api/internal/realtime/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-realtime-secret": SECRET as string },
    body: JSON.stringify({ userId, room: roomName(room) }),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { allowed?: unknown };
  return body.allowed === true;
}

const server = createRealtimeServer({ secret: SECRET, authorizeRoom });

server.listen(PORT).then((port) => {
  console.log(`[realtime] Dyne realtime server listening on port ${port}`);
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[realtime] ${signal}, shutting down`);
    server.close().then(() => process.exit(0));
  });
}
