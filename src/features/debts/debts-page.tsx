"use client";

import { ArrowDownLeft, ArrowUpRight, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import {
  ObjectCard,
  PassAvatar,
  PassStripeRail,
} from "@/components/ui/object-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SettleDebtDialog,
  type DebtCloseTone,
  type SettleDebtTarget,
} from "@/features/debts/close-debt-dialog";
import { Link } from "@/i18n/navigation";
import { fetchDebtsStats } from "@/lib/api/stats";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  DebtCounterpartyStats,
  DebtsStats,
  MoneyAmount,
} from "@/server/services/stats-service.types";

export function DebtsPage() {
  const t = useTranslations("debts");
  const [stats, setStats] = useState<DebtsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settleTarget, setSettleTarget] = useState<SettleDebtTarget | null>(
    null,
  );

  const loadStats = useCallback(async () => {
    const result = await fetchDebtsStats();
    setStats(result);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadStats()
      .catch(() => {
        if (!cancelled) {
          setStats(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  if (loading && !stats) {
    return <DebtsPageSkeleton />;
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <PageTitleWithBack fallbackHref="/">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </PageTitleWithBack>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCard
          tone="owe"
          title={t("myDebts")}
          total={stats.myDebts.totalAllTime}
          monthTotal={stats.myDebts.totalThisMonth}
          medianSettleDays={stats.myDebts.medianSettleDays}
          count={stats.myDebts.counterparties.length}
          monthLabel={t("totalMonth")}
          allLabel={t("totalAll")}
          medianSettleLabel={t("medianSettle")}
          emptyLabel={t("noOpenDebts")}
          peopleLabel={t("counterpartiesCount", {
            count: stats.myDebts.counterparties.length,
          })}
        />
        <SummaryCard
          tone="owed"
          title={t("debtsToMe")}
          total={stats.debtsToMe.totalAllTime}
          monthTotal={stats.debtsToMe.totalThisMonth}
          medianSettleDays={stats.debtsToMe.medianSettleDays}
          count={stats.debtsToMe.counterparties.length}
          monthLabel={t("totalMonth")}
          allLabel={t("totalAll")}
          medianSettleLabel={t("medianSettle")}
          emptyLabel={t("noOpenDebts")}
          peopleLabel={t("counterpartiesCount", {
            count: stats.debtsToMe.counterparties.length,
          })}
        />
      </div>

      <section className="rounded-xl border border-border/60 bg-card/50 px-5 py-4">
        <p className="text-sm text-muted-foreground">{t("forgivenAllTime")}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {formatMoney(
            stats.forgivenAllTime.amount,
            stats.forgivenAllTime.currency,
          )}
        </p>
      </section>

      <DebtPeopleSection
        tone="owe"
        title={t("myDebts")}
        counterparties={stats.myDebts.counterparties}
        emptyLabel={t("emptyMyDebts")}
        monthLabel={t("totalMonth")}
        allLabel={t("totalAll")}
        avgLabel={t("avgAmount")}
        frequencyLabel={t("frequency")}
        medianSettleLabel={t("medianSettle")}
        eventsLabel={t("events")}
        closeLabel={t("closeDebt")}
        forgiveLabel={t("forgiveDebt")}
        onCloseDebt={(person) =>
          setSettleTarget({ mode: "close", tone: "owe", person })
        }
        onForgiveDebt={(person) =>
          setSettleTarget({ mode: "forgive", tone: "owe", person })
        }
      />

      <DebtPeopleSection
        tone="owed"
        title={t("debtsToMe")}
        counterparties={stats.debtsToMe.counterparties}
        emptyLabel={t("emptyDebtsToMe")}
        monthLabel={t("totalMonth")}
        allLabel={t("totalAll")}
        avgLabel={t("avgAmount")}
        frequencyLabel={t("frequency")}
        medianSettleLabel={t("medianSettle")}
        eventsLabel={t("events")}
        closeLabel={t("closeDebt")}
        forgiveLabel={t("forgiveDebt")}
        onCloseDebt={(person) =>
          setSettleTarget({ mode: "close", tone: "owed", person })
        }
        onForgiveDebt={(person) =>
          setSettleTarget({ mode: "forgive", tone: "owed", person })
        }
      />

      <SettleDebtDialog
        target={settleTarget}
        open={Boolean(settleTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setSettleTarget(null);
          }
        }}
        onSettled={() => {
          void loadStats();
        }}
      />
    </div>
  );
}

function DebtsPageSkeleton() {
  return (
    <div className="space-y-6">
      <header>
        <Skeleton className="h-9 w-44" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <SummaryCardSkeleton tone="owe" />
        <SummaryCardSkeleton tone="owed" />
      </div>

      <PeopleSectionSkeleton />
      <PeopleSectionSkeleton />
    </div>
  );
}

function SummaryCardSkeleton({ tone }: { readonly tone: "owe" | "owed" }) {
  return (
    <article
      className={cn(
        "rounded-xl border p-5 sm:p-6",
        tone === "owe"
          ? "border-rose-400/35 bg-rose-500/8"
          : "border-emerald-400/35 bg-emerald-500/8",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-12 w-40 max-w-full sm:h-14" />
        </div>
        <Skeleton className="size-11 shrink-0 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-7 w-36 rounded-full" />
      <div className="mt-5 space-y-2 rounded-xl bg-background/35 px-4 py-3.5">
        <div className="flex justify-between gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex justify-between gap-4 border-t border-border/40 pt-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex justify-between gap-4 border-t border-border/40 pt-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </article>
  );
}

function PeopleSectionSkeleton() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-6" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <article
            key={`person-skeleton-${index}`}
            className="flex flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-7 w-20 shrink-0" />
            </div>
            <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
              {Array.from({ length: 5 }, (_, rowIndex) => (
                <div
                  key={`person-row-${index}-${rowIndex}`}
                  className="flex justify-between gap-3"
                >
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({
  tone,
  title,
  total,
  monthTotal,
  medianSettleDays,
  count,
  monthLabel,
  allLabel,
  medianSettleLabel,
  emptyLabel,
  peopleLabel,
}: {
  readonly tone: "owe" | "owed";
  readonly title: string;
  readonly total: MoneyAmount;
  readonly monthTotal: MoneyAmount;
  readonly medianSettleDays: number | null;
  readonly count: number;
  readonly monthLabel: string;
  readonly allLabel: string;
  readonly medianSettleLabel: string;
  readonly emptyLabel: string;
  readonly peopleLabel: string;
}) {
  const Icon = tone === "owe" ? ArrowUpRight : ArrowDownLeft;

  return (
    <article
      className={cn(
        "rounded-xl border p-5 sm:p-6",
        tone === "owe"
          ? "border-rose-400/35 bg-rose-500/8"
          : "border-emerald-400/35 bg-emerald-500/8",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p
            className={cn(
              "mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl",
              tone === "owe" ? "text-rose-400" : "text-emerald-400",
            )}
          >
            {formatMoney(total.amount, total.currency)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full",
            tone === "owe"
              ? "bg-rose-500/15 text-rose-400"
              : "bg-emerald-500/15 text-emerald-400",
          )}
        >
          <Icon className="size-5 stroke-[2.25]" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-background/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Users className="size-3.5 opacity-70" />
          {count === 0 ? emptyLabel : peopleLabel}
        </span>
      </div>

      <div className="mt-5 space-y-2 rounded-xl bg-background/35 px-4 py-3.5 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{monthLabel}</span>
          <span className="font-medium tabular-nums">
            {formatMoney(monthTotal.amount, monthTotal.currency)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/40 pt-2">
          <span className="text-muted-foreground">{allLabel}</span>
          <span className="font-semibold tabular-nums">
            {formatMoney(total.amount, total.currency)}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/40 pt-2">
          <span className="text-muted-foreground">{medianSettleLabel}</span>
          <span className="tabular-nums">
            {formatDays(medianSettleDays)}
          </span>
        </div>
      </div>
    </article>
  );
}

function formatDays(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function DebtPeopleSection({
  tone,
  title,
  counterparties,
  emptyLabel,
  monthLabel,
  allLabel,
  avgLabel,
  frequencyLabel,
  medianSettleLabel,
  eventsLabel,
  closeLabel,
  forgiveLabel,
  onCloseDebt,
  onForgiveDebt,
}: {
  readonly tone: DebtCloseTone;
  readonly title: string;
  readonly counterparties: DebtCounterpartyStats[];
  readonly emptyLabel: string;
  readonly monthLabel: string;
  readonly allLabel: string;
  readonly avgLabel: string;
  readonly frequencyLabel: string;
  readonly medianSettleLabel: string;
  readonly eventsLabel: string;
  readonly closeLabel: string;
  readonly forgiveLabel: string;
  readonly onCloseDebt: (person: DebtCounterpartyStats) => void;
  readonly onForgiveDebt: (person: DebtCounterpartyStats) => void;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {counterparties.length}
        </p>
      </div>

      {counterparties.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-5 py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {counterparties.map((person) => (
            <ObjectCard
              key={person.counterpartyId}
              className="h-full min-h-0"
            >
              <PassStripeRail seed={person.counterpartyId} />
              <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
                <Link
                  href={`/debts/${person.counterpartyId}`}
                  className="flex items-start gap-2.5 rounded-lg outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <PassAvatar name={person.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight">
                      {person.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {eventsLabel}: {person.eventCount}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-lg font-semibold tabular-nums",
                      tone === "owe" ? "text-rose-400" : "text-emerald-400",
                    )}
                  >
                    {formatMoney(
                      person.totalAllTime.amount,
                      person.totalAllTime.currency,
                    )}
                  </p>
                </Link>

                <dl className="mt-4 space-y-2 border-t border-border/50 pt-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{monthLabel}</dt>
                    <dd className="tabular-nums">
                      {formatMoney(
                        person.totalThisMonth.amount,
                        person.totalThisMonth.currency,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{allLabel}</dt>
                    <dd className="font-medium tabular-nums">
                      {formatMoney(
                        person.totalAllTime.amount,
                        person.totalAllTime.currency,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{avgLabel}</dt>
                    <dd className="tabular-nums">
                      {formatMoney(
                        person.averageAmount.amount,
                        person.averageAmount.currency,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{frequencyLabel}</dt>
                    <dd className="tabular-nums">
                      {formatDays(person.frequencyDays)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{medianSettleLabel}</dt>
                    <dd className="tabular-nums">
                      {formatDays(person.medianSettleDays)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 cursor-pointer rounded-xl"
                    onClick={() => onCloseDebt(person)}
                  >
                    {closeLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 cursor-pointer rounded-xl"
                    onClick={() => onForgiveDebt(person)}
                  >
                    {forgiveLabel}
                  </Button>
                </div>
              </div>
            </ObjectCard>
          ))}
        </div>
      )}
    </section>
  );
}
