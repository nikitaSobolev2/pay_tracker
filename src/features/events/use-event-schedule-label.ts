"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";

import { useGuestSafeReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  formatZonedTime,
  getBrowserTimezone,
  isSameZonedDay,
} from "@/lib/dates";

export type EventScheduleLabelFormatter = (
  occursAt: string,
  endsAt: string | null,
) => string;

/**
 * "Sun, today, at 19:47 – 22:00" when the event ends the same day, and a full
 * readable label on both sides when it spans days.
 */
export function useEventScheduleLabel(): EventScheduleLabelFormatter {
  const locale = useLocale();
  const t = useTranslations("datetime");
  const formatDateTime = useGuestSafeReadableDateTime();
  const timezone = getBrowserTimezone();

  return useCallback(
    (occursAt: string, endsAt: string | null): string => {
      const start = new Date(occursAt);
      const startLabel = formatDateTime(start);
      if (!endsAt) {
        return startLabel;
      }

      const end = new Date(endsAt);
      const endLabel = isSameZonedDay(start, end, timezone)
        ? formatZonedTime(end, locale, timezone)
        : formatDateTime(end);
      return t("range", { start: startLabel, end: endLabel });
    },
    [formatDateTime, locale, t, timezone],
  );
}
