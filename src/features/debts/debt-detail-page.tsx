"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceLineChart } from "@/features/charts/balance-line-chart";
import { DualSeriesBars } from "@/features/charts/dual-series-bars";
import { NamedAmountBars } from "@/features/charts/named-amount-bars";
import {
  SettleDebtDialog,
  type DebtCloseTone,
  type SettleDebtTarget,
} from "@/features/debts/close-debt-dialog";
import { ConfirmDeleteDialog } from "@/features/transactions/confirm-delete-dialog";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { Link, useRouter } from "@/i18n/navigation";
import { fetchDebtDetailStats } from "@/lib/api/stats";
import { deleteTransaction } from "@/lib/api/transactions";
import { uniqueRecentAmounts } from "@/lib/unique-recent-amounts";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DebtDetailStats } from "@/server/services/detail-stats-service.types";
import type { DebtCounterpartyStats } from "@/server/services/stats-service.types";
import { useUiStore } from "@/stores/ui.store";
import { TransactionKind } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type DebtDetailPageProps = {
  readonly counterpartyId: string;
  /** When nested under counterparty detail, omit the page back control. */
  readonly embedded?: boolean;
};

export function DebtDetailPage({
  counterpartyId,
  embedded = false,
}: DebtDetailPageProps) {
  const t = useTranslations("debtDetail");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const formatReadableDate = useReadableDateTime();
  const openEdit = useUiStore((state) => state.openEditTransactionModal);
  const [stats, setStats] = useState<DebtDetailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settleTarget, setSettleTarget] = useState<SettleDebtTarget | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<TransactionDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchDebtDetailStats(counterpartyId);
      setStats(result.stats);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notFound"));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [counterpartyId, t]);

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
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      await deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notFound"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-lg text-muted-foreground">{t("notFound")}</p>
        <Button className="mt-4" onClick={() => router.push("/debts")}>
          {tNav("debts")}
        </Button>
      </div>
    );
  }

  const closeTone: DebtCloseTone = stats.tone === "owe" ? "owe" : "owed";
  const closePerson: DebtCounterpartyStats = {
    counterpartyId: stats.counterpartyId,
    name: stats.name,
    totalAllTime: stats.netAllTime,
    totalThisMonth: stats.netThisMonth,
    averageAmount: stats.averageAmount,
    frequencyDays: stats.frequencyDays,
    medianSettleDays: stats.medianSettleDays,
    eventCount: stats.eventCount,
    recentAmounts: uniqueRecentAmounts(
      stats.transactions.map((item) => item.displayAmount),
    ),
    amountHistory: [],
  };

  function openSettle(mode: SettleDebtTarget["mode"]) {
    setSettleTarget({ mode, tone: closeTone, person: closePerson });
  }

  const amountNamed = stats.amountSizes.map((item) => ({
    id: item.id,
    name: item.label,
    amount: item.amount,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <DebtDetailTitle
          embedded={embedded}
          name={stats.name}
          toneLabel={
            stats.tone === "settled"
              ? t("noOpenDebt")
              : stats.tone === "owe"
                ? t("owe")
                : t("owed")
          }
          eyebrow={t("title")}
        />
        {stats.tone !== "settled" ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl sm:w-auto"
              onClick={() => openSettle("close")}
            >
              {t("closeDebt")}
            </Button>
            <Button
              variant="outline"
              className="h-11 w-full rounded-xl sm:w-auto"
              onClick={() => openSettle("forgive")}
            >
              {t("forgiveDebt")}
            </Button>
          </div>
        ) : null}
      </header>

      <Card className="rounded-xl border-border/60 bg-card/50 shadow-none">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">{t("netBalance")}</p>
            <p
              className={cn(
                "mt-2 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl",
                stats.tone === "owe"
                  ? "text-rose-400"
                  : stats.tone === "owed"
                    ? "text-emerald-400"
                    : "text-foreground",
              )}
            >
              {formatMoney(stats.netAllTime.amount, stats.netAllTime.currency)}
            </p>
          </div>
          <Metric
            label={t("totalMonth")}
            value={formatMoney(
              stats.netThisMonth.amount,
              stats.netThisMonth.currency,
            )}
          />
          <Metric
            label={t("events")}
            value={String(stats.eventCount)}
          />
          <Metric
            label={t("avgAmount")}
            value={formatMoney(
              stats.averageAmount.amount,
              stats.averageAmount.currency,
            )}
          />
          <Metric
            label={t("frequency")}
            value={
              stats.frequencyDays === null
                ? "—"
                : stats.frequencyDays.toFixed(1)
            }
          />
          <Metric
            label={t("medianSettle")}
            value={
              stats.medianSettleDays === null
                ? "—"
                : stats.medianSettleDays.toFixed(1)
            }
          />
          <Metric
            label={t("forgivenAllTime")}
            value={formatMoney(
              stats.forgivenAllTime.amount,
              stats.forgivenAllTime.currency,
            )}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <BalanceLineChart
          title={t("runningBalance")}
          currency={stats.currency}
          points={stats.runningBalance.map((point) => ({
            date: point.date,
            value: point.balance,
          }))}
        />
        <DualSeriesBars
          title={t("lendVsBorrow")}
          currency={stats.currency}
          data={stats.monthlyLendBorrow}
          lendLabel="Lend"
          borrowLabel="Borrow"
        />
        <BalanceLineChart
          title={t("settledProgress")}
          currency={stats.currency}
          points={stats.settledProgress.map((point) => ({
            date: point.date,
            value: point.remaining,
          }))}
        />
        <NamedAmountBars
          title={t("amountDistribution")}
          items={amountNamed}
          currency={stats.currency}
        />
        <NamedAmountBars
          title={t("currencyBreakdown")}
          items={stats.currencyBreakdown}
          currency={stats.currency}
        />
        <NamedAmountBars
          title={t("eventCadence")}
          items={stats.eventGapsDays.map((days, index) => ({
            id: String(index),
            name: `#${index + 1}`,
            amount: String(days),
          }))}
          currency={stats.currency}
        />
      </div>

      <Card className="rounded-xl border-border/60 shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">{t("history")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            stats.transactions.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-border/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link
                  href={`/transactions/${item.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-base font-medium">
                    {debtHistoryTitle(item, t)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatReadableDate(item.occurredAt)}
                  </p>
                </Link>
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold tabular-nums">
                    {formatMoney(item.displayAmount, item.displayCurrency)}
                  </p>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-9 rounded-xl"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="size-9 rounded-xl"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <SettleDebtDialog
        target={settleTarget}
        open={Boolean(settleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setSettleTarget(null);
          }
        }}
        onSettled={() => void load()}
      />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        count={1}
        splitShareCount={deleteTarget?.splitShares?.length ?? 0}
        loading={deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

function debtHistoryTitle(
  item: TransactionDto,
  t: (key: "forgiveDebt") => string,
): string {
  if (item.title) {
    return item.title;
  }
  if (item.kind === TransactionKind.Loan) {
    return "Lend";
  }
  if (item.kind === TransactionKind.Debt) {
    return "Borrow";
  }
  return t("forgiveDebt");
}

function DebtDetailTitle({
  embedded,
  eyebrow,
  name,
  toneLabel,
}: {
  readonly embedded: boolean;
  readonly eyebrow: string;
  readonly name: string;
  readonly toneLabel: string;
}) {
  const title = (
    <>
      <p className="text-sm text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
        {name}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{toneLabel}</p>
    </>
  );

  if (embedded) {
    return <div className="min-w-0">{title}</div>;
  }

  return (
    <PageTitleWithBack fallbackHref="/debts">{title}</PageTitleWithBack>
  );
}

function Metric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
    </div>
  );
}
