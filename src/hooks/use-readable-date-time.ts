"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";

import { useAppUser } from "@/hooks/use-app-user";
import {
  getBrowserTimezone,
  getReadableDateParts,
  type ReadableDateKind,
} from "@/lib/dates";

const KIND_KEYS: Record<ReadableDateKind, string> = {
  today: "todayAt",
  yesterday: "yesterdayAt",
  tomorrow: "tomorrowAt",
  sameYear: "sameYearAt",
  otherYear: "otherYearAt",
};

export type ReadableDateTimeFormatter = (value: string | Date) => string;

export function useReadableDateTime(): ReadableDateTimeFormatter {
  const { user } = useAppUser();
  return useDateTimeFormatter(user?.timezone ?? "UTC");
}

/**
 * Same formatting, but resolves the zone from the browser so public pages keep
 * working for guests who have no account preferences to read.
 */
export function useGuestSafeReadableDateTime(): ReadableDateTimeFormatter {
  return useDateTimeFormatter(getBrowserTimezone());
}

function useDateTimeFormatter(timezone: string): ReadableDateTimeFormatter {
  const locale = useLocale();
  const t = useTranslations("datetime");

  return useCallback(
    (value: string | Date): string => {
      const parts = getReadableDateParts(value, locale, timezone);
      if (!parts) {
        return typeof value === "string" ? value : value.toISOString();
      }
      return t(KIND_KEYS[parts.kind], {
        weekday: parts.weekday,
        date: parts.date,
        year: parts.year,
        time: parts.time,
      });
    },
    [locale, t, timezone],
  );
}
