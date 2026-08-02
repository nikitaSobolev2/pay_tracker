import { prisma } from "@/lib/prisma";

/**
 * Marks event content as changed for live guests. Presence heartbeats must not
 * call this — they update ownerLastSeenAt without touching updatedAt.
 */
export async function bumpEventContent(eventId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Event"
    SET "updatedAt" = NOW()
    WHERE id = ${eventId}
  `;
}

/** ISO stamp guests compare between live polls to know when to refetch detail. */
export async function readEventContentRevision(
  eventId: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ updatedAt: Date }>>`
    SELECT "updatedAt"
    FROM "Event"
    WHERE id = ${eventId}
  `;
  const updatedAt = rows[0]?.updatedAt;
  return updatedAt ? updatedAt.toISOString() : null;
}
