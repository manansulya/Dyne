import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(async (userId) => {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      institution: true,
      semesterName: true,
      onboarded: true,
      createdAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ user });
});
