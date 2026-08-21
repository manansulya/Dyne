/**
 * Room naming shared by the Next.js app and the realtime service. Kept free of
 * Next/Prisma imports so the standalone service can import it directly.
 */

export const ROOM_KINDS = ["user", "conversation", "channel", "community"] as const;
export type RoomKind = (typeof ROOM_KINDS)[number];

export interface Room {
  kind: RoomKind;
  id: string;
}

export function roomName({ kind, id }: Room): string {
  return `${kind}:${id}`;
}

/** Parses "conversation:abc" into a room, rejecting anything unknown. */
export function parseRoom(value: unknown): Room | null {
  if (typeof value !== "string") return null;
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!id || !(ROOM_KINDS as readonly string[]).includes(kind)) return null;
  return { kind: kind as RoomKind, id };
}
