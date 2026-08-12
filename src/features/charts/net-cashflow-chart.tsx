"use client";

import { BalanceLineChart } from "@/features/charts/balance-line-chart";
import type { TimelinePoint } from "@/server/services/stats-service.types";

export function NetCashflowChart({
  title,
  loading,
  currency,
  points,
}: {
  readonly title: string;
  readonly loading?: boolean;
  readonly currency: string;
  readonly points: TimelinePoint[];
}) {
  return (
    <BalanceLineChart
      title={title}
      loading={loading}
      currency={currency}
      points={toRunningNet(points)}
    />
  );
}

function toRunningNet(
  points: TimelinePoint[],
): Array<{ date: string; value: string }> {
  let running = 0;
  return points.map((point) => {
    running += Number(point.net);
    return { date: point.bucket, value: String(running) };
  });
}
