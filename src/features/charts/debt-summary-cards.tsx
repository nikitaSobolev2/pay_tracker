"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShareChartButton } from "@/features/share/share-chart-button";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { Link } from "@/i18n/navigation";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { NamedAmount } from "@/server/services/stats-service.types";

type DebtSummaryCardsProps = {
  loading?: boolean;
  displayCurrency: string;
  debtsIOwe: {
    total: { amount: string; currency?: string };
    breakdown: NamedAmount[];
  };
  debtsOwedToMe: {
    total: { amount: string; currency?: string };
    breakdown: NamedAmount[];
  };
  disableShare?: boolean;
};

function BreakdownList({
  items,
  currency,
  tone,
}: {
  readonly items: NamedAmount[];
  readonly currency: string;
  readonly tone: "owe" | "owed";
}) {
  const tCharts = useTranslations("charts");
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground">{tCharts("noCounterparties")}</div>
    );
  }
  const amountClass =
    tone === "owe" ? "text-rose-400" : "text-emerald-400";
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={`${item.id ?? item.name}-${item.amount}`}
          className="flex justify-between gap-4 text-sm"
        >
          <span className="truncate text-muted-foreground">{item.name}</span>
          <span className={cn("shrink-0 font-medium tabular-nums", amountClass)}>
            {formatChartMoney(item.amount, currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DebtCardSkeleton() {
  return (
    <div className="h-full rounded-xl border border-border/50 bg-card/80 p-4">
      <div className="space-y-3">
        <div>
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="mt-1.5 h-8 w-36 max-w-full" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={`debt-row-${index}`}
              className="flex justify-between gap-3"
            >
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DebtCard({
  title,
  amount,
  currency,
  breakdown,
  href,
  tone,
}: {
  readonly title: string;
  readonly amount: string;
  readonly currency: string;
  readonly breakdown: NamedAmount[];
  readonly href: string | null;
  readonly tone: "owe" | "owed";
}) {
  const tCharts = useTranslations("charts");
  const top = breakdown.slice(0, 2);
  const amountClass =
    tone === "owe" ? "text-rose-400" : "text-emerald-400";
  const borderClass =
    tone === "owe"
      ? "border-rose-400/25 bg-rose-500/5 hover:bg-rose-500/10"
      : "border-emerald-400/25 bg-emerald-500/5 hover:bg-emerald-500/10";
  const cardClassName = cn(
    "flex h-full flex-col rounded-xl border p-4 outline-none transition-colors",
    "focus-visible:ring-2 focus-visible:ring-ring/50",
    borderClass,
  );

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          href ? (
            <Link href={href} className={cardClassName} />
          ) : (
            <div className={cardClassName} />
          )
        }
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {breakdown.length === 0
                ? tCharts("noOpenDebts")
                : tCharts("counterpartiesCount", { count: breakdown.length })}
            </p>
          </div>
          <p
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              amountClass,
            )}
          >
            {formatChartMoney(amount, currency)}
          </p>
          {top.length === 0 ? (
            <p className="mt-auto text-sm text-muted-foreground">
              {tCharts("nothingToShow")}
            </p>
          ) : (
            <ul className="mt-auto space-y-1.5">
              {top.map((item) => (
                <li
                  key={`${item.id ?? item.name}-${item.amount}`}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    {item.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      amountClass,
                    )}
                  >
                    {formatChartMoney(item.amount, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <BreakdownList items={breakdown} currency={currency} tone={tone} />
      </TooltipContent>
    </Tooltip>
  );
}

export function DebtSummaryCards({
  loading = false,
  displayCurrency,
  debtsIOwe,
  debtsOwedToMe,
  disableShare = false,
}: DebtSummaryCardsProps) {
  const t = useTranslations("home");
  const tShare = useTranslations("share");
  const shareTitle = tShare("chartTypes.debtSummary");

  if (loading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <DebtCardSkeleton />
        <DebtCardSkeleton />
      </div>
    );
  }

  return (
    <div className="relative space-y-2">
      {!disableShare ? (
        <div className="absolute top-0 right-0 z-10 -mt-1">
          <ShareChartButton
            title={shareTitle}
            payload={{
              type: SharedChartType.DebtSummary,
              title: shareTitle,
              debtsIOwe: {
                total: {
                  amount: debtsIOwe.total.amount,
                  currency: displayCurrency,
                },
                breakdown: debtsIOwe.breakdown,
              },
              debtsOwedToMe: {
                total: {
                  amount: debtsOwedToMe.total.amount,
                  currency: displayCurrency,
                },
                breakdown: debtsOwedToMe.breakdown,
              },
            }}
          />
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <DebtCard
          title={t("debtIOwe")}
          amount={debtsIOwe.total.amount}
          currency={displayCurrency}
          breakdown={debtsIOwe.breakdown}
          href={disableShare ? null : "/debts"}
          tone="owe"
        />
        <DebtCard
          title={t("debtOwedToMe")}
          amount={debtsOwedToMe.total.amount}
          currency={displayCurrency}
          breakdown={debtsOwedToMe.breakdown}
          href={disableShare ? null : "/debts"}
          tone="owed"
        />
      </div>
    </div>
  );
}
