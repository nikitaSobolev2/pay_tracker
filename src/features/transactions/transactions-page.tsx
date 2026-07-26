"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { Button } from "@/components/ui/button";
import { ActivityHeatmapCard } from "@/features/charts/activity-heatmap";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import {
  CurrencyBreakdownCard,
  MoneyValueCard,
  PeriodTotalsCard,
  TopCategoriesCard,
  VsPreviousPeriodCard,
} from "@/features/charts/money-summary-cards";
import { TimelineWithDrilldown } from "@/features/charts/timeline-with-drilldown";
import { MobileTransactionFiltersSheet } from "@/features/transactions/mobile-transaction-filters-sheet";
import {
  filterStatesEqual,
  filtersFromSearchParams,
  writeFiltersToSearchParams,
} from "@/features/transactions/transaction-filter-query";
import {
  datePresetToApiParams,
  filtersAreDefault,
  isSingleDayDatePreset,
  supportsPreviousPeriod,
  type DateFilterPreset,
} from "@/features/transactions/transaction-filter.types";
import {
  TransactionFilters,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filters";
import {
  TransactionTable,
  type TransactionTableSort,
} from "@/features/transactions/transaction-table";
import {
  transactionTypeFromSearchParam,
  transactionTypeToSearchParam,
  type TransactionTypeFilter,
} from "@/features/transactions/transaction-type-switcher";
import { useRouter } from "@/i18n/navigation";
import { fetchTransactionStats } from "@/lib/api/stats";
import { listTransactions } from "@/lib/api/transactions";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  ListPageStats,
  PeriodComparison,
} from "@/server/services/stats-service.types";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";
import { DateRangeType, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

const PAGE_SIZE = 20;

/** Preferred ~336px card width; can grow, wraps before crushing big amounts. */
const SUMMARY_CARD_SHELL =
  "w-full min-w-0 flex-1 basis-full transition-[flex-grow,flex-basis,max-width,opacity,min-width] duration-500 ease-out md:min-w-[21rem] md:basis-[21rem]";

const EMPTY_COMPARISON: PeriodComparison = {
  current: { amount: "0", currency: "RUB" },
  previous: null,
  deltaAmount: null,
  deltaPercent: null,
};

export function TransactionsPage() {
  const t = useTranslations("stats");
  const tHome = useTranslations("home");
  const tCharts = useTranslations("charts");
  const tTransaction = useTranslations("transaction");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeFilter = transactionTypeFromSearchParam(searchParams.get("type"));
  const pageType =
    typeFilter === "all" ? undefined : (typeFilter as TransactionType);

  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    filtersFromSearchParams(searchParams),
  );
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ListPageStats | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [restorableDatePreset, setRestorableDatePreset] =
    useState<DateFilterPreset | null>(null);
  const [tableSort, setTableSort] = useState<TransactionTableSort>(null);

  const filtersBlockRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestLockRef = useRef(false);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);

  const hasMore = items.length < total;
  hasMoreRef.current = hasMore;
  pageRef.current = page;

  const filtersActive = !filtersAreDefault(filters);

  const queryBase = useMemo(() => {
    const dateParams = datePresetToApiParams(filters.datePreset);
    return {
      ...dateParams,
      type: pageType,
      kinds: filters.kinds.length ? filters.kinds : undefined,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      counterpartyIds: filters.counterpartyIds.length
        ? filters.counterpartyIds
        : undefined,
      hideUncategorized: filters.hideUncategorized ? true : undefined,
      sortBy: tableSort?.sortBy,
      sortDir: tableSort?.sortDir,
    };
  }, [filters, pageType, tableSort]);

  const showVsPrevious = supportsPreviousPeriod(filters.datePreset);
  const showAvgPerDay = !isSingleDayDatePreset(filters.datePreset);
  const previousDateRange = previousDateRangeFor(filters.datePreset);
  const applyPreviousPeriod = useCallback(() => {
    if (!previousDateRange) {
      return;
    }
    setFilters((current) => ({
      ...current,
      datePreset: {
        kind: "absolute",
        startDate: previousDateRange.startDate,
        endDate: previousDateRange.endDate,
      },
    }));
  }, [previousDateRange]);

  const heatmapFilters = useMemo(
    () => ({
      type: pageType,
      kinds: filters.kinds.length ? filters.kinds : undefined,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      counterpartyIds: filters.counterpartyIds.length
        ? filters.counterpartyIds
        : undefined,
      hideUncategorized: filters.hideUncategorized ? true : undefined,
    }),
    [pageType, filters],
  );

  useEffect(() => {
    const fromUrl = filtersFromSearchParams(searchParams);
    setFilters((current) =>
      filterStatesEqual(current, fromUrl) ? current : fromUrl,
    );
  }, [searchParams]);

  useEffect(() => {
    const params = buildTransactionsSearchParams(typeFilter, filters);
    if (searchParamsMatch(searchParams, params)) {
      return;
    }
    const query = params.toString();
    router.replace(query ? `/transactions?${query}` : "/transactions");
  }, [filters, typeFilter, router, searchParams]);

  const setTypeFilter = useCallback(
    (next: TransactionTypeFilter) => {
      const nextFilters: TransactionFilterState = {
        ...filters,
        categoryIds: [],
      };
      setFilters((current) =>
        current.categoryIds.length === 0 ? current : nextFilters,
      );
      const params = buildTransactionsSearchParams(next, nextFilters);
      const query = params.toString();
      router.replace(query ? `/transactions?${query}` : "/transactions");
    },
    [filters, router],
  );

  const setMobilePageChrome = useMobilePageChromeStore((state) => state.setChrome);

  const restoreDateFilter = useCallback(() => {
    if (!restorableDatePreset) {
      return;
    }
    setFilters((current) => ({
      ...current,
      datePreset: restorableDatePreset,
    }));
    setRestorableDatePreset(null);
  }, [restorableDatePreset]);

  useEffect(() => {
    setMobilePageChrome({
      typeFilter: {
        value: typeFilter,
        onChange: setTypeFilter,
      },
      action: {
        kind: "filters",
        active: filtersActive,
        onClick: () => setFiltersModalOpen(true),
        label: tTransaction("filters"),
      },
      backAction: restorableDatePreset
        ? {
            onClick: restoreDateFilter,
            label: tTransaction("getBack"),
          }
        : undefined,
    });
    return () => setMobilePageChrome(null);
  }, [
    filtersActive,
    restorableDatePreset,
    restoreDateFilter,
    setMobilePageChrome,
    setTypeFilter,
    tTransaction,
    typeFilter,
  ]);

  const reloadFirstPage = useCallback(async () => {
    requestLockRef.current = true;
    setInitialLoading(true);
    setLoadingMore(false);
    setLoadingStats(true);
    setItems([]);
    setPage(0);
    setTotal(0);

    try {
      const [list, nextStats] = await Promise.all([
        listTransactions({ ...queryBase, page: 1, pageSize: PAGE_SIZE }),
        fetchTransactionStats(queryBase),
      ]);
      setItems(list.items);
      setPage(list.page);
      setTotal(list.total);
      setStats(nextStats);
    } finally {
      setInitialLoading(false);
      setLoadingStats(false);
      requestLockRef.current = false;
    }
  }, [queryBase]);

  useEffect(() => {
    void reloadFirstPage();
  }, [reloadFirstPage]);

  useEffect(() => {
    function onChanged() {
      void reloadFirstPage();
    }
    window.addEventListener("paytracker:transactions-changed", onChanged);
    return () => {
      window.removeEventListener("paytracker:transactions-changed", onChanged);
    };
  }, [reloadFirstPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || initialLoading) {
      return;
    }

    async function loadNextPage() {
      if (requestLockRef.current || !hasMoreRef.current) {
        return;
      }
      const nextPage = pageRef.current + 1;
      requestLockRef.current = true;
      setLoadingMore(true);
      try {
        const result = await listTransactions({
          ...queryBase,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setItems((current) => appendUniqueTransactions(current, result.items));
        setPage(result.page);
        setTotal(result.total);
      } finally {
        setLoadingMore(false);
        requestLockRef.current = false;
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage();
        }
      },
      { root: null, rootMargin: "280px 0px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [queryBase, initialLoading, hasMore]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {tNav("transactions")}
        </h1>
      </header>

      <div
        ref={filtersBlockRef}
        className="hidden -mx-3 space-y-3 border-b border-border/40 bg-background/90 px-3 py-3 backdrop-blur md:sticky md:top-14 md:z-20 md:-mx-6 md:block md:px-6"
      >
        <TransactionFilters
          pageType={pageType}
          value={filters}
          onChange={(next) => {
            setRestorableDatePreset(null);
            setFilters(next);
          }}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
      </div>

      <MobileTransactionFiltersSheet
        open={filtersModalOpen}
        onOpenChange={setFiltersModalOpen}
        pageType={pageType}
        value={filters}
        onChange={(next) => {
          setRestorableDatePreset(null);
          setFilters(next);
        }}
      />

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-stretch">
        <div className={SUMMARY_CARD_SHELL}>
          <PeriodTotalsCard
            loading={loadingStats}
            stats={
              stats?.periodTotals ?? {
                count: 0,
                spending: { amount: "0", currency: "RUB" },
                earning: { amount: "0", currency: "RUB" },
                net: { amount: "0", currency: "RUB" },
                total: { amount: "0", currency: "RUB" },
              }
            }
            comparison={
              stats?.vsPreviousPeriod ?? {
                current: { amount: "0", currency: "RUB" },
                previous: null,
                deltaAmount: null,
                deltaPercent: null,
              }
            }
            hideComparison={!showVsPrevious}
          />
        </div>
        <div className={SUMMARY_CARD_SHELL}>
          <MoneyValueCard
            title={t("avgPerTx")}
            loading={loadingStats}
            amount={
              stats?.avgPerTransaction ?? { amount: "0", currency: "RUB" }
            }
            comparison={
              stats?.avgPerTransactionVsPrevious ?? EMPTY_COMPARISON
            }
            comparisonSense="lowerIsBetter"
            hideComparison={!showVsPrevious}
            details={
              showVsPrevious
                ? avgComparisonDetails(
                    stats?.avgPerTransactionVsPrevious ?? EMPTY_COMPARISON,
                    tHome("previousPeriod"),
                    tHome("change"),
                    previousDateRange ? applyPreviousPeriod : undefined,
                  )
                : undefined
            }
          />
        </div>
        <div
          className={cn(
            "transition-[flex-grow,flex-basis,max-width,opacity,min-width] duration-500 ease-out",
            showAvgPerDay
              ? SUMMARY_CARD_SHELL
              : "pointer-events-none max-h-0 min-w-0 flex-[0_0_0%] basis-0 overflow-hidden opacity-0 md:max-h-none",
          )}
        >
          <MoneyValueCard
            title={t("avgPerDay")}
            loading={loadingStats}
            amount={stats?.avgPerDay ?? { amount: "0", currency: "RUB" }}
            comparison={stats?.avgPerDayVsPrevious ?? EMPTY_COMPARISON}
            comparisonSense="lowerIsBetter"
            hideComparison={!showVsPrevious}
            details={
              showVsPrevious
                ? avgComparisonDetails(
                    stats?.avgPerDayVsPrevious ?? EMPTY_COMPARISON,
                    tHome("previousPeriod"),
                    tHome("change"),
                    previousDateRange ? applyPreviousPeriod : undefined,
                  )
                : undefined
            }
          />
        </div>
        <div
          className={cn(
            "transition-[flex-grow,flex-basis,max-width,opacity,min-width] duration-500 ease-out",
            showVsPrevious
              ? SUMMARY_CARD_SHELL
              : "pointer-events-none max-h-0 min-w-0 flex-[0_0_0%] basis-0 overflow-hidden opacity-0 md:max-h-none",
          )}
        >
          <VsPreviousPeriodCard
            title={tHome("vsPrevious")}
            loading={loadingStats}
            comparison={
              stats?.vsPreviousPeriod ?? {
                current: { amount: "0", currency: "RUB" },
                previous: null,
                deltaAmount: null,
                deltaPercent: null,
              }
            }
            dateRangeType={stats?.dateRangeType ?? DateRangeType.Month}
            onPreviousPeriodClick={
              previousDateRange ? applyPreviousPeriod : undefined
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
        <div className="min-w-0">
          <TopCategoriesCard
            title={categoryChartTitle(typeFilter, t, tHome)}
            description={
              typeFilter === "all" ? t("topCategoriesMixedHint") : undefined
            }
            loading={loadingStats}
            items={stats?.topCategories ?? []}
            currency={stats?.displayCurrency ?? "RUB"}
            showTypeHints={typeFilter === "all"}
            className="h-full"
          />
        </div>
        <div className="min-w-0">
          <CategoryPieChart
            title={
              typeFilter === "all"
                ? t("categoryShare")
                : categoryChartTitle(typeFilter, t, tHome)
            }
            description={
              typeFilter === "all" ? t("categoryShareMixedHint") : undefined
            }
            loading={loadingStats}
            slices={stats?.categoryPie ?? []}
            currency={stats?.displayCurrency ?? "RUB"}
            layout="stack"
            showTypeHints={typeFilter === "all"}
            className="h-full"
          />
        </div>
      </div>

      <TimelineWithDrilldown
        title={
          typeFilter === "all"
            ? t("timelineIncomeSpending")
            : tHome("timeline")
        }
        loading={loadingStats}
        points={stats?.timeline ?? []}
        currency={stats?.displayCurrency ?? "RUB"}
        mode={timelineModeForFilter(typeFilter)}
        filters={heatmapFilters}
      />

      <ActivityHeatmapCard
        title={tCharts("activity")}
        currency={stats?.displayCurrency ?? "RUB"}
        filters={heatmapFilters}
      />

      {stats?.hasMultipleCurrencies && stats.currencyBreakdown ? (
        <CurrencyBreakdownCard
          title={t("currencyBreakdown")}
          loading={loadingStats}
          items={stats.currencyBreakdown}
        />
      ) : null}

      <TransactionTable
        items={items}
        loading={initialLoading}
        loadingMore={loadingMore}
        onChanged={() => void reloadFirstPage()}
        sort={tableSort}
        onSortChange={setTableSort}
        onDateClick={(date) =>
          setFilters((current) => {
            setRestorableDatePreset(current.datePreset);
            return {
              ...current,
              datePreset: {
                kind: "absolute",
                startDate: date,
                endDate: date,
              },
            };
          })
        }
      />
      <div ref={sentinelRef} className="h-6 w-full" aria-hidden={!hasMore} />

      {restorableDatePreset ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-center md:flex">
          <Button
            type="button"
            className="pointer-events-auto rounded-full px-6 shadow-lg"
            onClick={restoreDateFilter}
          >
            {tTransaction("getBack")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function previousDateRangeFor(
  preset: TransactionFilterState["datePreset"],
): { startDate: string; endDate: string } | null {
  const today = new Date();
  const toKey = (date: Date) => format(date, "yyyy-MM-dd");
  if (preset.kind === "all_time") return null;
  if (preset.kind === "calendar") {
    if (preset.range === DateRangeType.Day) {
      const date = subDays(today, 1);
      return { startDate: toKey(startOfDay(date)), endDate: toKey(endOfDay(date)) };
    }
    if (preset.range === DateRangeType.Month) {
      const date = subMonths(today, 1);
      return { startDate: toKey(startOfMonth(date)), endDate: toKey(endOfMonth(date)) };
    }
    const date = subYears(today, 1);
    return { startDate: toKey(startOfYear(date)), endDate: toKey(endOfYear(date)) };
  }
  if (preset.kind === "absolute") {
    const start = new Date(`${preset.startDate}T00:00:00`);
    const end = new Date(`${preset.endDate}T00:00:00`);
    const length = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    return {
      startDate: toKey(subDays(start, length)),
      endDate: toKey(subDays(end, length)),
    };
  }
  const end = subDays(today, preset.n);
  if (preset.unit === "days") {
    return { startDate: toKey(subDays(end, preset.n - 1)), endDate: toKey(end) };
  }
  if (preset.unit === "months") {
    return { startDate: toKey(startOfMonth(subMonths(end, preset.n - 1))), endDate: toKey(endOfMonth(end)) };
  }
  return { startDate: toKey(startOfYear(subYears(end, preset.n - 1))), endDate: toKey(endOfYear(end)) };
}

function categoryChartTitle(
  typeFilter: TransactionTypeFilter,
  t: (key: "topCategoriesMixed") => string,
  tHome: (key: "earningByCategory" | "spendingByCategory") => string,
): string {
  if (typeFilter === "all") {
    return t("topCategoriesMixed");
  }
  if (typeFilter === TransactionType.Earning) {
    return tHome("earningByCategory");
  }
  return tHome("spendingByCategory");
}

function timelineModeForFilter(
  typeFilter: TransactionTypeFilter,
): "dual" | "earning" | "spending" {
  if (typeFilter === "all") {
    return "dual";
  }
  if (typeFilter === TransactionType.Earning) {
    return "earning";
  }
  return "spending";
}

function buildTransactionsSearchParams(
  typeFilter: TransactionTypeFilter,
  filters: TransactionFilterState,
): URLSearchParams {
  const params = new URLSearchParams();
  const typeParam = transactionTypeToSearchParam(typeFilter);
  if (typeParam) {
    params.set("type", typeParam);
  }
  writeFiltersToSearchParams(params, filters);
  return params;
}

function searchParamsMatch(
  current: Pick<URLSearchParams, "get">,
  desired: Pick<URLSearchParams, "get">,
): boolean {
  const currentType = transactionTypeFromSearchParam(current.get("type"));
  const desiredType = transactionTypeFromSearchParam(desired.get("type"));
  if (currentType !== desiredType) {
    return false;
  }
  return filterStatesEqual(
    filtersFromSearchParams(current),
    filtersFromSearchParams(desired),
  );
}

function appendUniqueTransactions(
  current: TransactionDto[],
  incoming: TransactionDto[],
): TransactionDto[] {
  const seen = new Set(current.map((item) => item.id));
  const appended = incoming.filter((item) => !seen.has(item.id));
  return [...current, ...appended];
}

function avgComparisonDetails(
  comparison: PeriodComparison,
  previousPeriodLabel: string,
  changeLabel: string,
  onPreviousPeriodClick?: () => void,
): Array<{
  readonly label: string;
  readonly value: string;
  readonly valueClassName?: string;
  readonly onClick?: () => void;
}> {
  return [
    {
      label: previousPeriodLabel,
      value: comparison.previous
        ? formatChartMoney(
            comparison.previous.amount,
            comparison.previous.currency,
          )
        : "—",
      onClick: onPreviousPeriodClick,
    },
    {
      label: changeLabel,
      value:
        comparison.deltaAmount != null
          ? formatChartMoney(
              comparison.deltaAmount,
              comparison.current.currency,
            )
          : "—",
      valueClassName: avgChangeClassName(comparison.deltaAmount),
    },
  ];
}

function avgChangeClassName(deltaAmount: string | null): string | undefined {
  if (deltaAmount == null) {
    return undefined;
  }
  const delta = Number(deltaAmount);
  if (!Number.isFinite(delta) || delta === 0) {
    return undefined;
  }
  return delta > 0 ? "text-rose-400" : "text-emerald-400";
}
