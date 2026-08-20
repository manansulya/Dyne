import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastChannelMessageUpdate } from "@/lib/realtime-server";

const updateSchema = z.object({
  content: z.string().max(5000).optional(),
  isDeleted: z.boolean().optional(),
});

export const PATCH = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const message = await db.message.findFirst({
      where: { id },
      include: { channel: { include: { space: { include: { members: { where: { userId } } } } } } },
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    const myMembership = message.channel.space.members[0];
    if (!myMembership) {
      return NextResponse.json({ error: "Not a member of this space" }, { status: 403 });
    }
    const isAuthor = message.authorId === userId;
    const isModOrAdmin = myMembership.role === "ADMIN" || myMembership.role === "MODERATOR";
    // Author can edit content; mod/admin can soft-delete
    if (parsed.data.isDeleted && !isModOrAdmin && !isAuthor) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    if (!parsed.data.isDeleted && !isAuthor) {
      return NextResponse.json({ error: "Only the author can edit content" }, { status: 403 });
    }
    const data: { content?: string; isEdited?: boolean; isDeleted?: boolean; fileUrl?: null; fileKind?: null } = {};
    if (parsed.data.content !== undefined && isAuthor) {
      data.content = parsed.data.content;
      data.isEdited = true;
    }
    if (parsed.data.isDeleted) {
      data.isDeleted = true;
      data.content = "This message has been deleted.";
      data.fileUrl = null;
      data.fileKind = null;
    }
    const updated = await db.message.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
      },
    });
    broadcastChannelMessageUpdate(message.channelId, updated);
    return NextResponse.json({ message: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const message = await db.message.findFirst({
      where: { id },
      include: { channel: { include: { space: { include: { members: { where: { userId } } } } } } },
    });
    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }
    const myMembership = message.channel.space.members[0];
    if (!myMembership) {
      return NextResponse.json({ error: "Not a member of this space" }, { status: 403 });
    }
    const isAuthor = message.authorId === userId;
    const isModOrAdmin = myMembership.role === "ADMIN" || myMembership.role === "MODERATOR";
    if (!isAuthor && !isModOrAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const updated = await db.message.update({
      where: { id },
      data: {
        isDeleted: true,
        content: "This message has been deleted.",
        fileUrl: null,
        fileKind: null,
      },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true, isOnline: true } },
      },
    });
    broadcastChannelMessageUpdate(message.channelId, updated);
    return NextResponse.json({ message: updated });
  }
);
