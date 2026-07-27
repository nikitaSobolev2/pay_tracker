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
  comparisonTrendClassName,
  MONEY_CARD_CONTENT_CLASS,
  MoneyCardSkeleton,
  PeriodChangeIndicator,
  signedAmountClassName,
} from "./primitives";

/** Keep tiny amounts visible when the other side dominates. */
const BAR_FLOOR_PERCENT = 7;

export type PeriodTotalsFooterMode = "incomeSpending" | "vsPrevious";

export function PeriodTotalsCard({
  loading,
  stats,
  comparison,
  hideComparison,
  footerMode = "incomeSpending",
  onPreviousPeriodClick,
  disableShare = false,
}: {
  readonly loading?: boolean;
  readonly stats: ListPageStats["periodTotals"];
  readonly comparison?: PeriodComparison;
  readonly hideComparison?: boolean;
  readonly footerMode?: PeriodTotalsFooterMode;
  readonly onPreviousPeriodClick?: () => void;
  readonly disableShare?: boolean;
}) {
  const t = useTranslations("stats");
  const tHome = useTranslations("home");
  const incomeValue = Math.max(0, Number(stats.earning.amount) || 0);
  const spendingValue = Math.max(0, Number(stats.spending.amount) || 0);
  const peak = Math.max(incomeValue, spendingValue, 1);
  const title = t("periodTotals");
  const showBars = footerMode === "incomeSpending";
  const showVsPreviousFooter = footerMode === "vsPrevious";
  const delta = comparison?.deltaAmount ?? null;

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
      contentClassName={MONEY_CARD_CONTENT_CLASS}
      skeleton={
        <MoneyCardSkeleton
          showBadge={!hideComparison}
          showHint={showBars}
          detailRows={2}
          detailStyle={showBars ? "bars" : "list"}
        />
      }
    >
      <div
        className={cn(
          AMOUNT_CLASS,
          comparison && !hideComparison
            ? comparisonTrendClassName(comparison, "higherIsBetter")
            : signedAmountClassName(stats.net.amount),
        )}
      >
        {formatChartMoney(stats.net.amount, stats.net.currency)}
      </div>
      {comparison ? (
        <PeriodChangeIndicator
          comparison={comparison}
          sense="higherIsBetter"
          hide={hideComparison}
        />
      ) : null}

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
          showBars
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <p className="text-sm text-muted-foreground">
            {t("netBalanceHint")} · {stats.count} {t("count").toLowerCase()}
          </p>
        </div>
      </div>

      <div className="mt-auto">
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
            showBars
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 space-y-4 overflow-hidden">
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
        </div>

        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
            showVsPreviousFooter
              ? "grid-rows-[1fr] opacity-100"
              : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5 text-base">
              <button
                type="button"
                disabled={!onPreviousPeriodClick}
                onClick={onPreviousPeriodClick}
                className="flex w-full cursor-pointer justify-between gap-4 text-left transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-inherit"
              >
                <span className="text-muted-foreground">
                  {tHome("previousPeriod")}
                </span>
                <span className="font-medium tabular-nums">
                  {comparison?.previous
                    ? formatChartMoney(
                        comparison.previous.amount,
                        comparison.previous.currency,
                      )
                    : "—"}
                </span>
              </button>
              <div className="flex justify-between gap-4 border-t border-border/40 pt-2.5">
                <span className="text-muted-foreground">{tHome("change")}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    delta == null ? undefined : signedAmountClassName(delta),
                  )}
                >
                  {delta == null || !comparison
                    ? "—"
                    : formatChartMoney(delta, comparison.current.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
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
