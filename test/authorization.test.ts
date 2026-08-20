import { beforeAll, describe, expect, it } from "vitest";
import { POST as createTask } from "@/app/api/tasks/route";
import { PATCH as patchTask, DELETE as deleteTask, GET as getTask } from "@/app/api/tasks/[id]/route";
import { POST as createCommunity } from "@/app/api/communities/route";
import { POST as createPost } from "@/app/api/posts/route";
import { DELETE as deletePost, PATCH as patchPost } from "@/app/api/posts/[id]/route";
import { PATCH as patchPresence } from "@/app/api/presence/[userId]/route";
import { POST as joinCommunity } from "@/app/api/communities/[id]/join/route";
import { actAs, createUser, jsonRequest, params, readJson, type TestUser } from "./helpers";

/**
 * Cross-account probes: account B must never reach account A's rows. These lock
 * in the isolation the app already has so later phases cannot regress it.
 */
describe("cross-account authorization", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceTaskId: string;
  let aliceCommunityId: string;
  let alicePostId: string;

  beforeAll(async () => {
    alice = await createUser({ name: "Alice" });
    bob = await createUser({ name: "Bob" });

    actAs(alice.id);
    const task = await readJson<{ task: { id: string } }>(
      await createTask(jsonRequest("/api/tasks", "POST", { title: "Alice task" }))
    );
    aliceTaskId = task.task.id;

    const community = await readJson<{ community: { id: string } }>(
      await createCommunity(
        jsonRequest("/api/communities", "POST", {
          name: `alice_${Date.now()}`,
          description: "Alice's community",
        })
      )
    );
    aliceCommunityId = community.community.id;

    const post = await readJson<{ post: { id: string } }>(
      await createPost(
        jsonRequest("/api/posts", "POST", {
          communityId: aliceCommunityId,
          title: "Alice post",
          content: "hello",
        })
      )
    );
    alicePostId = post.post.id;
  });

  it("hides another user's task from read, update and delete", async () => {
    actAs(bob.id);
    expect((await getTask(jsonRequest(`/api/tasks/${aliceTaskId}`), params({ id: aliceTaskId }))).status).toBe(404);
    expect(
      (
        await patchTask(
          jsonRequest(`/api/tasks/${aliceTaskId}`, "PATCH", { title: "hacked" }),
          params({ id: aliceTaskId })
        )
      ).status
    ).toBe(404);
    expect(
      (await deleteTask(jsonRequest(`/api/tasks/${aliceTaskId}`, "DELETE"), params({ id: aliceTaskId }))).status
    ).toBe(404);

    // …and the row is untouched.
    actAs(alice.id);
    const still = await readJson<{ task: { title: string } }>(
      await getTask(jsonRequest(`/api/tasks/${aliceTaskId}`), params({ id: aliceTaskId }))
    );
    expect(still.task.title).toBe("Alice task");
  });

  it("refuses to let a non-author edit or delete a post", async () => {
    actAs(bob.id);
    expect(
      (
        await patchPost(
          jsonRequest(`/api/posts/${alicePostId}`, "PATCH", { title: "hacked" }),
          params({ id: alicePostId })
        )
      ).status
    ).toBe(403);
    expect(
      (await deletePost(jsonRequest(`/api/posts/${alicePostId}`, "DELETE"), params({ id: alicePostId }))).status
    ).toBe(403);
  });

  it("refuses to write another user's presence", async () => {
    actAs(bob.id);
    const res = await patchPresence(
      jsonRequest(`/api/presence/${alice.id}`, "PATCH", { isOnline: true }),
      params({ userId: alice.id })
    );
    expect(res.status).toBe(403);
  });

  it("requires membership before posting to a community", async () => {
    actAs(bob.id);
    const denied = await createPost(
      jsonRequest("/api/posts", "POST", {
        communityId: aliceCommunityId,
        title: "Bob post",
        content: "x",
      })
    );
    expect(denied.status).toBe(403);

    await joinCommunity(jsonRequest(`/api/communities/${aliceCommunityId}/join`, "POST"), params({ id: aliceCommunityId }));
    const allowed = await createPost(
      jsonRequest("/api/posts", "POST", {
        communityId: aliceCommunityId,
        title: "Bob post",
        content: "x",
      })
    );
    expect(allowed.status).toBe(200);
  });

  it("rejects every probed mutation when signed out", async () => {
    actAs(null);
    expect((await createTask(jsonRequest("/api/tasks", "POST", { title: "x" }))).status).toBe(401);
    expect(
      (await patchTask(jsonRequest(`/api/tasks/${aliceTaskId}`, "PATCH", { title: "x" }), params({ id: aliceTaskId })))
        .status
    ).toBe(401);
    expect(
      (await createPost(jsonRequest("/api/posts", "POST", { communityId: aliceCommunityId, title: "x" }))).status
    ).toBe(401);
  });
});
