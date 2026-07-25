import Decimal from "decimal.js";

import {
  detectCompletedDebtEpisodes,
  medianDays,
  type DebtEpisodeEvent,
} from "@/lib/debt-episodes";
import { getDateRangeBounds } from "@/lib/dates";
import { toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { DateRangeType, TransactionDebtRole } from "@/types/enums";

import type {
  DebtCounterpartyStats,
  DebtsStats,
  DebtsStatsInput,
} from "../stats-service.types";
import {
  groupDebtRowsByCounterparty,
  inBounds,
  meanIntervalDays,
  moneyOf,
  netDebtBalance,
  type TxRow,
} from "./stats-common";

export async function getDebtsStats(
  input: DebtsStatsInput,
): Promise<DebtsStats> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId: input.userId,
      debtRole: { in: [TransactionDebtRole.Lend, TransactionDebtRole.Borrow] },
    },
    include: {
      counterparty: true,
      categories: { include: { category: true } },
    },
    orderBy: { occurredAt: "asc" },
  });

  const monthBounds = getDateRangeBounds(DateRangeType.Month, input.timezone);
  const netted = await buildNettedDebtSections(
    rows,
    monthBounds,
    input.displayCurrency,
  );

  return {
    displayCurrency: input.displayCurrency,
    medianSettleDays: netted.medianSettleDays,
    myDebts: netted.myDebts,
    debtsToMe: netted.debtsToMe,
  };
}

async function buildNettedDebtSections(
  rows: TxRow[],
  monthBounds: { start: Date | null; end: Date | null },
  displayCurrency: string,
) {
  const byParty = groupDebtRowsByCounterparty(rows);
  const myDebtsCounterparties: DebtCounterpartyStats[] = [];
  const debtsToMeCounterparties: DebtCounterpartyStats[] = [];
  let myDebtsAllTime = toDecimal(0);
  let myDebtsThisMonth = toDecimal(0);
  let debtsToMeAllTime = toDecimal(0);
  let debtsToMeThisMonth = toDecimal(0);
  const settleBuckets = {
    all: [] as number[],
    owe: [] as number[],
    owed: [] as number[],
  };

  for (const [counterpartyId, partyRows] of byParty) {
    if (counterpartyId === "unknown" || !partyRows[0]?.counterparty) {
      continue;
    }

    const partyMedianSettleDays = collectSettleDurations(
      partyRows,
      settleBuckets,
    );

    const allTimeNet = await netDebtBalance(partyRows, displayCurrency);
    if (allTimeNet.isZero()) {
      continue;
    }

    const monthRows = partyRows.filter((row) =>
      inBounds(row.occurredAt, monthBounds.start, monthBounds.end),
    );
    const monthNet = await netDebtBalance(monthRows, displayCurrency);
    const absAllTime = allTimeNet.abs();
    const stats: DebtCounterpartyStats = {
      counterpartyId,
      name: partyRows[0].counterparty.name,
      totalThisMonth: moneyOf(
        allTimeNet.gt(0)
          ? Decimal.max(monthNet, toDecimal(0))
          : Decimal.max(monthNet.neg(), toDecimal(0)),
        displayCurrency,
      ),
      totalAllTime: moneyOf(absAllTime, displayCurrency),
      averageAmount: moneyOf(
        partyRows.length > 0 ? absAllTime.div(partyRows.length) : toDecimal(0),
        displayCurrency,
      ),
      frequencyDays: meanIntervalDays(partyRows.map((row) => row.occurredAt)),
      medianSettleDays: partyMedianSettleDays,
      eventCount: partyRows.length,
    };

    if (allTimeNet.gt(0)) {
      debtsToMeCounterparties.push(stats);
      debtsToMeAllTime = debtsToMeAllTime.plus(absAllTime);
      debtsToMeThisMonth = debtsToMeThisMonth.plus(
        Decimal.max(monthNet, toDecimal(0)),
      );
    } else {
      myDebtsCounterparties.push(stats);
      myDebtsAllTime = myDebtsAllTime.plus(absAllTime);
      myDebtsThisMonth = myDebtsThisMonth.plus(
        Decimal.max(monthNet.neg(), toDecimal(0)),
      );
    }
  }

  myDebtsCounterparties.sort((a, b) =>
    toDecimal(b.totalAllTime.amount).cmp(toDecimal(a.totalAllTime.amount)),
  );
  debtsToMeCounterparties.sort((a, b) =>
    toDecimal(b.totalAllTime.amount).cmp(toDecimal(a.totalAllTime.amount)),
  );

  return {
    medianSettleDays: medianDays(settleBuckets.all),
    myDebts: {
      totalAllTime: moneyOf(myDebtsAllTime, displayCurrency),
      totalThisMonth: moneyOf(myDebtsThisMonth, displayCurrency),
      medianSettleDays: medianDays(settleBuckets.owe),
      counterparties: myDebtsCounterparties,
    },
    debtsToMe: {
      totalAllTime: moneyOf(debtsToMeAllTime, displayCurrency),
      totalThisMonth: moneyOf(debtsToMeThisMonth, displayCurrency),
      medianSettleDays: medianDays(settleBuckets.owed),
      counterparties: debtsToMeCounterparties,
    },
  };
}

function collectSettleDurations(
  partyRows: TxRow[],
  buckets: { all: number[]; owe: number[]; owed: number[] },
): number | null {
  const episodes = detectCompletedDebtEpisodes(
    partyRowsToEpisodeEvents(partyRows),
  );
  for (const episode of episodes) {
    buckets.all.push(episode.durationDays);
    if (episode.tone === "owe") {
      buckets.owe.push(episode.durationDays);
    } else {
      buckets.owed.push(episode.durationDays);
    }
  }
  return medianDays(episodes.map((episode) => episode.durationDays));
}

function partyRowsToEpisodeEvents(partyRows: TxRow[]): DebtEpisodeEvent[] {
  const events: DebtEpisodeEvent[] = [];
  for (const row of partyRows) {
    if (
      row.debtRole !== TransactionDebtRole.Lend &&
      row.debtRole !== TransactionDebtRole.Borrow
    ) {
      continue;
    }
    events.push({
      occurredAt: row.occurredAt,
      debtRole: row.debtRole,
      amountRub: row.amount.toString(),
    });
  }
  return events;
}
