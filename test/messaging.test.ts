import { beforeAll, describe, expect, it } from "vitest";
import { GET as listConversations, POST as startConversation } from "@/app/api/conversations/route";
import { GET as listMessages } from "@/app/api/conversations/[id]/route";
import { POST as sendMessage } from "@/app/api/direct-messages/route";
import { DELETE as deleteMessage, PATCH as patchMessage } from "@/app/api/direct-messages/[id]/route";
import { actAs, createUser, db, jsonRequest, params, readJson, type TestUser } from "./helpers";

interface Message {
  id: string;
  content: string;
  isDeleted: boolean;
  isEdited: boolean;
  authorId: string;
}

describe("direct messaging", () => {
  let alice: TestUser;
  let bob: TestUser;
  let outsider: TestUser;
  let conversationId: string;

  beforeAll(async () => {
    alice = await createUser({ name: "Alice" });
    bob = await createUser({ name: "Bob" });
    outsider = await createUser({ name: "Outsider" });
    actAs(alice.id);
    const res = await startConversation(
      jsonRequest("/api/conversations", "POST", { otherUserId: bob.id })
    );
    expect(res.status).toBe(200);
    conversationId = (await readJson<{ conversation: { id: string } }>(res)).conversation.id;
  });

  async function send(as: string, content: string) {
    actAs(as);
    const res = await sendMessage(
      jsonRequest("/api/direct-messages", "POST", { conversationId, content })
    );
    expect(res.status).toBe(200);
    return (await readJson<{ message: Message }>(res)).message;
  }

  it("reuses the same conversation for the same pair, in either direction", async () => {
    actAs(alice.id);
    const again = await readJson<{ conversation: { id: string } }>(
      await startConversation(jsonRequest("/api/conversations", "POST", { otherUserId: bob.id }))
    );
    expect(again.conversation.id).toBe(conversationId);

    actAs(bob.id);
    const reversed = await readJson<{ conversation: { id: string } }>(
      await startConversation(jsonRequest("/api/conversations", "POST", { otherUserId: alice.id }))
    );
    expect(reversed.conversation.id).toBe(conversationId);
  });

  it("rejects a conversation with yourself and with a missing user id", async () => {
    actAs(alice.id);
    expect(
      (await startConversation(jsonRequest("/api/conversations", "POST", { otherUserId: alice.id })))
        .status
    ).toBe(400);
    expect(
      (await startConversation(jsonRequest("/api/conversations", "POST", {}))).status
    ).toBe(400);
  });

  it("delivers messages to both members in chronological order", async () => {
    await send(alice.id, "hi bob");
    await new Promise((r) => setTimeout(r, 5));
    await send(bob.id, "hi alice");

    for (const member of [alice, bob]) {
      actAs(member.id);
      const body = await readJson<{ messages: Message[] }>(
        await listMessages(
          jsonRequest(`/api/conversations/${conversationId}`),
          params({ id: conversationId })
        )
      );
      expect(body.messages.map((m) => m.content)).toEqual(["hi bob", "hi alice"]);
    }
  });

  it("notifies the recipient only", async () => {
    const beforeBob = await db.notification.count({ where: { userId: bob.id } });
    const beforeAlice = await db.notification.count({ where: { userId: alice.id } });
    await send(alice.id, "ping");
    expect(await db.notification.count({ where: { userId: bob.id } })).toBe(beforeBob + 1);
    expect(await db.notification.count({ where: { userId: alice.id } })).toBe(beforeAlice);
  });

  it("keeps an outsider out of the conversation entirely", async () => {
    actAs(outsider.id);
    expect(
      (
        await listMessages(
          jsonRequest(`/api/conversations/${conversationId}`),
          params({ id: conversationId })
        )
      ).status
    ).toBe(404);
    expect(
      (
        await sendMessage(
          jsonRequest("/api/direct-messages", "POST", { conversationId, content: "let me in" })
        )
      ).status
    ).toBe(404);

    const list = await readJson<{ conversations: unknown[] }>(
      await listConversations(jsonRequest("/api/conversations"))
    );
    expect(list.conversations).toEqual([]);
  });

  it("rejects an empty message with no attachment", async () => {
    actAs(alice.id);
    const res = await sendMessage(
      jsonRequest("/api/direct-messages", "POST", { conversationId, content: "   " })
    );
    expect(res.status).toBe(400);
  });

  it("lets only the author edit or delete their own message", async () => {
    const mine = await send(alice.id, "editable");

    actAs(bob.id);
    // A member may not edit someone else's text…
    const bobEdit = await patchMessage(
      jsonRequest(`/api/direct-messages/${mine.id}`, "PATCH", { content: "tampered" }),
      params({ id: mine.id })
    );
    expect((await readJson<{ message: Message }>(bobEdit)).message.content).toBe("editable");
    // …nor soft-delete it, via either verb.
    expect(
      (
        await patchMessage(
          jsonRequest(`/api/direct-messages/${mine.id}`, "PATCH", { isDeleted: true }),
          params({ id: mine.id })
        )
      ).status
    ).toBe(403);
    expect(
      (await deleteMessage(jsonRequest(`/api/direct-messages/${mine.id}`, "DELETE"), params({ id: mine.id })))
        .status
    ).toBe(403);

    actAs(alice.id);
    const edited = await readJson<{ message: Message }>(
      await patchMessage(
        jsonRequest(`/api/direct-messages/${mine.id}`, "PATCH", { content: "edited" }),
        params({ id: mine.id })
      )
    );
    expect(edited.message).toMatchObject({ content: "edited", isEdited: true });

    const deleted = await readJson<{ message: Message }>(
      await deleteMessage(jsonRequest(`/api/direct-messages/${mine.id}`, "DELETE"), params({ id: mine.id }))
    );
    expect(deleted.message.isDeleted).toBe(true);
    expect(deleted.message.content).toBe("This message has been deleted.");
  });

  it("blocks an outsider from touching a message they can see the id of", async () => {
    const mine = await send(alice.id, "private");
    actAs(outsider.id);
    expect(
      (
        await patchMessage(
          jsonRequest(`/api/direct-messages/${mine.id}`, "PATCH", { content: "x" }),
          params({ id: mine.id })
        )
      ).status
    ).toBe(403);
  });
});
