import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { AppServiceError } from "@/lib/errors";
import { resolveAuthorName } from "@/lib/event-author";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { AppLocale } from "@/types/enums";

import { requestJsonCompletion } from "./ai/ai-client";
import { buildAnalysisContext } from "./event-analysis-context";
import { buildAnalysisPrompt } from "./event-analysis-prompt";
import {
  parseAnalysisResponse,
  toStoredSuggestedItems,
  type ItemAnalysisSuggestion,
  type ParsedEventAnalysis,
  type StoredSuggestedItem,
} from "./event-analysis-schema";
import { bumpEventContent } from "./event-content-revision";
import type { EventAiReportDto } from "./event-service.types";

export type AnalyzeEventInput = {
  readonly eventId: string;
  readonly contextMessage?: string | null;
  readonly responseLocale?: string | null;
};

/** Runs the analyzer and persists the report plus AI suggestion threads. */
export async function analyzeEvent(
  input: AnalyzeEventInput,
): Promise<EventAiReportDto> {
  const event = await loadAnalysisEvent(input.eventId);
  const responseLocale = normalizeResponseLocale(
    input.responseLocale ?? (await loadOwnerLanguage(event.userId)),
  );
  const context = buildAnalysisContext({
    title: event.title,
    occursAt: event.occursAt,
    endsAt: event.endsAt,
    currency: event.currency,
    address: event.address,
    latitude: toNumberOrNull(event.latitude),
    longitude: toNumberOrNull(event.longitude),
    contextMessage: input.contextMessage ?? null,
    items: event.spendings.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      amount: item.amount.toString(),
      amountUnit: item.amountUnit,
      price: item.price.toString(),
      note: item.note,
    })),
    attendees: event.attendees,
    threadMessages: flattenThreadMessages(event),
    chatMessages: event.messages.map((message) => ({
      body: message.body,
      authorName: resolveAuthorName({
        ownerDisplayName: event.ownerDisplayName,
        ownerName: event.user.name,
        authorUserId: message.authorUserId,
        guestName: message.authorGuest?.name ?? null,
      }),
      createdAt: message.createdAt,
    })),
  });

  const prompt = buildAnalysisPrompt({
    context,
    responseLanguage: responseLocale,
  });
  const completion = await requestJsonCompletion(prompt);
  const analysis = parseAnalysisResponse(
    completion.content,
    new Set(event.spendings.map((item) => item.id)),
    new Set(event.spendings.map((item) => item.title)),
  );
  const suggestedItems = toStoredSuggestedItems(
    analysis.suggestedItems,
    randomUUID,
  );

  await persistAnalysis({
    eventId: input.eventId,
    contextMessage: context.contextMessage,
    responseLocale,
    model: completion.model,
    analysis,
    suggestedItems,
  });
  await bumpEventContent(input.eventId);

  return {
    type: analysis.type,
    reportMessage: analysis.reportMessage,
    responseLocale,
    suggestedItems,
    createdAt: new Date().toISOString(),
  };
}

async function loadAnalysisEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      user: { select: { name: true } },
      attendees: { select: { status: true } },
      spendings: {
        select: {
          id: true,
          title: true,
          category: true,
          amount: true,
          amountUnit: true,
          price: true,
          note: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { authorGuest: { select: { name: true } } },
      },
      threads: {
        include: {
          comments: {
            orderBy: { createdAt: "asc" },
            include: { authorGuest: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!event) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }
  return event;
}

async function loadOwnerLanguage(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  return user?.locale || AppLocale.En;
}

function normalizeResponseLocale(locale: string): AppLocale {
  return locale.startsWith("ru") ? AppLocale.Ru : AppLocale.En;
}

async function persistAnalysis(input: {
  readonly eventId: string;
  readonly contextMessage: string | null;
  readonly responseLocale: AppLocale;
  readonly model: string;
  readonly analysis: ParsedEventAnalysis;
  readonly suggestedItems: readonly StoredSuggestedItem[];
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.eventAiReport.upsert({
      where: { eventId: input.eventId },
      create: {
        eventId: input.eventId,
        type: input.analysis.type,
        reportMessage: input.analysis.reportMessage,
        contextMessage: input.contextMessage,
        responseLocale: input.responseLocale,
        suggestedItems: input.suggestedItems as Prisma.InputJsonValue,
        model: input.model,
      },
      update: {
        type: input.analysis.type,
        reportMessage: input.analysis.reportMessage,
        contextMessage: input.contextMessage,
        responseLocale: input.responseLocale,
        suggestedItems: input.suggestedItems as Prisma.InputJsonValue,
        model: input.model,
      },
    });

    await deleteStaleAiThreads(tx, input.eventId);
    await createSuggestionThreads(tx, input.eventId, input.analysis.items);
  });
}

/** Drops AI threads that never collected a human reply so re-runs stay clean. */
async function deleteStaleAiThreads(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  const aiThreads = await tx.eventCommentThread.findMany({
    where: { eventId, createdByAi: true },
    select: {
      id: true,
      comments: { select: { isAiGenerated: true } },
    },
  });
  const staleIds = aiThreads
    .filter((thread) =>
      thread.comments.every((comment) => comment.isAiGenerated),
    )
    .map((thread) => thread.id);
  if (staleIds.length === 0) {
    return;
  }
  await tx.eventCommentThread.deleteMany({ where: { id: { in: staleIds } } });
}

async function createSuggestionThreads(
  tx: Prisma.TransactionClient,
  eventId: string,
  items: readonly ItemAnalysisSuggestion[],
): Promise<void> {
  for (const item of items) {
    await tx.eventCommentThread.create({
      data: {
        eventId,
        spendingId: item.itemId,
        createdByAi: true,
        comments: {
          create: {
            body: item.message,
            isAiGenerated: true,
            suggestedAmount: item.betterAmount,
            suggestedPrice: item.realisticPrice,
          },
        },
      },
    });
  }
}

function flattenThreadMessages(
  event: Awaited<ReturnType<typeof loadAnalysisEvent>>,
) {
  return event.threads.flatMap((thread) =>
    thread.comments.map((comment) => ({
      spendingId: thread.spendingId,
      body: comment.body,
      authorName: resolveAuthorName({
        ownerDisplayName: event.ownerDisplayName,
        ownerName: event.user.name,
        authorUserId: comment.authorUserId,
        guestName: comment.authorGuest?.name ?? null,
        isAiGenerated: comment.isAiGenerated,
      }),
      createdAt: comment.createdAt,
      isAiGenerated: comment.isAiGenerated,
    })),
  );
}

function toNumberOrNull(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString());
}
