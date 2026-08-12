"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import { BENTO_CHART_CLASS } from "@/lib/bento";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type DualSeriesBarsProps = {
  readonly title: string;
  readonly loading?: boolean;
  readonly currency: string;
  readonly data: Array<{ bucket: string; lend: string; borrow: string }>;
  readonly lendLabel: string;
  readonly borrowLabel: string;
};

export function DualSeriesBars({
  title,
  loading = false,
  currency,
  data,
  lendLabel,
  borrowLabel,
}: DualSeriesBarsProps) {
  const config = {
    lend: { label: lendLabel, color: "oklch(0.72 0.12 145)" },
    borrow: { label: borrowLabel, color: "oklch(0.65 0.15 25)" },
  } satisfies ChartConfig;

  const chartData = data.map((row) => ({
    bucket: row.bucket,
    lend: Number(row.lend),
    borrow: Number(row.borrow),
  }));

  return (
    <StatCard
      title={title}
      loading={loading}
      skeleton={<Skeleton className={BENTO_CHART_CLASS} />}
      bleed
    >
      {chartData.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">—</p>
      ) : (
        <ChartContainer config={config} className={cn(BENTO_CHART_CLASS, "px-2")}>
          <BarChart data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="bucket" tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    formatChartMoney(String(value), currency)
                  }
                />
              }
            />
            <Bar dataKey="lend" fill="var(--color-lend)" radius={4} />
            <Bar dataKey="borrow" fill="var(--color-borrow)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </StatCard>
  );
}
