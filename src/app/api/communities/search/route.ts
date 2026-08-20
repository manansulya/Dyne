import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

export const GET = withUserId(async (userId, req: Request) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ communities: [] });
  }
  const communities = await db.community.findMany({
    where: { name: { contains: q } },
    take: 20,
    orderBy: { members: { _count: "desc" } },
    include: { _count: { select: { members: true, posts: true } } },
  });
  return NextResponse.json({ communities });
});
