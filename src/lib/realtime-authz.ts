import { db } from "@/lib/db";
import type { Room } from "@/lib/realtime-rooms";

/**
 * Single source of truth for "may this user subscribe to this realtime room?".
 * Mirrors the HTTP read authorization of the corresponding resource:
 *
 *  - user:<id>          only the user themselves (notifications, presence)
 *  - conversation:<id>  the two DM members only
 *  - channel:<id>       members of the channel's space (see /api/messages)
 *  - community:<id>     any signed-in user, matching public forum reads
 *                       (/api/posts?communityId=…); posting still requires
 *                       membership, which is enforced by the HTTP route.
 */
export async function canJoinRoom(userId: string, room: Room): Promise<boolean> {
  switch (room.kind) {
    case "user":
      return room.id === userId;

    case "conversation": {
      const conversation = await db.conversation.findFirst({
        where: {
          id: room.id,
          OR: [{ memberOneId: userId }, { memberTwoId: userId }],
        },
        select: { id: true },
      });
      return conversation !== null;
    }

    case "channel": {
      const channel = await db.channel.findFirst({
        where: { id: room.id, space: { members: { some: { userId } } } },
        select: { id: true },
      });
      return channel !== null;
    }

    case "community": {
      const community = await db.community.findUnique({
        where: { id: room.id },
        select: { id: true },
      });
      return community !== null;
    }
  }
}
