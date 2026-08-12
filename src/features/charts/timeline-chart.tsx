"use client";

import { Area, AreaChart, XAxis } from "recharts";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import {
  useContainedHorizontalScroll,
  useStripChartFocus,
} from "@/features/charts/use-contained-horizontal-scroll";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { BENTO_CHART_CLASS } from "@/lib/bento";
import { formatBucketLabel } from "@/lib/chart-format";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TimelinePoint } from "@/server/services/stats-service.types";

type TimelineChartProps = {
  readonly title: string;
  readonly description?: string;
  readonly loading?: boolean;
  readonly points: TimelinePoint[];
  readonly currency?: string;
  readonly className?: string;
  /**
   * dual = earning + spending overlays (default for mixed views)
   * single = one series for the active filter type
   */
  readonly mode?: "dual" | "spending" | "earning";
  readonly disableShare?: boolean;
};

export function TimelineChart({
  title,
  description,
  loading = false,
  points,
  currency = "RUB",
  className,
  mode = "dual",
  disableShare = false,
}: TimelineChartProps) {
  const t = useTranslations("home");
  const tCharts = useTranslations("charts");
  const locale = useLocale();
  const data = points.map((point) => {
    const earning = Number(point.earning);
    const spending = Number(point.spending);
    return {
      bucket: point.bucket,
      earning,
      spending,
      net: earning - spending,
      activity: earning + spending,
      label: formatBucketLabel(point.bucket, locale),
    };
  });

  const totalEarning = data.reduce((sum, point) => sum + point.earning, 0);
  const totalSpending = data.reduce((sum, point) => sum + point.spending, 0);
  const totalActivity = totalEarning + totalSpending;
  const trendSource =
    mode === "spending"
      ? data.map((point) => point.spending)
      : mode === "earning"
        ? data.map((point) => point.earning)
        : data.map((point) => point.net);
  const trendPercent = computeTrendPercent(trendSource);

  const earningConfig = { label: t("income"), color: "oklch(0.72 0.17 155)" };
  const spendingConfig = {
    label: t("spendingLabel"),
    color: "oklch(0.68 0.19 25)",
  };
  const config: ChartConfig = {};
  if (mode === "dual" || mode === "earning") {
    config.earning = earningConfig;
  }
  if (mode === "dual" || mode === "spending") {
    config.spending = spendingConfig;
  }

  const autoDescription = buildTimelineDescription({
    empty: data.length === 0,
    mode,
    totalEarning,
    totalSpending,
    currency,
    incomeLabel: t("income"),
    spendingLabel: t("spendingLabel"),
  });

  const scrollResetKey = useMemo(
    () => `${data.length}:${points.map((point) => point.bucket).join("|")}`,
    [data.length, points],
  );
  const {
    scrollRef,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useContainedHorizontalScroll(scrollResetKey);
  useStripChartFocus(scrollRef, scrollResetKey);

  return (
    <StatCard
      title={title}
      description={description ?? autoDescription}
      action={
        trendPercent === null ? null : (
          <Badge
            variant="secondary"
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              trendPercent >= 0
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground",
            )}
          >
            {trendPercent >= 0 ? "+" : ""}
            {trendPercent.toFixed(0)}%
          </Badge>
        )
      }
      sharePayload={
        disableShare || loading || points.length === 0
          ? null
          : {
              type: SharedChartType.Timeline,
              title,
              description,
              points,
              currency,
              mode,
            }
      }
      loading={loading}
      skeleton={<TimelineChartSkeleton />}
      bleed
      className={cn("min-w-0", className)}
    >
      {data.length === 0 ? (
        <EmptyChartState label={tCharts("noTransactions")} />
      ) : (
        <div
          ref={scrollRef}
          className={cn(
            BENTO_CHART_CLASS,
            "-mb-2 touch-none select-none overflow-x-auto overscroll-contain scrollbar-none",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onMouseDownCapture={(event) => {
            event.preventDefault();
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <ChartContainer
            config={config}
            className="aspect-auto h-full min-h-full w-full outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none"
            style={
              data.length > 12
                ? { minWidth: `${Math.max(data.length * 40, 320)}px` }
                : undefined
            }
          >
            <AreaChart
              data={data}
              margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
              tabIndex={-1}
              accessibilityLayer={false}
              style={{ outline: "none" }}
            >
              <defs>
                <linearGradient id="fillEarning" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-earning)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-earning)"
                    stopOpacity={0.04}
                  />
                </linearGradient>
                <linearGradient id="fillSpending" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-spending)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-spending)"
                    stopOpacity={0.04}
                  />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tick={{ fill: "oklch(0.62 0 0)", fontSize: 11 }}
              />
              <ChartTooltip
                cursor={{ stroke: "oklch(1 0 0 / 14%)" }}
                content={
                  <ChartTooltipContent
                    indicator="line"
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
              {mode === "dual" || mode === "earning" ? (
                <Area
                  type="monotone"
                  dataKey="earning"
                  name="earning"
                  stroke="var(--color-earning)"
                  strokeWidth={2}
                  fill="url(#fillEarning)"
                  isAnimationActive={false}
                />
              ) : null}
              {mode === "dual" || mode === "spending" ? (
                <Area
                  type="monotone"
                  dataKey="spending"
                  name="spending"
                  stroke="var(--color-spending)"
                  strokeWidth={2}
                  fill="url(#fillSpending)"
                  isAnimationActive={false}
                />
              ) : null}
            </AreaChart>
          </ChartContainer>
        </div>
      )}
      {data.length > 0 && mode === "dual" ? (
        <div className="flex flex-wrap items-center justify-center gap-4 px-4 pb-3 text-xs text-muted-foreground">
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
          <span className="tabular-nums">
            Σ {formatChartMoney(String(totalActivity), currency)}
          </span>
        </div>
      ) : null}
    </StatCard>
  );
}

function buildTimelineDescription(input: {
  empty: boolean;
  mode: "dual" | "spending" | "earning";
  totalEarning: number;
  totalSpending: number;
  currency: string;
  incomeLabel: string;
  spendingLabel: string;
}): string | undefined {
  if (input.empty) {
    return undefined;
  }
  const income = `${input.incomeLabel} ${formatChartMoney(String(input.totalEarning), input.currency)}`;
  const spending = `${input.spendingLabel} ${formatChartMoney(String(input.totalSpending), input.currency)}`;
  if (input.mode === "earning") {
    return income;
  }
  if (input.mode === "spending") {
    return spending;
  }
  return `${income} · ${spending}`;
}

function computeTrendPercent(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const midpoint = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, midpoint);
  const secondHalf = values.slice(midpoint);
  const firstAvg =
    firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, value) => sum + value, 0) / secondHalf.length;
  if (firstAvg === 0) {
    return secondAvg === 0 ? 0 : 100;
  }
  const percent = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
  return Math.max(-999, Math.min(999, percent));
}

function TimelineChartSkeleton() {
  const heights = [42, 58, 36, 70, 48, 64, 40, 72, 52, 60, 44, 68];
  return (
    <div className="flex min-h-52 w-full flex-1 items-end gap-1.5 px-3 pb-3 pt-4 md:gap-2 md:px-4">
      {heights.map((height, index) => (
        <Skeleton
          key={`timeline-bar-${index}`}
          className="min-w-0 flex-1 rounded-t-md rounded-b-sm"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex min-h-52 flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
      <svg
        viewBox="0 0 220 64"
        className="h-16 w-full max-w-[220px] text-muted-foreground/40"
        aria-hidden
      >
        <path
          d="M0 40 C30 40 40 18 70 22 C100 26 110 52 140 48 C170 44 180 12 220 16 L220 64 L0 64 Z"
          fill="currentColor"
          opacity="0.35"
        />
        <path
          d="M0 40 C30 40 40 18 70 22 C100 26 110 52 140 48 C170 44 180 12 220 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <span>{label}</span>
    </div>
  );
}
