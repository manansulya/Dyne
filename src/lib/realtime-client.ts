"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

let socket: Socket | null = null;
let connectPromise: Promise<Socket | null> | null = null;

function getSocket(): Promise<Socket | null> {
  if (socket && socket.connected) return Promise.resolve(socket);
  if (connectPromise) return connectPromise;
  connectPromise = new Promise<Socket | null>((resolve) => {
    try {
      const s = io("/?XTransformPort=3003", {
        path: "/",
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
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
  return connectPromise;
}

/**
 * Hook that returns a connected Socket (or null while connecting / offline).
 * Also authenticates the socket with the current user's identity.
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
      // Send auth with user identity
      s.emit("auth", {
        userId: session.user.id,
        username: session.user.username,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
      });
      const onConnect = () => {
        setIsConnected(true);
        s.emit("auth", {
          userId: session.user.id,
          username: session.user.username,
          name: session.user.name,
          avatarUrl: session.user.avatarUrl,
        });
      };
      const onDisconnect = () => setIsConnected(false);
      s.on("connect", onConnect);
      s.on("disconnect", onDisconnect);
    });
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.username, session?.user?.name, session?.user?.avatarUrl]);

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
  const sendTyping = (isTyping: boolean) => {
    if (!socket || !channelId || !session?.user?.id) return;
    socket.emit("typing:channel", {
      channelId,
      userId: session.user.id,
      username: session.user.username ?? session.user.name ?? null,
      isTyping,
    });
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
    if (!socket || !conversationId || !session?.user?.id) return;
    socket.emit("typing:conversation", {
      conversationId,
      userId: session.user.id,
      username: session.user.username ?? session.user.name ?? null,
      isTyping,
    });
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

/**
 * WebRTC Call Signaling — subscribe to incoming call events.
 * Used by the voice/video calling system to exchange SDP offers/answers
 * and ICE candidates between two peers.
 */
export function useCallSignaling(
  handlers: {
    onOffer?: (data: { fromUserId: string; sdp: string; callId: string }) => void;
    onAnswer?: (data: { fromUserId: string; sdp: string; callId: string }) => void;
    onIceCandidate?: (data: { fromUserId: string; candidate: string; callId: string }) => void;
    onCallEnded?: (data: { fromUserId: string; callId: string }) => void;
  }
) {
  const { socket } = useRealtimeSocket();
  const { data: session } = useSession();
  useEffect(() => {
    if (!socket || !session?.user?.id) return;
    const onOffer = (d: any) => handlers.onOffer?.(d);
    const onAnswer = (d: any) => handlers.onAnswer?.(d);
    const onIce = (d: any) => handlers.onIceCandidate?.(d);
    const onEnd = (d: any) => handlers.onCallEnded?.(d);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice-candidate", onIce);
    socket.on("call:ended", onEnd);
    return () => {
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice-candidate", onIce);
      socket.off("call:ended", onEnd);
    };
  }, [socket, session?.user?.id]);

  const sendOffer = useCallback((targetUserId: string, sdp: string, callId: string) => {
    socket?.emit("webrtc:offer", { targetUserId, sdp, callId });
  }, [socket]);

  const sendAnswer = useCallback((targetUserId: string, sdp: string, callId: string) => {
    socket?.emit("webrtc:answer", { targetUserId, sdp, callId });
  }, [socket]);

  const sendIceCandidate = useCallback((targetUserId: string, candidate: string, callId: string) => {
    socket?.emit("webrtc:ice-candidate", { targetUserId, candidate, callId });
  }, [socket]);

  const sendCallEnd = useCallback((targetUserId: string, callId: string) => {
    socket?.emit("call:end", { targetUserId, callId });
  }, [socket]);

  return { sendOffer, sendAnswer, sendIceCandidate, sendCallEnd };
}
