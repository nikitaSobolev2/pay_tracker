"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { HideablePageBlock } from "@/components/hideable-page-block";
import { StatCard } from "@/features/charts/stat-card";
import { TimelineChart } from "@/features/charts/timeline-chart";
import {
  useContainedHorizontalScroll,
  useStripChartFocus,
} from "@/features/charts/use-contained-horizontal-scroll";
import { listTransactions } from "@/lib/api/transactions";
import { BENTO_CHART_CLASS } from "@/lib/bento";
import { formatBucketLabel } from "@/lib/chart-format";
import {
  groupTravelMoneyByDay,
  sumTravelDayNets,
  type TravelDayMoney,
} from "@/lib/group-travel-money-by-day";
import { formatChartMoney } from "@/lib/money";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { travelPageBlockScope } from "@/lib/page-block-visibility";
import { cn } from "@/lib/utils";
import type { TimelinePoint } from "@/server/services/stats-service.types";
import { DateRangeType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

const CHART_SURFACE_CLASS =
  "aspect-auto h-full min-h-full w-full outline-none [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none [&_svg]:outline-none";

type TravelExpenseChartsProps = {
  readonly travelId: string;
  readonly currency: string;
  readonly items: readonly TransactionDto[];
};

export function TravelExpenseCharts({
  travelId,
  currency,
  items,
}: TravelExpenseChartsProps) {
  const t = useTranslations("travels");
  const days = groupTravelMoneyByDay(items);
  if (days.length === 0) {
    return null;
  }
  return (
    <HideablePageBlock
      scope={travelPageBlockScope(travelId)}
      blockId="charts"
      title={t("expenseCharts")}
    >
      <div className="space-y-4">
        <TravelNetAreaChart
          title={t("netExpenses")}
          days={days}
          currency={currency}
        />
        <TimelineChart
          title={t("spendVsEarn")}
          points={toTimelinePoints(days)}
          currency={currency}
          mode="dual"
          disableShare
        />
      </div>
    </HideablePageBlock>
  );
}

export function TravelExpenseChartsForTravel({
  travelId,
  currency,
}: {
  readonly travelId: string;
  readonly currency: string;
}) {
  const t = useTranslations("travels");
  const [items, setItems] = useState<TransactionDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      listTransactions({
        travelId,
        dateRangeType: DateRangeType.AllTime,
        pageSize: 100,
      })
        .then((result) => {
          if (!cancelled) {
            setItems(result.items);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled && !isNetworkError(error)) {
            toast.error(error instanceof Error ? error.message : t("loadFailed"));
          }
        });
    }
    load();
    window.addEventListener("paytracker:transactions-changed", load);
    window.addEventListener("paytracker:travel-offline-synced", load);
    return () => {
      cancelled = true;
      window.removeEventListener("paytracker:transactions-changed", load);
      window.removeEventListener("paytracker:travel-offline-synced", load);
    };
  }, [t, travelId]);

  return (
    <TravelExpenseCharts
      travelId={travelId}
      currency={currency}
      items={items}
    />
  );
}

function toTimelinePoints(
  days: readonly TravelDayMoney[],
): TimelinePoint[] {
  return days.map((day) => ({
    bucket: day.date,
    spending: String(day.spending),
    earning: String(day.earning),
    net: String(day.net),
  }));
}

function TravelNetAreaChart({
  title,
  days,
  currency,
}: {
  readonly title: string;
  readonly days: readonly TravelDayMoney[];
  readonly currency: string;
}) {
  const t = useTranslations("travels");
  const locale = useLocale();
  const data = days.map((day) => ({
    date: day.date,
    net: day.net,
    label: formatBucketLabel(day.date, locale),
  }));
  const netTotal = sumTravelDayNets(days);
  const trendPercent = trendPercentForValues(data.map((day) => day.net));
  const config = {
    net: { label: title, color: "var(--chart-1)" },
  } satisfies ChartConfig;
  const scrollResetKey = days.map((day) => day.date).join("|");
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
      description={formatChartMoney(String(netTotal), currency)}
      action={<TrendPercentBadge percent={trendPercent} />}
      bleed
      className="min-w-0"
    >
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
          className={CHART_SURFACE_CLASS}
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
              <linearGradient id="travelFillNet" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-net)"
                  stopOpacity={0.4}
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-net)"
                  stopOpacity={0.04}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <ReferenceLine
              y={0}
              stroke="oklch(0.62 0 0 / 35%)"
              strokeDasharray="4 4"
            />
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
                <NetChartTooltip
                  currency={currency}
                  label={t("netExpenses")}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="net"
              name="net"
              stroke="var(--color-net)"
              strokeWidth={2}
              fill="url(#travelFillNet)"
              activeDot={{ r: 4, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 px-4 pb-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-1" />
          {t("netExpenses")}
          <span className="tabular-nums text-chart-1">
            {formatChartMoney(String(netTotal), currency)}
          </span>
        </span>
      </div>
    </StatCard>
  );
}

function NetChartTooltip({
  currency,
  label,
  ...props
}: ComponentProps<typeof ChartTooltipContent> & {
  readonly currency: string;
  readonly label: string;
}) {
  return (
    <ChartTooltipContent
      {...props}
      indicator="line"
      formatter={(value) => (
        <NetTooltipRow label={label} value={value} currency={currency} />
      )}
    />
  );
}

function TrendPercentBadge({ percent }: { readonly percent: number | null }) {
  if (percent === null) {
    return null;
  }
  return (
    <Badge
      variant="secondary"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        percent >= 0
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground",
      )}
    >
      {percent >= 0 ? "+" : ""}
      {percent.toFixed(0)}%
    </Badge>
  );
}

function NetTooltipRow({
  label,
  value,
  currency,
}: {
  readonly label: string;
  readonly value: unknown;
  readonly currency: string;
}) {
  return (
    <div className="flex min-w-36 items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-chart-1">
        {formatChartMoney(
          typeof value === "number" ? value : Number(value) || 0,
          currency,
        )}
      </span>
    </div>
  );
}

function trendPercentForValues(values: number[]): number | null {
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
