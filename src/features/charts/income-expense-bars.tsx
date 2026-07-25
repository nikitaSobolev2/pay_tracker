"use client";

import { Bar, BarChart, XAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import { Link } from "@/i18n/navigation";
import { formatBucketLabel } from "@/lib/chart-format";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TimelinePoint } from "@/server/services/stats-service.types";

type IncomeExpenseBarsProps = {
  readonly title: string;
  readonly description?: string;
  readonly loading?: boolean;
  readonly points: TimelinePoint[];
  readonly currency?: string;
};

export function IncomeExpenseBars({
  title,
  description,
  loading = false,
  points,
  currency = "RUB",
}: IncomeExpenseBarsProps) {
  const t = useTranslations("home");
  const tCharts = useTranslations("charts");
  const locale = useLocale();

  const data = trimLeadingEmpty(
    points.map((point) => {
      const earning = Number(point.earning);
      const spending = Number(point.spending);
      return {
        bucketId: point.bucket,
        label: formatBucketLabel(point.bucket, locale),
        activity: earning + spending,
        earning,
        spending,
      };
    }),
  );

  const totalEarning = data.reduce((sum, point) => sum + point.earning, 0);
  const totalSpending = data.reduce((sum, point) => sum + point.spending, 0);
  const peak = data.reduce(
    (best, point) => (point.activity > best.activity ? point : best),
    data[0] ?? {
      bucketId: "—",
      label: "—",
      activity: 0,
      earning: 0,
      spending: 0,
    },
  );

  const config = {
    earning: {
      label: t("income"),
      color: "oklch(0.72 0.17 155)",
    },
    spending: {
      label: t("spendingLabel"),
      color: "oklch(0.68 0.19 25)",
    },
  } satisfies ChartConfig;

  const autoDescription = `${t("income")} ${formatChartMoney(String(totalEarning), currency)} · ${t("spendingLabel")} ${formatChartMoney(String(totalSpending), currency)}`;

  return (
    <StatCard
      title={title}
      description={description ?? autoDescription}
      loading={loading}
      skeleton={<IncomeExpenseBarsSkeleton />}
    >
      {data.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {tCharts("noActivity")}
        </div>
      ) : (
        <div className="space-y-4">
          <ChartContainer config={config} className="aspect-auto h-48 w-full">
            <BarChart
              data={data}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              barCategoryGap="28%"
              barGap={2}
            >
              <XAxis
                dataKey="bucketId"
                tickFormatter={(value) => formatBucketLabel(String(value), locale)}
                tickLine={false}
                axisLine={false}
                tickMargin={12}
                tick={{ fill: "oklch(0.62 0 0)", fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                labelFormatter={(_label, payload) => {
                  const point = payload?.[0]?.payload as
                    | { label?: string }
                    | undefined;
                  return point?.label ?? "";
                }}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      const label =
                        name === "earning"
                          ? t("income")
                          : name === "spending"
                            ? t("spendingLabel")
                            : String(name);
                      const valueClass =
                        name === "earning"
                          ? "text-emerald-400"
                          : name === "spending"
                            ? "text-rose-400"
                            : undefined;
                      return (
                        <div className="flex min-w-36 items-center justify-between gap-4">
                          <span className="text-muted-foreground">{label}</span>
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              valueClass,
                            )}
                          >
                            {formatChartMoney(String(value), currency)}
                          </span>
                        </div>
                      );
                    }}
                  />
                }
              />
              <Bar
                dataKey="earning"
                name="earning"
                fill="var(--color-earning)"
                radius={[999, 999, 999, 999]}
                maxBarSize={16}
                isAnimationActive={false}
              />
              <Bar
                dataKey="spending"
                name="spending"
                fill="var(--color-spending)"
                radius={[999, 999, 999, 999]}
                maxBarSize={16}
                isAnimationActive={false}
              />
            </BarChart>
          </ChartContainer>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-400" />
              {t("income")}
              <span className="tabular-nums text-emerald-400">
                {formatChartMoney(String(totalEarning), currency)}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-400" />
              {t("spendingLabel")}
              <span className="tabular-nums text-rose-400">
                {formatChartMoney(String(totalSpending), currency)}
              </span>
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <MiniTile
              label={t("peakPeriod")}
              value={peak.label}
              hint={`${t("income")} ${formatChartMoney(String(peak.earning), currency)} · ${t("spendingLabel")} ${formatChartMoney(String(peak.spending), currency)}`}
            />
            <MiniTile
              label={t("periodTotalsShort")}
              value={formatChartMoney(String(totalEarning - totalSpending), currency)}
              hint={`${t("income")} ${formatChartMoney(String(totalEarning), currency)} · ${t("spendingLabel")} ${formatChartMoney(String(totalSpending), currency)}`}
              valueClassName={
                totalEarning - totalSpending >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }
            />
          </div>

          <Link
            href="/transactions"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "h-11 w-full rounded-full bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            {t("viewFullReport")}
          </Link>
        </div>
      )}
    </StatCard>
  );
}

function IncomeExpenseBarsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex h-48 items-end gap-2 px-1">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={`bar-skeleton-${index}`} className="flex flex-1 gap-0.5">
            <Skeleton
              className="flex-1 rounded-t-md bg-emerald-500/20"
              style={{ height: `${35 + ((index * 17) % 55)}%` }}
            />
            <Skeleton
              className="flex-1 rounded-t-md bg-rose-500/20"
              style={{ height: `${30 + ((index * 13) % 50)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

function MiniTile({
  label,
  value,
  hint,
  valueClassName,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  readonly valueClassName?: string;
}) {
  return (
    <div className="rounded-xl bg-muted/35 px-3.5 py-3">
      <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold tracking-tight tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function trimLeadingEmpty<T extends { activity: number }>(points: T[]): T[] {
  const firstActive = points.findIndex((point) => point.activity > 0);
  if (firstActive <= 0) {
    return points;
  }
  return points.slice(firstActive);
}
