import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocalStorageDriver } from "@/lib/storage/local-driver";
import { StorageObjectNotFound } from "@/lib/storage";
import { S3StorageDriver } from "@/lib/storage/s3-driver";

/** Commands the mocked S3 client received, newest last. */
const sent: Array<{ input: Record<string, unknown> }> = [];

vi.mock("@aws-sdk/client-s3", () => {
  class Command {
    constructor(public readonly input: Record<string, unknown>) {}
  }
  return {
    S3Client: class {
      async send(command: { input: Record<string, unknown> }) {
        sent.push(command);
        return { ContentLength: 3, ContentType: "image/png" };
      }
    },
    PutObjectCommand: class PutObjectCommand extends Command {},
    GetObjectCommand: class GetObjectCommand extends Command {},
    HeadObjectCommand: class HeadObjectCommand extends Command {},
    DeleteObjectCommand: class DeleteObjectCommand extends Command {},
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: async (
    _client: unknown,
    command: { input: Record<string, unknown> },
    opts: { expiresIn: number }
  ) => `https://signed.example/${String(command.input.Key)}?expires=${opts.expiresIn}`,
}));

function tempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "dyne-storage-"));
}

describe("local storage driver", () => {
  it("round-trips bytes with their metadata", async () => {
    const driver = new LocalStorageDriver(tempRoot());
    const key = "uploads/2026/08/user1/object.png";
    await driver.put(key, Buffer.from("bytes"), {
      contentType: "image/png",
      filename: "object.png",
      ownerId: "user1",
    });
    expect((await driver.get(key)).toString()).toBe("bytes");
    expect(await driver.head(key)).toEqual({ key, size: 5, contentType: "image/png" });

    await driver.delete(key);
    expect(await driver.head(key)).toBeNull();
    await expect(driver.get(key)).rejects.toBeInstanceOf(StorageObjectNotFound);
  });

  it("refuses keys that would write outside its root", async () => {
    const root = tempRoot();
    const driver = new LocalStorageDriver(root);
    const body = Buffer.from("x");
    const options = { contentType: "text/plain", filename: "x.txt", ownerId: "user1" };
    for (const key of ["../escape.txt", "uploads/../../escape.txt", "/etc/passwd"]) {
      await expect(driver.put(key, body, options)).rejects.toThrow();
      await expect(driver.get(key)).rejects.toThrow();
    }
    expect(fs.readdirSync(root)).toHaveLength(0);
  });

  it("cannot issue signed URLs, so reads must go through the app", async () => {
    const driver = new LocalStorageDriver(tempRoot());
    expect(await driver.signedUrl("uploads/a/b.png", { expiresInSeconds: 60 })).toBeNull();
  });
});

/**
 * The S3/R2 path is exercised against a mocked client: this proves the commands
 * and options we send (private writes, forced download disposition, presigned
 * expiry) without a bucket. It is NOT a verification against real R2.
 */
describe("s3 storage driver (mocked client)", () => {
  afterEach(() => {
    sent.length = 0;
  });

  function driverForTest() {
    return new S3StorageDriver({
      bucket: "dyne-test",
      region: "auto",
      accessKeyId: "id",
      secretAccessKey: "secret",
      endpoint: "https://accountid.r2.cloudflarestorage.com",
    });
  }

  it("writes private objects that browsers must download rather than render", async () => {
    const driver = driverForTest();
    await driver.put("uploads/2026/08/user1/a.png", Buffer.from("abc"), {
      contentType: "image/png",
      filename: 'we"ird.png',
      ownerId: "user1",
    });
    const input = sent[0]!.input;
    expect(input.Bucket).toBe("dyne-test");
    expect(input.ContentType).toBe("image/png");
    expect(input.ContentDisposition).toBe('attachment; filename="weird.png"');
    expect(input.ACL).toBeUndefined();
  });

  it("presigns short-lived reads with the disposition the app decided", async () => {
    const driver = driverForTest();
    const url = await driver.signedUrl("uploads/2026/08/user1/a.png", {
      expiresInSeconds: 300,
      filename: "a.png",
      contentType: "image/png",
      disposition: "inline",
    });
    expect(url).toBe("https://signed.example/uploads/2026/08/user1/a.png?expires=300");
  });

  it("validates keys before touching the network", async () => {
    const driver = driverForTest();
    await expect(driver.delete("uploads/../../etc/passwd")).rejects.toThrow();
    expect(sent).toHaveLength(0);
  });
});
