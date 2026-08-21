import path from "path";
import { randomUUID } from "crypto";
import { LocalStorageDriver } from "./local-driver";
import { S3StorageDriver } from "./s3-driver";
import type { StorageDriver } from "./types";

export * from "./types";
export * from "./file-types";
export { scanBuffer, scannerName } from "./scanner";

let cached: StorageDriver | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`STORAGE_DRIVER=s3 requires ${name} to be set`);
  }
  return value;
}

function build(): StorageDriver {
  const driver = process.env.STORAGE_DRIVER ?? "local";
  if (driver === "s3") {
    return new S3StorageDriver({
      bucket: required("STORAGE_S3_BUCKET"),
      region: process.env.STORAGE_S3_REGION ?? "auto",
      accessKeyId: required("STORAGE_S3_ACCESS_KEY_ID"),
      secretAccessKey: required("STORAGE_S3_SECRET_ACCESS_KEY"),
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === "true",
    });
  }
  if (driver !== "local") {
    throw new Error(`Unknown STORAGE_DRIVER: ${driver}`);
  }
  const root = process.env.STORAGE_LOCAL_ROOT
    ? path.resolve(process.env.STORAGE_LOCAL_ROOT)
    : path.resolve(process.cwd(), "storage-data");
  return new LocalStorageDriver(root);
}

export function getStorage(): StorageDriver {
  if (!cached) cached = build();
  return cached;
}

/** Test seam: drop the memoized driver after changing storage env vars. */
export function resetStorageForTests(): void {
  cached = null;
}

/**
 * Storage keys are always generated here, never derived from user input: the
 * owner prefix keeps objects attributable and the random id makes keys
 * unguessable, so an attacker cannot enumerate other users' objects even if a
 * bucket were ever misconfigured.
 */
export function buildStorageKey(ownerId: string, extension: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${ownerId}/${randomUUID()}.${extension}`;
}
