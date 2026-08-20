import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const createChannelSchema = z.object({
  spaceId: z.string().min(1),
  name: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers, and hyphens only"),
  description: z.string().max(200).optional().nullable(),
});

export const POST = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = createChannelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  // Validate membership + role
  const me = await db.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: data.spaceId, userId } },
  });
  if (!me) {
    return NextResponse.json({ error: "You are not a member of this space" }, { status: 403 });
  }
  if (me.role === "MEMBER") {
    return NextResponse.json({ error: "Only admins/mods can create channels" }, { status: 403 });
  }
  // Reject "general" (protected name)
  if (data.name.toLowerCase() === "general") {
    return NextResponse.json({ error: "Channel 'general' already exists" }, { status: 400 });
  }
  const maxPosition = await db.channel.findFirst({
    where: { spaceId: data.spaceId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const channel = await db.channel.create({
    data: {
      spaceId: data.spaceId,
      name: data.name,
      type: "TEXT",
      description: data.description ?? null,
      createdById: userId,
      position: (maxPosition?.position ?? 0) + 1,
    },
  });
  return NextResponse.json({ channel });
});
