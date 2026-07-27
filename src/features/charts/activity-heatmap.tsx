"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { IncomeVsSpendingsCard } from "@/features/charts/money-summary-cards";
import { StatCard } from "@/features/charts/stat-card";
import { useContainedHorizontalScroll } from "@/features/charts/use-contained-horizontal-scroll";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import { fetchActivityHeatmap, fetchTransactionStats } from "@/lib/api/stats";
import type { ActivityHeatmapParams } from "@/lib/api/stats";
import { fetchPublicShareDay } from "@/lib/api/shares";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type {
  ActivityHeatmap,
  ListPageStats,
} from "@/server/services/stats-service.types";

const EMERALD = "52,211,153";
const ROSE = "251,113,133";
const SKELETON_WEEKS = 53;

type ActivityHeatmapCardProps = {
  readonly title: string;
  readonly currency: string;
  /** Non-date filters applied to the heatmap and the per-day drill-down. */
  readonly filters?: ActivityHeatmapParams;
  /** When set, renders from snapshot and loads day stats via public share API. */
  readonly sharedData?: ActivityHeatmap;
  readonly shareId?: string;
  readonly disableShare?: boolean;
  /** side = beside heatmap (app pages); below = under heatmap (shared page). */
  readonly drilldownLayout?: "side" | "below";
};

export function ActivityHeatmapCard({
  title,
  currency,
  filters,
  sharedData,
  shareId,
  disableShare = false,
  drilldownLayout = "side",
}: ActivityHeatmapCardProps) {
  const t = useTranslations("charts");
  const tHome = useTranslations("home");
  const locale = useLocale();

  const [data, setData] = useState<ActivityHeatmap | null>(sharedData ?? null);
  const [loading, setLoading] = useState(!sharedData);
  const [selected, setSelected] = useState<string | null>(null);
  const [dayStats, setDayStats] = useState<ListPageStats | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const filterKey = JSON.stringify(filters ?? {});
  const isSharedView = Boolean(sharedData || shareId);

  useEffect(() => {
    if (sharedData) {
      setData(sharedData);
      setLoading(false);
      return;
    }
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- filter change resets and refetches */
    setLoading(true);
    setSelected(null);
    setDayStats(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    fetchActivityHeatmap(filters)
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
    // filterKey captures the filter object contents.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, sharedData]);

  useEffect(() => {
    if (isSharedView) {
      return;
    }
    function onTransactionsChanged() {
      fetchActivityHeatmap(filters).then(setData);
    }
    window.addEventListener(
      "paytracker:transactions-changed",
      onTransactionsChanged,
    );
    return () => {
      window.removeEventListener(
        "paytracker:transactions-changed",
        onTransactionsChanged,
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, isSharedView]);

  const columns = useMemo(() => toColumns(data?.days ?? []), [data]);
  const maxEarning = Number(data?.maxEarning ?? "0");
  const maxSpending = Number(data?.maxSpending ?? "0");
  const columnCount = columns.length;
  const scrollResetKey = `${data?.days.length ?? 0}:${columnCount}:${filterKey}`;
  const { scrollRef } = useContainedHorizontalScroll(scrollResetKey, {
    enablePointerDrag: false,
  });

  const selectDay = useCallback(
    (date: string, earning: number, spending: number) => {
      const empty = earning <= 0 && spending <= 0;
      if (empty) {
        if (selected) {
          setSelected(null);
          setDayStats(null);
        }
        return;
      }
      if (date === selected) {
        setSelected(null);
        setDayStats(null);
        return;
      }
      setSelected(date);
      setDayLoading(true);
      const request = shareId
        ? fetchPublicShareDay(shareId, date)
        : fetchTransactionStats({
            ...filters,
            startDate: date,
            endDate: date,
          });
      request.then(setDayStats).finally(() => setDayLoading(false));
    },
    [selected, filters, shareId],
  );

  const stackDrilldown = drilldownLayout === "below";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        !stackDrilldown && "lg:flex-row lg:items-stretch",
        selected && "rounded-2xl bg-muted/35 p-3",
      )}
    >
      <div
        className={cn(
          "min-w-0 transition-[flex-basis,max-width,width] duration-500 ease-out",
          stackDrilldown
            ? "w-full"
            : selected
              ? "lg:basis-1/2 lg:max-w-[50%] lg:self-start"
              : "lg:basis-full lg:max-w-full",
        )}
      >
        <StatCard
          title={title}
          description={t("activityHint")}
          sharePayload={
            disableShare || loading || !data
              ? null
              : {
                  type: SharedChartType.ActivityHeatmap,
                  title,
                  currency,
                  data,
                  filters,
                }
          }
          loading={loading}
          skeleton={<HeatmapSkeleton />}
          className="min-w-0"
        >
          {data && data.days.length > 0 ? (
            <TooltipProvider delay={280}>
              <div className="space-y-3">
                <div
                  ref={scrollRef}
                  className="touch-none overflow-x-auto overscroll-contain scrollbar-none md:overflow-visible md:touch-auto"
                >
                  <div
                    className="inline-block min-w-full space-y-2 md:block md:w-full md:space-y-3"
                    style={
                      {
                        "--heatmap-cols": columnCount,
                      } as CSSProperties
                    }
                  >
                    <MonthLabels columns={columns} locale={locale} />
                    <div
                      className={cn(
                        "grid gap-1 md:gap-0.75",
                        "grid-rows-7 grid-flow-col",
                        "grid-cols-[repeat(var(--heatmap-cols),1rem)]",
                        "md:grid-cols-[repeat(var(--heatmap-cols),minmax(0,1fr))]",
                      )}
                    >
                      {data.days.map((day) => (
                        <HeatmapCell
                          key={day.date}
                          date={day.date}
                          earning={Number(day.earning)}
                          spending={Number(day.spending)}
                          maxEarning={maxEarning}
                          maxSpending={maxSpending}
                          currency={currency}
                          locale={locale}
                          selected={day.date === selected}
                          onSelect={selectDay}
                          incomeLabel={tHome("income")}
                          spendingLabel={tHome("spendingLabel")}
                          netLabel={tHome("net")}
                          emptyLabel={t("noTransactions")}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <Legend
                  lessLabel={t("less")}
                  moreLabel={t("more")}
                  incomeLabel={tHome("income")}
                  spendingLabel={tHome("spendingLabel")}
                />
              </div>
            </TooltipProvider>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              {t("noActivity")}
            </div>
          )}
        </StatCard>
      </div>

      {selected ? (
        <div
          className={cn(
            stackDrilldown
              ? "grid w-full grid-cols-1 gap-3 md:grid-cols-2"
              : "contents",
          )}
        >
          <div
            key={`pie-${selected}`}
            className={cn(
              "flex min-w-0 animate-in fade-in-0 duration-500 fill-mode-both",
              stackDrilldown
                ? "slide-in-from-bottom-3"
                : "slide-in-from-right-4 lg:basis-1/4 lg:max-w-[25%]",
            )}
          >
            <CategoryPieChart
              title={formatDayLabel(selected, locale)}
              loading={dayLoading}
              slices={dayStats?.categoryPie ?? []}
              currency={dayStats?.displayCurrency ?? currency}
              layout="stack"
              showTypeHints
              className="h-full flex-1"
              disableShare={disableShare}
            />
          </div>
          <div
            key={`income-${selected}`}
            className={cn(
              "flex min-w-0 animate-in fade-in-0 duration-500 fill-mode-both delay-75",
              stackDrilldown
                ? "slide-in-from-bottom-3"
                : "slide-in-from-right-4 lg:basis-1/4 lg:max-w-[25%]",
            )}
          >
            <IncomeVsSpendingsCard
              title={`${tHome("incomeVsSpendings")} · ${formatDayLabel(selected, locale)}`}
              loading={dayLoading}
              income={
                dayStats?.periodTotals.earning ?? {
                  amount: "0",
                  currency,
                }
              }
              spending={
                dayStats?.periodTotals.spending ?? {
                  amount: "0",
                  currency,
                }
              }
              net={dayStats?.periodTotals.net ?? { amount: "0", currency }}
              hideComparison
              disableShare={disableShare}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeatmapCell({
  date,
  earning,
  spending,
  maxEarning,
  maxSpending,
  currency,
  locale,
  selected,
  onSelect,
  incomeLabel,
  spendingLabel,
  netLabel,
  emptyLabel,
}: {
  readonly date: string;
  readonly earning: number;
  readonly spending: number;
  readonly maxEarning: number;
  readonly maxSpending: number;
  readonly currency: string;
  readonly locale: string;
  readonly selected: boolean;
  readonly onSelect: (date: string, earning: number, spending: number) => void;
  readonly incomeLabel: string;
  readonly spendingLabel: string;
  readonly netLabel: string;
  readonly emptyLabel: string;
}) {
  const hasData = earning > 0 || spending > 0;
  const net = earning - spending;
  const dayLabel = formatDayLabel(date, locale);
  const ariaLabel = hasData
    ? `${dayLabel}. ${incomeLabel} ${formatChartMoney(String(earning), currency)}. ${spendingLabel} ${formatChartMoney(String(spending), currency)}`
    : `${dayLabel}. ${emptyLabel}`;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            onClick={() => onSelect(date, earning, spending)}
            style={cellStyle(earning, spending, maxEarning, maxSpending)}
            className={cn(
              "aspect-square size-4 shrink-0 rounded-[3px] transition-transform duration-150 md:size-auto md:w-full",
              hasData ? "cursor-pointer hover:scale-125" : "cursor-default",
              !hasData && "bg-foreground/6",
              selected &&
                "ring-2 ring-foreground ring-offset-1 ring-offset-background",
            )}
          />
        }
      />
      <TooltipContent
        side="top"
        sideOffset={6}
        className="flex max-w-56 flex-col items-start gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs text-foreground shadow-xl [&>div:last-child]:bg-background [&>div:last-child]:fill-background"
      >
        <span className="font-medium text-foreground">{dayLabel}</span>
        {hasData ? (
          <>
            <span className="tabular-nums text-emerald-400">
              {incomeLabel} {formatChartMoney(String(earning), currency)}
            </span>
            <span className="tabular-nums text-rose-400">
              {spendingLabel} {formatChartMoney(String(spending), currency)}
            </span>
            <span className={cn("tabular-nums", netToneClassName(net))}>
              {netLabel} {formatChartMoney(String(net), currency)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{emptyLabel}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function MonthLabels({
  columns,
  locale,
}: {
  readonly columns: string[][];
  readonly locale: string;
}) {
  const labels = columns.map((week, index) => {
    const first = week[0];
    if (!first) {
      return "";
    }
    const month = Number(first.slice(5, 7)) - 1;
    const previousFirst = columns[index - 1]?.[0];
    const previousMonth = previousFirst
      ? Number(previousFirst.slice(5, 7)) - 1
      : -1;
    if (month === previousMonth) {
      return "";
    }
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      month: "short",
    }).format(new Date(Date.UTC(2000, month, 1)));
  });

  return (
    <div
      className={cn(
        "grid gap-1 text-[10px] text-muted-foreground md:gap-0.75",
        "grid-cols-[repeat(var(--heatmap-cols),1rem)]",
        "md:grid-cols-[repeat(var(--heatmap-cols),minmax(0,1fr))]",
      )}
    >
      {labels.map((label, index) => (
        <span key={`month-${label || "empty"}-${index}`} className="truncate">
          {label}
        </span>
      ))}
    </div>
  );
}

function Legend({
  lessLabel,
  moreLabel,
  incomeLabel,
  spendingLabel,
}: {
  readonly lessLabel: string;
  readonly moreLabel: string;
  readonly incomeLabel: string;
  readonly spendingLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: `rgba(${EMERALD},0.85)` }}
          />
          {incomeLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: `rgba(${ROSE},0.85)` }}
          />
          {spendingLabel}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span>{lessLabel}</span>
        <span className="size-2.5 rounded-[3px] bg-foreground/6" />
        <span
          className="size-2.5 rounded-[3px]"
          style={{ backgroundColor: `rgba(${EMERALD},0.45)` }}
        />
        <span
          className="size-2.5 rounded-[3px]"
          style={{ backgroundColor: `rgba(${EMERALD},0.75)` }}
        />
        <span
          className="size-2.5 rounded-[3px]"
          style={{ backgroundColor: `rgba(${EMERALD},1)` }}
        />
        <span>{moreLabel}</span>
      </div>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto scrollbar-none md:overflow-visible">
        <div
          className="inline-block min-w-full space-y-2 md:block md:w-full md:space-y-3"
          style={
            {
              "--heatmap-cols": SKELETON_WEEKS,
            } as CSSProperties
          }
        >
          <Skeleton className="h-3 w-full min-w-[calc(53*1rem+52*0.25rem)] md:min-w-0" />
          <div
            className={cn(
              "grid gap-1 md:gap-0.75",
              "grid-rows-7 grid-flow-col",
              "grid-cols-[repeat(var(--heatmap-cols),1rem)]",
              "md:grid-cols-[repeat(var(--heatmap-cols),minmax(0,1fr))]",
            )}
          >
            {Array.from({ length: SKELETON_WEEKS * 7 }, (_, index) => (
              <Skeleton
                key={`heat-${index}`}
                className="aspect-square size-4 rounded-[3px] md:size-auto md:w-full"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function netToneClassName(net: number): string {
  if (net > 0) {
    return "text-emerald-400";
  }
  if (net < 0) {
    return "text-rose-400";
  }
  return "text-muted-foreground";
}

function intensity(value: number, max: number): number {
  if (value <= 0 || max <= 0) {
    return 0;
  }
  return 0.3 + 0.7 * Math.sqrt(value / max);
}

function cellStyle(
  earning: number,
  spending: number,
  maxEarning: number,
  maxSpending: number,
): CSSProperties {
  const earnAlpha = intensity(earning, maxEarning);
  const spendAlpha = intensity(spending, maxSpending);
  if (earning > 0 && spending > 0) {
    return {
      background: `linear-gradient(135deg, rgba(${EMERALD},${earnAlpha}) 0 50%, rgba(${ROSE},${spendAlpha}) 50% 100%)`,
    };
  }
  if (earning > 0) {
    return { backgroundColor: `rgba(${EMERALD},${earnAlpha})` };
  }
  if (spending > 0) {
    return { backgroundColor: `rgba(${ROSE},${spendAlpha})` };
  }
  return {};
}

function toColumns(days: { date: string }[]): string[][] {
  const columns: string[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    columns.push(days.slice(index, index + 7).map((day) => day.date));
  }
  return columns;
}

function formatDayLabel(date: string, locale: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}
