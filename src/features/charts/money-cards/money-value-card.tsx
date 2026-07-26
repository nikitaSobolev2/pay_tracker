"use client";

import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MoneyAmount, PeriodComparison } from "@/server/services/stats-service.types";

import {
  AMOUNT_CLASS,
  comparisonTrendClassName,
  MONEY_CARD_CONTENT_CLASS,
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
    readonly onClick?: () => void;
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
      contentClassName={MONEY_CARD_CONTENT_CLASS}
      skeleton={
        <MoneyCardSkeleton
          showBadge={Boolean(comparison) && !hideComparison}
          showHint={Boolean(hint)}
          detailRows={details?.length ?? 0}
        />
      }
    >
      <div
        className={cn(
          AMOUNT_CLASS,
          comparison && !hideComparison
            ? comparisonTrendClassName(comparison, comparisonSense)
            : amountClassName,
        )}
      >
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
        <div className="text-sm text-muted-foreground">{hint}</div>
      ) : null}
      {details && details.length > 0 ? (
        <div className="mt-auto space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5 text-base">
          {details.map((row, index) => {
            const rowClassName = cn(
              "flex w-full justify-between gap-4 text-left",
              index > 0 && "border-t border-border/40 pt-2.5",
              row.onClick &&
                "cursor-pointer transition-colors hover:text-foreground",
            );
            const value = (
              <span
                className={cn("font-medium tabular-nums", row.valueClassName)}
              >
                {row.value}
              </span>
            );
            if (row.onClick) {
              return (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className={rowClassName}
                >
                  <span className="text-muted-foreground">{row.label}</span>
                  {value}
                </button>
              );
            }
            return (
              <div key={row.label} className={rowClassName}>
                <span className="text-muted-foreground">{row.label}</span>
                {value}
              </div>
            );
          })}
        </div>
      ) : null}
    </StatCard>
  );
}
