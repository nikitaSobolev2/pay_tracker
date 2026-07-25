"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback } from "react";

import { useAppUser } from "@/hooks/use-app-user";
import { getReadableDateParts } from "@/lib/dates";

export function useReadableDateTime() {
  const locale = useLocale();
  const t = useTranslations("datetime");
  const { user } = useAppUser();
  const timezone = user?.timezone ?? "UTC";

  return useCallback(
    (value: string | Date): string => {
      const parts = getReadableDateParts(value, locale, timezone);
      if (!parts) {
        return typeof value === "string" ? value : value.toISOString();
      }

      if (parts.kind === "today") {
        return t("todayAt", { time: parts.time });
      }
      if (parts.kind === "yesterday") {
        return t("yesterdayAt", { time: parts.time });
      }
      if (parts.kind === "sameYear") {
        return t("sameYearAt", { date: parts.date, time: parts.time });
      }
      return t("otherYearAt", {
        date: parts.date,
        year: parts.year,
        time: parts.time,
      });
    },
    [locale, t, timezone],
  );
}
