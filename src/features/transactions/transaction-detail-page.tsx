"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { NamedAmountBars } from "@/features/charts/named-amount-bars";
import { TimelineChart } from "@/features/charts/timeline-chart";
import { ConfirmDeleteDialog } from "@/features/transactions/confirm-delete-dialog";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { Link, useRouter } from "@/i18n/navigation";
import { fetchTransactionContext } from "@/lib/api/stats";
import { deleteTransaction } from "@/lib/api/transactions";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategoryDetailStats } from "@/server/services/detail-stats-service.types";
import { useUiStore } from "@/stores/ui.store";
import { TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TransactionDetailPageProps = {
  readonly transactionId: string;
};

export function TransactionDetailPage({
  transactionId,
}: TransactionDetailPageProps) {
  const t = useTranslations("transactionDetail");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const formatReadableDate = useReadableDateTime();
  const openEdit = useUiStore((state) => state.openEditTransactionModal);
  const [transaction, setTransaction] = useState<TransactionDto | null>(null);
  const [categoryStats, setCategoryStats] =
    useState<CategoryDetailStats | null>(null);
  const [related, setRelated] = useState<TransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchTransactionContext(transactionId);
      setTransaction(payload.transaction);
      setCategoryStats(payload.categoryStats);
      setRelated(payload.relatedTransactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notFound"));
      setTransaction(null);
    } finally {
      setLoading(false);
    }
  }, [t, transactionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onChanged() {
      void load();
    }
    window.addEventListener("paytracker:transactions-changed", onChanged);
    return () =>
      window.removeEventListener("paytracker:transactions-changed", onChanged);
  }, [load]);

  async function handleDelete() {
    if (!transaction) {
      return;
    }
    setDeleting(true);
    try {
      await deleteTransaction(transaction.id);
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
      router.push("/transactions");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notFound"));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-lg text-muted-foreground">{t("notFound")}</p>
        <Button className="mt-4" onClick={() => router.push("/transactions")}>
          {tNav("transactions")}
        </Button>
      </div>
    );
  }

  const isSpending = transaction.type === TransactionType.Spending;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("title")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {transaction.title || "—"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => openEdit(transaction)}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
          <Button
            variant="destructive"
            className="h-11 rounded-xl"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            {t("delete")}
          </Button>
        </div>
      </header>

      <Card className="rounded-2xl border-border/60 bg-card/50 shadow-none">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("amount")}</p>
            <p
              className={cn(
                "mt-2 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl",
                isSpending ? "text-rose-400" : "text-emerald-400",
              )}
            >
              {formatMoney(
                transaction.displayAmount,
                transaction.displayCurrency,
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("type")}</p>
            <Badge className="mt-3 rounded-full px-3 py-1 text-sm">
              {isSpending ? tNav("spendings") : tNav("earnings")}
            </Badge>
            <p className="mt-4 text-sm text-muted-foreground">{t("date")}</p>
            <p className="mt-1 text-lg font-medium">
              {formatReadableDate(transaction.occurredAt)}
            </p>
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">{t("original")}</p>
              <p className="mt-1 text-lg font-medium tabular-nums">
                {formatMoney(
                  transaction.originalAmount,
                  transaction.inputCurrency,
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t("rate")}</p>
              <p className="mt-1 text-lg font-medium tabular-nums">
                {transaction.rateToRub}
              </p>
            </div>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <p className="text-sm text-muted-foreground">{t("categories")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {transaction.categories.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                transaction.categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/categories?id=${category.id}`}
                    className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm hover:bg-muted"
                  >
                    {category.path}
                  </Link>
                ))
              )}
            </div>
          </div>
          {transaction.counterpartyName ? (
            <div>
              <p className="text-sm text-muted-foreground">
                {t("counterparty")}
              </p>
              {transaction.counterpartyId ? (
                <Link
                  href={`/debts/${transaction.counterpartyId}`}
                  className="mt-1 inline-block text-lg font-medium underline-offset-4 hover:underline"
                >
                  {transaction.counterpartyName}
                </Link>
              ) : (
                <p className="mt-1 text-lg font-medium">
                  {transaction.counterpartyName}
                </p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {categoryStats ? (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label={t("thisMonth")}
              value={formatMoney(
                categoryStats.thisMonth.amount,
                categoryStats.thisMonth.currency,
              )}
            />
            <MetricCard
              label={t("lastMonth")}
              value={formatMoney(
                categoryStats.lastMonth.amount,
                categoryStats.lastMonth.currency,
              )}
            />
            <MetricCard
              label={t("momDelta")}
              value={
                categoryStats.momDeltaPercent === null
                  ? "—"
                  : `${categoryStats.momDeltaPercent >= 0 ? "+" : ""}${categoryStats.momDeltaPercent.toFixed(0)}%`
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TimelineChart
              title={t("categoryTimeline")}
              points={categoryStats.timeline}
              currency={categoryStats.currency}
            />
            {categoryStats.parentTimeline.length > 0 ? (
              <TimelineChart
                title={t("parentTimeline")}
                description={categoryStats.parentPath ?? undefined}
                points={categoryStats.parentTimeline}
                currency={categoryStats.currency}
              />
            ) : null}
            <NamedAmountBars
              title={t("parentShare")}
              items={categoryStats.siblingShares}
              currency={categoryStats.currency}
            />
            <NamedAmountBars
              title={t("childrenBreakdown")}
              items={categoryStats.childrenBreakdown}
              currency={categoryStats.currency}
            />
            <NamedAmountBars
              title={t("topCounterparties")}
              items={categoryStats.topCounterparties}
              currency={categoryStats.currency}
            />
          </div>
        </section>
      ) : (
        <p className="text-muted-foreground">{t("noCharts")}</p>
      )}

      <Card className="rounded-2xl border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">{t("related")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {related.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            related.map((item) => (
              <Link
                key={item.id}
                href={`/transactions/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">
                    {item.title || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatReadableDate(item.occurredAt)}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-base font-semibold tabular-nums",
                    item.type === TransactionType.Spending
                      ? "text-rose-400"
                      : "text-emerald-400",
                  )}
                >
                  {formatMoney(item.displayAmount, item.displayCurrency)}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={deleteOpen}
        loading={deleting}
        count={1}
        onOpenChange={setDeleteOpen}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-none">
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
