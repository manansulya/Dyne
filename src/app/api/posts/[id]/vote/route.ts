import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { withUserId } from "@/lib/server-auth";
import { broadcastCommunityPost } from "@/lib/realtime-server";

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
    const post = await db.post.findFirst({ where: { id } });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (vote === "NONE") {
      await db.reaction.deleteMany({
        where: { userId, postId: id },
      });
    } else {
      // Upsert reaction (one row per user+post, unique constraint)
      const existing = await db.reaction.findUnique({
        where: { userId_postId: { userId, postId: id } },
      });
      const isUpvote = vote === "UP";
      if (existing) {
        // Toggle: if same vote, remove; else update
        if (existing.isUpvote === isUpvote) {
          await db.reaction.delete({ where: { id: existing.id } });
        } else {
          await db.reaction.update({ where: { id: existing.id }, data: { isUpvote } });
        }
      } else {
        await db.reaction.create({
          data: { userId, postId: id, isUpvote },
        });
      }
    }

    // Compute new counts
    const reactions = await db.reaction.findMany({
      where: { postId: id },
      select: { isUpvote: true, userId: true },
    });
    const upvotes = reactions.filter((r) => r.isUpvote).length;
    const downvotes = reactions.filter((r) => !r.isUpvote).length;
    const score = upvotes - downvotes;
    const myReaction = reactions.find((r) => r.userId === userId);
    const myVote = myReaction ? (myReaction.isUpvote ? "UP" : "DOWN") : null;

    // Broadcast update (so other clients see the new score)
    const updatedPost = await db.post.findFirst({
      where: { id },
      include: {
        author: { select: { id: true, name: true, username: true, avatarUrl: true } },
        community: { select: { id: true, name: true, color: true, iconUrl: true } },
        _count: { select: { comments: true, reactions: true } },
      },
    });
    if (updatedPost) {
      broadcastCommunityPost(updatedPost.communityId, {
        ...updatedPost,
        upvotes,
        downvotes,
        score,
        myVote: null, // broadcast is generic — individual clients know their own vote
      });
    }

    return NextResponse.json({ upvotes, downvotes, score, myVote });
  }
);
