import {
  EventAttendanceStatus,
  type EventSpendingCategory,
} from "@/types/enums";

import { calculateSpendingTotal } from "./event-settlement";

export type AnalysisItemSource = {
  readonly id: string;
  readonly title: string;
  readonly category: EventSpendingCategory;
  readonly amount: string | number;
  readonly amountUnit: string;
  readonly price: string | number;
  readonly note: string | null;
};

export type AnalysisAttendeeSource = {
  readonly status: EventAttendanceStatus;
};

export type AnalysisThreadMessageSource = {
  readonly spendingId: string;
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: Date | string;
  readonly isAiGenerated: boolean;
};

export type AnalysisChatMessageSource = {
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: Date | string;
};

export type AnalysisContextSource = {
  readonly title: string;
  readonly occursAt: Date | string;
  readonly endsAt: Date | string | null;
  readonly currency: string;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly contextMessage: string | null;
  readonly items: readonly AnalysisItemSource[];
  readonly attendees: readonly AnalysisAttendeeSource[];
  readonly threadMessages: readonly AnalysisThreadMessageSource[];
  readonly chatMessages: readonly AnalysisChatMessageSource[];
};

export type AnalysisItemContext = {
  readonly id: string;
  readonly title: string;
  readonly category: EventSpendingCategory;
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
  readonly total: string;
  readonly note: string | null;
};

export type AnalysisLocationContext = {
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
};

export type AnalysisMessageContext = {
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: string;
  readonly isAiGenerated?: boolean;
};

export type EventAnalysisContext = {
  readonly title: string;
  readonly currency: string;
  /** Calendar year used for local retail price estimates. */
  readonly pricingYear: number;
  readonly durationHours: number | null;
  readonly attendeeCount: number;
  readonly certainAttendeeCount: number;
  readonly location: AnalysisLocationContext;
  readonly contextMessage: string | null;
  readonly items: readonly AnalysisItemContext[];
  readonly threadMessagesByItemId: Readonly<
    Record<string, readonly AnalysisMessageContext[]>
  >;
  readonly chatMessages: readonly AnalysisMessageContext[];
};

/** Pure mapper from event rows into the payload the analyzer prompt consumes. */
export function buildAnalysisContext(
  source: AnalysisContextSource,
  options: { readonly pricingYear?: number } = {},
): EventAnalysisContext {
  return {
    title: source.title,
    currency: source.currency,
    pricingYear: options.pricingYear ?? new Date().getFullYear(),
    durationHours: calculateDurationHours(source.occursAt, source.endsAt),
    attendeeCount: source.attendees.length,
    certainAttendeeCount: source.attendees.filter(
      (attendee) => attendee.status === EventAttendanceStatus.Certain,
    ).length,
    location: {
      address: source.address,
      latitude: source.latitude,
      longitude: source.longitude,
    },
    contextMessage: source.contextMessage?.trim() || null,
    items: source.items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      amount: String(item.amount),
      amountUnit: item.amountUnit,
      price: String(item.price),
      total: calculateSpendingTotal(item),
      note: item.note,
    })),
    threadMessagesByItemId: groupThreadMessages(source.threadMessages),
    chatMessages: source.chatMessages.map(toMessageContext),
  };
}

export function calculateDurationHours(
  occursAt: Date | string,
  endsAt: Date | string | null,
): number | null {
  if (!endsAt) {
    return null;
  }
  const startMs = new Date(occursAt).getTime();
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }
  return Math.round(((endMs - startMs) / 3_600_000) * 100) / 100;
}

function groupThreadMessages(
  messages: readonly AnalysisThreadMessageSource[],
): Record<string, AnalysisMessageContext[]> {
  const grouped: Record<string, AnalysisMessageContext[]> = {};
  for (const message of messages) {
    const bucket = grouped[message.spendingId] ?? [];
    bucket.push({
      ...toMessageContext(message),
      isAiGenerated: message.isAiGenerated,
    });
    grouped[message.spendingId] = bucket;
  }
  return grouped;
}

function toMessageContext(message: {
  readonly body: string;
  readonly authorName: string;
  readonly createdAt: Date | string;
}): AnalysisMessageContext {
  return {
    body: message.body,
    authorName: message.authorName,
    createdAt: new Date(message.createdAt).toISOString(),
  };
}
