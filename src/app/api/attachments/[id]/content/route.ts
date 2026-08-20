import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { canReadAttachment } from "@/lib/attachments";
import { allowedType, getStorage, StorageObjectNotFound } from "@/lib/storage";

const SIGNED_URL_TTL_SECONDS = 300;

/**
 * Authorized read path for stored bytes.
 *
 * Every request is authenticated and authorized against the attachment's
 * placement before anything is served. When the driver can issue a presigned
 * URL the client is redirected to it (short-lived, so a leaked link expires);
 * otherwise the bytes are streamed through this route. Either way the bucket
 * itself stays private.
 */
export const GET = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const attachment = await db.attachment.findUnique({ where: { id } });
    if (!attachment || !(await canReadAttachment(userId, attachment))) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const type = allowedType(attachment.contentType);
    // Only media types are allowed to render in place; everything else — HTML,
    // PDFs, documents, archives — is forced to download so it can never execute
    // as a document on the application origin.
    const wantsInline = new URL(req.url).searchParams.get("disposition") !== "attachment";
    const disposition: "inline" | "attachment" =
      type?.inlineSafe && wantsInline ? "inline" : "attachment";

    const storage = getStorage();
    if (attachment.driver !== storage.name) {
      // The row was written by a different storage backend than the one this
      // instance is configured with; refuse rather than guess a key.
      return NextResponse.json(
        { error: "Attachment is stored in a backend this server cannot read" },
        { status: 503 }
      );
    }

    const signed = await storage.signedUrl(attachment.storageKey, {
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      filename: attachment.filename,
      contentType: attachment.contentType,
      disposition,
    });
    if (signed) {
      return NextResponse.redirect(signed, {
        status: 302,
        headers: { "Cache-Control": "private, no-store" },
      });
    }

    let body: Buffer;
    try {
      body = await storage.get(attachment.storageKey);
    } catch (err) {
      if (err instanceof StorageObjectNotFound) {
        return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
      }
      throw err;
    }

    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Length": String(body.byteLength),
        "Content-Disposition": `${disposition}; filename="${attachment.filename}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  }
);
