"use client";

import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatChartMoney } from "@/lib/money";
import { EventSpendingCategory } from "@/types/enums";

import { useEventContext } from "./event-context";
import {
  CATEGORY_COLORS,
  CATEGORY_LABEL_KEYS,
} from "./event-spending-categories";

const chartConfig = { total: { label: "Total" } } satisfies ChartConfig;

type CategoryPieDatum = {
  readonly category: EventSpendingCategory;
  readonly label: string;
  readonly total: number;
  readonly percent: number;
  readonly fill: string;
};

export function EventTotalCard({ className }: { readonly className?: string }) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const grandTotal = Number(event.summary.total);
  const data: CategoryPieDatum[] = event.summary.byCategory.map((entry) => {
    const total = Number(entry.total);
    return {
      category: entry.category,
      label: t(CATEGORY_LABEL_KEYS[entry.category]),
      total,
      percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
      fill: CATEGORY_COLORS[entry.category],
    };
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{t("totalTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-semibold tabular-nums">
          {formatChartMoney(event.summary.total, event.currency)}
        </p>
        {data.length > 0 ? (
          <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,7.5rem)_1fr]">
            <ChartContainer
              config={chartConfig}
              className="mx-auto aspect-square h-28 w-28"
            >
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      hideLabel
                      formatter={(value, _name, item) => {
                        const payload = item.payload as
                          | CategoryPieDatum
                          | undefined;
                        return (
                          <div className="flex min-w-28 flex-col gap-0.5">
                            <span className="font-medium">
                              {payload?.label ?? String(_name)}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {formatChartMoney(String(value), event.currency)}
                              {payload
                                ? ` · ${payload.percent.toFixed(0)}%`
                                : null}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="total"
                  nameKey="label"
                  innerRadius={32}
                  outerRadius={50}
                  paddingAngle={3}
                  stroke="var(--popover)"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.category}
                      fill={entry.fill}
                      className="drop-shadow-sm outline-none"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="min-w-0 space-y-1.5">
              {data.map((entry) => (
                <li
                  key={entry.category}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full shadow-sm ring-1 ring-black/10"
                      style={{ backgroundColor: entry.fill }}
                      aria-hidden
                    />
                    <span className="truncate text-muted-foreground">
                      {entry.label}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground/90">
                    {formatChartMoney(entry.total, event.currency)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("spendingsEmpty")}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function EventPerPersonCard({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const { share } = event.summary;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{t("perPersonTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tabular-nums">
          {formatChartMoney(share.average, event.currency)}
        </p>
        {share.hasUncertain ? (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {t("perPersonRange", {
                low: formatChartMoney(share.lowerBound, event.currency),
                high: formatChartMoney(share.upperBound, event.currency),
              })}
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/50"
                style={{ width: `${rangeFillPercent(share)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t("perPersonRangeHint")}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("perPersonAllCertain")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function rangeFillPercent(share: {
  lowerBound: string;
  upperBound: string;
}): number {
  const upper = Number(share.upperBound);
  if (upper <= 0) {
    return 0;
  }
  return Math.min(100, (Number(share.lowerBound) / upper) * 100);
}
