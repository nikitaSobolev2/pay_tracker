"use client";

import { useTranslations } from "next-intl";

import { CALENDAR_OPTIONS } from "@/features/transactions/use-transaction-filter-data";
import {
  isCustomDatePreset,
  type DateFilterPreset,
} from "@/features/transactions/transaction-filter.types";
import { cn } from "@/lib/utils";
import { DateRangeType } from "@/types/enums";

import {
  travelDatePresetForMode,
  travelPeriodMode,
  travelPickerDateKeys,
  type TravelFilterDateBounds,
  type TravelPeriodMode,
} from "./travel-filter-date-range";

type FilterPeriodTabsProps = {
  readonly travelSelected: boolean;
  readonly bounds: TravelFilterDateBounds | null;
  readonly datePreset: DateFilterPreset;
  readonly onDatePresetChange: (preset: DateFilterPreset) => void;
  readonly onCustomClick?: () => void;
  readonly size?: "desktop" | "mobile";
  readonly customLabel: string;
};

export function FilterPeriodTabs({
  travelSelected,
  bounds,
  datePreset,
  onDatePresetChange,
  onCustomClick,
  size = "desktop",
  customLabel,
}: FilterPeriodTabsProps) {
  const t = useTranslations("transaction");
  const tDate = useTranslations("dateRange");
  const isCustom = isCustomDatePreset(datePreset);
  const tall = size === "mobile";

  return (
    <div
      className={cn(
        "relative w-full min-w-0 flex-1 overflow-hidden",
        tall ? "h-12" : "h-11",
      )}
    >
      <div
        className={periodLayerClassName(tall, !travelSelected)}
        aria-hidden={travelSelected}
      >
        <div
          role="tablist"
          aria-label={t("filterPeriod")}
          className={cn(
            "grid h-full w-full grid-cols-5 rounded-xl bg-muted p-0.5",
            travelSelected && "pointer-events-none",
          )}
        >
          {CALENDAR_OPTIONS.map((option) => {
            const active =
              !isCustom &&
              ((datePreset.kind === "calendar" &&
                datePreset.range === option) ||
                (datePreset.kind === "all_time" &&
                  option === DateRangeType.AllTime));
            return (
              <button
                key={option}
                type="button"
                role="tab"
                tabIndex={travelSelected ? -1 : 0}
                aria-selected={active}
                onClick={() => {
                  if (option === DateRangeType.AllTime) {
                    onDatePresetChange({ kind: "all_time" });
                    return;
                  }
                  onDatePresetChange({ kind: "calendar", range: option });
                }}
                className={periodSegmentClassName(active, tall)}
              >
                <span className="truncate">{tDate(option)}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            tabIndex={travelSelected ? -1 : 0}
            aria-selected={isCustom && !travelSelected}
            onClick={() => onCustomClick?.()}
            className={periodSegmentClassName(isCustom && !travelSelected, tall)}
          >
            <span className="truncate">{customLabel}</span>
          </button>
        </div>
      </div>

      <div
        className={periodLayerClassName(tall, travelSelected)}
        aria-hidden={!travelSelected}
      >
        <TravelPeriodTabs
          bounds={bounds}
          datePreset={datePreset}
          disabled={!travelSelected}
          tall={tall}
          customLabel={
            bounds && travelPeriodMode(datePreset, bounds) === "custom"
              ? customLabel
              : t("customPeriod")
          }
          onSelect={(mode) => {
            if (!bounds) {
              return;
            }
            onDatePresetChange(travelDatePresetForMode(bounds, mode));
          }}
          onCustomClick={onCustomClick}
        />
      </div>
    </div>
  );
}

function TravelPeriodTabs({
  bounds,
  datePreset,
  disabled,
  tall,
  customLabel,
  onSelect,
  onCustomClick,
}: {
  readonly bounds: TravelFilterDateBounds | null;
  readonly datePreset: DateFilterPreset;
  readonly disabled: boolean;
  readonly tall: boolean;
  readonly customLabel: string;
  readonly onSelect: (mode: Exclude<TravelPeriodMode, "custom">) => void;
  readonly onCustomClick?: () => void;
}) {
  const t = useTranslations("transaction");
  const mode = bounds ? travelPeriodMode(datePreset, bounds) : "spendings";
  const hasSpendings = Boolean(bounds?.spendingStartDate);
  const canPickCustomDates = Boolean(travelPickerDateKeys(bounds));
  const showSelection =
    Boolean(bounds?.spendingsKnown) || datePreset.kind === "absolute";

  return (
    <div
      role="tablist"
      aria-label={t("filterPeriod")}
      className={cn(
        "grid h-full w-full grid-cols-3 rounded-xl bg-muted p-0.5",
        disabled && "pointer-events-none",
      )}
    >
      <button
        type="button"
        role="tab"
        tabIndex={disabled ? -1 : 0}
        aria-selected={showSelection && mode === "spendings"}
        disabled={!hasSpendings && Boolean(bounds)}
        onClick={() => onSelect("spendings")}
        className={periodSegmentClassName(
          showSelection && mode === "spendings",
          tall,
        )}
      >
        <span className="truncate">{t("travelPeriodSpendings")}</span>
      </button>
      <button
        type="button"
        role="tab"
        tabIndex={disabled ? -1 : 0}
        aria-selected={showSelection && mode === "trip"}
        onClick={() => onSelect("trip")}
        className={periodSegmentClassName(
          showSelection && mode === "trip",
          tall,
        )}
      >
        <span className="truncate">{t("travelPeriodTrip")}</span>
      </button>
      <button
        type="button"
        role="tab"
        tabIndex={disabled ? -1 : 0}
        aria-selected={showSelection && mode === "custom"}
        disabled={!canPickCustomDates}
        onClick={() => onCustomClick?.()}
        className={periodSegmentClassName(
          showSelection && mode === "custom",
          tall,
        )}
      >
        <span className="truncate">{customLabel}</span>
      </button>
    </div>
  );
}

function periodLayerClassName(tall: boolean, visible: boolean): string {
  return cn(
    "absolute inset-0 transition-all duration-300 ease-out",
    tall ? "h-12" : "h-11",
    visible
      ? "translate-y-0 opacity-100"
      : "pointer-events-none translate-y-1 opacity-0",
  );
}

function periodSegmentClassName(active: boolean, tall: boolean): string {
  return cn(
    "inline-flex h-full min-w-0 cursor-pointer items-center justify-center rounded-lg font-medium transition-all",
    tall ? "px-1 text-sm" : "px-1.5 text-xs sm:text-sm",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-foreground/60 hover:text-foreground",
    "disabled:cursor-not-allowed disabled:opacity-40",
  );
}
