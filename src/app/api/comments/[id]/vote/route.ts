import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";

const voteSchema = z.object({
  vote: z.enum(["UP", "DOWN", "NONE"]),
});

export const POST = withUserId(
  async (userId, req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const body = await (req as Request).json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { vote } = parsed.data;
    const comment = await db.comment.findFirst({ where: { id } });
    if (!comment) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    if (vote === "NONE") {
      await db.reaction.deleteMany({
        where: { userId, commentId: id },
      });
    } else {
      const existing = await db.reaction.findUnique({
        where: { userId_commentId: { userId, commentId: id } },
      });
      const isUpvote = vote === "UP";
      if (existing) {
        if (existing.isUpvote === isUpvote) {
          await db.reaction.delete({ where: { id: existing.id } });
        } else {
          await db.reaction.update({
            where: { id: existing.id },
            data: { isUpvote },
          });
        }
      } else {
        await db.reaction.create({
          data: { userId, commentId: id, isUpvote },
        });
      }
    }

    const reactions = await db.reaction.findMany({
      where: { commentId: id },
      select: { isUpvote: true, userId: true },
    });
    const upvotes = reactions.filter((r) => r.isUpvote).length;
    const downvotes = reactions.filter((r) => !r.isUpvote).length;
    const score = upvotes - downvotes;
    const myReaction = reactions.find((r) => r.userId === userId);
    const myVote = myReaction ? (myReaction.isUpvote ? "UP" : "DOWN") : null;
    return NextResponse.json({ upvotes, downvotes, score, myVote });
  }
);
