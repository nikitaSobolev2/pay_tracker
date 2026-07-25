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
    <div className="rounded-2xl border border-border/60 bg-card/90 p-5">
      <div className="space-y-4">
        <div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-9 w-40 max-w-full md:h-10 md:w-48" />
          <Skeleton className="mt-3 h-6 w-36 max-w-full rounded-full" />
        </div>
        <div className="space-y-2.5 rounded-xl bg-muted/35 px-3.5 py-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div
              key={`debt-row-${index}`}
              className={cn(
                "flex justify-between gap-3",
                index < 2 && "border-b border-border/40 pb-2",
              )}
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
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
  const top = breakdown.slice(0, 3);
  const amountClass =
    tone === "owe" ? "text-rose-400" : "text-emerald-400";
  const borderClass =
    tone === "owe"
      ? "border-rose-400/30 bg-rose-500/5 hover:bg-rose-500/10"
      : "border-emerald-400/30 bg-emerald-500/5 hover:bg-emerald-500/10";
  const dotClass = tone === "owe" ? "bg-rose-400" : "bg-emerald-400";
  const cardClassName = cn(
    "block rounded-2xl border p-5 outline-none transition-colors",
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
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p
              className={cn(
                "mt-1 text-3xl font-semibold tracking-tight tabular-nums",
                amountClass,
              )}
            >
              {formatChartMoney(amount, currency)}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-background/40 px-2.5 py-1 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", dotClass)} />
              {breakdown.length === 0
                ? tCharts("noOpenDebts")
                : tCharts("counterpartiesCount", { count: breakdown.length })}
            </div>
          </div>

          <div className="rounded-xl bg-background/35 px-3.5 py-3">
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tCharts("nothingToShow")}
              </p>
            ) : (
              <ul className="space-y-2">
                {top.map((item, index) => (
                  <li
                    key={`${item.id ?? item.name}-${item.amount}`}
                    className={cn(
                      "flex items-center justify-between gap-3 text-sm",
                      index < top.length - 1 && "border-b border-border/40 pb-2",
                    )}
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
    <div className="space-y-2">
      {!disableShare ? (
        <div className="flex justify-end">
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
