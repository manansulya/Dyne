// Helper: get-or-create a unique 1:1 conversation between two users.
// Sorts the member IDs so (A,B) and (B,A) collapse to the same row.
import { db } from "@/lib/db";

export async function getOrCreateConversation(userOneId: string, userTwoId: string) {
  // Sort IDs so (A,B) and (B,A) collapse to the same row
  const [firstId, secondId] = [userOneId, userTwoId].sort();
  const existing = await db.conversation.findUnique({
    where: { memberOneId_memberTwoId: { memberOneId: firstId, memberTwoId: secondId } },
  });
  if (existing) return existing;
  return db.conversation.create({
    data: { memberOneId: firstId, memberTwoId: secondId },
  });
}

export async function findConversation(userOneId: string, userTwoId: string) {
  const [firstId, secondId] = [userOneId, userTwoId].sort();
  return db.conversation.findUnique({
    where: { memberOneId_memberTwoId: { memberOneId: firstId, memberTwoId: secondId } },
  });
}
