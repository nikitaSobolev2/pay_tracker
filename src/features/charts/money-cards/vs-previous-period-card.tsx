"use client";

import { useTranslations } from "next-intl";

import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { formatChartMoney } from "@/lib/money";
import type { PeriodComparison } from "@/server/services/stats-service.types";
import { DateRangeType } from "@/types/enums";

import {
  AMOUNT_CLASS,
  MoneyCardSkeleton,
  PeriodChangeIndicator,
} from "./primitives";

export function VsPreviousPeriodCard({
  title,
  loading,
  comparison,
  dateRangeType,
  disableShare = false,
}: {
  title: string;
  loading?: boolean;
  comparison: PeriodComparison;
  dateRangeType: DateRangeType;
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
      skeleton={<MoneyCardSkeleton showBadge showHint detailRows={2} />}
    >
      <div className={AMOUNT_CLASS}>
        {delta === null
          ? "—"
          : formatChartMoney(delta, comparison.current.currency)}
      </div>
      <PeriodChangeIndicator comparison={comparison} sense="higherIsBetter" />
      <p className="mt-1.5 text-sm text-muted-foreground">{t("netChange")}</p>
      <div className="mt-auto space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5 text-base">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t("thisPeriod")}</span>
          <span className="font-medium tabular-nums">
            {formatChartMoney(
              comparison.current.amount,
              comparison.current.currency,
            )}
          </span>
        </div>
        <div className="flex justify-between gap-4 border-t border-border/40 pt-2.5">
          <span className="text-muted-foreground">{t("previousPeriod")}</span>
          <span className="font-medium tabular-nums">
            {comparison.previous
              ? formatChartMoney(
                  comparison.previous.amount,
                  comparison.previous.currency,
                )
              : "—"}
          </span>
        </div>
      </div>
    </StatCard>
  );
}
