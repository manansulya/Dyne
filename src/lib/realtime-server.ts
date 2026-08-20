// Server-side helper: emit events to the realtime socket.io service.
// This is used by API routes after they persist data to the DB.
// Uses a single shared socket.io-client connection to the local mini-service.
import { io, Socket } from "socket.io-client";
import { realtimeSecret } from "@/lib/realtime-token";

const REALTIME_URL =
  process.env.REALTIME_URL || "http://localhost:3003";

let client: Socket | null = null;

function getClient(): Socket | null {
  // Lazily create a single client connection. If the realtime service is
  // unavailable, we silently fall back to no-op (the app still works via
  // polling / refetch — real-time is an enhancement, not a hard dependency).
  if (client) return client;
  try {
    client = io(REALTIME_URL, {
      path: "/",
      // Broadcasting into rooms is restricted to this identity; browsers only
      // ever get a per-user token.
      auth: { serverSecret: realtimeSecret() },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 2000,
    });
    client.on("connect", () => {
      // silent — server-side client doesn't need to do anything on connect
    });
    client.on("connect_error", (err) => {
      // Swallow — we degrade gracefully to no-realtime
      // console.warn("[realtime-client] connect_error", err.message);
    });
    return client;
  } catch (err) {
    console.warn("[realtime-client] init failed", err);
    return null;
  }
}

export function broadcastChannelMessage(channelId: string, message: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:channel-message", { channelId, message });
}

export function broadcastChannelMessageUpdate(channelId: string, message: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:channel-message-update", { channelId, message });
}

export function broadcastDM(conversationId: string, message: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:dm", { conversationId, message });
}

export function broadcastDMUpdate(conversationId: string, message: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:dm-update", { conversationId, message });
}

export function broadcastCommunityPost(communityId: string, post: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:community-post", { communityId, post });
}

export function broadcastCommunityComment(communityId: string, comment: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:community-comment", { communityId, comment });
}

export function broadcastNotification(userId: string, notification: unknown) {
  const c = getClient();
  if (!c || !c.connected) return;
  c.emit("broadcast:notification", { userId, notification });
}
