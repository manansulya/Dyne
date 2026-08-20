import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as upload, GET as uploadLimits } from "@/app/api/uploads/route";
import { DELETE as deleteAttachmentRoute, GET as attachmentMeta } from "@/app/api/attachments/[id]/route";
import { GET as attachmentContent } from "@/app/api/attachments/[id]/content/route";
import { POST as sendDirectMessage } from "@/app/api/direct-messages/route";
import { POST as startConversation } from "@/app/api/conversations/route";
import { assertSafeKey, sanitizeFilename, sniffContentType } from "@/lib/storage";
import { actAs, createUser, db, jsonRequest, params, readJson, type TestUser } from "./helpers";
import { TEST_STORAGE_ROOT } from "./db-path";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 3)]);
const TEXT = Buffer.from("line one\nline two\n");

interface PublicAttachmentJson {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: string;
  url: string;
  scanStatus: string;
}

function uploadRequest(files: Array<{ name: string; bytes: Buffer; type?: string }>): Request {
  const form = new FormData();
  for (const f of files) {
    form.append(
      "file",
      new File([new Uint8Array(f.bytes)], f.name, { type: f.type ?? "application/octet-stream" })
    );
  }
  return new Request("http://localhost:3000/api/uploads", { method: "POST", body: form });
}

async function uploadAs(
  userId: string,
  files: Array<{ name: string; bytes: Buffer; type?: string }>
): Promise<Response> {
  actAs(userId);
  return upload(uploadRequest(files));
}

async function uploadOne(
  userId: string,
  file: { name: string; bytes: Buffer; type?: string }
): Promise<PublicAttachmentJson> {
  const res = await uploadAs(userId, [file]);
  expect(res.status).toBe(201);
  const body = await readJson<{ attachments: PublicAttachmentJson[] }>(res);
  return body.attachments[0]!;
}

describe("content sniffing and filename safety", () => {
  it("classifies by magic bytes, not by the claimed extension", () => {
    const spoofed = sniffContentType(PDF, "totally-an-image.png");
    expect(spoofed.ok && spoofed.contentType).toBe("application/pdf");
  });

  it("rejects markup and executables regardless of extension", () => {
    for (const bytes of [
      Buffer.from("<!DOCTYPE html><script>alert(1)</script>"),
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>"),
      Buffer.from("#!/bin/sh\nrm -rf /\n"),
      Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    ]) {
      const outcome = sniffContentType(bytes, "harmless.txt");
      expect(outcome.ok).toBe(false);
    }
  });

  it("strips directories, control characters and the caller's extension", () => {
    expect(sanitizeFilename("../../etc/passwd", "png")).toBe("passwd.png");
    expect(sanitizeFilename("..\\..\\windows\\system32\\evil.exe", "png")).toBe("evil.png");
    expect(sanitizeFilename("re\u0000port.pdf", "pdf")).toBe("report.pdf");
    // A dotfile has no base name left once its extension is replaced.
    expect(sanitizeFilename(".hidden", "txt")).toBe("file.txt");
    expect(sanitizeFilename("", "png")).toMatch(/\.png$/);
  });

  it("rejects storage keys that could escape the object prefix", () => {
    for (const key of [
      "",
      "/absolute/key.png",
      "uploads/../../etc/passwd",
      "uploads/./key.png",
      "uploads//key.png",
      "uploads/key.png/",
      "uploads/key with spaces.png",
    ]) {
      expect(() => assertSafeKey(key)).toThrow();
    }
    expect(() => assertSafeKey("uploads/2026/08/user1/abc-123.png")).not.toThrow();
  });
});

describe("upload endpoint", () => {
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    alice = await createUser({ name: "Upload Alice" });
    bob = await createUser({ name: "Upload Bob" });
  });

  it("requires authentication", async () => {
    actAs(null);
    const res = await upload(uploadRequest([{ name: "a.png", bytes: PNG }]));
    expect(res.status).toBe(401);
  });

  it("stores the sniffed type and a sanitized filename, ignoring the browser's claims", async () => {
    const attachment = await uploadOne(alice.id, {
      name: "../../evil name!.png",
      bytes: PDF,
      type: "image/png",
    });
    expect(attachment.contentType).toBe("application/pdf");
    expect(attachment.filename).toBe("evil name_.pdf");
    expect(attachment.kind).toBe("PDF");

    const row = await db.attachment.findUniqueOrThrow({ where: { id: attachment.id } });
    expect(row.ownerId).toBe(alice.id);
    expect(row.storageKey).toMatch(
      new RegExp(`^uploads/\\d{4}/\\d{2}/${alice.id}/[0-9a-f-]{36}\\.pdf$`)
    );
    expect(row.byteSize).toBe(PDF.byteLength);
    // No scanner is configured, so the status must say so rather than "CLEAN".
    expect(row.scanStatus).toBe("SKIPPED");
    expect(row.scanner).toBe("none");
  });

  it("rejects rather than truncates oversized files", async () => {
    // text/plain is limited well below the global cap.
    const oversized = Buffer.alloc(11 * 1024 * 1024, 0x41);
    const res = await uploadAs(alice.id, [{ name: "big.txt", bytes: oversized }]);
    expect(res.status).toBe(413);
    expect(await db.attachment.count({ where: { ownerId: alice.id, extension: "txt" } })).toBe(0);
  });

  it("rejects empty, unsupported and executable payloads", async () => {
    expect((await uploadAs(alice.id, [{ name: "empty.txt", bytes: Buffer.alloc(0) }])).status).toBe(400);
    expect(
      (await uploadAs(alice.id, [{ name: "page.html", bytes: Buffer.from("<html><body>hi") }])).status
    ).toBe(415);
    expect(
      (await uploadAs(alice.id, [{ name: "app.exe", bytes: Buffer.from([0x4d, 0x5a, 0x00, 0x01]) }]))
        .status
    ).toBe(415);
  });

  it("requires multipart bodies", async () => {
    actAs(alice.id);
    const res = await upload(jsonRequest("/api/uploads", "POST", { file: "nope" }));
    expect(res.status).toBe(415);
  });

  it("stores duplicate filenames as distinct objects", async () => {
    const first = await uploadOne(alice.id, { name: "notes.txt", bytes: TEXT });
    const second = await uploadOne(alice.id, { name: "notes.txt", bytes: TEXT });
    expect(first.id).not.toBe(second.id);
    expect(first.filename).toBe(second.filename);
    const rows = await db.attachment.findMany({ where: { id: { in: [first.id, second.id] } } });
    expect(new Set(rows.map((r) => r.storageKey)).size).toBe(2);
  });

  it("stores nothing when one file in a batch is rejected", async () => {
    const before = await db.attachment.count({ where: { ownerId: bob.id } });
    const res = await uploadAs(bob.id, [
      { name: "ok.png", bytes: PNG },
      { name: "bad.html", bytes: Buffer.from("<html>x") },
    ]);
    expect(res.status).toBe(415);
    const live = await db.attachment.count({ where: { ownerId: bob.id, deletedAt: null } });
    expect(live).toBe(before);
  });

  it("advertises limits so the picker matches server validation", async () => {
    actAs(alice.id);
    const body = await readJson<{ maxBytes: number; accept: string; types: unknown[] }>(
      await uploadLimits()
    );
    expect(body.maxBytes).toBeGreaterThan(0);
    expect(body.accept).toContain("image/png");
    expect(body.types.length).toBeGreaterThan(5);
  });
});

describe("attachment access control", () => {
  let alice: TestUser;
  let bob: TestUser;
  let outsider: TestUser;
  let conversationId: string;

  beforeAll(async () => {
    alice = await createUser({ name: "Access Alice" });
    bob = await createUser({ name: "Access Bob" });
    outsider = await createUser({ name: "Access Outsider" });
    actAs(alice.id);
    const res = await startConversation(
      jsonRequest("/api/conversations", "POST", { otherUserId: bob.id })
    );
    conversationId = (await readJson<{ conversation: { id: string } }>(res)).conversation.id;
  });

  async function content(userId: string, id: string, query = ""): Promise<Response> {
    actAs(userId);
    return attachmentContent(
      new Request(`http://localhost:3000/api/attachments/${id}/content${query}`),
      params({ id })
    );
  }

  it("serves the owner's own bytes with non-executable headers", async () => {
    const attachment = await uploadOne(alice.id, { name: "shot.png", bytes: PNG });
    const res = await content(alice.id, attachment.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="shot.png"');
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("never serves documents inline, even when the client asks for it", async () => {
    const attachment = await uploadOne(alice.id, { name: "syllabus.pdf", bytes: PDF });
    const res = await content(alice.id, attachment.id, "?disposition=inline");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="syllabus.pdf"');
  });

  it("hides an unattached upload from every other user", async () => {
    const attachment = await uploadOne(alice.id, { name: "private.txt", bytes: TEXT });
    expect((await content(bob.id, attachment.id)).status).toBe(404);
    actAs(bob.id);
    const meta = await attachmentMeta(
      new Request(`http://localhost:3000/api/attachments/${attachment.id}`),
      params({ id: attachment.id })
    );
    expect(meta.status).toBe(404);
  });

  it("does not accept a storage key in place of an attachment id", async () => {
    const attachment = await uploadOne(alice.id, { name: "guess.txt", bytes: TEXT });
    const row = await db.attachment.findUniqueOrThrow({ where: { id: attachment.id } });
    expect((await content(bob.id, row.storageKey)).status).toBe(404);
    expect((await content(alice.id, row.storageKey)).status).toBe(404);
  });

  it("shares an attachment with the conversation once a DM claims it", async () => {
    const attachment = await uploadOne(alice.id, { name: "handout.pdf", bytes: PDF });
    actAs(alice.id);
    const sent = await sendDirectMessage(
      jsonRequest("/api/direct-messages", "POST", {
        conversationId,
        content: "notes attached",
        attachmentIds: [attachment.id],
      })
    );
    expect(sent.status).toBe(200);
    const message = (
      await readJson<{ message: { id: string; attachments: PublicAttachmentJson[] } }>(sent)
    ).message;
    expect(message.attachments.map((a) => a.id)).toEqual([attachment.id]);

    expect((await content(bob.id, attachment.id)).status).toBe(200);
    expect((await content(outsider.id, attachment.id)).status).toBe(404);
  });

  it("refuses to attach another user's upload", async () => {
    const aliceFile = await uploadOne(alice.id, { name: "mine.txt", bytes: TEXT });
    actAs(bob.id);
    const res = await sendDirectMessage(
      jsonRequest("/api/direct-messages", "POST", {
        conversationId,
        content: "stealing",
        attachmentIds: [aliceFile.id],
      })
    );
    expect(res.status).toBe(400);
    const row = await db.attachment.findUniqueOrThrow({ where: { id: aliceFile.id } });
    expect(row.directMessageId).toBeNull();
  });

  it("refuses to attach the same upload twice", async () => {
    const attachment = await uploadOne(alice.id, { name: "once.txt", bytes: TEXT });
    actAs(alice.id);
    const first = await sendDirectMessage(
      jsonRequest("/api/direct-messages", "POST", {
        conversationId,
        content: "first",
        attachmentIds: [attachment.id],
      })
    );
    expect(first.status).toBe(200);
    const second = await sendDirectMessage(
      jsonRequest("/api/direct-messages", "POST", {
        conversationId,
        content: "second",
        attachmentIds: [attachment.id],
      })
    );
    expect(second.status).toBe(400);
  });

  it("only lets the owner delete, and stops serving the bytes afterwards", async () => {
    const attachment = await uploadOne(alice.id, { name: "temp.png", bytes: PNG });
    const row = await db.attachment.findUniqueOrThrow({ where: { id: attachment.id } });
    const onDisk = path.join(TEST_STORAGE_ROOT, row.storageKey);
    expect(fs.existsSync(onDisk)).toBe(true);

    actAs(bob.id);
    const denied = await deleteAttachmentRoute(
      new Request(`http://localhost:3000/api/attachments/${attachment.id}`, { method: "DELETE" }),
      params({ id: attachment.id })
    );
    expect(denied.status).toBe(404);
    expect(fs.existsSync(onDisk)).toBe(true);

    actAs(alice.id);
    const deleted = await deleteAttachmentRoute(
      new Request(`http://localhost:3000/api/attachments/${attachment.id}`, { method: "DELETE" }),
      params({ id: attachment.id })
    );
    expect(deleted.status).toBe(200);
    expect(fs.existsSync(onDisk)).toBe(false);
    expect((await content(alice.id, attachment.id)).status).toBe(404);
    expect((await content(bob.id, attachment.id)).status).toBe(404);
  });
});
