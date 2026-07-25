"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/charts/stat-card";
import { formatChartMoney } from "@/lib/money";
import type { NamedAmount } from "@/server/services/stats-service.types";

type NamedAmountBarsProps = {
  readonly title: string;
  readonly loading?: boolean;
  readonly items: NamedAmount[];
  readonly currency: string;
};

const config = {
  amount: { label: "Amount", color: "oklch(0.72 0 0)" },
} satisfies ChartConfig;

export function NamedAmountBars({
  title,
  loading = false,
  items,
  currency,
}: NamedAmountBarsProps) {
  const data = items.map((item) => ({
    name: item.name,
    amount: Number(item.amount),
  }));

  return (
    <StatCard
      title={title}
      loading={loading}
      skeleton={<Skeleton className="h-48 w-full" />}
      bleed
    >
      {data.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">—</p>
      ) : (
        <ChartContainer config={config} className="h-56 w-full px-2">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    formatChartMoney(String(value), currency)
                  }
                />
              }
            />
            <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
          </BarChart>
        </ChartContainer>
      )}
    </StatCard>
  );
}
