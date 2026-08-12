"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PeriodComparison } from "@/server/services/stats-service.types";

export type TrendDirection = "up" | "down" | "flat";
export type TrendSense = "higherIsBetter" | "lowerIsBetter";

export const AMOUNT_CLASS =
  "whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums md:text-4xl";

/** Shared vertical rhythm for amount → badge → hint → footer blocks. */
export const MONEY_CARD_CONTENT_CLASS = "gap-3";

export function signedAmountClassName(amount: string): string | undefined {
  const value = Number(amount);
  if (!Number.isFinite(value) || value === 0) {
    return undefined;
  }
  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

/** Colors a delta amount by whether the move is good under `sense`. */
export function trendDeltaClassName(
  deltaAmount: string | null,
  sense: TrendSense = "higherIsBetter",
): string | undefined {
  if (deltaAmount == null) {
    return undefined;
  }
  const delta = Number(deltaAmount);
  if (!Number.isFinite(delta) || delta === 0) {
    return undefined;
  }
  const direction: TrendDirection = delta > 0 ? "up" : "down";
  return isPositiveTrend(direction, sense)
    ? "text-emerald-400"
    : "text-rose-400";
}

/** Matches PeriodChangeIndicator arrow/percent colors for the hero amount. */
export function comparisonTrendClassName(
  comparison: PeriodComparison,
  sense: TrendSense = "higherIsBetter",
): string | undefined {
  const percent = comparison.deltaPercent;
  if (percent === null && comparison.deltaAmount === null) {
    return undefined;
  }
  const direction = resolveTrendDirection(percent, comparison.deltaAmount);
  if (direction === "flat") {
    return undefined;
  }
  return isPositiveTrend(direction, sense)
    ? "text-emerald-400"
    : "text-rose-400";
}

/**
 * Colors "this period" the same as the hero amount / arrow / percent badge.
 */
export function thisPeriodVsPreviousClassName(
  comparison: PeriodComparison,
  sense: TrendSense = "higherIsBetter",
): string | undefined {
  return comparisonTrendClassName(comparison, sense);
}

export function MoneyCardSkeleton({
  showBadge = false,
  showHint = false,
  detailRows = 0,
  detailStyle = "list",
}: {
  readonly showBadge?: boolean;
  readonly showHint?: boolean;
  readonly detailRows?: number;
  /** `bars` matches income/period horizontal comparison rows. */
  readonly detailStyle?: "list" | "bars";
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col",
        MONEY_CARD_CONTENT_CLASS,
        detailRows > 0 && "min-h-40",
      )}
    >
      <Skeleton className="h-8 w-36 max-w-full md:h-9 md:w-44" />
      {showBadge ? (
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      ) : null}
      {showHint ? <Skeleton className="h-4 w-40 max-w-full" /> : null}
      {detailRows > 0 && detailStyle === "bars" ? (
        <div className="mt-auto space-y-4">
          {Array.from({ length: detailRows }, (_, index) => (
            <div key={`bar-skeleton-${index}`} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24 sm:h-5 sm:w-28" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : null}
      {detailRows > 0 && detailStyle === "list" ? (
        <div className="mt-auto space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5">
          {Array.from({ length: detailRows }, (_, index) => (
            <div
              key={`detail-skeleton-${index}`}
              className={cn(
                "flex justify-between gap-4",
                index > 0 && "border-t border-border/40 pt-2.5",
              )}
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryListSkeleton({ rows = 4 }: { readonly rows?: number }) {
  return (
    <ul className="space-y-3.5">
      {Array.from({ length: rows }, (_, index) => (
        <li key={`category-skeleton-${index}`} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28 max-w-[50%]" />
            <Skeleton className="h-4 w-12 shrink-0" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
          <Skeleton className="h-3 w-16" />
        </li>
      ))}
    </ul>
  );
}

export function CurrencyListSkeleton({ rows = 3 }: { readonly rows?: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <li key={`currency-skeleton-${index}`}>
          <Skeleton className="h-10 w-full rounded-lg" />
        </li>
      ))}
    </ul>
  );
}

function resolveTrendDirection(
  percent: number | null,
  deltaAmount: string | null,
): TrendDirection {
  if (percent !== null) {
    if (percent > 0) {
      return "up";
    }
    if (percent < 0) {
      return "down";
    }
    return "flat";
  }
  if (deltaAmount === null) {
    return "flat";
  }
  const delta = Number(deltaAmount);
  if (!Number.isFinite(delta) || delta === 0) {
    return "flat";
  }
  return delta > 0 ? "up" : "down";
}

function isPositiveTrend(
  direction: TrendDirection,
  sense: TrendSense,
): boolean {
  if (direction === "flat") {
    return false;
  }
  if (sense === "higherIsBetter") {
    return direction === "up";
  }
  return direction === "down";
}

export function PeriodChangeIndicator({
  comparison,
  sense = "higherIsBetter",
  hide,
}: {
  readonly comparison: PeriodComparison;
  readonly sense?: TrendSense;
  readonly hide?: boolean;
}) {
  if (hide) {
    return null;
  }

  const percent = comparison.deltaPercent;
  if (percent === null) {
    return null;
  }

  const direction = resolveTrendDirection(percent, comparison.deltaAmount);
  const TrendIcon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  const positive = isPositiveTrend(direction, sense);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {direction !== "flat" ? (
        <span
          className={cn(
            "inline-flex size-7 items-center justify-center rounded-full",
            positive
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-rose-500/15 text-rose-400",
          )}
          aria-hidden
        >
          <TrendIcon className="size-3.5 stroke-[2.5]" />
        </span>
      ) : null}
      <Badge
        variant="secondary"
        className={cn(
          "h-7 rounded-full px-2.5 text-sm font-medium",
          direction === "flat" && "bg-muted text-muted-foreground",
          direction !== "flat" &&
            positive &&
            "bg-emerald-500/15 text-emerald-300",
          direction !== "flat" &&
            !positive &&
            "bg-rose-500/15 text-rose-300",
        )}
      >
        {percent > 0 ? "+" : ""}
        {percent.toFixed(1)}%
      </Badge>
    </div>
  );
}
