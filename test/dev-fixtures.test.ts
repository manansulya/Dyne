import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as fixtures } from "@/app/api/dev/fixtures/route";
import { actAs, createUser, db, readJson, type TestUser } from "./helpers";

/**
 * The fixtures route replaced a destructive seed endpoint. These tests assert
 * the two gates hold and that running it cannot remove a user's real rows.
 */
describe("development fixtures", () => {
  let alice: TestUser;
  const originalFlag = process.env.ENABLE_DEV_FIXTURES;

  beforeAll(async () => {
    alice = await createUser({ name: "Fixtures User" });
  });

  afterEach(() => {
    process.env.ENABLE_DEV_FIXTURES = originalFlag;
    vi.unstubAllEnvs();
  });

  it("is a 404 unless explicitly enabled", async () => {
    actAs(alice.id);
    delete process.env.ENABLE_DEV_FIXTURES;
    const res = await fixtures();
    expect(res.status).toBe(404);
  });

  it("is a 404 in a production build even when the flag is set", async () => {
    actAs(alice.id);
    process.env.ENABLE_DEV_FIXTURES = "true";
    vi.stubEnv("NODE_ENV", "production");
    const res = await fixtures();
    expect(res.status).toBe(404);
  });

  it("requires authentication", async () => {
    actAs(null);
    process.env.ENABLE_DEV_FIXTURES = "true";
    const res = await fixtures();
    expect(res.status).toBe(401);
  });

  it("adds content without deleting anything the user already has", async () => {
    actAs(alice.id);
    process.env.ENABLE_DEV_FIXTURES = "true";

    const keptCourse = await db.course.create({
      data: { userId: alice.id, name: "Real Course", code: "REAL 101", color: "#0ea5e9" },
    });
    const keptTask = await db.task.create({
      data: { userId: alice.id, title: "Real task" },
    });
    const keptNote = await db.note.create({
      data: { userId: alice.id, title: "Real note", content: "keep me" },
    });

    const first = await fixtures();
    expect(first.status).toBe(200);
    expect((await readJson<{ ok: boolean }>(first)).ok).toBe(true);

    expect(await db.course.findUnique({ where: { id: keptCourse.id } })).not.toBeNull();
    expect(await db.task.findUnique({ where: { id: keptTask.id } })).not.toBeNull();
    expect(await db.note.findUnique({ where: { id: keptNote.id } })).not.toBeNull();

    const coursesAfterFirst = await db.course.count({ where: { userId: alice.id } });
    expect(coursesAfterFirst).toBeGreaterThan(1);

    // Running it twice must not collide on globally unique names either.
    const second = await fixtures();
    expect(second.status).toBe(200);
    expect(await db.course.count({ where: { userId: alice.id } })).toBeGreaterThan(coursesAfterFirst);
    expect(await db.note.findUnique({ where: { id: keptNote.id } })).not.toBeNull();
  });
});
