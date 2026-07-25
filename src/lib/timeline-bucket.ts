import { daysInRange } from "@/lib/dates";

/** Timeline X-axis granularity derived from the selected window length. */
export type TimelineBucket = "hour" | "day" | "month" | "year";

/**
 * Picks bucket size from the actual date bounds so custom rolling/absolute
 * ranges are not forced into calendar Day/Month/Year semantics
 * (e.g. "last 14 days" must not use hourly buckets).
 */
export function resolveTimelineBucket(bounds: {
  start: Date | null;
  end: Date | null;
}): TimelineBucket {
  if (!bounds.start || !bounds.end) {
    return "year";
  }
  const daySpan = daysInRange(bounds.start, bounds.end);
  if (daySpan <= 1) {
    return "hour";
  }
  if (daySpan <= 45) {
    return "day";
  }
  if (daySpan <= 400) {
    return "month";
  }
  return "year";
}
