"use client";

import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

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
import { useAppUser } from "@/hooks/use-app-user";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  createUtcFromZonedParts,
  getBrowserTimezone,
  getZonedDateTimeParts,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type DateTimePickerProps = {
  readonly value: Date;
  readonly onChange: (date: Date) => void;
  readonly className?: string;
  /** When set, covers the trigger face with this label (chip selection). */
  readonly coverLabel?: string | null;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function DateTimePicker({
  value,
  onChange,
  className,
  coverLabel,
}: DateTimePickerProps) {
  const locale = useLocale();
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const { user } = useAppUser();
  const timezone = user?.timezone || getBrowserTimezone();
  const [open, setOpen] = useState(false);

  const zonedParts = useMemo(
    () => getZonedDateTimeParts(value, timezone),
    [value, timezone],
  );
  const [hours, setHours] = useState(pad(zonedParts.hours));
  const [minutes, setMinutes] = useState(pad(zonedParts.minutes));

  useEffect(() => {
    setHours(pad(zonedParts.hours));
    setMinutes(pad(zonedParts.minutes));
  }, [zonedParts.hours, zonedParts.minutes]);

  const label = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(value),
    [locale, timezone, value],
  );
  const showCover = Boolean(coverLabel);

  function commitTime(nextHours: string, nextMinutes: string) {
    const parsedHours = Number(nextHours);
    const parsedMinutes = Number(nextMinutes);
    if (
      !Number.isFinite(parsedHours) ||
      !Number.isFinite(parsedMinutes) ||
      parsedHours < 0 ||
      parsedHours > 23 ||
      parsedMinutes < 0 ||
      parsedMinutes > 59
    ) {
      return;
    }
    const current = getZonedDateTimeParts(value, timezone);
    onChange(
      createUtcFromZonedParts(
        {
          ...current,
          hours: parsedHours,
          minutes: parsedMinutes,
        },
        timezone,
      ),
    );
  }

  function selectDate(date: Date | undefined) {
    if (!date) {
      return;
    }
    const selected = getZonedDateTimeParts(date, timezone);
    const current = getZonedDateTimeParts(value, timezone);
    onChange(
      createUtcFromZonedParts(
        {
          year: selected.year,
          month: selected.month,
          day: selected.day,
          hours: current.hours,
          minutes: current.minutes,
        },
        timezone,
      ),
    );
  }

  const panel = (
    <DateTimePickerPanel
      value={value}
      timezone={timezone}
      hours={hours}
      minutes={minutes}
      timeLabel={t("quickTime")}
      onSelectDate={selectDate}
      onHoursChange={(nextHours) => {
        setHours(nextHours);
        if (nextHours.length === 2) {
          commitTime(nextHours, minutes.padStart(2, "0"));
        }
      }}
      onMinutesChange={(nextMinutes) => {
        setMinutes(nextMinutes);
        if (nextMinutes.length === 2) {
          commitTime(hours.padStart(2, "0"), nextMinutes);
        }
      }}
      onHoursBlur={() => {
        const normalized = pad(Math.min(23, Number(hours) || 0));
        setHours(normalized);
        commitTime(normalized, minutes.padStart(2, "0"));
      }}
      onMinutesBlur={() => {
        const normalized = pad(Math.min(59, Number(minutes) || 0));
        setMinutes(normalized);
        commitTime(hours.padStart(2, "0"), normalized);
      }}
    />
  );

  const triggerFace = (
    <>
      <span className={cn("truncate text-left", showCover && "opacity-0")}>
        {label}
      </span>
      <CalendarIcon
        className={cn(
          "size-5 shrink-0 opacity-70",
          showCover && "opacity-0",
        )}
      />
      {showCover ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] bg-background px-3"
        >
          <span className="truncate text-center text-base font-medium text-foreground">
            {coverLabel}
          </span>
        </div>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <>
        <div className={cn("relative", className)}>
          <Button
            type="button"
            variant="outline"
            className="relative h-12 w-full justify-between rounded-xl px-3 text-base font-normal"
            onClick={() => setOpen(true)}
          >
            {triggerFace}
          </Button>
        </div>
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
      <div className={cn("relative", className)}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="relative h-12 w-full justify-between rounded-xl px-3 text-base font-normal md:h-11"
            />
          }
        >
          {triggerFace}
        </PopoverTrigger>
      </div>
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

function DateTimePickerPanel({
  value,
  timezone,
  hours,
  minutes,
  timeLabel,
  onSelectDate,
  onHoursChange,
  onMinutesChange,
  onHoursBlur,
  onMinutesBlur,
}: {
  readonly value: Date;
  readonly timezone: string;
  readonly hours: string;
  readonly minutes: string;
  readonly timeLabel: string;
  readonly onSelectDate: (date: Date | undefined) => void;
  readonly onHoursChange: (value: string) => void;
  readonly onMinutesChange: (value: string) => void;
  readonly onHoursBlur: () => void;
  readonly onMinutesBlur: () => void;
}) {
  return (
    <div className="space-y-3">
      <IosCalendar
        mode="single"
        selected={value}
        onSelect={onSelectDate}
        timezone={timezone}
      />
      <div className="flex items-center gap-3 border-t border-border/60 pt-3">
        <span className="text-sm text-muted-foreground">{timeLabel}</span>
        <div className="ml-auto flex items-center gap-2">
          <Input
            inputMode="numeric"
            aria-label="Hours"
            className="h-12 w-16 rounded-xl text-center text-lg tabular-nums"
            value={hours}
            onChange={(event) => {
              onHoursChange(event.target.value.replace(/\D/g, "").slice(0, 2));
            }}
            onBlur={onHoursBlur}
          />
          <span className="text-xl font-medium text-muted-foreground">:</span>
          <Input
            inputMode="numeric"
            aria-label="Minutes"
            className="h-12 w-16 rounded-xl text-center text-lg tabular-nums"
            value={minutes}
            onChange={(event) => {
              onMinutesChange(
                event.target.value.replace(/\D/g, "").slice(0, 2),
              );
            }}
            onBlur={onMinutesBlur}
          />
        </div>
      </div>
    </div>
  );
}
