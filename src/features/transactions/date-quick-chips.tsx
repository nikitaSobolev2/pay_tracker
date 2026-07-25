"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

export type DateQuickChipId =
  | "yesterday"
  | "twoDaysAgo"
  | "nDaysAgo"
  | "tenMinutesAgo"
  | "thirtyMinutesAgo"
  | "oneHourAgo"
  | "nHoursAgo";

type DateQuickChipsProps = {
  readonly selectedId: DateQuickChipId | null;
  readonly onSelect: (date: Date, chipId: DateQuickChipId) => void;
};

function subtractDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function subtractMinutes(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

function subtractHours(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

function parsePositiveInt(raw: string): number | null {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function DateQuickChips({
  selectedId,
  onSelect,
}: DateQuickChipsProps) {
  const t = useTranslations("transaction");
  const [days, setDays] = useState("3");
  const [hours, setHours] = useState("2");

  function selectDaysAgo(raw = days) {
    const parsed = parsePositiveInt(raw);
    if (parsed === null) {
      return;
    }
    onSelect(subtractDays(parsed), "nDaysAgo");
  }

  function selectHoursAgo(raw = hours) {
    const parsed = parsePositiveInt(raw);
    if (parsed === null) {
      return;
    }
    onSelect(subtractHours(parsed), "nHoursAgo");
  }

  return (
    <div className="space-y-3">
      <ChipGroup label={t("quickDays")}>
        <QuickChip
          tone="day"
          selected={selectedId === "yesterday"}
          onClick={() => onSelect(subtractDays(1), "yesterday")}
        >
          {t("yesterday")}
        </QuickChip>
        <QuickChip
          tone="day"
          selected={selectedId === "twoDaysAgo"}
          onClick={() => onSelect(subtractDays(2), "twoDaysAgo")}
        >
          {t("twoDaysAgo")}
        </QuickChip>
        <NumericQuickChip
          tone="day"
          selected={selectedId === "nDaysAgo"}
          value={days}
          onValueChange={(next) => {
            setDays(next);
            if (selectedId === "nDaysAgo" || next.length > 0) {
              selectDaysAgo(next);
            }
          }}
          onSelect={() => selectDaysAgo()}
          suffix={t("daysAgoSuffix")}
          ariaLabel={t("nDaysAgo", { n: days || "0" })}
        />
      </ChipGroup>

      <ChipGroup label={t("quickTime")}>
        <QuickChip
          tone="time"
          selected={selectedId === "tenMinutesAgo"}
          onClick={() => onSelect(subtractMinutes(10), "tenMinutesAgo")}
        >
          {t("tenMinutesAgo")}
        </QuickChip>
        <QuickChip
          tone="time"
          selected={selectedId === "thirtyMinutesAgo"}
          onClick={() => onSelect(subtractMinutes(30), "thirtyMinutesAgo")}
        >
          {t("thirtyMinutesAgo")}
        </QuickChip>
        <QuickChip
          tone="time"
          selected={selectedId === "oneHourAgo"}
          onClick={() => onSelect(subtractHours(1), "oneHourAgo")}
        >
          {t("oneHourAgo")}
        </QuickChip>
        <NumericQuickChip
          tone="time"
          selected={selectedId === "nHoursAgo"}
          value={hours}
          onValueChange={(next) => {
            setHours(next);
            if (selectedId === "nHoursAgo" || next.length > 0) {
              selectHoursAgo(next);
            }
          }}
          onSelect={() => selectHoursAgo()}
          suffix={t("hoursAgoSuffix")}
          ariaLabel={t("nHoursAgo", { n: hours || "0" })}
        />
      </ChipGroup>
    </div>
  );
}

function ChipGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function chipToneClasses(tone: "day" | "time", selected: boolean): string {
  if (tone === "day") {
    return selected
      ? "border-sky-400 bg-sky-500/45 text-sky-50 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.55)]"
      : "border-sky-400/35 bg-sky-500/12 text-sky-100/80 hover:bg-sky-500/25";
  }
  return selected
    ? "border-amber-400 bg-amber-500/45 text-amber-50 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.55)]"
    : "border-amber-400/35 bg-amber-500/12 text-amber-100/80 hover:bg-amber-500/25";
}

function QuickChip({
  tone,
  selected,
  className,
  children,
  onClick,
}: {
  readonly tone: "day" | "time";
  readonly selected: boolean;
  readonly className?: string;
  readonly children: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors",
        chipToneClasses(tone, selected),
        className,
      )}
    >
      {children}
    </button>
  );
}

function NumericQuickChip({
  tone,
  selected,
  value,
  onValueChange,
  onSelect,
  suffix,
  ariaLabel,
}: {
  readonly tone: "day" | "time";
  readonly selected: boolean;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onSelect: () => void;
  readonly suffix: string;
  readonly ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
        chipToneClasses(tone, selected),
      )}
    >
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) =>
          onValueChange(event.target.value.replace(/\D/g, "").slice(0, 2))
        }
        onClick={(event) => event.stopPropagation()}
        onFocus={onSelect}
        className={cn(
          "h-5 w-6 border-0 border-b bg-transparent p-0 text-center text-sm font-semibold tabular-nums outline-none",
          "border-current/70 caret-current",
          "focus-visible:border-current",
        )}
      />
      <span>{suffix}</span>
    </button>
  );
}
