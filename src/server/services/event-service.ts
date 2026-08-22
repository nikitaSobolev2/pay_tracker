import type { EventAccess, EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { resolveAuthor } from "@/lib/event-author";
import {
  pickNearestUpcomingEvent,
  resolveEventPhase,
} from "@/lib/event-timing";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { EventLinkType, EventPhase } from "@/types/enums";
import { findOrCreateCounterparty } from "./counterparty-service";
import { assertCanRemoveAttendee } from "./attendee-auth";
import { bumpEventContent } from "./event-content-revision";
import {
  calculateEventTotals,
  calculateSpendingTotal,
} from "./event-settlement";
import { buildEventSummary } from "./event-summary";
import { parseStoredSuggestedItems } from "./event-analysis-schema";
import {
  getLocationPollForEvent,
  readClaimedAttendeeId,
} from "./event-location-poll-service";
import type {
  AddAttendeeInput,
  CreateEventInput,
  CreateLinkInput,
  EventAttendeeDto,
  EventDetailResponse,
  EventLinkDto,
  EventListItemDto,
  EventPaymentDto,
  EventSettlementResponse,
  EventSpendingDto,
  UpcomingEventChipDto,
  UpdateAttendeeInput,
  UpdateEventInput,
  UpdateLinkInput,
} from "./event-service.types";

const detailInclude = {
  user: { select: { name: true } },
  links: { orderBy: { createdAt: "asc" } },
  attendees: {
    orderBy: { createdAt: "asc" },
    include: { counterparty: { select: { name: true } } },
  },
  spendings: {
    orderBy: { createdAt: "asc" },
    include: {
      authorGuest: { select: { name: true } },
      threads: { where: { resolvedAt: null }, select: { id: true } },
    },
  },
  payments: {
    orderBy: { paidAt: "desc" },
    include: {
      attendee: { include: { counterparty: { select: { name: true } } } },
    },
  },
  aiReport: true,
} as const;

export async function listEvents(userId: string): Promise<EventListItemDto[]> {
  const events = await prisma.event.findMany({
    where: { userId },
    orderBy: { occursAt: "desc" },
    include: {
      attendees: { select: { id: true } },
      spendings: { select: { amount: true, price: true, category: true } },
    },
  });

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    occursAt: event.occursAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    imageUrl: event.imageUrl,
    address: event.address,
    publicity: event.publicity,
    currency: event.currency,
    attendeeCount: event.attendees.length,
    total: sumSpendings(event.spendings),
    ...toPhaseFields(event),
  }));
}

/** Nearest upcoming or currently happening owned event for header chip. */
export async function getNearestUpcomingEvent(
  userId: string,
): Promise<UpcomingEventChipDto | null> {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      userId,
      AND: [
        {
          OR: [
            { phaseOverride: null },
            {
              phaseOverride: {
                notIn: [EventPhase.Finished, EventPhase.Canceled],
              },
            },
          ],
        },
        {
          OR: [
            { endsAt: { gte: now } },
            { endsAt: null, occursAt: { gte: now } },
            {
              phaseOverride: {
                in: [EventPhase.Pending, EventPhase.InProgress],
              },
            },
          ],
        },
      ],
    },
    orderBy: { occursAt: "asc" },
    take: 30,
    select: {
      id: true,
      title: true,
      occursAt: true,
      endsAt: true,
      phaseOverride: true,
    },
  });

  const picked = pickNearestUpcomingEvent(
    events.map((event) => ({
      id: event.id,
      title: event.title,
      occursAt: event.occursAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      phaseOverride: event.phaseOverride,
    })),
    now,
  );
  if (!picked) {
    return null;
  }

  const phase = resolveEventPhase({ ...picked, now });
  if (phase !== EventPhase.Pending && phase !== EventPhase.InProgress) {
    return null;
  }

  return {
    id: picked.id,
    title: picked.title,
    occursAt: picked.occursAt,
    endsAt: picked.endsAt,
    phase,
  };
}

export async function createEvent(input: CreateEventInput): Promise<string> {
  assertEndsAfterStart(input.occursAt, input.endsAt);
  const event = await prisma.event.create({
    data: {
      userId: input.userId,
      title: input.title.trim(),
      description: emptyToNull(input.description),
      occursAt: input.occursAt,
      endsAt: input.endsAt ?? null,
      imageUrl: emptyToNull(input.imageUrl),
      address: emptyToNull(input.address),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      publicity: input.publicity,
      guestPermission: input.guestPermission,
      currency: input.currency.toUpperCase(),
      attendees: {
        create: input.counterpartyIds.map((counterpartyId) => ({
          counterpartyId,
        })),
      },
    },
    select: { id: true },
  });
  return event.id;
}

export async function updateEvent(input: UpdateEventInput): Promise<void> {
  await assertUpdatedScheduleIsOrdered(input);
  await prisma.event.update({
    where: { id: input.eventId },
    data: {
      title: input.title?.trim(),
      description:
        input.description === undefined
          ? undefined
          : emptyToNull(input.description),
      occursAt: input.occursAt,
      endsAt: input.endsAt,
      imageUrl: input.imageUrl === undefined ? undefined : emptyToNull(input.imageUrl),
      address: input.address === undefined ? undefined : emptyToNull(input.address),
      latitude: input.latitude,
      longitude: input.longitude,
      publicity: input.publicity,
      guestPermission: input.guestPermission,
      ownerDisplayName:
        input.ownerDisplayName === undefined
          ? undefined
          : emptyToNull(input.ownerDisplayName),
      manualPerPersonAmount:
        input.manualPerPersonAmount === undefined
          ? undefined
          : input.manualPerPersonAmount,
      phaseOverride: nextPhaseOverride(input),
    },
  });
  if (input.manualPerPersonAmount !== undefined) {
    await bumpEventContent(input.eventId);
  }
}

export async function deleteEvent(eventId: string): Promise<void> {
  await prisma.event.delete({ where: { id: eventId } });
}

function assertEndsAfterStart(
  occursAt: Date,
  endsAt: Date | null | undefined,
): void {
  if (endsAt && endsAt.getTime() < occursAt.getTime()) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "The event cannot end before it starts",
    );
  }
}

/** A patch may move either end of the range, so compare against the stored values. */
async function assertUpdatedScheduleIsOrdered(
  input: UpdateEventInput,
): Promise<void> {
  if (input.occursAt === undefined && input.endsAt === undefined) {
    return;
  }
  const stored = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: { occursAt: true, endsAt: true },
  });
  if (!stored) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }
  assertEndsAfterStart(
    input.occursAt ?? stored.occursAt,
    input.endsAt === undefined ? stored.endsAt : input.endsAt,
  );
}

export async function getEventDetail(
  access: EventAccess,
): Promise<EventDetailResponse> {
  const event = await prisma.event.findUnique({
    where: { id: access.event.id },
    include: detailInclude,
  });
  if (!event) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Event not found");
  }

  const attendees = event.attendees.map(toAttendeeDto);
  const spendings = event.spendings.map((spending) =>
    toSpendingDto(spending, event.ownerDisplayName, event.user.name),
  );
  const payments = event.payments.map(toPaymentDto);
  const locationPoll = await getLocationPollForEvent(event.id, {
    userId: access.viewer.userId,
    guestUserId: access.viewer.guestUserId,
  });
  const claimedAttendeeId = await readClaimedAttendeeId(
    event.id,
    access.viewer.guestUserId,
  );

  return {
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      occursAt: event.occursAt.toISOString(),
      endsAt: event.endsAt?.toISOString() ?? null,
      imageUrl: event.imageUrl,
      address: event.address,
      latitude: toNumberOrNull(event.latitude),
      longitude: toNumberOrNull(event.longitude),
      publicity: event.publicity,
      guestPermission: event.guestPermission,
      currency: event.currency,
      ...toPhaseFields(event),
      ownerName: access.viewer.displayName,
      manualPerPersonAmount: event.manualPerPersonAmount?.toString() ?? null,
      links: event.links.map(toLinkDto),
      attendees,
      spendings,
      payments,
      summary: buildEventSummary({
        attendees: event.attendees.map((attendee) => ({
          id: attendee.id,
          status: attendee.status,
          name: attendee.counterparty.name,
        })),
        spendings: event.spendings.map((spending) => ({
          category: spending.category,
          amount: spending.amount.toString(),
          price: spending.price.toString(),
        })),
        payments: event.payments.map((payment) => ({
          attendeeId: payment.attendeeId,
          amount: payment.amount.toString(),
        })),
        manualPerPersonAmount: event.manualPerPersonAmount?.toString() ?? null,
      }),
      aiReport: event.aiReport
        ? {
            type: event.aiReport.type,
            reportMessage: event.aiReport.reportMessage,
            responseLocale: event.aiReport.responseLocale,
            suggestedItems: parseStoredSuggestedItems(
              event.aiReport.suggestedItems,
            ),
            createdAt: event.aiReport.createdAt.toISOString(),
          }
        : null,
      locationPoll,
    },
    viewer: {
      role: access.viewer.role,
      displayName: access.viewer.displayName,
      canEdit: access.viewer.canEdit,
      canManagePayments: access.viewer.canManagePayments,
      isAuthenticated: access.viewer.isAuthenticated,
      claimedAttendeeId,
      guestUserId: access.viewer.guestUserId,
    },
  };
}

export async function getEventSettlement(
  eventId: string,
): Promise<EventSettlementResponse> {
  const [eventRow, attendeeRows, spendingRows, paymentRows] = await Promise.all([
    prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: { manualPerPersonAmount: true },
    }),
    prisma.eventAttendee.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
      include: { counterparty: { select: { name: true } } },
    }),
    prisma.eventSpending.findMany({
      where: { eventId },
      select: { category: true, amount: true, price: true },
    }),
    prisma.eventPayment.findMany({
      where: { eventId },
      orderBy: { paidAt: "desc" },
      include: {
        attendee: { include: { counterparty: { select: { name: true } } } },
      },
    }),
  ]);

  return {
    attendees: attendeeRows.map(toAttendeeDto),
    payments: paymentRows.map(toPaymentDto),
    summary: buildEventSummary({
      attendees: attendeeRows.map((attendee) => ({
        id: attendee.id,
        status: attendee.status,
        name: attendee.counterparty.name,
      })),
      spendings: spendingRows.map((spending) => ({
        category: spending.category,
        amount: spending.amount.toString(),
        price: spending.price.toString(),
      })),
      payments: paymentRows.map((payment) => ({
        attendeeId: payment.attendeeId,
        amount: payment.amount.toString(),
      })),
      manualPerPersonAmount: eventRow.manualPerPersonAmount?.toString() ?? null,
    }),
  };
}

export async function addAttendee(
  input: AddAttendeeInput,
): Promise<EventAttendeeDto> {
  const counterpartyId = input.counterpartyId
    ? input.counterpartyId
    : (
        await findOrCreateCounterparty({
          userId: input.ownerUserId,
          name: requireName(input.name),
        })
      ).id;

  const existing = await prisma.eventAttendee.findUnique({
    where: {
      eventId_counterpartyId: { eventId: input.eventId, counterpartyId },
    },
    include: { counterparty: { select: { name: true } } },
  });
  if (existing) {
    return toAttendeeDto(existing);
  }

  const attendee = await prisma.eventAttendee.create({
    data: {
      eventId: input.eventId,
      counterpartyId,
      authorUserId: input.authorUserId ?? null,
      authorGuestId: input.authorGuestId ?? null,
    },
    include: { counterparty: { select: { name: true } } },
  });
  await bumpEventContent(input.eventId);
  return toAttendeeDto(attendee);
}

export async function updateAttendeeStatus(
  input: UpdateAttendeeInput,
): Promise<void> {
  const updated = await prisma.eventAttendee.updateMany({
    where: { id: input.attendeeId, eventId: input.eventId },
    data: { status: input.status },
  });
  if (updated.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Attendee not found");
  }
  await bumpEventContent(input.eventId);
}

export async function removeAttendee(input: {
  readonly eventId: string;
  readonly attendeeId: string;
  readonly viewer: EventViewer;
}): Promise<void> {
  const attendee = await prisma.eventAttendee.findFirst({
    where: { id: input.attendeeId, eventId: input.eventId },
    select: { id: true, authorUserId: true, authorGuestId: true },
  });
  if (!attendee) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Attendee not found");
  }
  assertCanRemoveAttendee(input.viewer, attendee);
  await prisma.eventAttendee.delete({ where: { id: attendee.id } });
  await bumpEventContent(input.eventId);
}

export async function createLink(input: CreateLinkInput): Promise<EventLinkDto> {
  const link = await prisma.eventLink.create({
    data: {
      eventId: input.eventId,
      type: input.type,
      title: input.title.trim(),
      url: input.url.trim(),
    },
  });
  await bumpEventContent(input.eventId);
  return toLinkDto(link);
}

export async function updateLink(input: UpdateLinkInput): Promise<EventLinkDto> {
  await assertLinkBelongsToEvent(input.linkId, input.eventId);
  const link = await prisma.eventLink.update({
    where: { id: input.linkId },
    data: {
      type: input.type,
      title: input.title?.trim(),
      url: input.url?.trim(),
    },
  });
  await bumpEventContent(input.eventId);
  return toLinkDto(link);
}

export async function deleteLink(input: {
  eventId: string;
  linkId: string;
}): Promise<void> {
  const deleted = await prisma.eventLink.deleteMany({
    where: { id: input.linkId, eventId: input.eventId },
  });
  if (deleted.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Link not found");
  }
  await bumpEventContent(input.eventId);
}

export function splitLinksByType(links: readonly EventLinkDto[]): {
  location: EventLinkDto[];
  other: EventLinkDto[];
} {
  return {
    location: links.filter((link) => link.type === EventLinkType.Location),
    other: links.filter((link) => link.type === EventLinkType.Other),
  };
}

async function assertLinkBelongsToEvent(
  linkId: string,
  eventId: string,
): Promise<void> {
  const link = await prisma.eventLink.findFirst({
    where: { id: linkId, eventId },
    select: { id: true },
  });
  if (!link) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Link not found");
  }
}

function toAttendeeDto(attendee: {
  id: string;
  counterpartyId: string;
  status: EventAttendeeDto["status"];
  authorUserId?: string | null;
  authorGuestId?: string | null;
  counterparty: { name: string };
}): EventAttendeeDto {
  return {
    id: attendee.id,
    counterpartyId: attendee.counterpartyId,
    name: attendee.counterparty.name,
    status: attendee.status,
    authorUserId: attendee.authorUserId ?? null,
    authorGuestId: attendee.authorGuestId ?? null,
  };
}

function toLinkDto(link: {
  id: string;
  type: EventLinkDto["type"];
  title: string;
  url: string;
}): EventLinkDto {
  return { id: link.id, type: link.type, title: link.title, url: link.url };
}

function toPaymentDto(payment: {
  id: string;
  attendeeId: string;
  amount: { toString(): string };
  paidAt: Date;
  attendee: { counterparty: { name: string } };
}): EventPaymentDto {
  return {
    id: payment.id,
    attendeeId: payment.attendeeId,
    attendeeName: payment.attendee.counterparty.name,
    amount: payment.amount.toString(),
    paidAt: payment.paidAt.toISOString(),
  };
}

function toSpendingDto(
  spending: {
    id: string;
    title: string;
    category: EventSpendingDto["category"];
    amount: { toString(): string };
    amountUnit: string;
    price: { toString(): string };
    note: string | null;
    authorUserId: string | null;
    createdAt: Date;
    authorGuest: { name: string } | null;
    threads: { id: string }[];
  },
  ownerDisplayName: string | null,
  ownerName: string,
): EventSpendingDto {
  const amount = spending.amount.toString();
  const price = spending.price.toString();
  return {
    id: spending.id,
    title: spending.title,
    category: spending.category,
    amount,
    amountUnit: spending.amountUnit,
    price,
    note: spending.note,
    total: calculateSpendingTotal({
      category: spending.category,
      amount,
      price,
    }),
    author: resolveAuthor({
      ownerDisplayName,
      ownerName,
      authorUserId: spending.authorUserId,
      guestName: spending.authorGuest?.name ?? null,
    }),
    createdAt: spending.createdAt.toISOString(),
    openThreadCount: spending.threads.length,
  };
}

function sumSpendings(
  spendings: readonly {
    amount: { toString(): string };
    price: { toString(): string };
    category: EventSpendingDto["category"];
  }[],
): string {
  return calculateEventTotals(
    spendings.map((spending) => ({
      category: spending.category,
      amount: spending.amount.toString(),
      price: spending.price.toString(),
    })),
  ).total;
}

function requireName(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new AppServiceError(ApiErrorCode.Validation, "Name is required");
  }
  return trimmed;
}

function toNumberOrNull(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString());
}

function toPhaseFields(event: {
  occursAt: Date;
  endsAt: Date | null;
  phaseOverride: EventPhase | null;
}): { phase: EventPhase; phaseOverride: EventPhase | null } {
  return {
    phase: resolveEventPhase(event),
    phaseOverride: event.phaseOverride,
  };
}

function nextPhaseOverride(
  input: UpdateEventInput,
): EventPhase | null | undefined {
  if (input.clearPhaseOverride) {
    return null;
  }
  return input.phaseOverride;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
