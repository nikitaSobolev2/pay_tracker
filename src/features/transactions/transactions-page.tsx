"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActivityHeatmapCard } from "@/features/charts/activity-heatmap";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import {
  CurrencyBreakdownCard,
  MoneyValueCard,
  PeriodTotalsCard,
  TopCategoriesCard,
  VsPreviousPeriodCard,
} from "@/features/charts/money-summary-cards";
import { TimelineChart } from "@/features/charts/timeline-chart";
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
} from "@/features/transactions/transaction-filter.types";
import {
  TransactionFilters,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filters";
import { TransactionTable } from "@/features/transactions/transaction-table";
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
      debtRoles: filters.debtRoles.length ? filters.debtRoles : undefined,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      counterpartyIds: filters.counterpartyIds.length
        ? filters.counterpartyIds
        : undefined,
      hideUncategorized: filters.hideUncategorized ? true : undefined,
    };
  }, [filters, pageType]);

  const showVsPrevious = supportsPreviousPeriod(filters.datePreset);
  const showAvgPerDay = !isSingleDayDatePreset(filters.datePreset);

  const heatmapFilters = useMemo(
    () => ({
      type: pageType,
      debtRoles: filters.debtRoles.length ? filters.debtRoles : undefined,
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
    });
    return () => setMobilePageChrome(null);
  }, [
    filtersActive,
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
          onChange={setFilters}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
        />
      </div>

      <MobileTransactionFiltersSheet
        open={filtersModalOpen}
        onOpenChange={setFiltersModalOpen}
        pageType={pageType}
        value={filters}
        onChange={setFilters}
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
                ? periodComparisonDetails(
                    stats?.avgPerTransactionVsPrevious ?? EMPTY_COMPARISON,
                    tHome("thisPeriod"),
                    tHome("previousPeriod"),
                  )
                : undefined
            }
          />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-[flex-grow,flex-basis,max-width,opacity,min-width] duration-500 ease-out",
            showAvgPerDay
              ? SUMMARY_CARD_SHELL
              : "pointer-events-none max-h-0 min-w-0 flex-[0_0_0%] basis-0 opacity-0 md:max-h-none",
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
                ? periodComparisonDetails(
                    stats?.avgPerDayVsPrevious ?? EMPTY_COMPARISON,
                    tHome("thisPeriod"),
                    tHome("previousPeriod"),
                  )
                : undefined
            }
          />
        </div>
        <div
          className={cn(
            "overflow-hidden transition-[flex-grow,flex-basis,max-width,opacity,min-width] duration-500 ease-out",
            showVsPrevious
              ? SUMMARY_CARD_SHELL
              : "pointer-events-none max-h-0 min-w-0 flex-[0_0_0%] basis-0 opacity-0 md:max-h-none",
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
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 lg:items-stretch">
        <div className="min-w-0 lg:col-span-1">
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
        <div className="min-w-0 lg:col-span-1">
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
        <div className="min-w-0 lg:col-span-2">
          <TimelineChart
            title={
              typeFilter === "all"
                ? t("timelineIncomeSpending")
                : tHome("timeline")
            }
            loading={loadingStats}
            points={stats?.timeline ?? []}
            currency={stats?.displayCurrency ?? "RUB"}
            mode={timelineModeForFilter(typeFilter)}
            className="h-full min-w-0"
          />
        </div>
      </div>

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
      />
      <div ref={sentinelRef} className="h-6 w-full" aria-hidden={!hasMore} />
    </div>
  );
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

function periodComparisonDetails(
  comparison: PeriodComparison,
  thisPeriodLabel: string,
  previousPeriodLabel: string,
): Array<{ readonly label: string; readonly value: string }> {
  return [
    {
      label: thisPeriodLabel,
      value: formatChartMoney(
        comparison.current.amount,
        comparison.current.currency,
      ),
    },
    {
      label: previousPeriodLabel,
      value: comparison.previous
        ? formatChartMoney(
            comparison.previous.amount,
            comparison.previous.currency,
          )
        : "—",
    },
  ];
}
