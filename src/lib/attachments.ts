import { createHash } from "crypto";
import type { Attachment } from "@prisma/client";
import { db } from "@/lib/db";
import {
  MAX_UPLOAD_BYTES,
  buildStorageKey,
  getStorage,
  sanitizeFilename,
  scanBuffer,
  sniffContentType,
} from "@/lib/storage";

export type UploadRejection =
  | { ok: false; status: number; error: string };

export type UploadOutcome = { ok: true; attachment: Attachment } | UploadRejection;

/**
 * Store an uploaded file and record it.
 *
 * Order matters: the bytes are validated (size, then sniffed type, then
 * scanner) before anything is written to storage, and the database row is only
 * created once the object exists — so a row never points at a missing object.
 * A failed row insert removes the object again rather than leaking it.
 */
export async function storeUpload(
  ownerId: string,
  file: { name: string; size: number; arrayBuffer(): Promise<ArrayBuffer> }
): Promise<UploadOutcome> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File is larger than the ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return { ok: false, status: 413, error: "File is larger than the upload limit" };
  }

  const sniffed = sniffContentType(buffer, file.name);
  if (!sniffed.ok) {
    if (sniffed.reason === "empty") {
      return { ok: false, status: 400, error: "File is empty" };
    }
    if (sniffed.reason === "executable") {
      return { ok: false, status: 415, error: "Executable and markup files are not accepted" };
    }
    return {
      ok: false,
      status: 415,
      error: `Unsupported file type (${sniffed.detected})`,
    };
  }

  const { type, contentType } = sniffed;
  if (buffer.byteLength > type.maxBytes) {
    return {
      ok: false,
      status: 413,
      error: `${contentType} files are limited to ${Math.floor(type.maxBytes / (1024 * 1024))}MB`,
    };
  }

  const scan = await scanBuffer(buffer, file.name);
  if (scan.status === "INFECTED") {
    return { ok: false, status: 422, error: "File was rejected by the malware scanner" };
  }

  const storage = getStorage();
  const filename = sanitizeFilename(file.name, type.extension);
  const storageKey = buildStorageKey(ownerId, type.extension);
  const checksum = createHash("sha256").update(buffer).digest("hex");

  await storage.put(storageKey, buffer, { contentType, filename, ownerId });

  try {
    const attachment = await db.attachment.create({
      data: {
        ownerId,
        driver: storage.name,
        bucket: storage.bucket,
        storageKey,
        filename,
        contentType,
        extension: type.extension,
        byteSize: buffer.byteLength,
        checksum,
        kind: type.kind,
        scanStatus: scan.status,
        scanner: scan.scanner,
      },
    });
    return { ok: true, attachment };
  } catch (err) {
    await storage.delete(storageKey).catch(() => {});
    throw err;
  }
}

/**
 * Who may read the bytes: the owner always, plus anyone who can see the
 * message, DM, or post the attachment was attached to. An unattached upload is
 * private to its owner.
 */
export async function canReadAttachment(userId: string, attachment: Attachment): Promise<boolean> {
  if (attachment.deletedAt) return false;
  if (attachment.ownerId === userId) return true;

  if (attachment.messageId) {
    const message = await db.message.findFirst({
      where: {
        id: attachment.messageId,
        isDeleted: false,
        channel: { space: { members: { some: { userId } } } },
      },
      select: { id: true },
    });
    if (message) return true;
  }

  if (attachment.directMessageId) {
    const dm = await db.directMessage.findFirst({
      where: {
        id: attachment.directMessageId,
        isDeleted: false,
        conversation: { OR: [{ memberOneId: userId }, { memberTwoId: userId }] },
      },
      select: { id: true },
    });
    if (dm) return true;
  }

  if (attachment.postId) {
    // Community posts are readable by any authenticated user, matching the
    // existing forum read model.
    const post = await db.post.findUnique({
      where: { id: attachment.postId },
      select: { id: true },
    });
    if (post) return true;
  }

  return false;
}

/**
 * Can this user still attach all of these uploads? Checked before the message
 * row is written so a bad attachment id cannot leave an orphaned message.
 */
export async function verifyClaimable(
  ownerId: string,
  attachmentIds: readonly string[]
): Promise<boolean> {
  if (attachmentIds.length === 0) return true;
  const unique = [...new Set(attachmentIds)];
  const available = await db.attachment.count({
    where: {
      id: { in: unique },
      ownerId,
      deletedAt: null,
      messageId: null,
      directMessageId: null,
      postId: null,
    },
  });
  return available === unique.length;
}

export type ClaimTarget =
  | { messageId: string }
  | { directMessageId: string }
  | { postId: string };

/**
 * Attach previously uploaded files to a message/DM/post.
 *
 * Only the uploader's own, still-unattached, not-deleted rows can be claimed,
 * so a caller cannot smuggle someone else's attachment id into their own
 * message and thereby republish it.
 */
export async function claimAttachments(
  ownerId: string,
  attachmentIds: readonly string[],
  target: ClaimTarget
): Promise<{ claimed: number; rejected: string[] }> {
  if (attachmentIds.length === 0) return { claimed: 0, rejected: [] };

  const owned = await db.attachment.findMany({
    where: {
      id: { in: [...attachmentIds] },
      ownerId,
      deletedAt: null,
      messageId: null,
      directMessageId: null,
      postId: null,
    },
    select: { id: true },
  });
  const claimable = new Set(owned.map((a) => a.id));
  const rejected = attachmentIds.filter((id) => !claimable.has(id));

  if (claimable.size > 0) {
    await db.attachment.updateMany({
      where: { id: { in: [...claimable] } },
      data: { ...target, visibility: "ATTACHED" },
    });
  }
  return { claimed: claimable.size, rejected };
}

/**
 * Soft-delete the row and remove the object. The row is kept (with deletedAt
 * set) so that references from messages resolve to a "deleted file" state
 * instead of a dangling id, and so the key is never handed out again.
 */
export async function deleteAttachment(attachment: Attachment): Promise<void> {
  const storage = getStorage();
  if (attachment.driver === storage.name) {
    await storage.delete(attachment.storageKey).catch(() => {});
  }
  await db.attachment.update({
    where: { id: attachment.id },
    data: { deletedAt: new Date(), visibility: "PRIVATE" },
  });
}

export interface PublicAttachment {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  kind: string;
  url: string;
  scanStatus: string;
}

export function publicAttachment(attachment: Attachment): PublicAttachment {
  return {
    id: attachment.id,
    filename: attachment.filename,
    contentType: attachment.contentType,
    byteSize: attachment.byteSize,
    kind: attachment.kind,
    url: `/api/attachments/${attachment.id}/content`,
    scanStatus: attachment.scanStatus,
  };
}
