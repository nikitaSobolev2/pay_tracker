"use client";

import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { formatChartMoney } from "@/lib/money";

import { CurrencyListSkeleton } from "./primitives";

export function CurrencyBreakdownCard({
  title,
  loading,
  items,
  disableShare = false,
}: {
  title: string;
  loading?: boolean;
  items: Array<{ currency: string; amount: string; count: number }>;
  disableShare?: boolean;
}) {
  return (
    <StatCard
      title={title}
      sharePayload={
        disableShare || loading || items.length === 0
          ? null
          : {
              type: SharedChartType.CurrencyBreakdown,
              title,
              items,
            }
      }
      loading={loading}
      skeleton={<CurrencyListSkeleton />}
    >
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li
            key={item.currency}
            className="flex justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
          >
            <span>{item.currency}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatChartMoney(item.amount, item.currency)} · {item.count}
            </span>
          </li>
        ))}
      </ul>
    </StatCard>
  );
}
