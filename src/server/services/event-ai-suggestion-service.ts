import type { Prisma } from "@prisma/client";

import type { EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { EventSpendingField, type EventSpendingField as SpendingField } from "@/types/enums";

import {
  parseStoredSuggestedItems,
  type StoredSuggestedItem,
} from "./event-analysis-schema";
import { bumpEventContent } from "./event-content-revision";
import { createSpending } from "./event-spending-service";

export type ApplySuggestionInput = {
  readonly eventId: string;
  readonly threadId: string;
  readonly commentId: string;
  readonly field: SpendingField;
};

/**
 * Writes one AI suggestion onto the spending row, stamps the applied time,
 * and resolves the thread once every offered suggestion has been applied.
 */
export async function applySuggestion(
  input: ApplySuggestionInput,
): Promise<void> {
  const comment = await prisma.eventComment.findFirst({
    where: {
      id: input.commentId,
      threadId: input.threadId,
      thread: { eventId: input.eventId },
      isAiGenerated: true,
    },
    include: {
      thread: {
        select: {
          id: true,
          spendingId: true,
          resolvedAt: true,
          spending: { select: { amount: true, price: true } },
        },
      },
    },
  });
  if (!comment) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Suggestion not found");
  }

  const suggestion =
    input.field === EventSpendingField.Amount
      ? comment.suggestedAmount
      : comment.suggestedPrice;
  if (suggestion === null) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      `No ${input.field} suggestion to apply`,
    );
  }

  const alreadyApplied =
    input.field === EventSpendingField.Amount
      ? comment.amountAppliedAt
      : comment.priceAppliedAt;
  if (alreadyApplied) {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      `That ${input.field} suggestion was already applied`,
    );
  }

  const currentValue =
    input.field === EventSpendingField.Amount
      ? comment.thread.spending.amount
      : comment.thread.spending.price;
  if (toDecimal(suggestion.toString()).eq(toDecimal(currentValue.toString()))) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      `Spending ${input.field} already matches the suggestion`,
    );
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.eventSpending.update({
      where: { id: comment.thread.spendingId },
      data:
        input.field === EventSpendingField.Amount
          ? { amount: suggestion }
          : { price: suggestion },
    });

    const updated = await tx.eventComment.update({
      where: { id: comment.id },
      data:
        input.field === EventSpendingField.Amount
          ? { amountAppliedAt: now }
          : { priceAppliedAt: now },
      select: {
        suggestedAmount: true,
        suggestedPrice: true,
        amountAppliedAt: true,
        priceAppliedAt: true,
      },
    });

    const spendingAfter = await tx.eventSpending.findUniqueOrThrow({
      where: { id: comment.thread.spendingId },
      select: { amount: true, price: true },
    });

    if (isFullyApplied(updated, spendingAfter)) {
      await tx.eventCommentThread.update({
        where: { id: comment.thread.id },
        data: { resolvedAt: now },
      });
    }
  });
  await bumpEventContent(input.eventId);
}

function isFullyApplied(
  comment: {
    readonly suggestedAmount: { toString(): string } | null;
    readonly suggestedPrice: { toString(): string } | null;
    readonly amountAppliedAt: Date | null;
    readonly priceAppliedAt: Date | null;
  },
  spending: {
    readonly amount: { toString(): string };
    readonly price: { toString(): string };
  },
): boolean {
  const amountDone =
    comment.suggestedAmount === null ||
    comment.amountAppliedAt !== null ||
    sameMoney(comment.suggestedAmount, spending.amount);
  const priceDone =
    comment.suggestedPrice === null ||
    comment.priceAppliedAt !== null ||
    sameMoney(comment.suggestedPrice, spending.price);
  return amountDone && priceDone;
}

function sameMoney(
  left: { toString(): string },
  right: { toString(): string },
): boolean {
  return toDecimal(left.toString()).eq(toDecimal(right.toString()));
}

export type ApplyMissingItemSuggestionInput = {
  readonly eventId: string;
  readonly suggestionId: string;
  readonly viewer: EventViewer;
};

/**
 * Creates a spending from a structured missing-item suggestion and marks it added.
 */
export async function applyMissingItemSuggestion(
  input: ApplyMissingItemSuggestionInput,
): Promise<{ readonly spendingId: string }> {
  const report = await prisma.eventAiReport.findUnique({
    where: { eventId: input.eventId },
    select: { suggestedItems: true },
  });
  if (!report) {
    throw new AppServiceError(ApiErrorCode.NotFound, "AI report not found");
  }

  const suggestions = parseStoredSuggestedItems(report.suggestedItems);
  const suggestion = suggestions.find((item) => item.id === input.suggestionId);
  if (!suggestion) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Suggestion not found");
  }
  if (suggestion.addedAt) {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      "That suggestion was already added",
    );
  }

  const spendingId = await createSpending({
    eventId: input.eventId,
    author: {
      userId: input.viewer.userId,
      guestUserId: input.viewer.guestUserId,
    },
    title: suggestion.title,
    category: suggestion.category,
    amount: suggestion.amount,
    amountUnit: suggestion.amountUnit,
    price: suggestion.price,
    note: suggestion.reason,
  });

  const now = new Date().toISOString();
  const nextSuggestions: StoredSuggestedItem[] = suggestions.map((item) =>
    item.id === suggestion.id ? { ...item, addedAt: now } : item,
  );

  await prisma.eventAiReport.update({
    where: { eventId: input.eventId },
    data: {
      suggestedItems: nextSuggestions as Prisma.InputJsonValue,
    },
  });
  await bumpEventContent(input.eventId);

  return { spendingId };
}
