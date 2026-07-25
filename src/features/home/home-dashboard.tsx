"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { DateRangeTypeSwitcher } from "@/components/date-range-type-switcher";
import { ActivityHeatmapCard } from "@/features/charts/activity-heatmap";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { DebtSummaryCards } from "@/features/charts/debt-summary-cards";
import {
  IncomeVsSpendingsCard,
  MoneyValueCard,
  VsPreviousPeriodCard,
} from "@/features/charts/money-summary-cards";
import { RecentTransactionsList } from "@/features/charts/recent-transactions-list";
import { TimelineChart } from "@/features/charts/timeline-chart";
import { FastTransactionInput } from "@/features/home/fast-transaction-input";
import { FastTransactionQueueTable } from "@/features/home/fast-transaction-queue-table";
import { useRouter } from "@/i18n/navigation";
import { fetchOverviewStats } from "@/lib/api/stats";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { OverviewStats } from "@/server/services/stats-service.types";
import { DateRangeType } from "@/types/enums";

export function HomeDashboard() {
  const t = useTranslations("home");
  const tCharts = useTranslations("charts");
  const router = useRouter();
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>(
    DateRangeType.Month,
  );
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOverviewStats(dateRangeType);
      setStats(result);
    } finally {
      setLoading(false);
    }
  }, [dateRangeType]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onChanged() {
      void load();
    }
    window.addEventListener("paytracker:transactions-changed", onChanged);
    return () => {
      window.removeEventListener("paytracker:transactions-changed", onChanged);
    };
  }, [load]);

  const avgDailyComparison = stats?.avgDailySpendVsPrevious ?? {
    current: { amount: "0", currency: "RUB" },
    previous: null,
    deltaAmount: null,
    deltaPercent: null,
  };
  const avgDailyCurrency = stats?.avgDailySpend.currency ?? "RUB";
  const avgDailyChangeClassName = spendChangeClassName(
    avgDailyComparison.deltaAmount,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <FastTransactionInput />
        <FastTransactionQueueTable />
      </div>

      <DebtSummaryCards
        loading={loading && !stats}
        displayCurrency={stats?.displayCurrency ?? "RUB"}
        debtsIOwe={
          stats?.debtsIOwe ?? {
            total: { amount: "0", currency: "RUB" },
            breakdown: [],
          }
        }
        debtsOwedToMe={
          stats?.debtsOwedToMe ?? {
            total: { amount: "0", currency: "RUB" },
            breakdown: [],
          }
        }
      />

      <div className="sticky top-14 z-20 -mx-3 border-b border-border/40 bg-background/90 px-3 py-2 backdrop-blur md:-mx-6 md:px-6">
        <DateRangeTypeSwitcher
          value={dateRangeType}
          onChange={setDateRangeType}
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        <div className="min-w-0 flex-1 transition-[flex-grow,flex-basis,max-width,opacity] duration-500 ease-out">
          <IncomeVsSpendingsCard
            title={t("incomeVsSpendings")}
            loading={loading && !stats}
            income={
              stats?.incomeVsSpending.income ?? {
                amount: "0",
                currency: "RUB",
              }
            }
            spending={
              stats?.incomeVsSpending.spending ?? {
                amount: "0",
                currency: "RUB",
              }
            }
            net={
              stats?.incomeVsSpending.net ?? { amount: "0", currency: "RUB" }
            }
            comparison={
              stats?.vsPreviousPeriod ?? {
                current: { amount: "0", currency: "RUB" },
                previous: null,
                deltaAmount: null,
                deltaPercent: null,
              }
            }
            hideComparison={dateRangeType === DateRangeType.AllTime}
          />
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-[flex-grow,flex-basis,max-width,opacity,margin] duration-500 ease-out",
            dateRangeType === DateRangeType.Day
              ? "pointer-events-none max-h-0 flex-[0_0_0%] opacity-0 md:max-h-none"
              : "flex-1 opacity-100",
          )}
        >
          <MoneyValueCard
            title={t("avgDailySpend")}
            loading={loading && !stats}
            amount={
              stats?.avgDailySpend ?? { amount: "0", currency: "RUB" }
            }
            amountClassName="text-rose-400"
            comparison={avgDailyComparison}
            comparisonSense="lowerIsBetter"
            hideComparison={dateRangeType === DateRangeType.AllTime}
            hint={t("spendingLabel")}
            details={[
              {
                label: t("previousAvg"),
                value: avgDailyComparison.previous
                  ? formatChartMoney(
                      avgDailyComparison.previous.amount,
                      avgDailyComparison.previous.currency,
                    )
                  : "—",
              },
              {
                label: t("change"),
                value:
                  avgDailyComparison.deltaAmount != null
                    ? formatChartMoney(
                        avgDailyComparison.deltaAmount,
                        avgDailyCurrency,
                      )
                    : "—",
                valueClassName: avgDailyChangeClassName,
              },
            ]}
          />
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden transition-[flex-grow,flex-basis,max-width,opacity,margin] duration-500 ease-out",
            dateRangeType === DateRangeType.AllTime
              ? "pointer-events-none max-h-0 flex-[0_0_0%] opacity-0 md:max-h-none"
              : "flex-1 opacity-100",
          )}
        >
          <VsPreviousPeriodCard
            title={t("vsPrevious")}
            loading={loading && !stats}
            comparison={
              stats?.vsPreviousPeriod ?? {
                current: { amount: "0", currency: "RUB" },
                previous: null,
                deltaAmount: null,
                deltaPercent: null,
              }
            }
            dateRangeType={dateRangeType}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CategoryPieChart
          title={t("spendingByCategory")}
          loading={loading && !stats}
          slices={stats?.spendingByCategory ?? []}
          currency={stats?.displayCurrency ?? "RUB"}
          onSliceClick={(slice) => {
            if (slice.categoryId) {
              router.push(
                `/transactions?type=spending&categoryIds=${encodeURIComponent(slice.categoryId)}`,
              );
            } else {
              router.push("/transactions?type=spending");
            }
          }}
        />
        <CategoryPieChart
          title={t("earningByCategory")}
          loading={loading && !stats}
          slices={stats?.earningByCategory ?? []}
          currency={stats?.displayCurrency ?? "RUB"}
          onSliceClick={(slice) => {
            if (slice.categoryId) {
              router.push(
                `/transactions?type=earning&categoryIds=${encodeURIComponent(slice.categoryId)}`,
              );
            } else {
              router.push("/transactions?type=earning");
            }
          }}
        />
      </div>

      <TimelineChart
        title={t("timelineIncomeSpending")}
        loading={loading && !stats}
        points={stats?.timeline ?? []}
        currency={stats?.displayCurrency ?? "RUB"}
        mode="dual"
      />

      <ActivityHeatmapCard
        title={tCharts("activity")}
        currency={stats?.displayCurrency ?? "RUB"}
      />

      <RecentTransactionsList
        dateRangeType={dateRangeType}
        periodTotalAmount={
          stats?.periodTotal ?? { amount: "0", currency: "RUB" }
        }
        periodTotalLoading={loading && !stats}
      />
    </div>
  );
}

function spendChangeClassName(deltaAmount: string | null): string | undefined {
  if (deltaAmount == null) {
    return undefined;
  }
  const delta = Number(deltaAmount);
  if (!Number.isFinite(delta) || delta === 0) {
    return undefined;
  }
  return delta > 0 ? "text-rose-400" : "text-emerald-400";
}
