import { EventPhase } from "@/types/enums";

export type EventPhaseInput = {
  readonly occursAt: Date | string;
  readonly endsAt?: Date | string | null;
  readonly phaseOverride?: EventPhase | null;
  readonly now?: Date;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** End of relevance: endsAt when set, otherwise occursAt. */
export function eventRelevanceEnd(input: EventPhaseInput): Date {
  if (input.endsAt) {
    return toDate(input.endsAt);
  }
  return toDate(input.occursAt);
}

export function resolveAutoEventPhase(
  occursAt: Date | string,
  endsAt: Date | string | null | undefined,
  now: Date = new Date(),
): EventPhase {
  const current = now.getTime();
  const start = toDate(occursAt).getTime();
  const end = eventRelevanceEnd({ occursAt, endsAt }).getTime();
  if (current < start) {
    return EventPhase.Pending;
  }
  if (current > end) {
    return EventPhase.Finished;
  }
  return EventPhase.InProgress;
}

/** Effective phase: override wins, else auto from date range. */
export function resolveEventPhase(input: EventPhaseInput): EventPhase {
  if (input.phaseOverride) {
    return input.phaseOverride;
  }
  return resolveAutoEventPhase(input.occursAt, input.endsAt, input.now);
}

/** Shown in header: pending or currently happening. */
export function isEventHeaderRelevant(input: EventPhaseInput): boolean {
  const phase = resolveEventPhase(input);
  return phase === EventPhase.Pending || phase === EventPhase.InProgress;
}

/**
 * Prefer in-progress, else soonest start among header-relevant events.
 * Returns null when nothing is relevant.
 */
export function pickNearestUpcomingEvent<T extends EventPhaseInput>(
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
    (event) =>
      resolveEventPhase({ ...event, now }) === EventPhase.InProgress,
  );
  if (inProgress) {
    return inProgress;
  }

  return [...relevant].sort(
    (left, right) =>
      toDate(left.occursAt).getTime() - toDate(right.occursAt).getTime(),
  )[0]!;
}
