"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;

/**
 * The realtime service establishes identity from a short-lived token minted by
 * `/api/realtime/token` for the session cookie holder — the client never tells
 * the service who it is.
 */
async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/realtime/token", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { token?: string };
    return body.token ?? null;
  } catch {
    return null;
  }
}

function getSocket(): Promise<Socket | null> {
  if (socket && socket.connected) return Promise.resolve(socket);
  if (connectPromise) return connectPromise;
  connectPromise = (async () => {
    const token = await fetchToken();
    if (!token) {
      connectPromise = null;
      return null;
    }
    return new Promise<Socket | null>((resolve) => {
      try {
        const s = io("/?XTransformPort=3003", {
          path: "/",
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1000,
          auth: { token },
        });
        // Tokens expire, so every reconnect attempt carries a fresh one.
        s.io.on("reconnect_attempt", () => {
          void fetchToken().then((next) => {
            if (next) s.auth = { token: next };
          });
        });
        s.on("connect", () => {
          socket = s;
          resolve(s);
        });
        s.on("connect_error", () => {
          // resolve null so callers can fall back to polling
          resolve(null);
        });
        // 3s timeout — if we can't connect, give up gracefully
        setTimeout(() => {
          if (!s.connected) resolve(null);
        }, 3000);
      } catch {
        resolve(null);
      }
    });
  })();
  return connectPromise;
}

/**
 * Hook that returns a connected Socket (or null while connecting / offline).
 * The connection is authenticated during the handshake, so there is nothing to
 * announce once it is open.
 */
export function useRealtimeSocket(): {
  socket: Socket | null;
  isConnected: boolean;
} {
  const { data: session } = useSession();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;
    getSocket().then((s) => {
      if (cancelled || !s) return;
      setIsConnected(s.connected);
      const onConnect = () => setIsConnected(true);
      const onDisconnect = () => setIsConnected(false);
      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  return { socket: socket && socket.connected ? socket : null, isConnected };
}

/**
 * Subscribe to a community's events (post created/updated, comment created).
 */
export function useCommunityRealtime(
  communityId: string | null | undefined,
  handlers: {
    onPost?: (post: unknown) => void;
    onComment?: (comment: unknown) => void;
  }
) {
  const { socket } = useRealtimeSocket();
  useEffect(() => {
    if (!socket || !communityId) return;
    socket.emit("join:community", communityId);
    const onPost = (post: unknown) => handlers.onPost?.(post);
    const onComment = (comment: unknown) => handlers.onComment?.(comment);
    socket.on("community:post", onPost);
    socket.on("community:comment", onComment);
    return () => {
      socket.emit("leave:community", communityId);
      socket.off("community:post", onPost);
      socket.off("community:comment", onComment);
    };
  }, [socket, communityId]);
}

/**
 * Subscribe to a channel's message events.
 */
export function useChannelRealtime(
  channelId: string | null | undefined,
  handlers: {
    onMessage?: (message: unknown) => void;
    onMessageUpdate?: (message: unknown) => void;
    onTyping?: (data: { userId: string; username: string | null; isTyping: boolean }) => void;
  }
) {
  const { socket } = useRealtimeSocket();
  const { data: session } = useSession();
  useEffect(() => {
    if (!socket || !channelId) return;
    socket.emit("join:channel", channelId);
    const onMessage = (m: unknown) => handlers.onMessage?.(m);
    const onUpdate = (m: unknown) => handlers.onMessageUpdate?.(m);
    const onTyping = (d: { userId: string; username: string | null; isTyping: boolean }) => {
      // Filter out our own typing events so we don't echo them back
      if (d.userId === session?.user?.id) return;
      handlers.onTyping?.(d);
    };
    socket.on("channel:message", onMessage);
    socket.on("channel:message:update", onUpdate);
    socket.on("typing:channel", onTyping);
    return () => {
      socket.emit("leave:channel", channelId);
      socket.off("channel:message", onMessage);
      socket.off("channel:message:update", onUpdate);
      socket.off("typing:channel", onTyping);
    };
  }, [socket, channelId, session?.user?.id]);

  // Helper to send a typing event
  // The service stamps the event with the authenticated user id itself.
  const sendTyping = (isTyping: boolean) => {
    if (!socket || !channelId) return;
    socket.emit("typing:channel", { channelId, isTyping });
  };
  return { sendTyping };
}

/**
 * Subscribe to a conversation's DM events.
 */
export function useConversationRealtime(
  conversationId: string | null | undefined,
  handlers: {
    onMessage?: (message: unknown) => void;
    onMessageUpdate?: (message: unknown) => void;
    onTyping?: (data: { userId: string; username: string | null; isTyping: boolean }) => void;
  }
) {
  const { socket } = useRealtimeSocket();
  const { data: session } = useSession();
  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit("join:conversation", conversationId);
    const onMessage = (m: unknown) => handlers.onMessage?.(m);
    const onUpdate = (m: unknown) => handlers.onMessageUpdate?.(m);
    const onTyping = (d: { userId: string; username: string | null; isTyping: boolean }) => {
      if (d.userId === session?.user?.id) return;
      handlers.onTyping?.(d);
    };
    socket.on("dm:message", onMessage);
    socket.on("dm:message:update", onUpdate);
    socket.on("typing:conversation", onTyping);
    return () => {
      socket.emit("leave:conversation", conversationId);
      socket.off("dm:message", onMessage);
      socket.off("dm:message:update", onUpdate);
      socket.off("typing:conversation", onTyping);
    };
  }, [socket, conversationId, session?.user?.id]);

  const sendTyping = (isTyping: boolean) => {
    if (!socket || !conversationId) return;
    socket.emit("typing:conversation", { conversationId, isTyping });
  };
  return { sendTyping };
}

/**
 * Subscribe to incoming notifications for the current user.
 */
export function useNotificationRealtime(
  onNotification: (notification: unknown) => void
) {
  const { socket } = useRealtimeSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = (n: unknown) => onNotification(n);
    socket.on("notification", handler);
    return () => {
      socket.off("notification", handler);
    };
  }, [socket, onNotification]);
}

/**
 * Subscribe to a specific user's presence (online/offline).
 */
export function useUserPresence(
  userId: string | null | undefined
): { isOnline: boolean | null } {
  const { socket } = useRealtimeSocket();
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  useEffect(() => {
    if (!socket || !userId) return;
    const handler = (data: { userId: string; isOnline: boolean }) => {
      if (data.userId === userId) setIsOnline(data.isOnline);
    };
    socket.on(`presence:${userId}`, handler);
    return () => {
      socket.off(`presence:${userId}`, handler);
    };
  }, [socket, userId]);
  return { isOnline };
}

// NOTE: the WebRTC signaling hook was removed together with the realtime
// service's relay handlers — it threw on render (missing `useCallback` import)
// and the service never forwarded the events it emitted.
