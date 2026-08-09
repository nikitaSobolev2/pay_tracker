import type { EventViewer } from "@/lib/event-access";
import type {
  EventAiReportType,
  EventAttendanceStatus,
  EventAuthorRole,
  EventGuestPermission,
  EventLinkType,
  EventPublicity,
  EventSpendingCategory,
} from "@/types/enums";

import type { EventLocationPollDto } from "./event-location-poll-service.types";

export type EventLocationInput = {
  readonly address?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
};

export type CreateEventInput = {
  readonly userId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly occursAt: Date;
  readonly endsAt?: Date | null;
  readonly imageUrl?: string | null;
  readonly publicity: EventPublicity;
  readonly guestPermission: EventGuestPermission;
  readonly currency: string;
  readonly counterpartyIds: readonly string[];
} & EventLocationInput;

export type UpdateEventInput = {
  readonly eventId: string;
  readonly title?: string;
  readonly description?: string | null;
  readonly occursAt?: Date;
  readonly endsAt?: Date | null;
  readonly imageUrl?: string | null;
  readonly publicity?: EventPublicity;
  readonly guestPermission?: EventGuestPermission;
  readonly ownerDisplayName?: string | null;
  readonly manualPerPersonAmount?: string | null;
} & EventLocationInput;

export type EventListItemDto = {
  readonly id: string;
  readonly title: string;
  readonly occursAt: string;
  readonly endsAt: string | null;
  readonly imageUrl: string | null;
  readonly address: string | null;
  readonly publicity: EventPublicity;
  readonly currency: string;
  readonly attendeeCount: number;
  readonly total: string;
};

/** Compact chip for desktop header (nearest upcoming / in-progress). */
export type UpcomingEventChipDto = {
  readonly id: string;
  readonly title: string;
  readonly occursAt: string;
  readonly endsAt: string | null;
  readonly timing: "upcoming" | "inProgress";
};

export type EventLinkDto = {
  readonly id: string;
  readonly type: EventLinkType;
  readonly title: string;
  readonly url: string;
};

export type EventAttendeeDto = {
  readonly id: string;
  readonly counterpartyId: string;
  readonly name: string;
  readonly status: EventAttendanceStatus;
  readonly authorUserId: string | null;
  readonly authorGuestId: string | null;
};

export type EventAuthorDto = {
  readonly role: EventAuthorRole;
  readonly name: string;
};

export type EventSpendingDto = {
  readonly id: string;
  readonly title: string;
  readonly category: EventSpendingCategory;
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
  readonly note: string | null;
  readonly total: string;
  readonly author: EventAuthorDto;
  readonly createdAt: string;
  readonly openThreadCount: number;
};

export type EventPaymentDto = {
  readonly id: string;
  readonly attendeeId: string;
  readonly attendeeName: string;
  readonly amount: string;
  readonly paidAt: string;
};

export type EventSummaryDto = {
  readonly total: string;
  readonly byCategory: readonly {
    readonly category: EventSpendingCategory;
    readonly total: string;
  }[];
  readonly drinksAndAlcohol: string;
  readonly share: {
    readonly average: string;
    readonly lowerBound: string;
    readonly upperBound: string;
    readonly hasUncertain: boolean;
  };
  readonly balances: readonly {
    readonly attendeeId: string;
    readonly name: string;
    readonly paid: string;
    readonly share: string;
    readonly remaining: string;
    readonly hasPaidShare: boolean;
  }[];
  readonly paidProgress: {
    readonly paidCount: number;
    readonly totalCount: number;
    readonly certainPaidCount: number;
    readonly uncertainPaidCount: number;
    readonly collected: string;
    readonly expected: string;
  };
};

export type EventDetailDto = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly occursAt: string;
  readonly endsAt: string | null;
  readonly imageUrl: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly publicity: EventPublicity;
  readonly guestPermission: EventGuestPermission;
  readonly currency: string;
  readonly ownerName: string;
  /** Owner override for per-person share; null = computed from spendings. */
  readonly manualPerPersonAmount: string | null;
  readonly links: readonly EventLinkDto[];
  readonly attendees: readonly EventAttendeeDto[];
  readonly spendings: readonly EventSpendingDto[];
  readonly payments: readonly EventPaymentDto[];
  readonly summary: EventSummaryDto;
  readonly aiReport: EventAiReportDto | null;
  readonly locationPoll: EventLocationPollDto | null;
};

export type EventAiSuggestedItemDto = {
  readonly id: string;
  readonly title: string;
  readonly category: EventSpendingCategory;
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
  readonly reason: string;
  readonly addedAt: string | null;
};

export type EventAiReportDto = {
  readonly type: EventAiReportType;
  readonly reportMessage: string;
  readonly responseLocale: string | null;
  readonly suggestedItems: readonly EventAiSuggestedItemDto[];
  readonly createdAt: string;
};

export type EventViewerDto = {
  readonly role: EventAuthorRole;
  readonly displayName: string;
  readonly canEdit: boolean;
  readonly canManagePayments: boolean;
  /** Drives guest-only chrome such as the locale switcher on the public page. */
  readonly isAuthenticated: boolean;
  /** Guest-claimed attendance person for this event, if any. */
  readonly claimedAttendeeId: string | null;
  readonly guestUserId: string | null;
};

export type EventDetailResponse = {
  readonly event: EventDetailDto;
  readonly viewer: EventViewerDto;
};

export type EventSettlementResponse = {
  readonly attendees: readonly EventAttendeeDto[];
  readonly payments: readonly EventPaymentDto[];
  readonly summary: EventSummaryDto;
};

export type AddAttendeeInput = {
  readonly eventId: string;
  readonly ownerUserId: string;
  readonly counterpartyId?: string;
  readonly name?: string;
  readonly authorUserId?: string | null;
  readonly authorGuestId?: string | null;
};

export type UpdateAttendeeInput = {
  readonly eventId: string;
  readonly attendeeId: string;
  readonly status: EventAttendanceStatus;
};

export type CreateLinkInput = {
  readonly eventId: string;
  readonly type: EventLinkType;
  readonly title: string;
  readonly url: string;
};

export type UpdateLinkInput = {
  readonly eventId: string;
  readonly linkId: string;
  readonly type?: EventLinkType;
  readonly title?: string;
  readonly url?: string;
};

export type EventViewerContext = {
  readonly event: { readonly id: string; readonly currency: string };
  readonly viewer: EventViewer;
};
