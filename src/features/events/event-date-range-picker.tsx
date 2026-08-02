"use client";

import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { IosCalendar } from "@/features/transactions/ios-calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createUtcFromZonedParts,
  getBrowserTimezone,
  getZonedDateTimeParts,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

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

const DEFAULT_DURATION_HOURS = 2;

export function EventDateRangePicker({
  value,
  onChange,
  className,
}: EventDateRangePickerProps) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const formatSchedule = useEventScheduleLabel();
  const [open, setOpen] = useState(false);

  const panel = (
    <EventDateRangePanel value={value} onChange={onChange} />
  );

  const trigger = (
    <>
      <span className="truncate text-left">
        {formatSchedule(value.occursAt, value.endsAt)}
      </span>
      <CalendarIcon className="size-5 shrink-0 opacity-70" />
    </>
  );

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-12 w-full justify-between rounded-xl px-3 text-base font-normal",
            className,
          )}
          onClick={() => setOpen(true)}
        >
          {trigger}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            showCloseButton={false}
            className="h-dvh max-h-dvh gap-0 rounded-none border-0 p-0"
          >
            <SheetHeader className="border-b border-border/50 px-4 py-3">
              <SheetTitle className="text-lg">{t("date")}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2">
              {panel}
            </div>
            <SheetFooter className="border-t border-border/50 p-4">
              <Button
                type="button"
                className="h-12 w-full rounded-xl text-base"
                onClick={() => setOpen(false)}
              >
                {tCommon("confirm")}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-12 w-full justify-between rounded-xl px-3 text-base font-normal md:h-11",
              className,
            )}
          />
        }
      >
        {trigger}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(100vw-2rem,22rem)] gap-0 rounded-2xl p-3"
      >
        {panel}
        <Button
          type="button"
          className="mt-3 h-11 w-full rounded-xl text-base"
          onClick={() => setOpen(false)}
        >
          {tCommon("confirm")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function EventDateRangePanel({
  value,
  onChange,
}: {
  readonly value: EventScheduleValue;
  readonly onChange: (value: EventScheduleValue) => void;
}) {
  const t = useTranslations("events");
  const timezone = getBrowserTimezone();
  const start = new Date(value.occursAt);
  const end = value.endsAt ? new Date(value.endsAt) : null;

  function selectRange(range: DateRange | undefined) {
    if (!range?.from) {
      return;
    }
    const nextStart = withDayOf(start, range.from, timezone);
    const nextEnd = range.to
      ? withDayOf(end ?? defaultEnd(nextStart), range.to, timezone)
      : end && end.getTime() < nextStart.getTime()
        ? null
        : end;
    onChange({
      occursAt: nextStart.toISOString(),
      endsAt: nextEnd ? nextEnd.toISOString() : null,
    });
  }

  function changeStartTime(next: Date) {
    onChange({
      occursAt: next.toISOString(),
      endsAt: end && end.getTime() < next.getTime() ? null : value.endsAt,
    });
  }

  function toggleEnd() {
    onChange({
      occursAt: value.occursAt,
      endsAt: end ? null : defaultEnd(start).toISOString(),
    });
  }

  return (
    <div className="space-y-3">
      <IosCalendar
        mode="range"
        selected={{ from: start, to: end ?? undefined }}
        onSelect={selectRange}
        defaultMonth={start}
        timezone={timezone}
      />

      <TimeRow
        label={t("scheduleStart")}
        value={start}
        timezone={timezone}
        onChange={changeStartTime}
      />

      {end ? (
        <TimeRow
          label={t("scheduleEnd")}
          value={end}
          timezone={timezone}
          onChange={(next) =>
            onChange({ occursAt: value.occursAt, endsAt: next.toISOString() })
          }
        />
      ) : null}

      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full rounded-xl text-sm"
        onClick={toggleEnd}
      >
        {end ? t("scheduleRemoveEnd") : t("scheduleAddEnd")}
      </Button>
    </div>
  );
}

function TimeRow({
  label,
  value,
  timezone,
  onChange,
}: {
  readonly label: string;
  readonly value: Date;
  readonly timezone: string;
  readonly onChange: (value: Date) => void;
}) {
  const parts = getZonedDateTimeParts(value, timezone);

  function commit(hours: number, minutes: number) {
    onChange(
      createUtcFromZonedParts({ ...parts, hours, minutes }, timezone),
    );
  }

  return (
    <div className="flex items-center gap-3 border-t border-border/60 pt-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="ml-auto flex items-center gap-2">
        <TimeInput
          ariaLabel={`${label} hours`}
          max={23}
          value={parts.hours}
          onCommit={(hours) => commit(hours, parts.minutes)}
        />
        <span className="text-xl font-medium text-muted-foreground">:</span>
        <TimeInput
          ariaLabel={`${label} minutes`}
          max={59}
          value={parts.minutes}
          onCommit={(minutes) => commit(parts.hours, minutes)}
        />
      </div>
    </div>
  );
}

function TimeInput({
  ariaLabel,
  max,
  value,
  onCommit,
}: {
  readonly ariaLabel: string;
  readonly max: number;
  readonly value: number;
  readonly onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Input
      inputMode="numeric"
      aria-label={ariaLabel}
      className="h-12 w-16 rounded-xl text-center text-lg tabular-nums"
      value={draft ?? pad(value)}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
        setDraft(digits);
        if (digits.length === 2) {
          onCommit(Math.min(max, Number(digits)));
        }
      }}
      onBlur={() => {
        if (draft !== null) {
          onCommit(Math.min(max, Number(draft) || 0));
          setDraft(null);
        }
      }}
    />
  );
}

function withDayOf(source: Date, day: Date, timezone: string): Date {
  const time = getZonedDateTimeParts(source, timezone);
  const target = getZonedDateTimeParts(day, timezone);
  return createUtcFromZonedParts(
    {
      year: target.year,
      month: target.month,
      day: target.day,
      hours: time.hours,
      minutes: time.minutes,
    },
    timezone,
  );
}

function defaultEnd(start: Date): Date {
  return new Date(start.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
