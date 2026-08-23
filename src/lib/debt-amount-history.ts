import { toDecimal } from "@/lib/money";

const ZERO_EPSILON = 0.005;

export type DebtHistoryEvent = {
  readonly signedAmount: string;
};

/** Parts of the current open episode, oriented so + increases the shown debt. */
export function openEpisodeOrientedAmounts(
  events: readonly DebtHistoryEvent[],
  netSign: 1 | -1,
): string[] {
  let running = toDecimal(0);
  let start = 0;
  for (const [index, event] of events.entries()) {
    const previous = running;
    running = running.plus(toDecimal(event.signedAmount));
    if (isNearZero(previous) && !isNearZero(running)) {
      start = index;
    }
    if (isNearZero(running)) {
      start = index + 1;
    }
  }
  const history: string[] = [];
  for (const event of events.slice(start)) {
    const oriented = toDecimal(event.signedAmount).times(netSign);
    if (oriented.isZero()) {
      continue;
    }
    history.push(oriented.toFixed());
  }
  return history;
}

function isNearZero(value: ReturnType<typeof toDecimal>): boolean {
  return value.abs().lte(ZERO_EPSILON);
}
