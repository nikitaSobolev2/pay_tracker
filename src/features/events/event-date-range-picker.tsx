"use client";

import { useTranslations } from "next-intl";

import { DateRangeSchedulePicker } from "@/components/date-range-schedule-picker";

import { useEventScheduleLabel } from "./use-event-schedule-label";

export type EventScheduleValue = {
  readonly occursAt: string;
  readonly endsAt: string | null;
};

export type EventDateRangePickerProps = {
  readonly value: EventScheduleValue;
  readonly onChange: (value: EventScheduleValue) => void;
  readonly className?: string;
};

export function EventDateRangePicker({
  value,
  onChange,
  className,
}: EventDateRangePickerProps) {
  const t = useTranslations("events");
  const formatSchedule = useEventScheduleLabel();

  return (
    <DateRangeSchedulePicker
      className={className}
      value={{ startsAt: value.occursAt, endsAt: value.endsAt }}
      onChange={(next) =>
        onChange({ occursAt: next.startsAt, endsAt: next.endsAt })
      }
      formatLabel={formatSchedule}
      title={t("date")}
      startLabel={t("scheduleStart")}
      endLabel={t("scheduleEnd")}
      addEndLabel={t("scheduleAddEnd")}
      removeEndLabel={t("scheduleRemoveEnd")}
    />
  );
}
