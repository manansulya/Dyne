import { promises as fs } from "fs";
import path from "path";
import {
  assertSafeKey,
  StorageObjectNotFound,
  type ObjectMetadata,
  type PutOptions,
  type SignedUrlOptions,
  type StorageDriver,
} from "./types";

interface SidecarMetadata {
  contentType: string;
  filename: string;
  ownerId: string;
}

/**
 * Development driver: bytes on local disk, metadata in a `.meta.json` sidecar.
 * It is deliberately not signed-URL capable — the application streams these
 * objects through an authorized route, which is how it behaves in production
 * too when signing is unavailable.
 *
 * This is not production storage: no replication, no lifecycle rules, and the
 * files live on whichever machine served the upload.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";
  readonly bucket = null;

  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    const root = path.resolve(this.root);
    // Defence in depth: even if key validation is ever loosened, refuse to
    // touch anything outside the storage root.
    if (full !== root && !full.startsWith(root + path.sep)) {
      throw new Error(`Unsafe storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    const meta: SidecarMetadata = {
      contentType: options.contentType,
      filename: options.filename,
      ownerId: options.ownerId,
    };
    await fs.writeFile(`${full}.meta.json`, JSON.stringify(meta), "utf8");
  }

  async get(key: string): Promise<Buffer> {
    const full = this.resolve(key);
    try {
      return await fs.readFile(full);
    } catch {
      throw new StorageObjectNotFound(key);
    }
  }

  async head(key: string): Promise<ObjectMetadata | null> {
    const full = this.resolve(key);
    try {
      const stat = await fs.stat(full);
      let contentType = "application/octet-stream";
      try {
        const raw = await fs.readFile(`${full}.meta.json`, "utf8");
        contentType = (JSON.parse(raw) as SidecarMetadata).contentType;
      } catch {
        // Missing sidecar: fall back to the generic type.
      }
      return { key, size: stat.size, contentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await fs.rm(full, { force: true });
    await fs.rm(`${full}.meta.json`, { force: true });
  }

  async signedUrl(_key: string, _options: SignedUrlOptions): Promise<string | null> {
    return null;
  }
}
