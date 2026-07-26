"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Area, AreaChart, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { IncomeVsSpendingsCard } from "@/features/charts/money-cards/income-vs-spendings-card";
import { StatCard } from "@/features/charts/stat-card";
import {
  useContainedHorizontalScroll,
  useStripChartFocus,
} from "@/features/charts/use-contained-horizontal-scroll";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { fetchPublicSharePeriod } from "@/lib/api/shares";
import { fetchTransactionStats } from "@/lib/api/stats";
import { formatBucketLabel } from "@/lib/chart-format";
import { formatChartMoney } from "@/lib/money";
import { timelineBucketToDateRange } from "@/lib/timeline-bucket-range";
import { cn } from "@/lib/utils";
import type {
  ListPageStats,
  TimelinePoint,
} from "@/server/services/stats-service.types";
import type { TransactionKind, TransactionType } from "@/types/enums";

type TimelineFilters = {
  readonly type?: TransactionType;
  readonly kinds?: TransactionKind[];
  readonly categoryIds?: string[];
  readonly counterpartyIds?: string[];
  readonly hideUncategorized?: boolean;
};

type TimelineWithDrilldownProps = {
  readonly title: string;
  readonly loading?: boolean;
  readonly points: TimelinePoint[];
  readonly currency: string;
  readonly mode?: "dual" | "spending" | "earning";
  readonly filters?: TimelineFilters;
  readonly disableShare?: boolean;
  /** When set, loads bucket stats via public share API. */
  readonly shareId?: string;
  readonly drilldownLayout?: "side" | "below";
};

export function TimelineWithDrilldown({
  title,
  loading = false,
  points,
  currency,
  mode = "dual",
  filters,
  disableShare = false,
  shareId,
  drilldownLayout = "side",
}: TimelineWithDrilldownProps) {
  const t = useTranslations("home");
  const tCharts = useTranslations("charts");
  const locale = useLocale();
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);
  const [bucketStats, setBucketStats] = useState<ListPageStats | null>(null);
  const [bucketLoading, setBucketLoading] = useState(false);
  const stackDrilldown = drilldownLayout === "below";

  useEffect(() => {
    setSelectedBucket(null);
    setBucketStats(null);
  }, [points]);

  const selectBucket = useCallback(
    (bucket: string) => {
      if (selectedBucket === bucket) {
        setSelectedBucket(null);
        setBucketStats(null);
        return;
      }
      const range = timelineBucketToDateRange(bucket);
      if (!range) {
        return;
      }
      setSelectedBucket(bucket);
      setBucketLoading(true);
      const request = shareId
        ? fetchPublicSharePeriod(shareId, range)
        : fetchTransactionStats({
            ...filters,
            startDate: range.startDate,
            endDate: range.endDate,
          });
      request.then(setBucketStats).finally(() => setBucketLoading(false));
    },
    [filters, selectedBucket, shareId],
  );

  const data = points.map((point) => {
    const earning = Number(point.earning);
    const spending = Number(point.spending);
    return {
      bucket: point.bucket,
      earning,
      spending,
      label: formatBucketLabel(point.bucket, locale),
    };
  });

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

  const {
    scrollRef,
    isDragging,
    scrollIndexIntoCenter,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  } = useContainedHorizontalScroll(
    `${data.length}:${points.map((point) => point.bucket).join("|")}`,
  );
  useStripChartFocus(scrollRef, data.length);

  const selectedIndex = selectedBucket
    ? data.findIndex((point) => point.bucket === selectedBucket)
    : -1;

  useEffect(() => {
    if (selectedIndex < 0) {
      return;
    }
    const count = data.length;
    const run = () => scrollIndexIntoCenter(selectedIndex, count);
    run();
    const frameA = requestAnimationFrame(() => {
      run();
      requestAnimationFrame(run);
    });
    const node = scrollRef.current;
    const resizeObserver =
      node == null ? null : new ResizeObserver(run);
    if (node && resizeObserver) {
      resizeObserver.observe(node);
    }
    // Flex shrink transition is 500ms — final center, then stop forcing scroll.
    const timeoutId = window.setTimeout(() => {
      run();
      resizeObserver?.disconnect();
    }, 520);
    return () => {
      cancelAnimationFrame(frameA);
      window.clearTimeout(timeoutId);
      resizeObserver?.disconnect();
    };
  }, [data.length, scrollIndexIntoCenter, scrollRef, selectedIndex]);

  const selectedLabel = selectedBucket
    ? formatBucketLabel(selectedBucket, locale)
    : "";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        !stackDrilldown && "lg:flex-row lg:items-stretch",
        selectedBucket && "rounded-2xl bg-muted/35 p-3",
      )}
    >
      <div
        className={cn(
          "min-w-0 transition-[flex-basis,max-width,width] duration-500 ease-out",
          stackDrilldown
            ? "w-full"
            : selectedBucket
              ? "lg:basis-1/2 lg:max-w-[50%]"
              : "lg:basis-full lg:max-w-full",
        )}
      >
        <StatCard
          title={title}
          loading={loading}
          bleed
          className="h-full min-w-0"
          sharePayload={
            disableShare || loading || points.length === 0
              ? null
              : {
                  type: SharedChartType.Timeline,
                  title,
                  points,
                  currency,
                  mode,
                  filters,
                }
          }
        >
          {data.length === 0 ? (
            <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
              {tCharts("noTransactions")}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className={cn(
                "-mb-2 touch-none select-none overflow-x-auto overscroll-contain scrollbar-none",
                isDragging ? "cursor-grabbing" : "cursor-pointer",
              )}
              onMouseDownCapture={(event) => {
                // Capture before the SVG default-focuses (tabIndex=-1 is still click-focusable).
                event.preventDefault();
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <ChartContainer
                config={config}
                className="aspect-auto h-56 w-full cursor-pointer outline-none [&_.recharts-active-dot]:cursor-pointer [&_.recharts-dot]:cursor-pointer [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_svg]:cursor-pointer [&_svg]:outline-none"
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
                  onClick={(state) => {
                    if (isDragging) {
                      return;
                    }
                    const rawIndex =
                      state.activeTooltipIndex ?? state.activeIndex;
                    if (rawIndex == null || rawIndex === "") {
                      return;
                    }
                    const index =
                      typeof rawIndex === "number"
                        ? rawIndex
                        : Number(rawIndex);
                    if (!Number.isFinite(index)) {
                      return;
                    }
                    const bucket = data[index]?.bucket;
                    if (bucket) {
                      selectBucket(bucket);
                    }
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }}
                >
                  <defs>
                    <linearGradient id="fillEarningDrill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-earning)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-earning)" stopOpacity={0.04} />
                    </linearGradient>
                    <linearGradient id="fillSpendingDrill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-spending)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-spending)" stopOpacity={0.04} />
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
                        formatter={(value, name) => (
                          <div className="flex min-w-36 items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {name === "earning" ? t("income") : t("spendingLabel")}
                            </span>
                            <span className="font-medium tabular-nums">
                              {formatChartMoney(String(value), currency)}
                            </span>
                          </div>
                        )}
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
                      fill="url(#fillEarningDrill)"
                      isAnimationActive={false}
                      activeDot={{
                        r: 6,
                        className: "cursor-pointer",
                        cursor: "pointer",
                      }}
                    />
                  ) : null}
                  {mode === "dual" || mode === "spending" ? (
                    <Area
                      type="monotone"
                      dataKey="spending"
                      name="spending"
                      stroke="var(--color-spending)"
                      strokeWidth={2}
                      fill="url(#fillSpendingDrill)"
                      isAnimationActive={false}
                      activeDot={{
                        r: 6,
                        className: "cursor-pointer",
                        cursor: "pointer",
                      }}
                    />
                  ) : null}
                </AreaChart>
              </ChartContainer>
            </div>
          )}
          {selectedBucket ? (
            <div className="mt-2 flex justify-center">
              <Badge variant="secondary" className="rounded-full">
                {selectedLabel}
              </Badge>
            </div>
          ) : null}
        </StatCard>
      </div>

      {selectedBucket ? (
        <div
          className={cn(
            stackDrilldown
              ? "grid w-full grid-cols-1 gap-3 md:grid-cols-2"
              : "contents",
          )}
        >
          <div
            className={cn(
              "min-w-0 animate-in fade-in-0 duration-500 fill-mode-both",
              stackDrilldown
                ? "slide-in-from-bottom-3"
                : "slide-in-from-right-4 lg:basis-1/4 lg:max-w-[25%]",
            )}
          >
            <CategoryPieChart
              title={selectedLabel}
              loading={bucketLoading}
              slices={bucketStats?.categoryPie ?? []}
              currency={bucketStats?.displayCurrency ?? currency}
              layout="stack"
              showTypeHints
              className="h-full"
              disableShare={disableShare}
            />
          </div>
          <div
            className={cn(
              "min-w-0 animate-in fade-in-0 duration-500 fill-mode-both delay-75",
              stackDrilldown
                ? "slide-in-from-bottom-3"
                : "slide-in-from-right-4 lg:basis-1/4 lg:max-w-[25%]",
            )}
          >
            <IncomeVsSpendingsCard
              title={`${t("incomeVsSpendings")} · ${selectedLabel}`}
              loading={bucketLoading}
              income={
                bucketStats?.periodTotals.earning ?? {
                  amount: "0",
                  currency,
                }
              }
              spending={
                bucketStats?.periodTotals.spending ?? {
                  amount: "0",
                  currency,
                }
              }
              net={bucketStats?.periodTotals.net ?? { amount: "0", currency }}
              hideComparison
              disableShare={disableShare}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
