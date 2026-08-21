import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { canReadAttachment, deleteAttachment, publicAttachment } from "@/lib/attachments";

export const GET = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const attachment = await db.attachment.findUnique({ where: { id } });
    // Unreadable attachments are indistinguishable from missing ones, so ids
    // cannot be probed for existence.
    if (!attachment || !(await canReadAttachment(userId, attachment))) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    return NextResponse.json({ attachment: publicAttachment(attachment) });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const attachment = await db.attachment.findUnique({ where: { id } });
    if (!attachment || attachment.deletedAt) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    // Only the uploader can destroy the bytes, even if others can read them.
    if (attachment.ownerId !== userId) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }
    await deleteAttachment(attachment);
    return NextResponse.json({ ok: true });
  }
);
