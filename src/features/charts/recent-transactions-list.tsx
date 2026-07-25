"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { Link } from "@/i18n/navigation";
import { listTransactions } from "@/lib/api/transactions";
import { formatChartMoney, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MoneyAmount } from "@/server/services/stats-service.types";
import { DateRangeType, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

const PAGE_SIZE = 10;
const SKELETON_COUNT = 3;

type RecentTransactionsListProps = {
  readonly dateRangeType: DateRangeType;
  readonly periodTotalAmount: MoneyAmount;
  readonly periodTotalLoading?: boolean;
};

export function RecentTransactionsList({
  dateRangeType,
  periodTotalAmount,
  periodTotalLoading = false,
}: RecentTransactionsListProps) {
  const t = useTranslations("home");
  const tTx = useTranslations("transaction");
  const formatReadableDateTime = useReadableDateTime();

  const [items, setItems] = useState<TransactionDto[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestLockRef = useRef(false);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);

  const hasMore = items.length < total;
  hasMoreRef.current = hasMore;
  pageRef.current = page;

  useEffect(() => {
    let cancelled = false;

    async function loadFirstPage() {
      requestLockRef.current = true;
      setInitialLoading(true);
      setLoadingMore(false);
      setError(null);
      setItems([]);
      setPage(0);
      setTotal(0);

      try {
        const result = await listTransactions({
          dateRangeType,
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) {
          return;
        }
        setItems(result.items);
        setPage(result.page);
        setTotal(result.total);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load transactions",
          );
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
        requestLockRef.current = false;
      }
    }

    loadFirstPage();

    function onTransactionsChanged() {
      loadFirstPage();
    }
    window.addEventListener(
      "paytracker:transactions-changed",
      onTransactionsChanged,
    );

    return () => {
      cancelled = true;
      window.removeEventListener(
        "paytracker:transactions-changed",
        onTransactionsChanged,
      );
    };
  }, [dateRangeType]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    async function loadNextPage() {
      if (requestLockRef.current || !hasMoreRef.current) {
        return;
      }

      const nextPage = pageRef.current + 1;
      requestLockRef.current = true;
      setLoadingMore(true);
      setError(null);

      try {
        const result = await listTransactions({
          dateRangeType,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setItems((current) => appendUniqueTransactions(current, result.items));
        setPage(result.page);
        setTotal(result.total);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load transactions",
        );
      } finally {
        setLoadingMore(false);
        requestLockRef.current = false;
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadNextPage();
        }
      },
      { root: null, rootMargin: "240px 0px", threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dateRangeType, hasMore, initialLoading]);

  return (
    <StatCard
      title={t("recent")}
      description={t("recentPeriodActivity")}
      loading={initialLoading}
      skeleton={
        <ul className="divide-y divide-border/50">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <RecentTransactionSkeleton key={`skeleton-${index}`} />
          ))}
        </ul>
      }
      action={
        periodTotalLoading ? (
          <div className="space-y-1 text-right">
            <Skeleton className="ml-auto h-3 w-16" />
            <Skeleton className="ml-auto h-6 w-24" />
          </div>
        ) : (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t("periodTotal")}</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums md:text-xl",
                Number(periodTotalAmount.amount) > 0 && "text-emerald-400",
                Number(periodTotalAmount.amount) < 0 && "text-rose-400",
              )}
            >
              {formatChartMoney(
                periodTotalAmount.amount,
                periodTotalAmount.currency,
              )}
            </p>
          </div>
        )
      }
    >
      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : null}

      {!initialLoading && items.length === 0 && !error ? (
        <div className="text-sm text-muted-foreground">
          No recent transactions
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="divide-y divide-border/50">
          {items.map((item) => (
            <li key={item.id} className="first:pt-0 last:pb-0">
              <Link
                href={`/transactions/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-lg py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <div
                    className={cn(
                      "truncate text-sm font-medium",
                      item.type === TransactionType.Spending
                        ? "text-rose-400"
                        : "text-emerald-400",
                    )}
                  >
                    {item.title ||
                      (item.type === TransactionType.Spending
                        ? tTx("spending")
                        : tTx("earning"))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatReadableDateTime(item.occurredAt)}
                  </div>
                </div>
                <div
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    item.type === TransactionType.Spending
                      ? "text-rose-400"
                      : "text-emerald-400",
                  )}
                >
                  {item.type === TransactionType.Spending ? "−" : "+"}
                  {formatMoney(item.displayAmount, item.displayCurrency)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {loadingMore ? (
        <ul className="mt-1 divide-y divide-border/50 border-t border-border/50">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <RecentTransactionSkeleton key={`skeleton-${index}`} />
          ))}
        </ul>
      ) : null}

      <div
        ref={sentinelRef}
        className="h-4 w-full"
        aria-hidden={!hasMore}
      />
    </StatCard>
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

function RecentTransactionSkeleton() {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-36 max-w-[55%]" />
        <Skeleton className="h-3 w-24 max-w-[40%]" />
      </div>
      <Skeleton className="h-4 w-16 shrink-0 sm:w-20" />
    </li>
  );
}
