import { TravelPhase } from "@/types/enums";

export type TravelPhaseInput = {
  readonly startsAt: Date | string;
  readonly endsAt: Date | string;
  readonly phaseOverride?: TravelPhase | null;
  readonly now?: Date;
};

/** Inclusive calendar-day count for a trip (min 1). */
export function countTravelDays(
  startsAt: Date | string,
  endsAt: Date | string,
): number {
  const start = startOfUtcDay(toDate(startsAt));
  const end = startOfUtcDay(toDate(endsAt));
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((end.getTime() - start.getTime()) / msPerDay);
  return Math.max(1, diff + 1);
}

/** Effective phase: override wins, else auto from date range. */
export function resolveTravelPhase(input: TravelPhaseInput): TravelPhase {
  if (input.phaseOverride) {
    return input.phaseOverride;
  }
  return resolveAutoTravelPhase(input.startsAt, input.endsAt, input.now);
}

export function resolveAutoTravelPhase(
  startsAt: Date | string,
  endsAt: Date | string,
  now: Date = new Date(),
): TravelPhase {
  const start = toDate(startsAt).getTime();
  const end = toDate(endsAt).getTime();
  const current = now.getTime();
  if (current < start) {
    return TravelPhase.Prepares;
  }
  if (current > end) {
    return TravelPhase.Finished;
  }
  return TravelPhase.InProgress;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}
