"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import { formatChartMoney } from "@/lib/money";

type BalanceLineChartProps = {
  readonly title: string;
  readonly loading?: boolean;
  readonly currency: string;
  readonly points: Array<{ date: string; value: string }>;
  readonly valueKey?: string;
};

const config = {
  value: { label: "Balance", color: "oklch(0.7 0 0)" },
} satisfies ChartConfig;

export function BalanceLineChart({
  title,
  loading = false,
  currency,
  points,
}: BalanceLineChartProps) {
  const data = points.map((point) => ({
    date: point.date.slice(0, 10),
    value: Number(point.value),
  }));

  return (
    <StatCard
      title={title}
      loading={loading}
      skeleton={<Skeleton className="h-52 w-full" />}
      bleed
    >
      {data.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">—</p>
      ) : (
        <ChartContainer config={config} className="h-56 w-full px-2">
          <AreaChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    formatChartMoney(String(value), currency)
                  }
                />
              }
            />
            <Area
              type="stepAfter"
              dataKey="value"
              stroke="var(--color-value)"
              fill="var(--color-value)"
              fillOpacity={0.15}
            />
          </AreaChart>
        </ChartContainer>
      )}
    </StatCard>
  );
}
