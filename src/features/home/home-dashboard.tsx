"use client";

import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { DateRangeTypeSwitcher } from "@/components/date-range-type-switcher";
import { ActivityHeatmapCard } from "@/features/charts/activity-heatmap";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { DebtSummaryCards } from "@/features/charts/debt-summary-cards";
import {
  IncomeVsSpendingsCard,
  MoneyValueCard,
  TopCategoriesCard,
  VsPreviousPeriodCard,
} from "@/features/charts/money-summary-cards";
import { NetCashflowChart } from "@/features/charts/net-cashflow-chart";
import { RecentTransactionsList } from "@/features/charts/recent-transactions-list";
import { TimelineWithDrilldown } from "@/features/charts/timeline-with-drilldown";
import { FastTransactionInput } from "@/features/home/fast-transaction-input";
import { FastTransactionQueueTable } from "@/features/home/fast-transaction-queue-table";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchOverviewStats } from "@/lib/api/stats";
import { formatChartMoney } from "@/lib/money";
import type { OverviewStats } from "@/server/services/stats-service.types";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";
import { DateRangeType } from "@/types/enums";

type AbsoluteRange = {
  readonly startDate: string;
  readonly endDate: string;
};

const DATE_RANGE_OPTIONS = [
  DateRangeType.Day,
  DateRangeType.Month,
  DateRangeType.Year,
  DateRangeType.AllTime,
] as const;

export function HomeDashboard() {
  const t = useTranslations("home");
  const tCharts = useTranslations("charts");
  const tDateRange = useTranslations("dateRange");
  const isMobile = useIsMobile();
  const setMobilePageChrome = useMobilePageChromeStore((state) => state.setChrome);
  const dateRangeSentinelRef = useRef<HTMLDivElement>(null);
  const [dateRangeOutOfView, setDateRangeOutOfView] = useState(false);
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>(
    DateRangeType.Month,
  );
  const [absoluteRange, setAbsoluteRange] = useState<AbsoluteRange | null>(
    null,
  );
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchOverviewStats(
        dateRangeType,
        absoluteRange ?? undefined,
      );
      setStats(result);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [absoluteRange, dateRangeType]);

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

  useEffect(() => {
    if (!isMobile) {
      setDateRangeOutOfView(false);
      return;
    }

    const sentinel = dateRangeSentinelRef.current;
    if (!sentinel) return;

    function updateScrolledPast() {
      const node = dateRangeSentinelRef.current;
      if (!node) {
        setDateRangeOutOfView(false);
        return;
      }
      const rect = node.getBoundingClientRect();
      // Only when the in-page filter has fully left above the viewport.
      // Below-the-fold (not reached yet): bottom > 0 → stay hidden in island.
      setDateRangeOutOfView(rect.bottom <= 0);
    }

    updateScrolledPast();

    const scrollTargets: Array<Element | Window> = [window];
    let ancestor: HTMLElement | null = sentinel.parentElement;
    while (ancestor) {
      const { overflowY } = window.getComputedStyle(ancestor);
      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay"
      ) {
        scrollTargets.push(ancestor);
      }
      ancestor = ancestor.parentElement;
    }

    for (const target of scrollTargets) {
      target.addEventListener("scroll", updateScrolledPast, { passive: true });
    }
    window.addEventListener("resize", updateScrolledPast);

    const observer = new IntersectionObserver(updateScrolledPast, {
      threshold: [0, 1],
    });
    observer.observe(sentinel);

    return () => {
      for (const target of scrollTargets) {
        target.removeEventListener("scroll", updateScrolledPast);
      }
      window.removeEventListener("resize", updateScrolledPast);
      observer.disconnect();
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !dateRangeOutOfView) {
      setMobilePageChrome(null);
      return () => setMobilePageChrome(null);
    }

    setMobilePageChrome({
      segmentFilter: {
        value: dateRangeType,
        options: DATE_RANGE_OPTIONS.map((option) => ({
          value: option,
          label: tDateRange(option),
        })),
        onChange: (next) => {
          if (
            next === DateRangeType.Day ||
            next === DateRangeType.Month ||
            next === DateRangeType.Year ||
            next === DateRangeType.AllTime
          ) {
            setAbsoluteRange(null);
            setDateRangeType(next);
          }
        },
      },
    });
    return () => setMobilePageChrome(null);
  }, [
    dateRangeOutOfView,
    dateRangeType,
    isMobile,
    setMobilePageChrome,
    tDateRange,
  ]);

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
  const canApplyPreviousPeriod = dateRangeType !== DateRangeType.AllTime;
  const applyPreviousPeriod = useCallback(() => {
    if (!canApplyPreviousPeriod) {
      return;
    }
    setAbsoluteRange((current) =>
      previousAbsoluteRange(dateRangeType, current),
    );
  }, [canApplyPreviousPeriod, dateRangeType]);

  function handleDateRangeTypeChange(next: DateRangeType) {
    setAbsoluteRange(null);
    setDateRangeType(next);
  }

  return (
    <div className="space-y-4">
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

      <div
        ref={dateRangeSentinelRef}
        className="-mx-3 border-b border-border/40 bg-background/90 px-3 py-2 backdrop-blur md:sticky md:top-14 md:z-20 md:-mx-5 md:px-5"
      >
        <DateRangeTypeSwitcher
          value={dateRangeType}
          onChange={handleDateRangeTypeChange}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        {dateRangeType !== DateRangeType.Day ? (
          <MoneyValueCard
            title={t("avgDailySpend")}
            loading={loading && !stats}
            amount={
              stats?.avgDailySpend ?? { amount: "0", currency: "RUB" }
            }
            amountClassName={
              Number(stats?.avgDailySpend?.amount ?? 0) > 0
                ? "text-rose-400"
                : undefined
            }
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
                onClick: canApplyPreviousPeriod
                  ? applyPreviousPeriod
                  : undefined,
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
        ) : null}
        {dateRangeType !== DateRangeType.AllTime ? (
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
            onPreviousPeriodClick={
              canApplyPreviousPeriod ? applyPreviousPeriod : undefined
            }
          />
        ) : null}
      </div>

      <TimelineWithDrilldown
        title={t("timelineIncomeSpending")}
        loading={loading && !stats}
        points={stats?.timeline ?? []}
        currency={stats?.displayCurrency ?? "RUB"}
        mode="dual"
        drilldownLayout="below"
      />

      <ActivityHeatmapCard
        title={tCharts("activity")}
        currency={stats?.displayCurrency ?? "RUB"}
        drilldownLayout="below"
      />

      <TopCategoriesCard
        title={t("spendingByCategory")}
        loading={loading && !stats}
        items={stats?.spendingByCategory ?? []}
        currency={stats?.displayCurrency ?? "RUB"}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <CategoryPieChart
          title={t("earningByCategory")}
          loading={loading && !stats}
          slices={stats?.earningByCategory ?? []}
          currency={stats?.displayCurrency ?? "RUB"}
          layout="stack"
        />
        <NetCashflowChart
          title={t("netCashflow")}
          loading={loading && !stats}
          currency={stats?.displayCurrency ?? "RUB"}
          points={stats?.timeline ?? []}
        />
      </div>

      <RecentTransactionsList
        dateRangeType={dateRangeType}
        startDate={absoluteRange?.startDate}
        endDate={absoluteRange?.endDate}
        periodTotalAmount={
          stats?.periodTotal ?? { amount: "0", currency: "RUB" }
        }
        periodTotalLoading={loading && !stats}
      />
    </div>
  );
}

function previousAbsoluteRange(
  dateRangeType: DateRangeType,
  current: AbsoluteRange | null,
): AbsoluteRange | null {
  if (dateRangeType === DateRangeType.AllTime) {
    return null;
  }
  const toKey = (date: Date) => format(date, "yyyy-MM-dd");
  if (current) {
    const start = new Date(`${current.startDate}T00:00:00`);
    const end = new Date(`${current.endDate}T00:00:00`);
    const length =
      Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return {
      startDate: toKey(subDays(start, length)),
      endDate: toKey(subDays(end, length)),
    };
  }
  const today = new Date();
  if (dateRangeType === DateRangeType.Day) {
    const date = subDays(today, 1);
    return {
      startDate: toKey(startOfDay(date)),
      endDate: toKey(endOfDay(date)),
    };
  }
  if (dateRangeType === DateRangeType.Month) {
    const date = subMonths(today, 1);
    return {
      startDate: toKey(startOfMonth(date)),
      endDate: toKey(endOfMonth(date)),
    };
  }
  const date = subYears(today, 1);
  return {
    startDate: toKey(startOfYear(date)),
    endDate: toKey(endOfYear(date)),
  };
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
