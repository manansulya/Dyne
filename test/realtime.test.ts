import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { createRealtimeServer } from "../mini-services/realtime/server";
import { canJoinRoom } from "@/lib/realtime-authz";
import { signRealtimeToken } from "@/lib/realtime-token";
import { createUser, db, type TestUser } from "./helpers";

/**
 * Realtime security regression tests.
 *
 * These run the actual socket.io service against the actual database-backed
 * authorization used in production (`canJoinRoom`), with real socket.io clients
 * for two separate accounts. Nothing here is mocked except the port.
 */

const SECRET = "realtime-test-secret";
const WRONG_SECRET = "not-the-realtime-secret";

let server: ReturnType<typeof createRealtimeServer>;
let url: string;
const openSockets: Socket[] = [];

/** Connects and resolves once the handshake either succeeds or is rejected. */
function connectWith(auth: Record<string, unknown>): Promise<
  { socket: Socket; ok: true } | { socket: Socket; ok: false; error: string }
> {
  return new Promise((resolve) => {
    const socket = connect(url, {
      path: "/",
      transports: ["websocket"],
      reconnection: false,
      auth,
    });
    openSockets.push(socket);
    socket.on("connect", () => resolve({ socket, ok: true }));
    socket.on("connect_error", (err) => resolve({ socket, ok: false, error: err.message }));
  });
}

async function connectAsUser(user: TestUser): Promise<Socket> {
  const { token } = signRealtimeToken(user.id, { secret: SECRET });
  const result = await connectWith({ token });
  if (!result.ok) throw new Error(`expected an authenticated connection: ${result.error}`);
  return result.socket;
}

async function connectAsApp(): Promise<Socket> {
  const result = await connectWith({ serverSecret: SECRET });
  if (!result.ok) throw new Error(`expected the app connection to be accepted: ${result.error}`);
  return result.socket;
}

/** Resolves with the first payload of `event`, or null if it never arrives. */
function nextEvent<T = unknown>(socket: Socket, event: string, timeoutMs = 400): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);
    const handler = (payload: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

/** Emits a join and reports whether the service allowed or denied it. */
function join(socket: Socket, kind: string, id: string): Promise<"joined" | "denied"> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`no join decision for ${kind}:${id}`));
    }, 2000);
    const onJoined = () => {
      cleanup();
      resolve("joined");
    };
    const onDenied = () => {
      cleanup();
      resolve("denied");
    };
    function cleanup() {
      clearTimeout(timer);
      socket.off("realtime:joined", onJoined);
      socket.off("realtime:denied", onDenied);
    }
    socket.once("realtime:joined", onJoined);
    socket.once("realtime:denied", onDenied);
    socket.emit(`join:${kind}`, id);
  });
}

describe("realtime security", () => {
  let alice: TestUser;
  let bob: TestUser;
  let carol: TestUser;
  let aliceBobConversation: string;
  let bobCarolConversation: string;
  let bobChannel: string;
  let community: string;

  beforeAll(async () => {
    server = createRealtimeServer({
      secret: SECRET,
      authorizeRoom: canJoinRoom,
      authorizationCacheMs: 0,
      logger: { log: () => {}, warn: () => {}, error: () => {} },
    });
    const port = await server.listen(0);
    url = `http://127.0.0.1:${port}`;

    alice = await createUser({ name: "Alice" });
    bob = await createUser({ name: "Bob" });
    carol = await createUser({ name: "Carol" });

    aliceBobConversation = (
      await db.conversation.create({ data: { memberOneId: alice.id, memberTwoId: bob.id } })
    ).id;
    bobCarolConversation = (
      await db.conversation.create({ data: { memberOneId: bob.id, memberTwoId: carol.id } })
    ).id;

    const space = await db.space.create({
      data: {
        name: "Bob's space",
        ownerId: bob.id,
        members: { create: { userId: bob.id, role: "ADMIN" } },
      },
    });
    bobChannel = (
      await db.channel.create({
        data: { spaceId: space.id, name: "general", createdById: bob.id },
      })
    ).id;

    community = (
      await db.community.create({
        data: { name: `c${randomUUID().slice(0, 8)}`, createdBy: bob.id },
      })
    ).id;
  });

  afterAll(async () => {
    for (const socket of openSockets) socket.disconnect();
    await server.close();
  });

  describe("connection identity", () => {
    it("rejects a connection with no credentials", async () => {
      const result = await connectWith({});
      expect(result.ok).toBe(false);
    });

    it("rejects a token signed with the wrong secret", async () => {
      const { token } = signRealtimeToken(alice.id, { secret: WRONG_SECRET });
      const result = await connectWith({ token });
      expect(result.ok).toBe(false);
    });

    it("rejects an expired token", async () => {
      const { token } = signRealtimeToken(alice.id, { secret: SECRET, ttlSeconds: -10 });
      const result = await connectWith({ token });
      expect(result.ok).toBe(false);
    });

    it("rejects a hand-crafted token payload without a signature", async () => {
      const forged = Buffer.from(
        JSON.stringify({ sub: bob.id, exp: Math.floor(Date.now() / 1000) + 60, un: null })
      ).toString("base64url");
      expect((await connectWith({ token: `${forged}.` })).ok).toBe(false);
      expect((await connectWith({ token: forged })).ok).toBe(false);
    });

    it("rejects the app identity when the shared secret is wrong", async () => {
      expect((await connectWith({ serverSecret: WRONG_SECRET })).ok).toBe(false);
    });

    it("accepts a token minted for a real user", async () => {
      const socket = await connectAsUser(alice);
      expect(socket.connected).toBe(true);
    });
  });

  describe("room authorization", () => {
    it("lets a DM member subscribe to their own conversation", async () => {
      const socket = await connectAsUser(alice);
      expect(await join(socket, "conversation", aliceBobConversation)).toBe("joined");
    });

    it("denies A a conversation between B and C", async () => {
      const socket = await connectAsUser(alice);
      expect(await join(socket, "conversation", bobCarolConversation)).toBe("denied");
    });

    it("denies A a channel in a space A is not a member of, and allows the member", async () => {
      const aliceSocket = await connectAsUser(alice);
      expect(await join(aliceSocket, "channel", bobChannel)).toBe("denied");
      const bobSocket = await connectAsUser(bob);
      expect(await join(bobSocket, "channel", bobChannel)).toBe("joined");
    });

    it("denies unknown and malformed rooms", async () => {
      const socket = await connectAsUser(alice);
      expect(await join(socket, "conversation", "does-not-exist")).toBe("denied");
      expect(await join(socket, "channel", "does-not-exist")).toBe("denied");
      expect(await join(socket, "community", "does-not-exist")).toBe("denied");
    });

    it("allows any signed-in user into a community room (public forum reads)", async () => {
      const socket = await connectAsUser(alice);
      expect(await join(socket, "community", community)).toBe("joined");
    });
  });

  describe("message delivery", () => {
    it("delivers a DM only to the conversation's members", async () => {
      const app = await connectAsApp();
      const bobSocket = await connectAsUser(bob);
      const aliceSocket = await connectAsUser(alice);
      expect(await join(bobSocket, "conversation", bobCarolConversation)).toBe("joined");
      expect(await join(aliceSocket, "conversation", bobCarolConversation)).toBe("denied");

      const forBob = nextEvent<{ content: string }>(bobSocket, "dm:message", 1500);
      const forAlice = nextEvent(aliceSocket, "dm:message", 1500);
      app.emit("broadcast:dm", {
        conversationId: bobCarolConversation,
        message: { content: "private to bob and carol" },
      });

      expect((await forBob)?.content).toBe("private to bob and carol");
      expect(await forAlice).toBeNull();
    });

    it("delivers notifications only to the addressed user's socket", async () => {
      const app = await connectAsApp();
      const bobSocket = await connectAsUser(bob);
      const aliceSocket = await connectAsUser(alice);

      const forBob = nextEvent<{ id: string }>(bobSocket, "notification", 1500);
      const forAlice = nextEvent(aliceSocket, "notification", 1500);
      app.emit("broadcast:notification", { userId: bob.id, notification: { id: "n1" } });

      expect((await forBob)?.id).toBe("n1");
      expect(await forAlice).toBeNull();
    });

    it("re-authorizes rooms after a reconnect", async () => {
      const app = await connectAsApp();
      const bobSocket = await connectAsUser(bob);
      expect(await join(bobSocket, "conversation", bobCarolConversation)).toBe("joined");

      bobSocket.disconnect();
      const reconnected = await connectAsUser(bob);
      // The room is not remembered by the service: it must be re-joined, and
      // re-joining goes through authorization again.
      const beforeJoin = nextEvent(reconnected, "dm:message", 300);
      app.emit("broadcast:dm", {
        conversationId: bobCarolConversation,
        message: { content: "before re-join" },
      });
      expect(await beforeJoin).toBeNull();

      expect(await join(reconnected, "conversation", bobCarolConversation)).toBe("joined");
      const afterJoin = nextEvent<{ content: string }>(reconnected, "dm:message", 1500);
      app.emit("broadcast:dm", {
        conversationId: bobCarolConversation,
        message: { content: "after re-join" },
      });
      expect((await afterJoin)?.content).toBe("after re-join");
    });
  });

  describe("A cannot act as B", () => {
    it("refuses broadcasts from a user socket, so A cannot inject a message", async () => {
      const bobSocket = await connectAsUser(bob);
      const aliceSocket = await connectAsUser(alice);
      expect(await join(bobSocket, "conversation", bobCarolConversation)).toBe("joined");

      const denied = nextEvent<{ event: string }>(aliceSocket, "realtime:denied", 1500);
      const forBob = nextEvent(bobSocket, "dm:message", 1500);
      aliceSocket.emit("broadcast:dm", {
        conversationId: bobCarolConversation,
        message: { content: "injected by alice" },
      });

      expect((await denied)?.event).toBe("broadcast:dm");
      expect(await forBob).toBeNull();
    });

    it("refuses a notification injected by another user", async () => {
      const bobSocket = await connectAsUser(bob);
      const aliceSocket = await connectAsUser(alice);

      const denied = nextEvent<{ event: string }>(aliceSocket, "realtime:denied", 1500);
      const forBob = nextEvent(bobSocket, "notification", 1500);
      aliceSocket.emit("broadcast:notification", {
        userId: bob.id,
        notification: { id: "forged" },
      });

      expect((await denied)?.event).toBe("broadcast:notification");
      expect(await forBob).toBeNull();
    });

    it("stamps typing events with the authenticated user, ignoring a spoofed id", async () => {
      const aliceSocket = await connectAsUser(alice);
      const bobSocket = await connectAsUser(bob);
      expect(await join(aliceSocket, "conversation", aliceBobConversation)).toBe("joined");
      expect(await join(bobSocket, "conversation", aliceBobConversation)).toBe("joined");

      const received = nextEvent<{ userId: string; username: string | null }>(
        bobSocket,
        "typing:conversation",
        1500
      );
      aliceSocket.emit("typing:conversation", {
        conversationId: aliceBobConversation,
        userId: carol.id, // spoofed
        username: "carol",
        isTyping: true,
      });

      const payload = await received;
      expect(payload?.userId).toBe(alice.id);
    });

    it("drops typing and read receipts for rooms the socket did not join", async () => {
      const aliceSocket = await connectAsUser(alice);
      const bobSocket = await connectAsUser(bob);
      expect(await join(bobSocket, "conversation", bobCarolConversation)).toBe("joined");

      const typingSeen = nextEvent(bobSocket, "typing:conversation", 800);
      const denied = nextEvent<{ event: string }>(aliceSocket, "realtime:denied", 800);
      aliceSocket.emit("typing:conversation", {
        conversationId: bobCarolConversation,
        isTyping: true,
      });
      expect(await typingSeen).toBeNull();
      expect((await denied)?.event).toBe("typing:conversation");

      const readSeen = nextEvent(bobSocket, "read:conversation", 800);
      aliceSocket.emit("read:conversation", { conversationId: bobCarolConversation });
      expect(await readSeen).toBeNull();
    });

    it("reports read receipts to the room with the authenticated reader's id", async () => {
      const aliceSocket = await connectAsUser(alice);
      const bobSocket = await connectAsUser(bob);
      expect(await join(aliceSocket, "conversation", aliceBobConversation)).toBe("joined");
      expect(await join(bobSocket, "conversation", aliceBobConversation)).toBe("joined");

      const receipt = nextEvent<{ userId: string; conversationId: string }>(
        bobSocket,
        "read:conversation",
        1500
      );
      aliceSocket.emit("read:conversation", {
        conversationId: aliceBobConversation,
        userId: bob.id, // spoofed
        messageId: "m1",
      });
      const payload = await receipt;
      expect(payload?.userId).toBe(alice.id);
      expect(payload?.conversationId).toBe(aliceBobConversation);
    });

    it("does not let A manipulate B's presence", async () => {
      const observer = await connectAsUser(carol);
      const bobPresence = nextEvent<{ isOnline: boolean }>(observer, `presence:${bob.id}`, 800);

      const aliceSocket = await connectAsUser(alice);
      // The legacy handshake event and any presence payload naming B are ignored.
      aliceSocket.emit("auth", { userId: bob.id });
      aliceSocket.emit("presence", { userId: bob.id, isOnline: true });

      expect(await bobPresence).toBeNull();
    });

    it("announces presence for the authenticated user on connect", async () => {
      const observer = await connectAsUser(bob);
      const presence = nextEvent<{ userId: string; isOnline: boolean }>(
        observer,
        `presence:${carol.id}`,
        1500
      );
      await connectAsUser(carol);
      const payload = await presence;
      expect(payload?.userId).toBe(carol.id);
      expect(payload?.isOnline).toBe(true);
    });
  });
});
