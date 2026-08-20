import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, Caddy uses it to forward to the right port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// --------------------------------
// In-memory presence
// --------------------------------
// socketId -> { userId, username, name, avatarUrl }
const onlineUsers = new Map<
  string,
  {
    userId: string;
    username: string | null;
    name: string | null;
    avatarUrl: string | null;
  }
>();
// userId -> Set<socketId>  (same user can have multiple tabs)
const userSockets = new Map<string, Set<string>>();

function emitUserPresence(userId: string) {
  const isOnline = userSockets.has(userId) && (userSockets.get(userId)?.size ?? 0) > 0;
  io.emit(`presence:${userId}`, { userId, isOnline });
}

io.on("connection", (socket) => {
  console.log(`[realtime] connected ${socket.id}`);

  // ---- Identity handshake ----
  // Client emits "auth" with their Dyne user info once after connecting.
  socket.on(
    "auth",
    (data: {
      userId: string;
      username?: string | null;
      name?: string | null;
      avatarUrl?: string | null;
    }) => {
      if (!data?.userId) return;
      onlineUsers.set(socket.id, {
        userId: data.userId,
        username: data.username ?? null,
        name: data.name ?? null,
        avatarUrl: data.avatarUrl ?? null,
      });
      if (!userSockets.has(data.userId)) {
        userSockets.set(data.userId, new Set());
      }
      userSockets.get(data.userId)!.add(socket.id);
      // Join a personal room keyed by userId so we can push DMs/calls to them
      socket.join(`user:${data.userId}`);
      // Newly online — broadcast presence
      emitUserPresence(data.userId);
    }
  );

  // ---- Channel / Space chat rooms ----
  socket.on("join:channel", (channelId: string) => {
    if (!channelId) return;
    socket.join(`channel:${channelId}`);
  });
  socket.on("leave:channel", (channelId: string) => {
    socket.leave(`channel:${channelId}`);
  });

  // ---- Conversation (DM) rooms ----
  socket.on("join:conversation", (conversationId: string) => {
    if (!conversationId) return;
    socket.join(`conversation:${conversationId}`);
  });
  socket.on("leave:conversation", (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // ---- Community rooms (for post/comment events) ----
  socket.on("join:community", (communityId: string) => {
    if (!communityId) return;
    socket.join(`community:${communityId}`);
  });
  socket.on("leave:community", (communityId: string) => {
    socket.leave(`community:${communityId}`);
  });

  // ---- Typing indicators ----
  // channel-typing / conversation-typing
  socket.on(
    "typing:channel",
    (data: { channelId: string; userId: string; username: string | null; isTyping: boolean }) => {
      if (!data?.channelId) return;
      socket.to(`channel:${data.channelId}`).emit("typing:channel", data);
    }
  );
  socket.on(
    "typing:conversation",
    (data: { conversationId: string; userId: string; username: string | null; isTyping: boolean }) => {
      if (!data?.conversationId) return;
      socket.to(`conversation:${data.conversationId}`).emit("typing:conversation", data);
    }
  );

  // ---- Broadcast hooks for Next.js API routes ----
  // The API routes connect as a separate client (with secret) and call these
  // events to broadcast. All emits go to the room corresponding to the entity.
  socket.on(
    "broadcast:channel-message",
    (data: { channelId: string; message: unknown }) => {
      io.to(`channel:${data.channelId}`).emit("channel:message", data.message);
    }
  );
  socket.on(
    "broadcast:channel-message-update",
    (data: { channelId: string; message: unknown }) => {
      io.to(`channel:${data.channelId}`).emit("channel:message:update", data.message);
    }
  );
  socket.on(
    "broadcast:dm",
    (data: { conversationId: string; message: unknown }) => {
      io.to(`conversation:${data.conversationId}`).emit("dm:message", data.message);
    }
  );
  socket.on(
    "broadcast:dm-update",
    (data: { conversationId: string; message: unknown }) => {
      io.to(`conversation:${data.conversationId}`).emit("dm:message:update", data.message);
    }
  );
  socket.on(
    "broadcast:community-post",
    (data: { communityId: string; post: unknown }) => {
      io.to(`community:${data.communityId}`).emit("community:post", data.post);
    }
  );
  socket.on(
    "broadcast:community-comment",
    (data: { communityId: string; comment: unknown }) => {
      io.to(`community:${data.communityId}`).emit("community:comment", data.comment);
    }
  );
  socket.on(
    "broadcast:notification",
    (data: { userId: string; notification: unknown }) => {
      io.to(`user:${data.userId}`).emit("notification", data.notification);
    }
  );

  // ---- Disconnect: clean up presence ----
  socket.on("disconnect", () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      const set = userSockets.get(user.userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(user.userId);
          // User went offline — broadcast presence
          emitUserPresence(user.userId);
        }
      }
    }
    console.log(`[realtime] disconnected ${socket.id}`);
  });

  socket.on("error", (err) => {
    console.error(`[realtime] socket error ${socket.id}:`, err);
  });

  // NOTE: WebRTC call signaling relay was removed here. It was unreachable dead
  // code (it gated on an `authenticated` flag that was never set) and no client
  // used it. Authenticated signaling belongs with the signed-socket-token work.

  socket.on("disconnect", () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      const set = userSockets.get(user.userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(user.userId);
          emitUserPresence(user.userId);
        }
      }
    }
    console.log(`[realtime] disconnected ${socket.id}`);
  });
});

const PORT = 3003;
httpServer.listen(PORT, () => {
  console.log(`[realtime] Dyne realtime server listening on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("[realtime] SIGTERM, shutting down");
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("[realtime] SIGINT, shutting down");
  httpServer.close(() => process.exit(0));
});
