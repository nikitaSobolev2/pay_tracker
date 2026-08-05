import type { EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { resolveAuthor } from "@/lib/event-author";
import { toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { EventAuthorRole } from "@/types/enums";

import { bumpEventContent } from "./event-content-revision";
import type { EventAuthorDto } from "./event-service.types";
import { normalizeMessageAttachment } from "./message-attachment";

export type EventCommentDto = {
  readonly id: string;
  readonly body: string;
  readonly imageUrl: string | null;
  readonly author: EventAuthorDto;
  readonly createdAt: string;
  readonly canDelete: boolean;
  readonly isAi: boolean;
  readonly suggestedAmount: string | null;
  readonly suggestedPrice: string | null;
  readonly amountApplied: boolean;
  readonly priceApplied: boolean;
  readonly canApply: boolean;
};

export type EventThreadDto = {
  readonly id: string;
  readonly spendingId: string;
  readonly resolved: boolean;
  readonly createdAt: string;
  readonly comments: readonly EventCommentDto[];
};

export type ThreadOwnerNames = {
  readonly ownerDisplayName: string | null;
  readonly ownerName: string;
};

export type ListThreadsInput = {
  readonly eventId: string;
  readonly spendingId?: string;
  readonly viewer: EventViewer;
};

export type CreateThreadInput = {
  readonly eventId: string;
  readonly spendingId: string;
  readonly viewer: EventViewer;
  readonly body?: string;
  readonly imageUrl?: string | null;
};

export type CreateCommentInput = {
  readonly eventId: string;
  readonly threadId: string;
  readonly viewer: EventViewer;
  readonly body?: string;
  readonly imageUrl?: string | null;
};

export async function listThreads(
  input: ListThreadsInput,
): Promise<EventThreadDto[]> {
  const names = await loadOwnerNames(input.eventId);
  const threads = await prisma.eventCommentThread.findMany({
    where: {
      eventId: input.eventId,
      ...(input.spendingId ? { spendingId: input.spendingId } : {}),
    },
    orderBy: { createdAt: "asc" },
    include: {
      spending: { select: { amount: true, price: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { authorGuest: { select: { name: true } } },
      },
    },
  });

  return threads.map((thread) => ({
    id: thread.id,
    spendingId: thread.spendingId,
    resolved: thread.resolvedAt !== null,
    createdAt: thread.createdAt.toISOString(),
    comments: thread.comments.map((comment) =>
      toCommentDto(comment, names, input.viewer, thread.spending),
    ),
  }));
}

function toCommentDto(
  comment: {
    readonly id: string;
    readonly body: string;
    readonly imageUrl: string | null;
    readonly authorUserId: string | null;
    readonly authorGuestId: string | null;
    readonly isAiGenerated: boolean;
    readonly suggestedAmount: { toString(): string } | null;
    readonly suggestedPrice: { toString(): string } | null;
    readonly amountAppliedAt: Date | null;
    readonly priceAppliedAt: Date | null;
    readonly createdAt: Date;
    readonly authorGuest: { readonly name: string } | null;
  },
  names: ThreadOwnerNames,
  viewer: EventViewer,
  spending: {
    readonly amount: { toString(): string };
    readonly price: { toString(): string };
  },
): EventCommentDto {
  const suggestedAmount = comment.suggestedAmount?.toString() ?? null;
  const suggestedPrice = comment.suggestedPrice?.toString() ?? null;
  const amountActionable =
    suggestedAmount !== null &&
    comment.amountAppliedAt === null &&
    !sameMoney(suggestedAmount, spending.amount);
  const priceActionable =
    suggestedPrice !== null &&
    comment.priceAppliedAt === null &&
    !sameMoney(suggestedPrice, spending.price);

  return {
    id: comment.id,
    body: comment.body,
    imageUrl: comment.imageUrl,
    author: resolveAuthor({
      ownerDisplayName: names.ownerDisplayName,
      ownerName: names.ownerName,
      authorUserId: comment.authorUserId,
      guestName: comment.authorGuest?.name ?? null,
      isAiGenerated: comment.isAiGenerated,
    }),
    createdAt: comment.createdAt.toISOString(),
    canDelete: canDelete(viewer, comment),
    isAi: comment.isAiGenerated,
    suggestedAmount,
    suggestedPrice,
    amountApplied: comment.amountAppliedAt !== null,
    priceApplied: comment.priceAppliedAt !== null,
    canApply:
      viewer.role === EventAuthorRole.Owner &&
      comment.isAiGenerated &&
      (amountActionable || priceActionable),
  };
}

function sameMoney(
  left: { toString(): string },
  right: { toString(): string },
): boolean {
  return toDecimal(left.toString()).eq(toDecimal(right.toString()));
}

export async function createThread(input: CreateThreadInput): Promise<string> {
  await assertSpendingBelongsToEvent(input.spendingId, input.eventId);
  const content = normalizeMessageAttachment({
    body: input.body,
    imageUrl: input.imageUrl,
  });
  const thread = await prisma.eventCommentThread.create({
    data: {
      eventId: input.eventId,
      spendingId: input.spendingId,
      comments: {
        create: {
          body: content.body,
          imageUrl: content.imageUrl,
          authorUserId: input.viewer.userId,
          authorGuestId: input.viewer.guestUserId,
        },
      },
    },
    select: { id: true },
  });
  await bumpEventContent(input.eventId);
  return thread.id;
}

export async function createComment(
  input: CreateCommentInput,
): Promise<string> {
  await assertThreadBelongsToEvent(input.threadId, input.eventId);
  const content = normalizeMessageAttachment({
    body: input.body,
    imageUrl: input.imageUrl,
  });
  const comment = await prisma.eventComment.create({
    data: {
      threadId: input.threadId,
      body: content.body,
      imageUrl: content.imageUrl,
      authorUserId: input.viewer.userId,
      authorGuestId: input.viewer.guestUserId,
    },
    select: { id: true },
  });
  await bumpEventContent(input.eventId);
  return comment.id;
}

export async function setThreadResolved(input: {
  eventId: string;
  threadId: string;
  resolved: boolean;
}): Promise<void> {
  const updated = await prisma.eventCommentThread.updateMany({
    where: { id: input.threadId, eventId: input.eventId },
    data: { resolvedAt: input.resolved ? new Date() : null },
  });
  if (updated.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Thread not found");
  }
  await bumpEventContent(input.eventId);
}

export async function deleteThread(input: {
  eventId: string;
  threadId: string;
}): Promise<void> {
  const deleted = await prisma.eventCommentThread.deleteMany({
    where: { id: input.threadId, eventId: input.eventId },
  });
  if (deleted.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Thread not found");
  }
  await bumpEventContent(input.eventId);
}

export async function deleteComment(input: {
  eventId: string;
  threadId: string;
  commentId: string;
  viewer: EventViewer;
}): Promise<void> {
  await assertThreadBelongsToEvent(input.threadId, input.eventId);
  const comment = await prisma.eventComment.findFirst({
    where: { id: input.commentId, threadId: input.threadId },
    select: { id: true, authorUserId: true, authorGuestId: true },
  });
  if (!comment) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Comment not found");
  }
  if (!canDelete(input.viewer, comment)) {
    throw new AppServiceError(
      ApiErrorCode.Forbidden,
      "You can delete only your own comments",
    );
  }
  await prisma.eventComment.delete({ where: { id: comment.id } });
  await deleteThreadIfEmpty(input.threadId);
  await bumpEventContent(input.eventId);
}

export async function countOpenThreadsBySpending(
  eventId: string,
): Promise<Record<string, number>> {
  const rows = await prisma.eventCommentThread.groupBy({
    by: ["spendingId"],
    where: { eventId, resolvedAt: null },
    _count: { _all: true },
  });
  return Object.fromEntries(
    rows.map((row) => [row.spendingId, row._count._all]),
  );
}

function canDelete(
  viewer: EventViewer,
  comment: { authorUserId: string | null; authorGuestId: string | null },
): boolean {
  if (viewer.role === EventAuthorRole.Owner) {
    return true;
  }
  return (
    comment.authorGuestId !== null &&
    comment.authorGuestId === viewer.guestUserId
  );
}

async function deleteThreadIfEmpty(threadId: string): Promise<void> {
  const remaining = await prisma.eventComment.count({ where: { threadId } });
  if (remaining === 0) {
    await prisma.eventCommentThread.delete({ where: { id: threadId } });
  }
}

async function loadOwnerNames(eventId: string): Promise<ThreadOwnerNames> {
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

async function assertSpendingBelongsToEvent(
  spendingId: string,
  eventId: string,
): Promise<void> {
  const spending = await prisma.eventSpending.findFirst({
    where: { id: spendingId, eventId },
    select: { id: true },
  });
  if (!spending) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Spending not found");
  }
}

async function assertThreadBelongsToEvent(
  threadId: string,
  eventId: string,
): Promise<void> {
  const thread = await prisma.eventCommentThread.findFirst({
    where: { id: threadId, eventId },
    select: { id: true },
  });
  if (!thread) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Thread not found");
  }
}

