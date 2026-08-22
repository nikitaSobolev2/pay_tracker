import { TransactionKind, TransactionType } from "@/types/enums";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Treat balances within this RUB epsilon as settled. */
const ZERO_EPSILON = 0.005;

export const DEBT_LEDGER_KINDS: readonly TransactionKind[] = [
  TransactionKind.Loan,
  TransactionKind.Debt,
  TransactionKind.Forgive,
];

export function isDebtLedgerKind(kind: TransactionKind): boolean {
  return (
    kind === TransactionKind.Loan ||
    kind === TransactionKind.Debt ||
    kind === TransactionKind.Forgive
  );
}

/**
 * Signed ledger multiplier. Positive = they owe you; negative = you owe them.
 * Forgive uses the same sign as Close: spending forgive is like Loan (+),
 * earning forgive is like Debt (−).
 */
export function debtBalanceDelta(
  kind: TransactionKind,
  type: TransactionType,
): number {
  if (kind === TransactionKind.Loan) {
    return 1;
  }
  if (kind === TransactionKind.Debt) {
    return -1;
  }
  if (kind !== TransactionKind.Forgive) {
    return 0;
  }
  if (type === TransactionType.Spending) {
    return 1;
  }
  if (type === TransactionType.Earning) {
    return -1;
  }
  return 0;
}

export type DebtEpisodeEvent = {
  readonly occurredAt: Date;
  readonly kind: TransactionKind;
  readonly type: TransactionType;
  /** Canonical RUB amount (always positive). */
  readonly amountRub: number | string;
};

export type DebtEpisodeTone = "owe" | "owed";

export type CompletedDebtEpisode = {
  readonly startAt: Date;
  readonly endAt: Date;
  readonly durationDays: number;
  /** Sign while the episode was open: owed = they owe you; owe = you owe them. */
  readonly tone: DebtEpisodeTone;
};

function signedDelta(event: DebtEpisodeEvent): number {
  const amount = Math.abs(Number(event.amountRub));
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return amount * debtBalanceDelta(event.kind, event.type);
}

function balanceSign(balance: number): -1 | 0 | 1 {
  if (Math.abs(balance) <= ZERO_EPSILON) {
    return 0;
  }
  return balance > 0 ? 1 : -1;
}

function toneFromSign(sign: -1 | 1): DebtEpisodeTone {
  return sign > 0 ? "owed" : "owe";
}

function daysBetween(start: Date, end: Date): number {
  return Number(((end.getTime() - start.getTime()) / MS_PER_DAY).toFixed(2));
}

/**
 * Walk debt events chronologically and emit completed settlement episodes
 * (balance leaves ~0, then returns to ~0). Sign flips count as settle + reopen.
 */
export function detectCompletedDebtEpisodes(
  events: readonly DebtEpisodeEvent[],
): CompletedDebtEpisode[] {
  const sorted = [...events].sort(
    (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
  );

  const completed: CompletedDebtEpisode[] = [];
  let running = 0;
  let episodeStart: Date | null = null;
  let episodeSign: -1 | 1 | null = null;

  for (const event of sorted) {
    const previousSign = balanceSign(running);
    running += signedDelta(event);
    const nextSign = balanceSign(running);

    if (previousSign === 0 && nextSign !== 0) {
      episodeStart = event.occurredAt;
      episodeSign = nextSign;
      continue;
    }

    if (previousSign !== 0 && nextSign === 0 && episodeStart && episodeSign) {
      completed.push({
        startAt: episodeStart,
        endAt: event.occurredAt,
        durationDays: daysBetween(episodeStart, event.occurredAt),
        tone: toneFromSign(episodeSign),
      });
      episodeStart = null;
      episodeSign = null;
      continue;
    }

    if (
      previousSign !== 0 &&
      nextSign !== 0 &&
      previousSign !== nextSign &&
      episodeStart &&
      episodeSign
    ) {
      completed.push({
        startAt: episodeStart,
        endAt: event.occurredAt,
        durationDays: daysBetween(episodeStart, event.occurredAt),
        tone: toneFromSign(episodeSign),
      });
      episodeStart = event.occurredAt;
      episodeSign = nextSign;
    }
  }

  return completed;
}

export function medianDays(
  values: readonly number[],
): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid]!;
  }
  return Number(((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(2));
}

export function medianSettleDaysFromEvents(
  events: readonly DebtEpisodeEvent[],
  tone?: DebtEpisodeTone,
): number | null {
  const episodes = detectCompletedDebtEpisodes(events);
  const durations = episodes
    .filter((episode) => (tone ? episode.tone === tone : true))
    .map((episode) => episode.durationDays);
  return medianDays(durations);
}
