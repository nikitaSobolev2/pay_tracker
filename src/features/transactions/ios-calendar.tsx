"use client";

import {
  addMonths,
  format,
  setMonth,
  setYear,
  startOfMonth,
  subMonths,
} from "date-fns";
import { enUS, ru, type Locale } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import type { DateRange, DayButton } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  getBrowserTimezone,
  getZonedDateTimeParts,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

type CalendarView = "days" | "months" | "years";

const YEARS_PER_PAGE = 16;
const DEFAULT_YEAR_AHEAD = 5;
const DEFAULT_MIN_YEAR = 1900;

function defaultStartMonth(): Date {
  return new Date(DEFAULT_MIN_YEAR, 0);
}

function defaultEndMonth(reference = new Date()): Date {
  return new Date(reference.getFullYear() + DEFAULT_YEAR_AHEAD, 11);
}

type IosRangeCalendarProps = {
  readonly mode?: "range";
  readonly selected?: DateRange;
  readonly onSelect?: (range: DateRange | undefined) => void;
  readonly defaultMonth?: Date;
  readonly startMonth?: Date;
  readonly endMonth?: Date;
  readonly timezone?: string;
  readonly className?: string;
};

type IosSingleCalendarProps = {
  readonly mode: "single";
  readonly selected?: Date;
  readonly onSelect?: (date: Date | undefined) => void;
  readonly defaultMonth?: Date;
  readonly startMonth?: Date;
  readonly endMonth?: Date;
  readonly timezone?: string;
  readonly className?: string;
};

type IosCalendarProps = IosRangeCalendarProps | IosSingleCalendarProps;

function resolveDateLocale(locale: string): Locale {
  return locale.startsWith("ru") ? ru : enUS;
}

function clampMonth(
  month: Date,
  startMonth?: Date,
  endMonth?: Date,
): Date {
  const next = startOfMonth(month);
  if (startMonth && next < startOfMonth(startMonth)) {
    return startOfMonth(startMonth);
  }
  if (endMonth && next > startOfMonth(endMonth)) {
    return startOfMonth(endMonth);
  }
  return next;
}

function isSameMonth(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function yearPageFor(year: number): number {
  return year - (year % YEARS_PER_PAGE);
}

function IosDayButton({
  currentLabel,
  ...dayProps
}: ComponentProps<typeof DayButton> & {
  readonly currentLabel: string;
}) {
  return (
    <CalendarDayButton
      {...dayProps}
      className={cn("gap-0.5", dayProps.className)}
    >
      {dayProps.children}
      {dayProps.modifiers.today ? (
        <span className="max-w-full truncate text-[8px] font-medium leading-none opacity-70">
          {currentLabel}
        </span>
      ) : null}
    </CalendarDayButton>
  );
}

export function IosCalendar(props: IosCalendarProps) {
  const localeCode = useLocale();
  const dateLocale = resolveDateLocale(localeCode);
  const tDateTime = useTranslations("datetime");
  const timezone = props.timezone ?? getBrowserTimezone();
  const todayParts = useMemo(
    () => getZonedDateTimeParts(new Date(), timezone),
    [timezone],
  );
  const currentLabel = tDateTime("current");

  const startMonthTime = props.startMonth?.getTime();
  const endMonthTime = props.endMonth?.getTime();
  const defaultMonthTime = props.defaultMonth?.getTime();
  const selectedMonthTime =
    props.mode === "single"
      ? props.selected?.getTime()
      : props.selected?.from?.getTime();
  const mode = props.mode ?? "range";

  const startMonth = useMemo(
    () =>
      startMonthTime === undefined
        ? defaultStartMonth()
        : new Date(startMonthTime),
    [startMonthTime],
  );
  const endMonth = useMemo(
    () =>
      endMonthTime === undefined ? defaultEndMonth() : new Date(endMonthTime),
    [endMonthTime],
  );

  const initialMonth = useMemo(() => {
    if (defaultMonthTime !== undefined) {
      return clampMonth(new Date(defaultMonthTime), startMonth, endMonth);
    }
    if (selectedMonthTime !== undefined) {
      return clampMonth(new Date(selectedMonthTime), startMonth, endMonth);
    }
    return clampMonth(new Date(), startMonth, endMonth);
  }, [defaultMonthTime, selectedMonthTime, startMonth, endMonth]);

  const [view, setView] = useState<CalendarView>("days");
  const [displayMonth, setDisplayMonth] = useState(initialMonth);
  const [yearPageStart, setYearPageStart] = useState(() =>
    yearPageFor(initialMonth.getFullYear()),
  );

  useEffect(() => {
    setDisplayMonth((current) =>
      isSameMonth(current, initialMonth) ? current : initialMonth,
    );
    setYearPageStart(yearPageFor(initialMonth.getFullYear()));
  }, [initialMonth]);

  const monthLabel = format(displayMonth, "LLLL yyyy", { locale: dateLocale });
  const yearLabel = String(displayMonth.getFullYear());
  const yearPageEnd = yearPageStart + YEARS_PER_PAGE - 1;

  const canGoPrevMonth =
    startOfMonth(subMonths(displayMonth, 1)) >= startOfMonth(startMonth);
  const canGoNextMonth =
    startOfMonth(addMonths(displayMonth, 1)) <= startOfMonth(endMonth);
  const minYear = startMonth.getFullYear();
  const maxYear = endMonth.getFullYear();
  const canGoPrevYears = yearPageStart > minYear;
  const canGoNextYears = yearPageStart + YEARS_PER_PAGE <= maxYear;

  const dayButtonComponents = useMemo(
    () => ({
      DayButton: (dayProps: ComponentProps<typeof DayButton>) => (
        <IosDayButton {...dayProps} currentLabel={currentLabel} />
      ),
    }),
    [currentLabel],
  );

  function goToMonth(next: Date) {
    setDisplayMonth(clampMonth(next, startMonth, endMonth));
    setView("days");
  }

  function selectMonth(monthIndex: number) {
    goToMonth(setMonth(displayMonth, monthIndex));
  }

  function selectYear(year: number) {
    const next = clampMonth(setYear(displayMonth, year), startMonth, endMonth);
    setDisplayMonth(next);
    setView("months");
  }

  return (
    <div className={cn("w-full space-y-3", props.className)}>
      {view === "days" ? (
        <>
          <IosHeader
            title={monthLabel}
            titleClassName="capitalize"
            onTitleClick={() => setView("months")}
            onPrev={() =>
              setDisplayMonth((current) =>
                clampMonth(subMonths(current, 1), startMonth, endMonth),
              )
            }
            onNext={() =>
              setDisplayMonth((current) =>
                clampMonth(addMonths(current, 1), startMonth, endMonth),
              )
            }
            disablePrev={!canGoPrevMonth}
            disableNext={!canGoNextMonth}
          />
          {mode === "single" ? (
            <Calendar
              mode="single"
              locale={dateLocale}
              month={displayMonth}
              onMonthChange={(month) =>
                setDisplayMonth(clampMonth(month, startMonth, endMonth))
              }
              selected={
                props.mode === "single" ? props.selected : undefined
              }
              onSelect={
                props.mode === "single" ? props.onSelect : undefined
              }
              hideNavigation
              timeZone={timezone}
              startMonth={startMonth}
              endMonth={endMonth}
              components={dayButtonComponents}
              className="p-0 [--cell-size:2.9rem]"
              classNames={{
                month_caption: "hidden",
                nav: "hidden",
              }}
            />
          ) : (
            <Calendar
              mode="range"
              locale={dateLocale}
              month={displayMonth}
              onMonthChange={(month) =>
                setDisplayMonth(clampMonth(month, startMonth, endMonth))
              }
              selected={
                props.mode !== "single" ? props.selected : undefined
              }
              onSelect={
                props.mode !== "single" ? props.onSelect : undefined
              }
              hideNavigation
              numberOfMonths={1}
              timeZone={timezone}
              startMonth={startMonth}
              endMonth={endMonth}
              components={dayButtonComponents}
              className="p-0 [--cell-size:2.9rem]"
              classNames={{
                month_caption: "hidden",
                nav: "hidden",
              }}
            />
          )}
        </>
      ) : null}

      {view === "months" ? (
        <>
          <IosHeader
            title={yearLabel}
            onTitleClick={() => {
              setYearPageStart(yearPageFor(displayMonth.getFullYear()));
              setView("years");
            }}
            showNav={false}
          />
          <div className="grid grid-cols-3 gap-2 px-1 pb-1">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const label = format(
                new Date(displayMonth.getFullYear(), monthIndex, 1),
                "LLL",
                { locale: dateLocale },
              );
              const active = displayMonth.getMonth() === monthIndex;
              const isCurrent =
                displayMonth.getFullYear() === todayParts.year &&
                monthIndex === todayParts.month - 1;
              const candidate = new Date(
                displayMonth.getFullYear(),
                monthIndex,
                1,
              );
              const disabled =
                candidate < startOfMonth(startMonth) ||
                candidate > startOfMonth(endMonth);
              return (
                <button
                  key={monthIndex}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectMonth(monthIndex)}
                  className={cn(
                    "flex h-14 select-none flex-col items-center justify-center gap-0.5 rounded-full text-sm font-medium capitalize transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "hover:bg-muted",
                    disabled && "pointer-events-none opacity-35",
                  )}
                >
                  <span>{label}</span>
                  {isCurrent ? (
                    <span className="text-[9px] font-medium leading-none opacity-70">
                      {currentLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {view === "years" ? (
        <>
          <IosHeader
            title={`${yearPageStart} – ${yearPageEnd}`}
            onPrev={() =>
              setYearPageStart((current) =>
                Math.max(minYear, current - YEARS_PER_PAGE),
              )
            }
            onNext={() =>
              setYearPageStart((current) =>
                Math.min(maxYear - YEARS_PER_PAGE + 1, current + YEARS_PER_PAGE),
              )
            }
            disablePrev={!canGoPrevYears}
            disableNext={!canGoNextYears}
            titleClickable={false}
          />
          <div className="grid grid-cols-4 gap-2 px-1 pb-1">
            {Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
              const year = yearPageStart + index;
              if (year < minYear || year > maxYear) {
                return <div key={year} />;
              }
              const active = displayMonth.getFullYear() === year;
              const isCurrent = year === todayParts.year;
              return (
                <button
                  key={year}
                  type="button"
                  onClick={() => selectYear(year)}
                  className={cn(
                    "flex h-14 select-none flex-col items-center justify-center gap-0.5 rounded-full text-sm font-medium tabular-nums transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "hover:bg-muted",
                  )}
                >
                  <span>{year}</span>
                  {isCurrent ? (
                    <span className="text-[9px] font-medium leading-none opacity-70">
                      {currentLabel}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function IosHeader({
  title,
  titleClassName,
  onTitleClick,
  onPrev,
  onNext,
  disablePrev,
  disableNext,
  showNav = true,
  titleClickable = true,
}: {
  readonly title: string;
  readonly titleClassName?: string;
  readonly onTitleClick?: () => void;
  readonly onPrev?: () => void;
  readonly onNext?: () => void;
  readonly disablePrev?: boolean;
  readonly disableNext?: boolean;
  readonly showNav?: boolean;
  readonly titleClickable?: boolean;
}) {
  return (
    <div className="flex h-11 items-center gap-1 px-1">
      {showNav ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          disabled={disablePrev}
          onClick={onPrev}
          aria-label="Previous"
        >
          <ChevronLeft className="size-5" />
        </Button>
      ) : (
        <div className="size-9 shrink-0" />
      )}

      {titleClickable && onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          className={cn(
            "min-w-0 flex-1 truncate rounded-full px-3 py-2 text-center text-base font-semibold tracking-tight transition-colors hover:bg-muted",
            titleClassName,
          )}
        >
          {title}
        </button>
      ) : (
        <div
          className={cn(
            "min-w-0 flex-1 truncate px-3 py-2 text-center text-base font-semibold tracking-tight",
            titleClassName,
          )}
        >
          {title}
        </div>
      )}

      {showNav ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 rounded-full"
          disabled={disableNext}
          onClick={onNext}
          aria-label="Next"
        >
          <ChevronRight className="size-5" />
        </Button>
      ) : (
        <div className="size-9 shrink-0" />
      )}
    </div>
  );
}
