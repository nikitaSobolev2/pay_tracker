"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/features/transactions/confirm-delete-dialog";
import { TransactionMobileList } from "@/features/transactions/transaction-mobile-list";
import { useIsMobile } from "@/hooks/use-mobile";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { Link } from "@/i18n/navigation";
import {
  bulkDeleteTransactions,
  deleteTransaction,
} from "@/lib/api/transactions";
import {
  formatLeafCategoryLabel,
  leafCategoriesOnly,
} from "@/lib/category-selection";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui.store";
import {
  SortDirection,
  TransactionKind,
  TransactionSortBy,
  TransactionType,
  type TransactionSortBy as TransactionSortByType,
  type SortDirection as SortDirectionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type TransactionTableSort = {
  readonly sortBy: TransactionSortByType;
  readonly sortDir: SortDirectionType;
} | null;

type TransactionTableProps = {
  items: TransactionDto[];
  loading?: boolean;
  loadingMore?: boolean;
  onChanged: () => void;
  onDateClick?: (date: string) => void;
  sort?: TransactionTableSort;
  onSortChange?: (sort: TransactionTableSort) => void;
};

const SKELETON_ROWS = 5;

export function TransactionTable({
  items,
  loading = false,
  loadingMore = false,
  onChanged,
  onDateClick,
  sort = null,
  onSortChange,
}: TransactionTableProps) {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const formatReadableDateTime = useReadableDateTime();
  const openEditTransactionModal = useUiStore(
    (state) => state.openEditTransactionModal,
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  function toggleSort(sortBy: TransactionSortByType) {
    if (!onSortChange) {
      return;
    }
    if (sort?.sortBy !== sortBy) {
      onSortChange({ sortBy, sortDir: SortDirection.Asc });
      return;
    }
    if (sort.sortDir === SortDirection.Asc) {
      onSortChange({ sortBy, sortDir: SortDirection.Desc });
      return;
    }
    onSortChange({ sortBy, sortDir: SortDirection.Asc });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? items.map((item) => item.id) : []);
  }

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
      onChanged();
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="flex items-center gap-2">
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

      {isMobile ? (
        <TransactionMobileList
          items={items}
          loading={loading}
          loadingMore={loadingMore}
          selected={selected}
          onToggleOne={toggleOne}
          onEnterSelection={enterSelection}
          onEdit={openEditTransactionModal}
          onSoftDeleted={(id) => {
            setSelected((prev) => prev.filter((item) => item !== id));
          }}
          onDateClick={onDateClick}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      items.length > 0 && selected.length === items.length
                    }
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                  />
                </TableHead>
                <SortableTableHead
                  label={t("title")}
                  sortBy={TransactionSortBy.Title}
                  sort={sort}
                  onToggle={toggleSort}
                  onClear={() => onSortChange?.(null)}
                  clearLabel={t("clearTableSort")}
                />
                <SortableTableHead
                  label={t("amount")}
                  sortBy={TransactionSortBy.Amount}
                  sort={sort}
                  onToggle={toggleSort}
                  onClear={() => onSortChange?.(null)}
                  clearLabel={t("clearTableSort")}
                />
                <SortableTableHead
                  label={t("date")}
                  sortBy={TransactionSortBy.Date}
                  sort={sort}
                  onToggle={toggleSort}
                  onClear={() => onSortChange?.(null)}
                  clearLabel={t("clearTableSort")}
                />
                <SortableTableHead
                  label={t("categories")}
                  sortBy={TransactionSortBy.Categories}
                  sort={sort}
                  onToggle={toggleSort}
                  onClear={() => onSortChange?.(null)}
                  clearLabel={t("clearTableSort")}
                />
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                    <TransactionSkeletonRow key={`skeleton-${index}`} />
                  ))
                : null}

              {!loading && items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    —
                  </TableCell>
                </TableRow>
              ) : null}

              {!loading
                ? items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Checkbox
                          className="size-5"
                          checked={selected.includes(item.id)}
                          onCheckedChange={() => toggleOne(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/transactions/${item.id}`}
                          className="block min-w-0 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <div className="font-medium">
                            {item.title ||
                              (item.type === TransactionType.Spending
                                ? t("spending")
                                : t("earning"))}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.kind === TransactionKind.Loan
                              ? `${t("toLend")}: ${item.counterpartyName ?? "—"}`
                              : null}
                            {item.kind === TransactionKind.Debt
                              ? `${t("toBorrow")}: ${item.counterpartyName ?? "—"}`
                              : null}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell
                        className={
                          item.type === TransactionType.Spending
                            ? "text-rose-400"
                            : "text-emerald-400"
                        }
                      >
                        {item.type === TransactionType.Spending ? "−" : "+"}
                        {formatMoney(item.displayAmount, item.displayCurrency)}
                        {item.inputCurrency !== item.displayCurrency ? (
                          <div className="text-xs text-muted-foreground">
                            {formatMoney(
                              item.originalAmount,
                              item.inputCurrency,
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => onDateClick?.(item.occurredAt.slice(0, 10))}
                          className="hover:underline"
                        >
                          {formatReadableDateTime(item.occurredAt)}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {leafCategoriesOnly(item.categories).map(
                            (category) => (
                              <Link
                                key={category.id}
                                href={`/categories/${category.id}`}
                                onClick={(event) => event.stopPropagation()}
                                className="rounded-md bg-muted px-1.5 py-0.5 text-xs"
                              >
                                {formatLeafCategoryLabel(category)}
                              </Link>
                            ),
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5"
                            onClick={() => openEditTransactionModal(item)}
                          >
                            <Pencil className="size-4" />
                            {tCommon("edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            onClick={() => requestDelete([item.id])}
                          >
                            <Trash2 className="size-4" />
                            {tCommon("delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                : null}

              {loadingMore
                ? Array.from({ length: 3 }, (_, index) => (
                    <TransactionSkeletonRow key={`more-${index}`} />
                  ))
                : null}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmOpen}
        count={pendingIds.length}
        loading={deleting}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function SortableTableHead({
  label,
  sortBy,
  sort,
  onToggle,
  onClear,
  clearLabel,
}: {
  readonly label: string;
  readonly sortBy: TransactionSortByType;
  readonly sort: TransactionTableSort;
  readonly onToggle: (sortBy: TransactionSortByType) => void;
  readonly onClear: () => void;
  readonly clearLabel: string;
}) {
  const active = sort?.sortBy === sortBy;
  return (
    <TableHead>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left font-medium transition-colors hover:bg-muted/60",
            active && "text-foreground",
          )}
          onClick={() => onToggle(sortBy)}
        >
          <span>{label}</span>
          {active ? (
            sort?.sortDir === SortDirection.Asc ? (
              <ArrowUp className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ArrowDown className="size-3.5 shrink-0" aria-hidden />
            )
          ) : null}
        </button>
        {active ? (
          <button
            type="button"
            className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            aria-label={clearLabel}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
    </TableHead>
  );
}

function TransactionSkeletonRow() {
  return (
    <TableRow>
      <TableCell className="w-10">
        <Skeleton className="size-5 rounded" />
      </TableCell>
      <TableCell>
        <div className="min-w-[8rem] space-y-2">
          <Skeleton className="h-4 w-28 sm:w-36" />
          <Skeleton className="h-3 w-16 sm:w-24" />
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20 sm:w-24" />
          <Skeleton className="h-3 w-14 sm:w-16" />
        </div>
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-24 sm:w-32" />
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-14 rounded-md" />
          <Skeleton className="hidden h-5 w-16 rounded-md sm:block" />
        </div>
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Skeleton className="h-9 w-20 rounded-md" />
          <Skeleton className="h-9 w-20 rounded-md" />
        </div>
      </TableCell>
    </TableRow>
  );
}
