import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { signRealtimeToken } from "@/lib/realtime-token";

/**
 * Mints a short-lived token the browser hands to the realtime service during
 * the socket handshake. The identity comes from the session cookie, so a client
 * can only ever obtain a token for itself.
 */
export const GET = withUserId(async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { username: true, name: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const { token, expiresAt } = signRealtimeToken(userId, {
    displayName: user.username ?? user.name ?? null,
  });
  return NextResponse.json(
    { token, expiresAt },
    { headers: { "Cache-Control": "no-store" } }
  );
});
