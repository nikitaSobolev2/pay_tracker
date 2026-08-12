"use client";

import { Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { BENTO_CARD_CLASS, BENTO_LABEL_CLASS } from "@/lib/bento";
import { updateEvent } from "@/lib/api/events";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { EventAuthorRole, EventSpendingCategory } from "@/types/enums";

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
    <Card className={cn(BENTO_CARD_CLASS, className)}>
      <CardHeader>
        <CardTitle className={BENTO_LABEL_CLASS}>{t("totalTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <p className="text-3xl font-semibold tabular-nums">
          {formatChartMoney(event.summary.total, event.currency)}
        </p>
        {data.length > 0 ? (
          <div className="mt-auto grid flex-1 items-center gap-3 sm:grid-cols-[minmax(0,7.5rem)_1fr]">
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
  const { event, viewer, refreshEvent } = useEventContext();
  const { share } = event.summary;
  const isOwner = viewer.role === EventAuthorRole.Owner;
  const isManual = event.manualPerPersonAmount != null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(share.average);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(event.manualPerPersonAmount ?? share.average);
    setEditing(true);
  }

  async function saveManual(amount: string | null) {
    setSaving(true);
    try {
      await updateEvent(event.id, { manualPerPersonAmount: amount });
      await refreshEvent();
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("perPersonSaveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  function submitDraft() {
    const trimmed = draft.trim();
    if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) {
      toast.error(t("perPersonInvalidAmount"));
      return;
    }
    void saveManual(trimmed);
  }

  return (
    <Card className={cn(BENTO_CARD_CLASS, className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className={BENTO_LABEL_CLASS}>{t("perPersonTitle")}</CardTitle>
        {isOwner && !editing ? (
          <div className="flex items-center gap-1">
            {isManual ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={saving}
                onClick={() => void saveManual(null)}
              >
                {t("perPersonClear")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={t("perPersonEdit")}
              disabled={saving}
              onClick={startEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitDraft();
                }
                if (event.key === "Escape") {
                  setEditing(false);
                }
              }}
              disabled={saving}
              className="h-10 text-xl font-semibold tabular-nums"
              autoFocus
            />
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={submitDraft}
            >
              {t("perPersonSave")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("perPersonCancel")}
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <p className="text-3xl font-semibold tabular-nums">
            {formatChartMoney(share.average, event.currency)}
          </p>
        )}
        {isManual ? (
          <p className="mt-auto text-sm text-muted-foreground">
            {t("perPersonManualHint")}
          </p>
        ) : share.hasUncertain ? (
          <div className="mt-auto space-y-1.5">
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
          <p className="mt-auto text-sm text-muted-foreground">
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
