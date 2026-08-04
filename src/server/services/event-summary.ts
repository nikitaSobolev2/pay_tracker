import Decimal from "decimal.js";

import { toDecimal } from "@/lib/money";

import {
  calculateAttendeeBalances,
  calculateEventTotals,
  calculatePaidProgress,
  calculatePerPersonShare,
  type PerPersonShare,
  type SettlementAttendee,
  type SettlementPayment,
  type SettlementSpending,
} from "./event-settlement";
import type { EventSummaryDto } from "./event-service.types";

export type SummarySource = {
  readonly attendees: readonly (SettlementAttendee & { readonly name: string })[];
  readonly spendings: readonly SettlementSpending[];
  readonly payments: readonly SettlementPayment[];
  readonly manualPerPersonAmount?: string | null;
};

const MONEY_SCALE = 2;

/** Turns raw event rows into every number the charts and lists render. */
export function buildEventSummary(source: SummarySource): EventSummaryDto {
  const totals = calculateEventTotals(source.spendings);
  const share = resolveShare(totals.total, source);
  const balances = calculateAttendeeBalances({
    attendees: source.attendees,
    payments: source.payments,
    share: share.average,
  });
  const paidProgress = calculatePaidProgress({
    attendees: source.attendees,
    payments: source.payments,
    share: share.average,
  });

  return {
    total: totals.total,
    byCategory: totals.byCategory,
    drinksAndAlcohol: totals.drinksAndAlcohol,
    share,
    balances: balances.map((balance) => ({
      ...balance,
      name: nameOf(source.attendees, balance.attendeeId),
    })),
    paidProgress,
  };
}

function resolveShare(
  total: string,
  source: SummarySource,
): PerPersonShare {
  if (source.manualPerPersonAmount == null) {
    return calculatePerPersonShare({
      total,
      attendees: source.attendees,
    });
  }

  const formatted = formatMoney(source.manualPerPersonAmount);
  return {
    average: formatted,
    lowerBound: formatted,
    upperBound: formatted,
    hasUncertain: false,
  };
}

function formatMoney(value: string | number): string {
  return toDecimal(value)
    .toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP)
    .toFixed(MONEY_SCALE);
}

function nameOf(
  attendees: SummarySource["attendees"],
  attendeeId: string,
): string {
  return attendees.find((attendee) => attendee.id === attendeeId)?.name ?? "";
}
