import type { EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { resolveAuthor } from "@/lib/event-author";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { EventAuthorRole } from "@/types/enums";
import type { EventAuthorDto } from "./event-service.types";
import { normalizeMessageAttachment } from "./message-attachment";

export type EventChatMessageDto = {
  readonly id: string;
  readonly body: string;
  readonly imageUrl: string | null;
  readonly author: EventAuthorDto;
  readonly createdAt: string;
  readonly isMine: boolean;
  readonly canDelete: boolean;
};

export type ListMessagesInput = {
  readonly eventId: string;
  readonly viewer: EventViewer;
  readonly afterId?: string | null;
  readonly limit?: number;
};

export type PostMessageInput = {
  readonly eventId: string;
  readonly viewer: EventViewer;
  readonly body?: string;
  readonly imageUrl?: string | null;
};

const DEFAULT_PAGE_SIZE = 100;

export async function listMessages(
  input: ListMessagesInput,
): Promise<EventChatMessageDto[]> {
  const after = input.afterId
    ? await prisma.eventChatMessage.findUnique({
        where: { id: input.afterId },
        select: { createdAt: true },
      })
    : null;

  const owner = await loadOwnerNames(input.eventId);
  const messages = await prisma.eventChatMessage.findMany({
    where: {
      eventId: input.eventId,
      ...(after ? { createdAt: { gt: after.createdAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: input.limit ?? DEFAULT_PAGE_SIZE,
    include: { authorGuest: { select: { name: true } } },
  });

  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    imageUrl: message.imageUrl,
    author: resolveAuthor({
      ownerDisplayName: owner.ownerDisplayName,
      ownerName: owner.ownerName,
      authorUserId: message.authorUserId,
      guestName: message.authorGuest?.name ?? null,
    }),
    createdAt: message.createdAt.toISOString(),
    isMine: isMine(input.viewer, message),
    canDelete: canDelete(input.viewer, message),
  }));
}

export async function postMessage(input: PostMessageInput): Promise<string> {
  const content = normalizeMessageAttachment({
    body: input.body,
    imageUrl: input.imageUrl,
  });
  const message = await prisma.eventChatMessage.create({
    data: {
      eventId: input.eventId,
      body: content.body,
      imageUrl: content.imageUrl,
      authorUserId: input.viewer.userId,
      authorGuestId: input.viewer.guestUserId,
    },
    select: { id: true },
  });
  return message.id;
}

export async function deleteMessage(input: {
  eventId: string;
  messageId: string;
  viewer: EventViewer;
}): Promise<void> {
  const message = await prisma.eventChatMessage.findFirst({
    where: { id: input.messageId, eventId: input.eventId },
    select: { id: true, authorUserId: true, authorGuestId: true },
  });
  if (!message) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Message not found");
  }
  if (!canDelete(input.viewer, message)) {
    throw new AppServiceError(
      ApiErrorCode.Forbidden,
      "You can delete only your own messages",
    );
  }
  await prisma.eventChatMessage.delete({ where: { id: message.id } });
}

function isMine(
  viewer: EventViewer,
  message: { authorUserId: string | null; authorGuestId: string | null },
): boolean {
  if (viewer.role === EventAuthorRole.Owner) {
    return message.authorUserId === viewer.userId;
  }
  return (
    message.authorGuestId !== null &&
    message.authorGuestId === viewer.guestUserId
  );
}

function canDelete(
  viewer: EventViewer,
  message: { authorUserId: string | null; authorGuestId: string | null },
): boolean {
  return viewer.role === EventAuthorRole.Owner || isMine(viewer, message);
}

async function loadOwnerNames(eventId: string): Promise<{
  ownerDisplayName: string | null;
  ownerName: string;
}> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { ownerDisplayName: true, user: { select: { name: true } } },
  });
  if (!event) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }
  return {
    ownerDisplayName: event.ownerDisplayName,
    ownerName: event.user.name,
  };
}
