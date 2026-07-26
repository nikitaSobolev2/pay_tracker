"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ListTree, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
  categoryTypeTextClass,
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
  parentChartKey?: string;
};

function childChartKey(parentChartKey: string, child: CategorySlice): string {
  return `child:${parentChartKey}:${child.categoryId ?? child.title}`;
}

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
  const [openChildrenKey, setOpenChildrenKey] = useState<string | null>(null);

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
    if (openChildrenKey != null) {
      setOpenChildrenKey(null);
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

  const expandedParent = useMemo(
    () =>
      openChildrenKey == null
        ? null
        : (baseData.find((slice) => slice.chartKey === openChildrenKey) ?? null),
    [baseData, openChildrenKey],
  );

  const childDatums = useMemo(() => {
    if (!expandedParent || expandedParent.children.length === 0) {
      return [] as PieSliceDatum[];
    }
    return expandedParent.children.map((child, index) => ({
      ...child,
      type: expandedParent.type,
      amount: Number(child.amount),
      fill: categorySliceFill(expandedParent.type, index),
      chartKey: childChartKey(expandedParent.chartKey, child),
      displayPercent: child.percent,
      parentChartKey: expandedParent.chartKey,
      children: [] as CategorySlice[],
    }));
  }, [expandedParent]);

  const pieSourceData = useMemo(() => {
    if (!expandedParent) {
      return baseData;
    }
    const withoutParent = baseData.filter(
      (slice) => slice.chartKey !== expandedParent.chartKey,
    );
    return [...withoutParent, ...childDatums];
  }, [baseData, childDatums, expandedParent]);

  const dataWithPercents: PieSliceDatum[] = useMemo(() => {
    const visible = pieSourceData.filter(
      (slice) => !hiddenKeys.has(slice.chartKey),
    );
    const totalByType = {
      [TransactionType.Earning]: 0,
      [TransactionType.Spending]: 0,
    };
    for (const slice of visible) {
      totalByType[slice.type] += slice.amount;
    }
    const visibleTotal = visible.reduce((sum, slice) => sum + slice.amount, 0);

    return pieSourceData.map((slice) => {
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
  }, [hiddenKeys, mixedTypes, pieSourceData, showTypeHints]);

  const legendData = useMemo(() => {
    const withPercents = baseData.map((slice) => {
      const fromPie = dataWithPercents.find(
        (item) => item.chartKey === slice.chartKey,
      );
      if (fromPie) {
        return fromPie;
      }
      // Parent replaced by children while expanded — keep legend percent from own amount.
      const visibleRoots = baseData.filter(
        (item) =>
          !hiddenKeys.has(item.chartKey) ||
          item.chartKey === expandedParent?.chartKey,
      );
      const visibleTotal = visibleRoots.reduce((sum, item) => {
        if (
          expandedParent &&
          item.chartKey === expandedParent.chartKey
        ) {
          const visibleChildren = childDatums.filter(
            (child) => !hiddenKeys.has(child.chartKey),
          );
          return (
            sum +
            visibleChildren.reduce((childSum, child) => childSum + child.amount, 0)
          );
        }
        return hiddenKeys.has(item.chartKey) ? sum : sum + item.amount;
      }, 0);
      const amountStillVisible =
        !hiddenKeys.has(slice.chartKey) ||
        (expandedParent?.chartKey === slice.chartKey &&
          childDatums.some((child) => !hiddenKeys.has(child.chartKey)));
      return {
        ...slice,
        displayPercent:
          amountStillVisible && visibleTotal > 0
            ? (slice.amount / visibleTotal) * 100
            : 0,
      };
    });
    return withPercents;
  }, [
    baseData,
    childDatums,
    dataWithPercents,
    expandedParent,
    hiddenKeys,
  ]);

  const visibleData = useMemo(
    () => dataWithPercents.filter((slice) => !hiddenKeys.has(slice.chartKey)),
    [dataWithPercents, hiddenKeys],
  );

  const visibleTotal = useMemo(
    () => visibleData.reduce((sum, slice) => sum + slice.amount, 0),
    [visibleData],
  );

  const openChildrenSlice = useMemo(
    () =>
      openChildrenKey == null
        ? null
        : (legendData.find((slice) => slice.chartKey === openChildrenKey) ??
          null),
    [legendData, openChildrenKey],
  );

  const config = Object.fromEntries(
    [...baseData, ...childDatums].map((slice) => [
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
      const pieKeys = pieSourceData.map((slice) => slice.chartKey);
      const visibleCount = pieKeys.filter((key) => !next.has(key)).length;
      if (visibleCount <= 1) {
        return prev;
      }
      next.add(chartKey);
      return next;
    });
  }

  function clearChildHiddenKeys(parentChartKey: string) {
    const prefix = `child:${parentChartKey}:`;
    setHiddenKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const key of prev) {
        if (key.startsWith(prefix)) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
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

          <div className="relative min-h-40">
            <ul className="space-y-2.5">
              {legendData.slice(0, 5).map((slice) => {
                const expanded = openChildrenKey === slice.chartKey;
                const hidden =
                  !expanded && hiddenKeys.has(slice.chartKey);
                const hasChildren = slice.children.length > 0;
                return (
                  <li
                    key={slice.chartKey}
                    className={cn(
                      "group grid w-full grid-cols-[minmax(0,1fr)_4.5rem_2rem] items-center gap-x-2 text-sm transition-opacity",
                      hidden && "opacity-40",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-2.5 text-left"
                      onClick={() => {
                        if (expanded) {
                          return;
                        }
                        toggleSlice(slice.chartKey);
                      }}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.fill }}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {slice.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "text-right tabular-nums",
                        categoryTypeTextClass(slice.type),
                      )}
                      onClick={() => {
                        if (expanded) {
                          return;
                        }
                        toggleSlice(slice.chartKey);
                      }}
                    >
                      <span className="block">
                        {hidden
                          ? "—"
                          : `${slice.displayPercent.toFixed(0)}%`}
                      </span>
                      <span className="block text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                        {formatChartMoney(String(slice.amount), currency)}
                      </span>
                    </button>
                    {hasChildren ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "size-8 rounded-lg text-muted-foreground",
                          expanded && "bg-muted text-foreground",
                        )}
                        onClick={() => {
                          if (openChildrenKey === slice.chartKey) {
                            clearChildHiddenKeys(slice.chartKey);
                            setOpenChildrenKey(null);
                            return;
                          }
                          setOpenChildrenKey(slice.chartKey);
                        }}
                        aria-label={
                          expanded
                            ? tCharts("hideSubcategories")
                            : tCharts("showSubcategories")
                        }
                        aria-pressed={expanded}
                      >
                        <ListTree className="size-4" />
                      </Button>
                    ) : (
                      <span aria-hidden className="size-8" />
                    )}
                  </li>
                );
              })}
            </ul>

            {openChildrenSlice && openChildrenSlice.children.length > 0 ? (
              <div className="absolute inset-0 z-10 flex flex-col rounded-xl border border-border/60 bg-popover p-3 shadow-lg">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {tCharts("subcategoriesOf", {
                        title: openChildrenSlice.title,
                      })}
                    </p>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        categoryTypeTextClass(openChildrenSlice.type),
                      )}
                    >
                      {formatChartMoney(
                        String(openChildrenSlice.amount),
                        currency,
                      )}
                      {" · "}
                      {openChildrenSlice.displayPercent.toFixed(0)}%
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg"
                    onClick={() => {
                      clearChildHiddenKeys(openChildrenSlice.chartKey);
                      setOpenChildrenKey(null);
                    }}
                    aria-label={tCharts("closeSubcategories")}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                  {openChildrenSlice.children.map((child, index) => {
                    const key = childChartKey(
                      openChildrenSlice.chartKey,
                      child,
                    );
                    const childHidden = hiddenKeys.has(key);
                    const childFill = categorySliceFill(
                      openChildrenSlice.type,
                      index,
                    );
                    const pieChild = dataWithPercents.find(
                      (item) => item.chartKey === key,
                    );
                    return (
                      <li key={key}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm transition-opacity hover:bg-muted/50",
                            childHidden && "opacity-40",
                          )}
                          onClick={() => toggleSlice(key)}
                        >
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: childFill }}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {child.title}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 tabular-nums",
                              categoryTypeTextClass(openChildrenSlice.type),
                            )}
                          >
                            {childHidden
                              ? "—"
                              : formatChartMoney(child.amount, currency)}
                            <span className="ml-1">
                              {childHidden
                                ? ""
                                : `${(pieChild?.displayPercent ?? child.percent).toFixed(0)}%`}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
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
