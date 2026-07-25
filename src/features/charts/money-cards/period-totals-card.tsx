"use client";

import { useTranslations } from "next-intl";

import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  ListPageStats,
  PeriodComparison,
} from "@/server/services/stats-service.types";

import {
  AMOUNT_CLASS,
  MoneyCardSkeleton,
  PeriodChangeIndicator,
  signedAmountClassName,
} from "./primitives";

/** Keep tiny amounts visible when the other side dominates. */
const BAR_FLOOR_PERCENT = 7;

export function PeriodTotalsCard({
  loading,
  stats,
  comparison,
  hideComparison,
  disableShare = false,
}: {
  loading?: boolean;
  stats: ListPageStats["periodTotals"];
  comparison?: PeriodComparison;
  hideComparison?: boolean;
  disableShare?: boolean;
}) {
  const t = useTranslations("stats");
  const tHome = useTranslations("home");
  const incomeValue = Math.max(0, Number(stats.earning.amount) || 0);
  const spendingValue = Math.max(0, Number(stats.spending.amount) || 0);
  const peak = Math.max(incomeValue, spendingValue, 1);
  const title = t("periodTotals");

  return (
    <StatCard
      title={title}
      sharePayload={
        disableShare || loading
          ? null
          : {
              type: SharedChartType.PeriodTotals,
              title,
              stats,
              comparison,
              hideComparison,
            }
      }
      loading={loading}
      className="h-full"
      skeleton={
        <MoneyCardSkeleton
          showBadge={!hideComparison}
          showHint
          detailRows={2}
          detailStyle="bars"
        />
      }
    >
      <div className={cn(AMOUNT_CLASS, signedAmountClassName(stats.net.amount))}>
        {formatChartMoney(stats.net.amount, stats.net.currency)}
      </div>
      {comparison ? (
        <PeriodChangeIndicator
          comparison={comparison}
          sense="higherIsBetter"
          hide={hideComparison}
        />
      ) : null}
      <p className="mt-1.5 text-sm text-muted-foreground">
        {t("netBalanceHint")} · {stats.count} {t("count").toLowerCase()}
      </p>

      <div className="mt-auto space-y-4 pt-5">
        <AmountRow
          label={tHome("income")}
          amount={formatChartMoney(
            stats.earning.amount,
            stats.earning.currency,
          )}
          widthPercent={barWidthPercent(incomeValue, peak)}
          barClassName="bg-emerald-400"
          amountClassName="text-emerald-400"
        />
        <AmountRow
          label={tHome("spendingLabel")}
          amount={formatChartMoney(
            stats.spending.amount,
            stats.spending.currency,
          )}
          widthPercent={barWidthPercent(spendingValue, peak)}
          barClassName="bg-rose-400"
          amountClassName="text-rose-400"
        />
      </div>
    </StatCard>
  );
}

function barWidthPercent(value: number, peak: number): number {
  if (value <= 0) {
    return 0;
  }
  return Math.max((value / peak) * 100, BAR_FLOOR_PERCENT);
}

function AmountRow({
  label,
  amount,
  widthPercent,
  barClassName,
  amountClassName,
}: {
  readonly label: string;
  readonly amount: string;
  readonly widthPercent: number;
  readonly barClassName: string;
  readonly amountClassName: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-sm font-medium tabular-nums sm:text-base",
            amountClassName,
          )}
        >
          {amount}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            barClassName,
          )}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  );
}
