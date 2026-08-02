import Decimal from "decimal.js";

import { toDecimal } from "@/lib/money";
import {
  EventAttendanceStatus,
  EventSpendingCategory,
} from "@/types/enums";

export type SettlementSpending = {
  readonly category: EventSpendingCategory;
  readonly amount: string | number;
  readonly price: string | number;
};

export type SettlementAttendee = {
  readonly id: string;
  readonly status: EventAttendanceStatus;
};

export type SettlementPayment = {
  readonly attendeeId: string;
  readonly amount: string | number;
};

export type CategoryTotal = {
  readonly category: EventSpendingCategory;
  readonly total: string;
};

export type EventTotals = {
  readonly total: string;
  readonly byCategory: readonly CategoryTotal[];
  readonly drinksAndAlcohol: string;
};

export type PerPersonShare = {
  /** Total split across every attendee, certain and uncertain. */
  readonly average: string;
  /** Everyone pays: the smallest possible share. */
  readonly lowerBound: string;
  /** No uncertain attendee pays: the largest possible share. */
  readonly upperBound: string;
  readonly hasUncertain: boolean;
};

export type AttendeeBalance = {
  readonly attendeeId: string;
  readonly status: EventAttendanceStatus;
  readonly paid: string;
  readonly share: string;
  readonly remaining: string;
  readonly hasPaidShare: boolean;
};

export type PaidProgress = {
  readonly paidCount: number;
  readonly totalCount: number;
  readonly certainPaidCount: number;
  readonly uncertainPaidCount: number;
  readonly collected: string;
  readonly expected: string;
};

const MONEY_SCALE = 2;
const ZERO = new Decimal(0);

export function calculateSpendingTotal(spending: SettlementSpending): string {
  return format(toDecimal(spending.amount).times(toDecimal(spending.price)));
}

export function calculateEventTotals(
  spendings: readonly SettlementSpending[],
): EventTotals {
  const totals = new Map<EventSpendingCategory, Decimal>();
  let total = ZERO;

  for (const spending of spendings) {
    const rowTotal = toDecimal(spending.amount).times(toDecimal(spending.price));
    total = total.plus(rowTotal);
    totals.set(
      spending.category,
      (totals.get(spending.category) ?? ZERO).plus(rowTotal),
    );
  }

  const drinksAndAlcohol = (
    totals.get(EventSpendingCategory.Drinks) ?? ZERO
  ).plus(totals.get(EventSpendingCategory.Alcohol) ?? ZERO);

  return {
    total: format(total),
    byCategory: Object.values(EventSpendingCategory)
      .filter((category) => totals.has(category))
      .map((category) => ({
        category,
        total: format(totals.get(category) ?? ZERO),
      })),
    drinksAndAlcohol: format(drinksAndAlcohol),
  };
}

export function calculatePerPersonShare(input: {
  readonly total: string | number;
  readonly attendees: readonly SettlementAttendee[];
}): PerPersonShare {
  const total = toDecimal(input.total);
  const allCount = input.attendees.length;
  const certainCount = countCertain(input.attendees);
  const hasUncertain = allCount > certainCount;

  const average = divideOrZero(total, allCount);
  const upperBound = certainCount > 0 ? divideOrZero(total, certainCount) : average;

  return {
    average: format(average),
    lowerBound: format(average),
    upperBound: format(upperBound),
    hasUncertain,
  };
}

export function calculateAttendeeBalances(input: {
  readonly attendees: readonly SettlementAttendee[];
  readonly payments: readonly SettlementPayment[];
  readonly share: string | number;
}): readonly AttendeeBalance[] {
  const share = toDecimal(input.share);
  const paidByAttendee = sumPaymentsByAttendee(input.payments);

  return input.attendees.map((attendee) => {
    const paid = paidByAttendee.get(attendee.id) ?? ZERO;
    const remaining = Decimal.max(share.minus(paid), ZERO);
    return {
      attendeeId: attendee.id,
      status: attendee.status,
      paid: format(paid),
      share: format(share),
      remaining: format(remaining),
      hasPaidShare: hasPaidShare(paid, share),
    };
  });
}

export function calculatePaidProgress(input: {
  readonly attendees: readonly SettlementAttendee[];
  readonly payments: readonly SettlementPayment[];
  readonly share: string | number;
}): PaidProgress {
  const share = toDecimal(input.share);
  const balances = calculateAttendeeBalances(input);
  const paid = balances.filter((balance) => balance.hasPaidShare);

  const collected = input.payments.reduce(
    (sum, payment) => sum.plus(toDecimal(payment.amount)),
    ZERO,
  );

  return {
    paidCount: paid.length,
    totalCount: input.attendees.length,
    certainPaidCount: paid.filter(
      (balance) => balance.status === EventAttendanceStatus.Certain,
    ).length,
    uncertainPaidCount: paid.filter(
      (balance) => balance.status === EventAttendanceStatus.Uncertain,
    ).length,
    collected: format(collected),
    expected: format(share.times(input.attendees.length)),
  };
}

function hasPaidShare(paid: Decimal, share: Decimal): boolean {
  if (share.lessThanOrEqualTo(ZERO)) {
    return paid.greaterThan(ZERO);
  }
  return paid.greaterThanOrEqualTo(share);
}

function sumPaymentsByAttendee(
  payments: readonly SettlementPayment[],
): Map<string, Decimal> {
  const sums = new Map<string, Decimal>();
  for (const payment of payments) {
    sums.set(
      payment.attendeeId,
      (sums.get(payment.attendeeId) ?? ZERO).plus(toDecimal(payment.amount)),
    );
  }
  return sums;
}

function countCertain(attendees: readonly SettlementAttendee[]): number {
  return attendees.filter(
    (attendee) => attendee.status === EventAttendanceStatus.Certain,
  ).length;
}

function divideOrZero(total: Decimal, count: number): Decimal {
  return count > 0 ? total.dividedBy(count) : ZERO;
}

function format(value: Decimal): string {
  return value.toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP).toFixed(
    MONEY_SCALE,
  );
}
