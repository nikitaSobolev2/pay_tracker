"use client";

import { useTranslations } from "next-intl";

import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PeriodComparison } from "@/server/services/stats-service.types";
import { DateRangeType } from "@/types/enums";

import {
  AMOUNT_CLASS,
  comparisonTrendClassName,
  MONEY_CARD_CONTENT_CLASS,
  MoneyCardSkeleton,
  PeriodChangeIndicator,
  signedAmountClassName,
} from "./primitives";

export function VsPreviousPeriodCard({
  title,
  loading,
  comparison,
  dateRangeType,
  onPreviousPeriodClick,
  disableShare = false,
}: {
  title: string;
  loading?: boolean;
  comparison: PeriodComparison;
  dateRangeType: DateRangeType;
  onPreviousPeriodClick?: () => void;
  disableShare?: boolean;
}) {
  const t = useTranslations("home");

  if (dateRangeType === DateRangeType.AllTime) {
    return null;
  }

  const delta = comparison.deltaAmount;

  return (
    <StatCard
      title={title}
      sharePayload={
        disableShare || loading
          ? null
          : {
              type: SharedChartType.VsPrevious,
              title,
              comparison,
              dateRangeType,
            }
      }
      loading={loading}
      className="h-full"
      contentClassName={MONEY_CARD_CONTENT_CLASS}
      skeleton={<MoneyCardSkeleton showBadge showHint detailRows={2} />}
    >
      <div
        className={cn(
          AMOUNT_CLASS,
          comparisonTrendClassName(comparison, "higherIsBetter"),
        )}
      >
        {formatChartMoney(
          comparison.current.amount,
          comparison.current.currency,
        )}
      </div>
      <PeriodChangeIndicator comparison={comparison} sense="higherIsBetter" />
      <p className="text-sm text-muted-foreground">{t("netChange")}</p>
      <div className="mt-auto space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5 text-base">
        <button
          type="button"
          disabled={!onPreviousPeriodClick}
          onClick={onPreviousPeriodClick}
          className="flex w-full cursor-pointer justify-between gap-4 text-left transition-colors hover:text-foreground disabled:cursor-default disabled:hover:text-inherit"
        >
          <span className="text-muted-foreground">{t("previousPeriod")}</span>
          <span className="font-medium tabular-nums">
            {comparison.previous
              ? formatChartMoney(
                  comparison.previous.amount,
                  comparison.previous.currency,
                )
              : "—"}
          </span>
        </button>
        <div className="flex justify-between gap-4 border-t border-border/40 pt-2.5">
          <span className="text-muted-foreground">{t("change")}</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              delta === null ? undefined : signedAmountClassName(delta),
            )}
          >
            {delta === null
              ? "—"
              : formatChartMoney(delta, comparison.current.currency)}
          </span>
        </div>
      </div>
    </StatCard>
  );
}
