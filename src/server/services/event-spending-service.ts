import type { EventViewer } from "@/lib/event-access";
import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { EventAttendanceStatus, EventSpendingCategory } from "@/types/enums";

import { bumpEventContent } from "./event-content-revision";

export type SpendingAuthor = Pick<EventViewer, "userId" | "guestUserId">;

export type CreateSpendingInput = {
  readonly eventId: string;
  readonly author: SpendingAuthor;
  readonly title: string;
  readonly category: EventSpendingCategory;
  readonly amount: string;
  readonly amountUnit: string;
  readonly price: string;
  readonly note?: string | null;
};

export type UpdateSpendingInput = {
  readonly eventId: string;
  readonly spendingId: string;
  readonly title?: string;
  readonly category?: EventSpendingCategory;
  readonly amount?: string;
  readonly amountUnit?: string;
  readonly price?: string;
  readonly note?: string | null;
};

export type CreatePaymentInput = {
  readonly eventId: string;
  readonly attendeeId: string;
  readonly amount: string;
  readonly paidAt?: Date;
};

export async function createSpending(
  input: CreateSpendingInput,
): Promise<string> {
  const spending = await prisma.eventSpending.create({
    data: {
      eventId: input.eventId,
      title: input.title.trim(),
      category: input.category,
      amount: input.amount,
      amountUnit: input.amountUnit.trim(),
      price: input.price,
      note: emptyToNull(input.note),
      authorUserId: input.author.userId,
      authorGuestId: input.author.guestUserId,
    },
    select: { id: true },
  });
  await bumpEventContent(input.eventId);
  return spending.id;
}

export async function updateSpending(
  input: UpdateSpendingInput,
): Promise<void> {
  const updated = await prisma.eventSpending.updateMany({
    where: { id: input.spendingId, eventId: input.eventId },
    data: {
      title: input.title?.trim(),
      category: input.category,
      amount: input.amount,
      amountUnit: input.amountUnit?.trim(),
      price: input.price,
      note: input.note === undefined ? undefined : emptyToNull(input.note),
    },
  });
  if (updated.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Spending not found");
  }
  await bumpEventContent(input.eventId);
}

export async function deleteSpending(input: {
  eventId: string;
  spendingId: string;
}): Promise<void> {
  const deleted = await prisma.eventSpending.deleteMany({
    where: { id: input.spendingId, eventId: input.eventId },
  });
  if (deleted.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Spending not found");
  }
  await bumpEventContent(input.eventId);
}

/** Records a payment; an uncertain attendee who pays becomes certain. */
export async function createPayment(
  input: CreatePaymentInput,
): Promise<string> {
  const attendee = await prisma.eventAttendee.findFirst({
    where: { id: input.attendeeId, eventId: input.eventId },
    select: { id: true, status: true },
  });
  if (!attendee) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Attendee not found");
  }

  const [payment] = await prisma.$transaction([
    prisma.eventPayment.create({
      data: {
        eventId: input.eventId,
        attendeeId: attendee.id,
        amount: input.amount,
        paidAt: input.paidAt ?? new Date(),
      },
      select: { id: true },
    }),
    prisma.eventAttendee.update({
      where: { id: attendee.id },
      data: { status: EventAttendanceStatus.Certain },
    }),
  ]);
  await bumpEventContent(input.eventId);
  return payment.id;
}

export async function updatePayment(input: {
  eventId: string;
  paymentId: string;
  amount: string;
}): Promise<void> {
  const updated = await prisma.eventPayment.updateMany({
    where: { id: input.paymentId, eventId: input.eventId },
    data: { amount: input.amount },
  });
  if (updated.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Payment not found");
  }
  await bumpEventContent(input.eventId);
}

export async function deletePayment(input: {
  eventId: string;
  paymentId: string;
}): Promise<void> {
  const deleted = await prisma.eventPayment.deleteMany({
    where: { id: input.paymentId, eventId: input.eventId },
  });
  if (deleted.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Payment not found");
  }
  await bumpEventContent(input.eventId);
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
