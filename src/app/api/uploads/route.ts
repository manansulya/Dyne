import { NextResponse } from "next/server";
import type { Attachment } from "@prisma/client";
import { withUserId } from "@/lib/server-auth";
import { deleteAttachment, publicAttachment, storeUpload } from "@/lib/attachments";
import { MAX_UPLOAD_BYTES, acceptAttribute, allowedTypes } from "@/lib/storage";

/**
 * Authenticated upload endpoint. Accepts `multipart/form-data` with one or more
 * `file` parts; the uploaded objects start unattached and private to the
 * uploader until a message/post claims them.
 */
export const POST = withUserId(async (userId, req: Request) => {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json(
      { error: "Upload must be multipart/form-data" },
      { status: 415 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Malformed upload" }, { status: 400 });
  }

  const files = form.getAll("file").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (files.length > 10) {
    return NextResponse.json({ error: "At most 10 files per request" }, { status: 400 });
  }

  const stored: Attachment[] = [];
  for (const file of files) {
    const result = await storeUpload(userId, file);
    if (!result.ok) {
      // A request either stores every file or none of them, so a rejected file
      // never leaves half-uploaded siblings behind for the client to reconcile.
      for (const done of stored) {
        await deleteAttachment(done);
      }
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    stored.push(result.attachment);
  }

  return NextResponse.json(
    { attachments: stored.map(publicAttachment) },
    { status: 201 }
  );
});

/** Client-discoverable upload limits, so the picker and validation agree. */
export const GET = withUserId(async () => {
  return NextResponse.json({
    maxBytes: MAX_UPLOAD_BYTES,
    accept: acceptAttribute(),
    types: allowedTypes().map((t) => ({
      contentType: t.contentType,
      extension: t.extension,
      kind: t.kind,
      maxBytes: t.maxBytes,
    })),
  });
});
