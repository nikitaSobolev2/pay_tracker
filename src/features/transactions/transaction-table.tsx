"use client";

import { Pencil, Trash2 } from "lucide-react";
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
import { formatMoney } from "@/lib/money";
import { useUiStore } from "@/stores/ui.store";
import { TransactionDebtRole, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TransactionTableProps = {
  items: TransactionDto[];
  loading?: boolean;
  loadingMore?: boolean;
  onChanged: () => void;
};

const SKELETON_ROWS = 5;

export function TransactionTable({
  items,
  loading = false,
  loadingMore = false,
  onChanged,
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
                <TableHead>{t("title")}</TableHead>
                <TableHead>{t("amount")}</TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("categories")}</TableHead>
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
                            {item.debtRole === TransactionDebtRole.Lend
                              ? `${t("toLend")}: ${item.counterpartyName ?? "—"}`
                              : null}
                            {item.debtRole === TransactionDebtRole.Borrow
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
                        {formatReadableDateTime(item.occurredAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.categories.map((category) => (
                            <span
                              key={category.id}
                              className="rounded-md bg-muted px-1.5 py-0.5 text-xs"
                            >
                              {category.path}
                            </span>
                          ))}
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
