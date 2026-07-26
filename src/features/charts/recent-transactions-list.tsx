"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import { ConfirmDeleteDialog } from "@/features/transactions/confirm-delete-dialog";
import { TransactionMobileList } from "@/features/transactions/transaction-mobile-list";
import {
  bulkDeleteTransactions,
  deleteTransaction,
  listTransactions,
} from "@/lib/api/transactions";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MoneyAmount } from "@/server/services/stats-service.types";
import { useUiStore } from "@/stores/ui.store";
import { DateRangeType } from "@/types/enums";
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
  const tCommon = useTranslations("common");
  const openEditTransactionModal = useUiStore(
    (state) => state.openEditTransactionModal,
  );

  const [items, setItems] = useState<TransactionDto[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestLockRef = useRef(false);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(false);

  const hasMore = items.length < total;
  hasMoreRef.current = hasMore;
  pageRef.current = page;

  const reloadFirstPage = useCallback(async () => {
    requestLockRef.current = true;
    setInitialLoading(true);
    setLoadingMore(false);
    setError(null);
    setItems([]);
    setPage(0);
    setTotal(0);
    setSelected([]);

    try {
      const result = await listTransactions({
        dateRangeType,
        page: 1,
        pageSize: PAGE_SIZE,
      });
      setItems(result.items);
      setPage(result.page);
      setTotal(result.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load transactions",
      );
    } finally {
      setInitialLoading(false);
      requestLockRef.current = false;
    }
  }, [dateRangeType]);

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
      setSelected([]);

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
      void reloadFirstPage();
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
  }, [dateRangeType, reloadFirstPage]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || initialLoading) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry?.isIntersecting ||
          !hasMoreRef.current ||
          requestLockRef.current
        ) {
          return;
        }

        const nextPage = pageRef.current + 1;
        requestLockRef.current = true;
        setLoadingMore(true);

        listTransactions({
          dateRangeType,
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
          .then((result) => {
            setItems((current) =>
              appendUniqueTransactions(current, result.items),
            );
            setPage(result.page);
            setTotal(result.total);
          })
          .catch((loadError) => {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Failed to load transactions",
            );
          })
          .finally(() => {
            setLoadingMore(false);
            requestLockRef.current = false;
          });
      },
      { rootMargin: "120px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [dateRangeType, initialLoading]);

  function toggleOne(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  const enterSelection = useCallback((id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  function requestDelete(ids: string[]) {
    setPendingIds(ids);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      if (pendingIds.length === 1) {
        await deleteTransaction(pendingIds[0]!);
      } else {
        await bulkDeleteTransactions(pendingIds);
      }
      setSelected([]);
      setConfirmOpen(false);
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Delete failed",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <StatCard
      title={t("recent")}
      loading={initialLoading}
      skeleton={
        <TransactionMobileList
          items={[]}
          loading
          selected={[]}
          onToggleOne={() => undefined}
          onEnterSelection={() => undefined}
          onEdit={() => undefined}
          variant="plain"
          skeletonCount={SKELETON_COUNT}
        />
      }
      action={
        periodTotalLoading ? (
          <div className="text-right">
            <Skeleton className="ml-auto h-3 w-16" />
            <Skeleton className="mt-1 ml-auto h-5 w-24" />
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

      {selected.length > 0 ? (
        <div className="mb-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={() => requestDelete(selected)}
          >
            <Trash2 data-icon="inline-start" />
            {tCommon("delete")} ({selected.length})
          </Button>
        </div>
      ) : null}

      {!initialLoading && items.length === 0 && !error ? (
        <div className="text-sm text-muted-foreground">{t("noRecent")}</div>
      ) : null}

      {items.length > 0 || loadingMore ? (
        <TransactionMobileList
          items={items}
          loadingMore={loadingMore}
          selected={selected}
          onToggleOne={toggleOne}
          onEnterSelection={enterSelection}
          onEdit={openEditTransactionModal}
          onSoftDeleted={(id) => {
            setSelected((prev) => prev.filter((item) => item !== id));
          }}
          variant="plain"
          emptyLabel={t("noRecent")}
        />
      ) : null}

      <div
        ref={sentinelRef}
        className="h-4 w-full"
        aria-hidden={!hasMore}
      />

      <ConfirmDeleteDialog
        open={confirmOpen}
        count={pendingIds.length}
        loading={deleting}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void confirmDelete()}
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
