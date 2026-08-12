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
import { BENTO_CHART_CLASS } from "@/lib/bento";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { NamedAmount } from "@/server/services/stats-service.types";

type NamedAmountBarsProps = {
  readonly title: string;
  readonly loading?: boolean;
  readonly items: NamedAmount[];
  readonly currency: string;
};

const config = {
  amount: { label: "Amount", color: "var(--chart-1)" },
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
      skeleton={<Skeleton className={BENTO_CHART_CLASS} />}
      bleed
    >
      {data.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-muted-foreground">—</p>
      ) : (
        <ChartContainer config={config} className={cn(BENTO_CHART_CLASS, "px-2")}>
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
