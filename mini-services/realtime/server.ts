import { createServer, type Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import { verifyRealtimeToken, secretsMatch } from "../../src/lib/realtime-token";
import { parseRoom, roomName, type Room } from "../../src/lib/realtime-rooms";

/**
 * Realtime service.
 *
 * Identity: a connection is either
 *   - a *user* socket, which must present a short-lived HMAC token minted by
 *     the Next.js app for the signed-in user (`auth.token`), or
 *   - the *app* itself (`auth.serverSecret`), which is the only identity
 *     allowed to broadcast into rooms.
 * Client-supplied user ids are never trusted: every event derives its actor
 * from `socket.data.userId`, set during the handshake.
 *
 * Authorization: joining any room is delegated to `authorizeRoom`, which is
 * backed by the app's database (space/conversation membership). Emitting into a
 * room requires the socket to already be a member of that room.
 */

export interface RealtimeServerOptions {
  secret: string;
  /** Resolves whether `userId` may subscribe to `room`. */
  authorizeRoom: (userId: string, room: Room) => Promise<boolean>;
  /** How long an authorization decision may be reused per socket (ms). */
  authorizationCacheMs?: number;
  logger?: Pick<Console, "log" | "warn" | "error">;
}

interface SocketData {
  userId: string | null;
  /** Signed display name from the token — never client-supplied. */
  username: string | null;
  isApp: boolean;
  authorizations: Map<string, { allowed: boolean; expiresAt: number }>;
}

export interface RealtimeServer {
  io: Server;
  httpServer: HttpServer;
  listen: (port: number) => Promise<number>;
  close: () => Promise<void>;
}

const DEFAULT_CACHE_MS = 10_000;

export const APP_BROADCAST_EVENTS = [
  "broadcast:channel-message",
  "broadcast:channel-message-update",
  "broadcast:dm",
  "broadcast:dm-update",
  "broadcast:community-post",
  "broadcast:community-comment",
  "broadcast:notification",
] as const;

export function createRealtimeServer(options: RealtimeServerOptions): RealtimeServer {
  const { secret, authorizeRoom } = options;
  const cacheMs = options.authorizationCacheMs ?? DEFAULT_CACHE_MS;
  const log = options.logger ?? console;

  const httpServer = createServer();
  const io = new Server(httpServer, {
    // DO NOT change the path, Caddy uses it to forward to the right port
    path: "/",
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // userId -> Set<socketId> (a user may have several tabs/devices)
  const userSockets = new Map<string, Set<string>>();

  function data(socket: Socket): SocketData {
    return socket.data as SocketData;
  }

  function emitUserPresence(userId: string) {
    const isOnline = (userSockets.get(userId)?.size ?? 0) > 0;
    io.emit(`presence:${userId}`, { userId, isOnline });
  }

  /** Handshake: establishes the identity of the connection or rejects it. */
  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: unknown; serverSecret?: unknown };

    if (auth?.serverSecret !== undefined) {
      if (!secretsMatch(auth.serverSecret, secret)) {
        return next(new Error("unauthorized"));
      }
      socket.data = {
        userId: null,
        username: null,
        isApp: true,
        authorizations: new Map(),
      } satisfies SocketData;
      return next();
    }

    const payload = verifyRealtimeToken(auth?.token, { secret });
    if (!payload) return next(new Error("unauthorized"));
    socket.data = {
      userId: payload.sub,
      username: payload.un,
      isApp: false,
      authorizations: new Map(),
    } satisfies SocketData;
    next();
  });

  /** Room authorization with a short per-socket cache. */
  async function mayJoin(socket: Socket, room: Room): Promise<boolean> {
    const { userId, authorizations } = data(socket);
    if (!userId) return false;
    const key = roomName(room);
    const cached = authorizations.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.allowed;
    let allowed = false;
    try {
      allowed = await authorizeRoom(userId, room);
    } catch (err) {
      log.error("[realtime] authorization failed", err);
      allowed = false;
    }
    authorizations.set(key, { allowed, expiresAt: Date.now() + cacheMs });
    return allowed;
  }

  function deny(socket: Socket, event: string, detail: string) {
    log.warn(`[realtime] denied ${event} for ${data(socket).userId ?? "anonymous"}: ${detail}`);
    socket.emit("realtime:denied", { event, detail });
  }

  io.on("connection", (socket) => {
    const { userId, isApp } = data(socket);

    if (isApp) {
      registerAppHandlers(socket);
    } else if (userId) {
      log.log(`[realtime] authenticated ${socket.id} as ${userId}`);
      // The personal room needs no lookup: it is the socket's own identity.
      socket.join(roomName({ kind: "user", id: userId }));
      let sockets = userSockets.get(userId);
      if (!sockets) {
        sockets = new Set();
        userSockets.set(userId, sockets);
      }
      sockets.add(socket.id);
      emitUserPresence(userId);
      registerUserHandlers(socket, userId, data(socket).username);
    }

    socket.on("error", (err) => {
      log.error(`[realtime] socket error ${socket.id}:`, err);
    });

    socket.on("disconnect", () => {
      if (!userId) return;
      const sockets = userSockets.get(userId);
      if (!sockets) return;
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        emitUserPresence(userId);
      }
    });
  });

  function registerUserHandlers(socket: Socket, userId: string, username: string | null) {
    const joinHandler = (kind: Room["kind"]) => async (id: unknown) => {
      const room = parseRoom(typeof id === "string" ? `${kind}:${id}` : null);
      if (!room) return deny(socket, `join:${kind}`, "invalid room");
      if (!(await mayJoin(socket, room))) return deny(socket, `join:${kind}`, "not permitted");
      socket.join(roomName(room));
      socket.emit("realtime:joined", { room: roomName(room) });
    };
    const leaveHandler = (kind: Room["kind"]) => (id: unknown) => {
      const room = parseRoom(typeof id === "string" ? `${kind}:${id}` : null);
      if (room) socket.leave(roomName(room));
    };

    for (const kind of ["channel", "conversation", "community"] as const) {
      socket.on(`join:${kind}`, joinHandler(kind));
      socket.on(`leave:${kind}`, leaveHandler(kind));
    }

    // Typing indicators: the actor is always the authenticated user, and the
    // socket must already be in the room it is typing in.
    const typingHandler =
      (kind: "channel" | "conversation", idField: "channelId" | "conversationId") =>
      (payload: unknown) => {
        const id = (payload as Record<string, unknown> | null)?.[idField];
        const room = parseRoom(typeof id === "string" ? `${kind}:${id}` : null);
        if (!room) return deny(socket, `typing:${kind}`, "invalid room");
        const name = roomName(room);
        if (!socket.rooms.has(name)) return deny(socket, `typing:${kind}`, "not in room");
        const isTyping = Boolean((payload as { isTyping?: unknown })?.isTyping);
        socket.to(name).emit(`typing:${kind}`, { [idField]: room.id, userId, username, isTyping });
      };
    socket.on("typing:channel", typingHandler("channel", "channelId"));
    socket.on("typing:conversation", typingHandler("conversation", "conversationId"));

    // Read receipts: scoped to a room the socket belongs to, actor is derived.
    socket.on("read:conversation", (payload: unknown) => {
      const id = (payload as { conversationId?: unknown } | null)?.conversationId;
      const room = parseRoom(typeof id === "string" ? `conversation:${id}` : null);
      if (!room) return deny(socket, "read:conversation", "invalid room");
      const name = roomName(room);
      if (!socket.rooms.has(name)) return deny(socket, "read:conversation", "not in room");
      const messageId = (payload as { messageId?: unknown }).messageId;
      socket.to(name).emit("read:conversation", {
        conversationId: room.id,
        userId,
        messageId: typeof messageId === "string" ? messageId : null,
        readAt: new Date().toISOString(),
      });
    });

    // Broadcasts are app-only. Reject them loudly on user sockets so a client
    // cannot inject messages or notifications as somebody else.
    for (const event of APP_BROADCAST_EVENTS) {
      socket.on(event, () => deny(socket, event, "broadcasts are server-only"));
    }
  }

  function registerAppHandlers(socket: Socket) {
    const relay = <T extends Record<string, unknown>>(
      event: string,
      kind: Room["kind"],
      idField: string,
      payloadField: string,
      outEvent: string
    ) => {
      socket.on(event, (payload: T) => {
        const id = payload?.[idField];
        const room = parseRoom(typeof id === "string" ? `${kind}:${id}` : null);
        if (!room) return;
        io.to(roomName(room)).emit(outEvent, payload[payloadField]);
      });
    };

    relay("broadcast:channel-message", "channel", "channelId", "message", "channel:message");
    relay(
      "broadcast:channel-message-update",
      "channel",
      "channelId",
      "message",
      "channel:message:update"
    );
    relay("broadcast:dm", "conversation", "conversationId", "message", "dm:message");
    relay("broadcast:dm-update", "conversation", "conversationId", "message", "dm:message:update");
    relay("broadcast:community-post", "community", "communityId", "post", "community:post");
    relay("broadcast:community-comment", "community", "communityId", "comment", "community:comment");
    relay("broadcast:notification", "user", "userId", "notification", "notification");
  }

  return {
    io,
    httpServer,
    listen: (port: number) =>
      new Promise<number>((resolve) => {
        httpServer.listen(port, () => {
          const address = httpServer.address();
          resolve(typeof address === "object" && address ? address.port : port);
        });
      }),
    close: () =>
      new Promise<void>((resolve) => {
        io.close(() => resolve());
      }),
  };
}
