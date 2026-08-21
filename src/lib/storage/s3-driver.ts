import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  assertSafeKey,
  StorageObjectNotFound,
  type ObjectMetadata,
  type PutOptions,
  type SignedUrlOptions,
  type StorageDriver,
} from "./types";

export interface S3DriverConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Set for R2 / MinIO; omit for AWS S3. */
  endpoint?: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible driver — the same code path serves AWS S3, Cloudflare R2 and
 * MinIO; only the endpoint differs. Objects are written with no public ACL: all
 * reads go through an application authorization check that then either streams
 * the bytes or hands out a short-lived presigned URL.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = "s3";
  readonly bucket: string;
  private readonly client: S3Client;

  constructor(config: S3DriverConfig) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle ?? Boolean(config.endpoint),
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(key: string, body: Buffer, options: PutOptions): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: options.contentType,
        // Browsers must never be able to render a stored object as an inline
        // document on a bucket domain.
        ContentDisposition: `attachment; filename="${options.filename.replace(/"/g, "")}"`,
        Metadata: { ownerid: options.ownerId },
      })
    );
  }

  async get(key: string): Promise<Buffer> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      if (!res.Body) throw new StorageObjectNotFound(key);
      const bytes = await res.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch (err) {
      if (err instanceof StorageObjectNotFound) throw err;
      throw new StorageObjectNotFound(key);
    }
  }

  async head(key: string): Promise<ObjectMetadata | null> {
    assertSafeKey(key);
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key })
      );
      return {
        key,
        size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async signedUrl(key: string, options: SignedUrlOptions): Promise<string | null> {
    assertSafeKey(key);
    const disposition = options.disposition ?? "attachment";
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      ResponseContentDisposition: options.filename
        ? `${disposition}; filename="${options.filename.replace(/"/g, "")}"`
        : disposition,
    });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresInSeconds });
  }
}
