/**
 * Object-storage abstraction.
 *
 * The application never touches a filesystem path or an S3 client directly: it
 * asks the configured driver for an opaque key. That keeps the local
 * development driver and the production S3/R2 driver interchangeable, and keeps
 * authorization in the application (which knows about users) rather than in the
 * bucket.
 */

export interface PutOptions {
  contentType: string;
  /** Original (already sanitized) filename, stored as object metadata. */
  filename: string;
  /** Owning user id, stored as object metadata for forensics. */
  ownerId: string;
}

export interface ObjectMetadata {
  key: string;
  size: number;
  contentType: string;
}

export interface SignedUrlOptions {
  expiresInSeconds: number;
  /** Filename to force in the download, when the driver supports it. */
  filename?: string;
  contentType?: string;
  /** `inline` renders in the browser, `attachment` always downloads. */
  disposition?: "inline" | "attachment";
}

export interface StorageDriver {
  /** Stable identifier persisted on Attachment.driver. */
  readonly name: string;
  /** Bucket for object stores, null for the local filesystem driver. */
  readonly bucket: string | null;

  put(key: string, body: Buffer, options: PutOptions): Promise<void>;
  get(key: string): Promise<Buffer>;
  head(key: string): Promise<ObjectMetadata | null>;
  delete(key: string): Promise<void>;

  /**
   * A time-limited URL that grants direct read access to the object, or null
   * when the driver cannot issue one (the local driver). Callers must fall back
   * to streaming through an authorized application route in that case.
   */
  signedUrl(key: string, options: SignedUrlOptions): Promise<string | null>;
}

export class StorageObjectNotFound extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = "StorageObjectNotFound";
  }
}

/**
 * Keys are generated server-side, but they are also read back from the
 * database and (in tests) from callers, so every driver validates them. This
 * rejects absolute paths, traversal segments, and anything outside a
 * deliberately narrow character set before it can reach a filesystem or bucket.
 */
export function assertSafeKey(key: string): void {
  if (
    !key ||
    key.length > 512 ||
    key.startsWith("/") ||
    key.endsWith("/") ||
    !/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/.test(key) ||
    key.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}
