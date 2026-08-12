"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BENTO_CARD_CLASS, BENTO_LABEL_CLASS } from "@/lib/bento";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

import { useEventContext } from "./event-context";

export function EventPaidProgressCard({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const progress = event.summary.paidProgress;
  const paidPercent = percentOf(progress.paidCount, progress.totalCount);
  const collectedPercent = moneyPercent(progress.collected, progress.expected);

  return (
    <Card className={cn(BENTO_CARD_CLASS, className)}>
      <CardHeader>
        <CardTitle className={BENTO_LABEL_CLASS}>{t("paidProgressTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-3xl font-semibold tabular-nums">
          {t("paidProgressCount", {
            paid: progress.paidCount,
            total: progress.totalCount,
          })}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${paidPercent}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {t("paidProgressSplit", {
            certain: progress.certainPaidCount,
            uncertain: progress.uncertainPaidCount,
          })}
        </p>
        <div className="mt-auto space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("collected")}</span>
            <span className="font-medium tabular-nums">
              {formatChartMoney(progress.collected, event.currency)} /{" "}
              {formatChartMoney(progress.expected, event.currency)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${collectedPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function percentOf(part: number, total: number): number {
  return total > 0 ? Math.min(100, (part / total) * 100) : 0;
}

function moneyPercent(part: string, total: string): number {
  const totalValue = Number(total);
  return totalValue > 0 ? Math.min(100, (Number(part) / totalValue) * 100) : 0;
}
