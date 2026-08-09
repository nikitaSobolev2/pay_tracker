"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function TravelMoneyCard({
  title,
  amount,
  currency,
  hint,
  className,
}: {
  readonly title: string;
  readonly amount: string;
  readonly currency: string;
  readonly hint?: string;
  readonly className?: string;
}) {
  return (
    <Card className={cn("border-border/60 shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatChartMoney(amount, currency)}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TravelGoalProgressCard({
  plannedTotal,
  actualTotal,
  goal,
  currency,
  useActual = false,
}: {
  readonly plannedTotal: string;
  readonly actualTotal: string;
  readonly goal: string | null;
  readonly currency: string;
  readonly useActual?: boolean;
}) {
  const t = useTranslations("travels");
  if (!goal) {
    return null;
  }
  const spent = Number(useActual ? actualTotal : plannedTotal);
  const max = Number(goal);
  const ratio = max > 0 ? Math.min(1, spent / max) : 0;
  const remaining = max - spent;
  return (
    <Card className="border-border/60 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("goalProgress")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-semibold tabular-nums">
          {formatChartMoney(String(spent), currency)}
          <span className="text-base font-normal text-muted-foreground">
            {" / "}
            {formatChartMoney(goal, currency)}
          </span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              remaining < 0 ? "bg-rose-500" : "bg-sky-500",
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {remaining >= 0
            ? `${t("remainingGoal")}: ${formatChartMoney(String(remaining), currency)}`
            : `${t("overGoal")}: ${formatChartMoney(String(Math.abs(remaining)), currency)}`}
        </p>
      </CardContent>
    </Card>
  );
}
