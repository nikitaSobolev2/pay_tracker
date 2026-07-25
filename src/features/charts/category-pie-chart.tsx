"use client";

import { Cell, Pie, PieChart } from "recharts";
import { useTranslations } from "next-intl";

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
  readonly onSliceClick?: (slice: CategorySlice) => void;
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
  onSliceClick,
  disableShare = false,
}: CategoryPieChartProps) {
  const tTx = useTranslations("transaction");
  const tCharts = useTranslations("charts");
  const typeCounts = { spending: 0, earning: 0 };
  const data = slices.map((slice) => {
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

  const total = data.reduce((sum, slice) => sum + slice.amount, 0);
  const mixedTypes = typeCounts.spending > 0 && typeCounts.earning > 0;
  const config = Object.fromEntries(
    data.map((slice) => [
      slice.chartKey,
      { label: slice.title, color: slice.fill },
    ]),
  ) satisfies ChartConfig;
  const stacked = layout === "stack";
  const autoDescription =
    total > 0 ? formatChartMoney(String(total), currency) : tCharts("noData");

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
      {data.length === 0 ? (
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
                      const payload = item.payload as
                        | (CategorySlice & {
                            amount: number;
                            chartKey: string;
                          })
                        | undefined;
                      const percent = payload?.percent;
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
                data={data}
                dataKey="amount"
                nameKey="chartKey"
                innerRadius={stacked ? 48 : 58}
                outerRadius={stacked ? 68 : 78}
                paddingAngle={2}
                stroke="transparent"
                onClick={(_, index) => {
                  const slice = slices[index];
                  if (slice) {
                    onSliceClick?.(slice);
                  }
                }}
              >
                {data.map((entry) => (
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
            {data.slice(0, 5).map((slice, index) => {
              const source = slices[index];
              return (
                <li key={slice.chartKey}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 text-left text-sm"
                    onClick={() => {
                      if (source) {
                        onSliceClick?.(source);
                      }
                    }}
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
                      {slice.percent.toFixed(0)}%
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
