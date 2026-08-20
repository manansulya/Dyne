import { beforeAll, describe, expect, it } from "vitest";
import { GET as getFeed } from "@/app/api/feed/route";
import { POST as createCommunity } from "@/app/api/communities/route";
import { POST as joinCommunity, DELETE as leaveCommunity } from "@/app/api/communities/[id]/join/route";
import { POST as createPost } from "@/app/api/posts/route";
import { PUT as bookmarkPost, DELETE as unbookmarkPost } from "@/app/api/posts/[id]/bookmark/route";
import { actAs, createUser, jsonRequest, params, readJson, type TestUser } from "./helpers";

interface FeedPost {
  id: string;
  title: string | null;
  isBookmarked?: boolean;
}
interface FeedResponse {
  posts: FeedPost[];
  nextCursor: string | null;
}

async function newCommunity(prefix: string) {
  const res = await createCommunity(
    jsonRequest("/api/communities", "POST", { name: `${prefix}${Date.now() % 1_000_000}` })
  );
  expect(res.status).toBe(200);
  return (await readJson<{ community: { id: string } }>(res)).community.id;
}

describe("feed", () => {
  let author: TestUser;
  let reader: TestUser;
  let communityId: string;

  beforeAll(async () => {
    author = await createUser({ name: "Author" });
    reader = await createUser({ name: "Reader" });
    actAs(author.id);
    communityId = await newCommunity("feedc");
    // Ordering is by createdAt desc; SQLite timestamps are millisecond precision,
    // so create posts one at a time and keep the observed order stable.
    for (let i = 1; i <= 5; i++) {
      const res = await createPost(
        jsonRequest("/api/posts", "POST", {
          communityId,
          title: `post-${i}`,
          content: `body ${i}`,
        })
      );
      expect(res.status).toBe(200);
      await new Promise((r) => setTimeout(r, 5));
    }
  });

  it("shows nothing to a user who has joined nothing", async () => {
    actAs(reader.id);
    const feed = await readJson<FeedResponse>(await getFeed(jsonRequest("/api/feed")));
    expect(feed.posts).toEqual([]);
    expect(feed.nextCursor).toBeNull();
  });

  it("paginates by cursor without repeating or dropping posts", async () => {
    actAs(reader.id);
    await joinCommunity(jsonRequest(`/api/communities/${communityId}/join`, "POST"), params({ id: communityId }));

    const first = await readJson<FeedResponse>(await getFeed(jsonRequest("/api/feed?limit=2")));
    expect(first.posts.map((p) => p.title)).toEqual(["post-5", "post-4"]);
    expect(first.nextCursor).toBe(first.posts[1].id);

    const second = await readJson<FeedResponse>(
      await getFeed(jsonRequest(`/api/feed?limit=2&cursor=${first.nextCursor}`))
    );
    expect(second.posts.map((p) => p.title)).toEqual(["post-3", "post-2"]);

    const third = await readJson<FeedResponse>(
      await getFeed(jsonRequest(`/api/feed?limit=2&cursor=${second.nextCursor}`))
    );
    expect(third.posts.map((p) => p.title)).toEqual(["post-1"]);
    expect(third.nextCursor).toBeNull();

    const seen = [...first.posts, ...second.posts, ...third.posts].map((p) => p.id);
    expect(new Set(seen).size).toBe(5);
  });

  it("stops showing a community's posts after leaving it", async () => {
    actAs(reader.id);
    await leaveCommunity(
      jsonRequest(`/api/communities/${communityId}/join`, "DELETE"),
      params({ id: communityId })
    );
    const feed = await readJson<FeedResponse>(await getFeed(jsonRequest("/api/feed")));
    expect(feed.posts).toEqual([]);
  });
});

describe("bookmarks", () => {
  it("round-trips a bookmark and reflects it in the feed", async () => {
    const user = await createUser();
    actAs(user.id);
    const communityId = await newCommunity("bmk");
    const post = await readJson<{ post: { id: string } }>(
      await createPost(
        jsonRequest("/api/posts", "POST", { communityId, title: "bookmark me", content: "x" })
      )
    );

    const on = await bookmarkPost(
      jsonRequest(`/api/posts/${post.post.id}/bookmark`, "PUT"),
      params({ id: post.post.id })
    );
    expect(on.status).toBe(200);
    expect(await readJson<{ isBookmarked: boolean }>(on)).toMatchObject({ isBookmarked: true });

    // Bookmarking twice must not throw on the unique constraint.
    const again = await bookmarkPost(
      jsonRequest(`/api/posts/${post.post.id}/bookmark`, "PUT"),
      params({ id: post.post.id })
    );
    expect(again.status).toBe(200);

    let feed = await readJson<FeedResponse>(await getFeed(jsonRequest("/api/feed")));
    expect(feed.posts.find((p) => p.id === post.post.id)?.isBookmarked).toBe(true);

    const off = await unbookmarkPost(
      jsonRequest(`/api/posts/${post.post.id}/bookmark`, "DELETE"),
      params({ id: post.post.id })
    );
    expect(off.status).toBe(200);

    feed = await readJson<FeedResponse>(await getFeed(jsonRequest("/api/feed")));
    expect(feed.posts.find((p) => p.id === post.post.id)?.isBookmarked).toBe(false);
  });

  it("404s on bookmarking a post that does not exist", async () => {
    const user = await createUser();
    actAs(user.id);
    const res = await bookmarkPost(
      jsonRequest("/api/posts/does-not-exist/bookmark", "PUT"),
      params({ id: "does-not-exist" })
    );
    expect(res.status).toBe(404);
  });
});
