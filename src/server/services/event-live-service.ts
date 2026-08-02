import type { EventViewer } from "@/lib/event-access";
import { resolveOwnerName } from "@/lib/event-author";
import { prisma } from "@/lib/prisma";
import { EventAuthorRole } from "@/types/enums";
import { readEventContentRevision } from "./event-content-revision";
import { listMessages, type EventChatMessageDto } from "./event-chat-service";
import { countOpenThreadsBySpending } from "./event-thread-service";

export type EventPresenceViewerDto = {
  readonly id: string;
  readonly name: string;
  readonly isOwner: boolean;
};

export type EventLiveDto = {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly messages: readonly EventChatMessageDto[];
  readonly threadCounts: Record<string, number>;
  /** Changes when spendings, people, payments, links, or event fields change. */
  readonly contentRevision: string | null;
  readonly serverTime: string;
};

export type PollEventLiveInput = {
  readonly eventId: string;
  readonly viewer: EventViewer;
  readonly chatAfterId?: string | null;
};

const ONLINE_WINDOW_MS = 30_000;

export async function pollEventLive(
  input: PollEventLiveInput,
): Promise<EventLiveDto> {
  await touchPresence(input.eventId, input.viewer);

  const [viewers, messages, threadCounts, contentRevision] = await Promise.all([
    listActiveViewers(input.eventId),
    listMessages({
      eventId: input.eventId,
      viewer: input.viewer,
      afterId: input.chatAfterId,
    }),
    countOpenThreadsBySpending(input.eventId),
    readEventContentRevision(input.eventId),
  ]);

  return {
    viewers,
    messages,
    threadCounts,
    contentRevision,
    serverTime: new Date().toISOString(),
  };
}

async function touchPresence(
  eventId: string,
  viewer: EventViewer,
): Promise<void> {
  const now = new Date();
  if (viewer.role === EventAuthorRole.Owner) {
    // Raw update so the heartbeat does not bump updatedAt / contentRevision.
    await prisma.$executeRaw`
      UPDATE "Event"
      SET "ownerLastSeenAt" = ${now}
      WHERE id = ${eventId}
    `;
    return;
  }
  if (!viewer.guestUserId) {
    return;
  }
  await prisma.eventGuestPresence.upsert({
    where: {
      eventId_guestUserId: { eventId, guestUserId: viewer.guestUserId },
    },
    create: { eventId, guestUserId: viewer.guestUserId, lastSeenAt: now },
    update: { lastSeenAt: now },
  });
  await prisma.guestUser.update({
    where: { id: viewer.guestUserId },
    data: { lastSeenAt: now },
  });
}

async function listActiveViewers(
  eventId: string,
): Promise<EventPresenceViewerDto[]> {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      userId: true,
      ownerDisplayName: true,
      ownerLastSeenAt: true,
      user: { select: { name: true } },
      presences: {
        where: { lastSeenAt: { gte: since } },
        orderBy: { lastSeenAt: "desc" },
        include: { guest: { select: { id: true, name: true } } },
      },
    },
  });
  if (!event) {
    return [];
  }

  const guests = event.presences.map((presence) => ({
    id: presence.guest.id,
    name: presence.guest.name,
    isOwner: false,
  }));

  const ownerIsOnline =
    event.ownerLastSeenAt !== null && event.ownerLastSeenAt >= since;
  if (!ownerIsOnline) {
    return guests;
  }

  return [
    {
      id: event.userId,
      name: resolveOwnerName(event.ownerDisplayName, event.user.name),
      isOwner: true,
    },
    ...guests,
  ];
}
