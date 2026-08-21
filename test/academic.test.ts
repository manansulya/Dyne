import { beforeAll, describe, expect, it } from "vitest";
import { GET as listTasks, POST as createTask } from "@/app/api/tasks/route";
import { DELETE as deleteTask, PATCH as patchTask } from "@/app/api/tasks/[id]/route";
import { POST as createAssignment } from "@/app/api/assignments/route";
import { actAs, createUser, db, jsonRequest, params, readJson, type TestUser } from "./helpers";

describe("assignment progress recomputation", () => {
  let user: TestUser;
  let assignmentId: string;

  beforeAll(async () => {
    user = await createUser();
    actAs(user.id);
    const created = await readJson<{ assignment: { id: string } }>(
      await createAssignment(
        jsonRequest("/api/assignments", "POST", {
          title: "Essay",
          dueDate: new Date(Date.now() + 86_400_000).toISOString(),
        })
      )
    );
    assignmentId = created.assignment.id;
  });

  async function addTask(title: string) {
    const res = await createTask(
      jsonRequest("/api/tasks", "POST", { title, assignmentId })
    );
    expect(res.status).toBe(200);
    return (await readJson<{ task: { id: string } }>(res)).task.id;
  }

  async function progress() {
    const a = await db.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
    return { progress: a.progress, status: a.status };
  }

  it("tracks progress and status as subtasks are completed, then removed", async () => {
    const first = await addTask("Outline");
    const second = await addTask("Draft");
    expect(await progress()).toEqual({ progress: 0, status: "TODO" });

    await patchTask(
      jsonRequest(`/api/tasks/${first}`, "PATCH", { status: "COMPLETED" }),
      params({ id: first })
    );
    expect(await progress()).toEqual({ progress: 50, status: "IN_PROGRESS" });

    await patchTask(
      jsonRequest(`/api/tasks/${second}`, "PATCH", { status: "COMPLETED" }),
      params({ id: second })
    );
    expect(await progress()).toEqual({ progress: 100, status: "COMPLETED" });

    await deleteTask(jsonRequest(`/api/tasks/${second}`, "DELETE"), params({ id: second }));
    expect(await progress()).toEqual({ progress: 100, status: "COMPLETED" });

    await deleteTask(jsonRequest(`/api/tasks/${first}`, "DELETE"), params({ id: first }));
    expect(await progress()).toEqual({ progress: 0, status: "TODO" });
  });

  it("refuses to attach a task to another user's assignment", async () => {
    const other = await createUser();
    actAs(other.id);
    const res = await createTask(
      jsonRequest("/api/tasks", "POST", { title: "Steal", assignmentId })
    );
    expect(res.status).toBe(400);
    actAs(user.id);
  });
});

describe("task listing", () => {
  it("is empty for a brand-new user and only ever returns that user's rows", async () => {
    const fresh = await createUser();
    actAs(fresh.id);
    const empty = await readJson<{ tasks: unknown[] }>(await listTasks(jsonRequest("/api/tasks")));
    expect(empty.tasks).toEqual([]);

    await createTask(jsonRequest("/api/tasks", "POST", { title: "Mine" }));
    const mine = await readJson<{ tasks: Array<{ title: string }> }>(
      await listTasks(jsonRequest("/api/tasks"))
    );
    expect(mine.tasks.map((t) => t.title)).toEqual(["Mine"]);

    const stranger = await createUser();
    actAs(stranger.id);
    const theirs = await readJson<{ tasks: unknown[] }>(await listTasks(jsonRequest("/api/tasks")));
    expect(theirs.tasks).toEqual([]);
  });

  it("filters by status and due date", async () => {
    const user = await createUser();
    actAs(user.id);
    await createTask(
      jsonRequest("/api/tasks", "POST", {
        title: "Due today",
        dueDate: "2030-05-05T10:00:00.000Z",
      })
    );
    await createTask(jsonRequest("/api/tasks", "POST", { title: "No date", status: "COMPLETED" }));

    const onDay = await readJson<{ tasks: Array<{ title: string }> }>(
      await listTasks(jsonRequest("/api/tasks?dueDate=2030-05-05"))
    );
    expect(onDay.tasks.map((t) => t.title)).toEqual(["Due today"]);

    const done = await readJson<{ tasks: Array<{ title: string }> }>(
      await listTasks(jsonRequest("/api/tasks?status=COMPLETED"))
    );
    expect(done.tasks.map((t) => t.title)).toEqual(["No date"]);

    const invalid = await listTasks(jsonRequest("/api/tasks?status=NOPE"));
    expect(invalid.status).toBe(400);
  });
});
