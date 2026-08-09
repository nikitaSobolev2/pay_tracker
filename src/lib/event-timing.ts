export type EventTiming = "upcoming" | "inProgress" | "finished";

export type EventTimingInput = {
  readonly occursAt: Date | string;
  readonly endsAt?: Date | string | null;
  readonly now?: Date;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** End of relevance: endsAt when set, otherwise occursAt. */
export function eventRelevanceEnd(input: EventTimingInput): Date {
  if (input.endsAt) {
    return toDate(input.endsAt);
  }
  return toDate(input.occursAt);
}

export function resolveEventTiming(input: EventTimingInput): EventTiming {
  const now = (input.now ?? new Date()).getTime();
  const start = toDate(input.occursAt).getTime();
  const end = eventRelevanceEnd(input).getTime();
  if (now > end) {
    return "finished";
  }
  if (now >= start) {
    return "inProgress";
  }
  return "upcoming";
}

/** Still shown in header: upcoming or currently happening. */
export function isEventHeaderRelevant(input: EventTimingInput): boolean {
  return resolveEventTiming(input) !== "finished";
}

/**
 * Prefer in-progress, else soonest start among non-finished events.
 * Returns null when nothing is relevant.
 */
export function pickNearestUpcomingEvent<T extends EventTimingInput>(
  events: readonly T[],
  now: Date = new Date(),
): T | null {
  const relevant = events.filter((event) =>
    isEventHeaderRelevant({ ...event, now }),
  );
  if (relevant.length === 0) {
    return null;
  }

  const inProgress = relevant.find(
    (event) => resolveEventTiming({ ...event, now }) === "inProgress",
  );
  if (inProgress) {
    return inProgress;
  }

  return [...relevant].sort(
    (left, right) =>
      toDate(left.occursAt).getTime() - toDate(right.occursAt).getTime(),
  )[0]!;
}
