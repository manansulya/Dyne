import { NextResponse } from "next/server";
import { z } from "zod";
import { canJoinRoom } from "@/lib/realtime-authz";
import { parseRoom } from "@/lib/realtime-rooms";
import { secretsMatch } from "@/lib/realtime-token";

const bodySchema = z.object({
  userId: z.string().min(1),
  room: z.string().min(3),
});

/**
 * Service-to-service endpoint: the realtime service asks whether an
 * already-authenticated user may subscribe to a room. Callers must present the
 * shared realtime secret; browsers cannot reach it usefully because the user id
 * in the body only means anything once the service has verified a signed token.
 */
export async function POST(req: Request) {
  if (!secretsMatch(req.headers.get("x-realtime-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const room = parseRoom(parsed.data.room);
  if (!room) {
    return NextResponse.json({ error: "Unknown room" }, { status: 400 });
  }
  const allowed = await canJoinRoom(parsed.data.userId, room);
  return NextResponse.json({ allowed }, { headers: { "Cache-Control": "no-store" } });
}
