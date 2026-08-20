import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const updateSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Username must start with a letter and contain only letters/numbers/underscores")
    .optional(),
  bio: z.string().max(500).optional().nullable(),
  avatarUrl: z.string().max(500_000).optional().nullable(),
  name: z.string().max(80).optional().nullable(),
  institution: z.string().max(200).optional().nullable(),
});

export const GET = withUserId(async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      bio: true,
      avatarUrl: true,
      institution: true,
      semesterName: true,
      onboarded: true,
      createdAt: true,
      isOnline: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const [postsCount, commentsCount, joinedCommunities, joinedSpaces] = await Promise.all([
    db.post.count({ where: { authorId: userId } }),
    db.comment.count({ where: { authorId: userId } }),
    db.communityMember.count({ where: { userId } }),
    db.spaceMember.count({ where: { userId } }),
  ]);
  const postReactions = await db.reaction.findMany({
    where: { userId: { not: userId }, post: { authorId: userId } },
    select: { isUpvote: true },
  });
  const commentReactions = await db.reaction.findMany({
    where: { userId: { not: userId }, comment: { authorId: userId } },
    select: { isUpvote: true },
  });
  const postKarma =
    postReactions.filter((r) => r.isUpvote).length -
    postReactions.filter((r) => !r.isUpvote).length;
  const commentKarma =
    commentReactions.filter((r) => r.isUpvote).length -
    commentReactions.filter((r) => !r.isUpvote).length;
  const karma = postKarma + commentKarma;

  return NextResponse.json({
    user: {
      ...user,
      postsCount,
      commentsCount,
      joinedCommunities,
      joinedSpaces,
      karma,
      postKarma,
      commentKarma,
    },
  });
});

export const PATCH = withUserId(async (userId, req: Request) => {
  const body = await (req as Request).json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const data = parsed.data;
  if (data.username) {
    const existing = await db.user.findFirst({
      where: { username: data.username, NOT: { id: userId } },
    });
    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }
  }
  const updated = await db.user.update({
    where: { id: userId },
    data: {
      ...(data.username ? { username: data.username } : {}),
      ...(data.name !== undefined ? { name: data.name ?? null } : {}),
      ...(data.bio !== undefined ? { bio: data.bio ?? null } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl ?? null } : {}),
      ...(data.institution !== undefined ? { institution: data.institution ?? null } : {}),
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      bio: true,
      avatarUrl: true,
      institution: true,
      semesterName: true,
      onboarded: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ user: updated });
});
