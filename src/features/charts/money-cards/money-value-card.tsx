"use client";

import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MoneyAmount, PeriodComparison } from "@/server/services/stats-service.types";

import {
  AMOUNT_CLASS,
  MoneyCardSkeleton,
  PeriodChangeIndicator,
  type TrendSense,
} from "./primitives";

export function MoneyValueCard({
  title,
  amount,
  loading,
  hint,
  amountClassName,
  comparison,
  comparisonSense = "higherIsBetter",
  hideComparison,
  details,
  disableShare = false,
}: {
  title: string;
  amount: MoneyAmount;
  loading?: boolean;
  hint?: string;
  amountClassName?: string;
  comparison?: PeriodComparison;
  comparisonSense?: TrendSense;
  hideComparison?: boolean;
  details?: Array<{
    readonly label: string;
    readonly value: string;
    readonly valueClassName?: string;
  }>;
  disableShare?: boolean;
}) {
  return (
    <StatCard
      title={title}
      sharePayload={
        disableShare || loading
          ? null
          : {
              type: SharedChartType.MoneyValue,
              title,
              amount,
              comparison,
              comparisonSense,
              hideComparison,
              details: details?.map((item) => ({
                label: item.label,
                value: item.value,
              })),
            }
      }
      loading={loading}
      className="h-full"
      skeleton={
        <MoneyCardSkeleton
          showBadge={Boolean(comparison) && !hideComparison}
          showHint={Boolean(hint)}
          detailRows={details?.length ?? 0}
        />
      }
    >
      <div className={cn(AMOUNT_CLASS, amountClassName)}>
        {formatChartMoney(amount.amount, amount.currency)}
      </div>
      {comparison ? (
        <PeriodChangeIndicator
          comparison={comparison}
          sense={comparisonSense}
          hide={hideComparison}
        />
      ) : null}
      {hint ? (
        <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
      ) : null}
      {details && details.length > 0 ? (
        <div className="mt-auto space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5 text-base">
          {details.map((row, index) => (
            <div
              key={row.label}
              className={cn(
                "flex justify-between gap-4",
                index > 0 && "border-t border-border/40 pt-2.5",
              )}
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span
                className={cn("font-medium tabular-nums", row.valueClassName)}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </StatCard>
  );
}
