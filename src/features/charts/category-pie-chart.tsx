"use client";

import { Cell, Pie, PieChart } from "recharts";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChildrenDetails } from "@/features/charts/category-children-details";
import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import {
  categorySliceFill,
  categoryTypeBadgeClass,
  sliceIdentityKey,
} from "@/lib/category-chart-style";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategorySlice } from "@/server/services/stats-service.types";
import { TransactionType } from "@/types/enums";

type PieSliceDatum = Omit<CategorySlice, "amount"> & {
  amount: number;
  fill: string;
  chartKey: string;
  displayPercent: number;
};

type CategoryPieChartProps = {
  readonly title: string;
  readonly description?: string;
  readonly loading?: boolean;
  readonly slices: CategorySlice[];
  readonly currency: string;
  /** split = pie + legend side-by-side; stack = legend under pie (narrow columns). */
  readonly layout?: "split" | "stack";
  /** Color slices by earning/spending and show type chips when both appear. */
  readonly showTypeHints?: boolean;
  readonly className?: string;
  /** Hide share control (e.g. on public shared pages). */
  readonly disableShare?: boolean;
};

export function CategoryPieChart({
  title,
  description,
  loading = false,
  slices,
  currency,
  layout = "split",
  showTypeHints = false,
  className,
  disableShare = false,
}: CategoryPieChartProps) {
  const tTx = useTranslations("transaction");
  const tCharts = useTranslations("charts");
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set());

  const baseData = useMemo(() => {
    const typeCounts = { spending: 0, earning: 0 };
    return slices.map((slice) => {
      const withinType =
        slice.type === TransactionType.Earning
          ? typeCounts.earning++
          : typeCounts.spending++;
      return {
        ...slice,
        amount: Number(slice.amount),
        fill: categorySliceFill(slice.type, withinType),
        chartKey: sliceIdentityKey(
          slice.categoryId,
          slice.type,
          slice.title,
          withinType,
        ),
      };
    });
  }, [slices]);

  const slicesIdentity = useMemo(
    () => baseData.map((slice) => slice.chartKey).join("|"),
    [baseData],
  );
  const slicesIdentityRef = useRef(slicesIdentity);
  if (slicesIdentityRef.current !== slicesIdentity) {
    slicesIdentityRef.current = slicesIdentity;
    if (hiddenKeys.size > 0) {
      setHiddenKeys(new Set());
    }
  }

  const mixedTypes = useMemo(() => {
    let spending = 0;
    let earning = 0;
    for (const slice of baseData) {
      if (slice.type === TransactionType.Earning) {
        earning += 1;
      } else {
        spending += 1;
      }
    }
    return spending > 0 && earning > 0;
  }, [baseData]);

  const dataWithPercents: PieSliceDatum[] = useMemo(() => {
    const visible = baseData.filter((slice) => !hiddenKeys.has(slice.chartKey));
    const totalByType = {
      [TransactionType.Earning]: 0,
      [TransactionType.Spending]: 0,
    };
    for (const slice of visible) {
      totalByType[slice.type] += slice.amount;
    }
    const visibleTotal = visible.reduce((sum, slice) => sum + slice.amount, 0);

    return baseData.map((slice) => {
      const hidden = hiddenKeys.has(slice.chartKey);
      let displayPercent = 0;
      if (!hidden) {
        const denominator =
          showTypeHints && mixedTypes
            ? totalByType[slice.type]
            : visibleTotal;
        displayPercent =
          denominator > 0 ? (slice.amount / denominator) * 100 : 0;
      }
      return { ...slice, displayPercent };
    });
  }, [baseData, hiddenKeys, mixedTypes, showTypeHints]);

  const visibleData = useMemo(
    () => dataWithPercents.filter((slice) => !hiddenKeys.has(slice.chartKey)),
    [dataWithPercents, hiddenKeys],
  );

  const visibleTotal = useMemo(
    () => visibleData.reduce((sum, slice) => sum + slice.amount, 0),
    [visibleData],
  );

  const config = Object.fromEntries(
    baseData.map((slice) => [
      slice.chartKey,
      { label: slice.title, color: slice.fill },
    ]),
  ) satisfies ChartConfig;
  const stacked = layout === "stack";
  const autoDescription =
    visibleTotal > 0
      ? formatChartMoney(String(visibleTotal), currency)
      : tCharts("noData");

  function toggleSlice(chartKey: string) {
    setHiddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(chartKey)) {
        next.delete(chartKey);
        return next;
      }
      const visibleCount = baseData.length - next.size;
      if (visibleCount <= 1) {
        return prev;
      }
      next.add(chartKey);
      return next;
    });
  }

  return (
    <StatCard
      title={title}
      description={loading ? undefined : (description ?? autoDescription)}
      sharePayload={
        disableShare || loading || slices.length === 0
          ? null
          : {
              type: SharedChartType.CategoryPie,
              title,
              description,
              slices,
              currency,
              layout,
              showTypeHints,
            }
      }
      loading={loading}
      className={cn("h-full", className)}
      skeleton={<CategoryPieSkeleton stacked={stacked} />}
    >
      {baseData.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <div className="size-28 rounded-full border-10 border-muted/50" />
          <span>{tCharts("noCategories")}</span>
        </div>
      ) : (
        <div
          className={cn(
            "grid items-center gap-4",
            stacked ? "grid-cols-1" : "sm:grid-cols-[1fr_1.1fr]",
          )}
        >
          <ChartContainer
            config={config}
            className={cn(
              "mx-auto aspect-square w-full",
              stacked ? "max-w-40" : "max-w-50",
            )}
          >
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => {
                      const payload = item.payload as PieSliceDatum | undefined;
                      const percent = payload?.displayPercent;
                      return (
                        <div className="flex min-w-40 flex-col gap-0.5">
                          <span className="font-medium">
                            {payload?.title ?? String(_name)}
                          </span>
                          {payload && showTypeHints ? (
                            <span
                              className={cn(
                                "text-xs",
                                payload.type === TransactionType.Earning
                                  ? "text-emerald-400"
                                  : "text-rose-400",
                              )}
                            >
                              {payload.type === TransactionType.Earning
                                ? tTx("earning")
                                : tTx("spending")}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "tabular-nums",
                              payload
                                ? payload.type === TransactionType.Earning
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatChartMoney(String(value), currency)}
                            {percent !== undefined
                              ? ` · ${percent.toFixed(1)}%`
                              : null}
                          </span>
                          {payload ? (
                            <CategoryChildrenDetails
                              slice={{
                                ...payload,
                                amount: String(payload.amount),
                              }}
                              currency={currency}
                            />
                          ) : null}
                        </div>
                      );
                    }}
                  />
                }
              />
              <Pie
                data={visibleData}
                dataKey="amount"
                nameKey="chartKey"
                innerRadius={stacked ? 48 : 58}
                outerRadius={stacked ? 68 : 78}
                paddingAngle={2}
                stroke="transparent"
                onClick={(_, index) => {
                  const slice = visibleData[index];
                  if (slice) {
                    toggleSlice(slice.chartKey);
                  }
                }}
              >
                {visibleData.map((entry) => (
                  <Cell
                    key={entry.chartKey}
                    fill={entry.fill}
                    className="cursor-pointer outline-none"
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <ul className="space-y-2.5">
            {dataWithPercents.slice(0, 5).map((slice) => {
              const hidden = hiddenKeys.has(slice.chartKey);
              return (
                <li key={slice.chartKey}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2.5 text-left text-sm transition-opacity",
                      hidden && "opacity-40",
                    )}
                    onClick={() => toggleSlice(slice.chartKey)}
                    title={
                      slice.children.length > 0
                        ? slice.children
                            .map(
                              (child) =>
                                `${child.title}: ${formatChartMoney(child.amount, currency)}`,
                            )
                            .join("\n")
                        : undefined
                    }
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.fill }}
                    />
                    <span className="min-w-0 flex-1 truncate">{slice.title}</span>
                    {showTypeHints && mixedTypes ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-full px-1.5 text-[10px] font-medium",
                          categoryTypeBadgeClass(slice.type),
                        )}
                      >
                        {slice.type === TransactionType.Earning
                          ? tTx("earning")
                          : tTx("spending")}
                      </Badge>
                    ) : null}
                    <span
                      className={cn(
                        "shrink-0 tabular-nums",
                        slice.type === TransactionType.Earning
                          ? "text-emerald-400"
                          : "text-rose-400",
                      )}
                    >
                      {hidden ? "—" : `${slice.displayPercent.toFixed(0)}%`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </StatCard>
  );
}

function CategoryPieSkeleton({
  stacked = false,
}: {
  readonly stacked?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-4",
        stacked
          ? "grid-cols-1"
          : "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
      )}
    >
      <Skeleton
        className={cn(
          "mx-auto rounded-full",
          stacked ? "size-32 sm:size-36" : "size-36 sm:size-40",
        )}
      />
      <ul className="w-full space-y-2.5">
        {Array.from({ length: stacked ? 4 : 5 }, (_, index) => (
          <li
            key={`pie-legend-${index}`}
            className="flex items-center gap-2.5"
          >
            <Skeleton className="size-2.5 shrink-0 rounded-full" />
            <Skeleton className="h-4 min-w-0 flex-1" />
            <Skeleton className="h-4 w-10 shrink-0 sm:w-12" />
          </li>
        ))}
      </ul>
    </div>
  );
}
