"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChildrenDetails } from "@/features/charts/category-children-details";
import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import {
  categorySliceFill,
  sliceIdentityKey,
} from "@/lib/category-chart-style";
import { formatChartMoney } from "@/lib/money";
import type { CategorySlice } from "@/server/services/stats-service.types";
import { TransactionType } from "@/types/enums";

type TopCategoryBar = {
  readonly chartKey: string;
  readonly label: string;
  readonly amount: number;
  readonly fill: string;
  readonly slice: CategorySlice;
};

const chartConfig = {
  amount: { label: "Amount" },
} satisfies ChartConfig;

const LABEL_MAX_CHARS = 10;

export function TopCategoriesCard({
  title,
  description,
  loading,
  items,
  currency,
  showTypeHints = false,
  className,
  disableShare = false,
}: {
  readonly title: string;
  readonly description?: string;
  readonly loading?: boolean;
  readonly items: CategorySlice[];
  readonly currency: string;
  readonly showTypeHints?: boolean;
  readonly className?: string;
  readonly disableShare?: boolean;
}) {
  const tCharts = useTranslations("charts");
  const tTx = useTranslations("transaction");

  const data = useMemo(() => {
    const typeCounts = { spending: 0, earning: 0 };
    return items.map((slice, index): TopCategoryBar => {
      const withinType =
        slice.type === TransactionType.Earning
          ? typeCounts.earning++
          : typeCounts.spending++;
      return {
        chartKey: sliceIdentityKey(
          slice.categoryId,
          slice.type,
          slice.title,
          index,
        ),
        label: truncateLabel(slice.title),
        amount: Number(slice.amount),
        fill: categorySliceFill(slice.type, withinType),
        slice,
      };
    });
  }, [items]);

  return (
    <StatCard
      title={title}
      description={description}
      sharePayload={
        disableShare || loading || items.length === 0
          ? null
          : {
              type: SharedChartType.TopCategories,
              title,
              description,
              items,
              currency,
              showTypeHints,
            }
      }
      loading={loading}
      className={className}
      bleed
      skeleton={<Skeleton className="mx-2 mb-2 h-56 w-[calc(100%-1rem)]" />}
    >
      {data.length === 0 ? (
        <div className="px-6 pb-6 text-sm text-muted-foreground">
          {tCharts("noCategoriesYet")}
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-56 w-full px-2">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              type="number"
              tickLine={false}
              axisLine={false}
              width={36}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => compactAxisTick(Number(value))}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              content={
                <TopCategoriesTooltip
                  currency={currency}
                  showTypeHints={showTypeHints}
                  earningLabel={tTx("earning")}
                  spendingLabel={tTx("spending")}
                />
              }
            />
            <Bar dataKey="amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {data.map((entry) => (
                <Cell key={entry.chartKey} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      )}
    </StatCard>
  );
}

function TopCategoriesTooltip({
  active,
  payload,
  currency,
  showTypeHints,
  earningLabel,
  spendingLabel,
}: {
  readonly active?: boolean;
  readonly payload?: ReadonlyArray<{ payload?: TopCategoryBar }>;
  readonly currency: string;
  readonly showTypeHints: boolean;
  readonly earningLabel: string;
  readonly spendingLabel: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload as TopCategoryBar | undefined;
  if (!row) {
    return null;
  }
  const { slice } = row;
  const typeLabel =
    slice.type === TransactionType.Earning ? earningLabel : spendingLabel;

  return (
    <div className="grid min-w-48 gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-medium">{slice.title}</div>
        {showTypeHints ? (
          <span className="shrink-0 text-muted-foreground">{typeLabel}</span>
        ) : null}
      </div>
      <div className="flex justify-between gap-4 tabular-nums">
        <span className="text-muted-foreground">
          {slice.percent.toFixed(1)}%
        </span>
        <span className="font-mono font-medium">
          {formatChartMoney(slice.amount, currency)}
        </span>
      </div>
      {slice.children.length > 0 ? (
        <CategoryChildrenDetails
          slice={slice}
          currency={currency}
          className="border-t border-border/40 pt-2"
        />
      ) : null}
    </div>
  );
}

function truncateLabel(title: string): string {
  if (title.length <= LABEL_MAX_CHARS) {
    return title;
  }
  return `${title.slice(0, LABEL_MAX_CHARS - 1)}…`;
}

function compactAxisTick(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`;
  }
  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(absolute >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(value));
}
