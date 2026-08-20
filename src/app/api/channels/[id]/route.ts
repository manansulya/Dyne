import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const updateSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  description: z.string().max(200).optional().nullable(),
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
    const channel = await db.channel.findFirst({
      where: { id },
      include: { space: { include: { members: { where: { userId } } } } },
    });
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const myMembership = channel.space.members[0];
    if (!myMembership || myMembership.role === "MEMBER") {
      return NextResponse.json({ error: "Admins/mods only" }, { status: 403 });
    }
    if (channel.name === "general" && parsed.data.name && parsed.data.name !== "general") {
      return NextResponse.json({ error: "Cannot rename 'general' channel" }, { status: 400 });
    }
    const updated = await db.channel.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ channel: updated });
  }
);

export const DELETE = withUserId(
  async (userId, _req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const channel = await db.channel.findFirst({
      where: { id },
      include: { space: { include: { members: { where: { userId } } } } },
    });
    if (!channel) {
      return NextResponse.json({ error: "Channel not found" }, { status: 404 });
    }
    const myMembership = channel.space.members[0];
    if (!myMembership || myMembership.role === "MEMBER") {
      return NextResponse.json({ error: "Admins/mods only" }, { status: 403 });
    }
    if (channel.name === "general") {
      return NextResponse.json({ error: "Cannot delete 'general' channel" }, { status: 400 });
    }
    await db.channel.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }
);
