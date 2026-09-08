"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  AMOUNT_CLASS,
  MONEY_CARD_CONTENT_CLASS,
} from "@/features/charts/money-cards/primitives";
import { StatCard } from "@/features/charts/stat-card";
import { formatChartMoney, toIntegerAmountString } from "@/lib/money";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { cn } from "@/lib/utils";
import { useTravelCacheStore } from "@/stores/travel-cache.store";

const BAR_FLOOR_PERCENT = 7;

export function TravelMoneyCard({
  title,
  amount,
  currency,
  hint,
  amountClassName,
  details,
}: {
  readonly title: string;
  readonly amount: string;
  readonly currency: string;
  readonly hint?: string;
  readonly amountClassName?: string;
  readonly details?: readonly {
    readonly label: string;
    readonly value: string;
    readonly valueClassName?: string;
  }[];
}) {
  return (
    <StatCard
      title={title}
      className="h-full min-w-0"
      contentClassName={MONEY_CARD_CONTENT_CLASS}
    >
      <div className={cn(AMOUNT_CLASS, amountClassName)}>
        {formatChartMoney(amount, currency)}
      </div>
      {hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
      {details && details.length > 0 ? (
        <div className="mt-auto space-y-2.5 rounded-xl bg-muted/35 px-4 py-3.5 text-base">
          {details.map((row, index) => (
            <div
              key={row.label}
              className={cn(
                "flex justify-between gap-4",
                index > 0 && "border-t border-border/40 pt-2.5",
              )}
            >
              <span className="text-muted-foreground">{row.label}</span>
              <span
                className={cn("font-medium tabular-nums", row.valueClassName)}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </StatCard>
  );
}

export function TravelPlanVsActualCard({
  planned,
  actual,
  currency,
}: {
  readonly planned: string;
  readonly actual: string;
  readonly currency: string;
}) {
  const t = useTranslations("travels");
  const plannedValue = Math.max(0, Number(planned) || 0);
  const actualValue = Math.max(0, Number(actual) || 0);
  const delta = actualValue - plannedValue;
  const peak = Math.max(plannedValue, actualValue, 1);

  return (
    <StatCard
      title={t("plannedVsActual")}
      className="h-full min-w-0"
      contentClassName={MONEY_CARD_CONTENT_CLASS}
    >
      <div
        className={cn(
          AMOUNT_CLASS,
          delta > 0 && "text-rose-400",
          delta < 0 && "text-emerald-400",
        )}
      >
        {formatChartMoney(String(Math.abs(delta)), currency)}
      </div>
      <p className="text-sm text-muted-foreground">
        {delta >= 0
          ? t("deltaOver", {
              amount: formatChartMoney(String(delta), currency),
            })
          : t("deltaUnder", {
              amount: formatChartMoney(String(Math.abs(delta)), currency),
            })}
      </p>
      <div className="mt-auto space-y-4">
        <AmountBarRow
          label={t("plannedTotal")}
          amount={formatChartMoney(planned, currency)}
          widthPercent={barWidthPercent(plannedValue, peak)}
          barClassName="bg-sky-400"
          amountClassName="text-sky-400"
        />
        <AmountBarRow
          label={t("actualTotal")}
          amount={formatChartMoney(actual, currency)}
          widthPercent={barWidthPercent(actualValue, peak)}
          barClassName="bg-rose-400"
          amountClassName="text-rose-400"
        />
      </div>
    </StatCard>
  );
}

export function TravelSpendEarnCard({
  spending,
  earning,
  currency,
}: {
  readonly spending: number;
  readonly earning: number;
  readonly currency: string;
}) {
  const t = useTranslations("travels");
  const tHome = useTranslations("home");
  const net = spending - earning;
  const peak = Math.max(spending, earning, 1);

  return (
    <StatCard
      title={t("spendVsEarn")}
      className="h-full min-w-0"
      contentClassName={MONEY_CARD_CONTENT_CLASS}
    >
      <div
        className={cn(
          AMOUNT_CLASS,
          net > 0 && "text-rose-400",
          net < 0 && "text-emerald-400",
        )}
      >
        {formatChartMoney(String(net), currency)}
      </div>
      <p className="text-sm text-muted-foreground">{t("netExpenses")}</p>
      <div className="mt-auto space-y-4">
        <AmountBarRow
          label={tHome("income")}
          amount={formatChartMoney(String(earning), currency)}
          widthPercent={barWidthPercent(earning, peak)}
          barClassName="bg-emerald-400"
          amountClassName="text-emerald-400"
        />
        <AmountBarRow
          label={tHome("spendingLabel")}
          amount={formatChartMoney(String(spending), currency)}
          widthPercent={barWidthPercent(spending, peak)}
          barClassName="bg-rose-400"
          amountClassName="text-rose-400"
        />
      </div>
    </StatCard>
  );
}

export function TravelGoalProgressCard({
  travelId,
  plannedTotal,
  actualTotal,
  goal,
  currency,
  useActual = false,
  onRefresh,
}: {
  readonly travelId: string;
  readonly plannedTotal: string;
  readonly actualTotal: string;
  readonly goal: string | null;
  readonly currency: string;
  readonly useActual?: boolean;
  readonly onRefresh: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal ? toIntegerAmountString(goal) : "");
  const [saving, setSaving] = useState(false);

  const spent = Number(useActual ? actualTotal : plannedTotal);
  const max = goal ? Number(goal) : 0;
  const ratio = max > 0 ? Math.min(1, spent / max) : 0;
  const remaining = max - spent;

  async function persist(next: string | null) {
    setSaving(true);
    useTravelCacheStore.getState().patchTravel(travelId, (current) => ({
      ...current,
      maxSpendingGoal: next,
      summary: {
        ...current.summary,
        maxSpendingGoal: next,
      },
    }));
    enqueueTravelOp({
      travelId,
      op: { kind: "updateTravel", body: { maxSpendingGoal: next } },
      baseline: { maxSpendingGoal: goal },
    });
    await onRefresh();
    setSaving(false);
    setEditing(false);
  }

  return (
    <StatCard
      title={t("goalProgress")}
      className="h-full min-w-0"
      contentClassName={MONEY_CARD_CONTENT_CLASS}
      action={
        goal && !editing ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("goalSet")}
            onClick={() => {
              setDraft(toIntegerAmountString(goal));
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null
      }
    >
      {editing ? (
        <GoalEditor
          draft={draft}
          saving={saving}
          hasGoal={Boolean(goal)}
          placeholder={t("goalOptional")}
          saveLabel={t("goalSet")}
          clearLabel={t("goalClear")}
          cancelLabel={tCommon("cancel")}
          onDraftChange={setDraft}
          onSave={() => void persist(draft.trim() || null)}
          onClear={() => {
            setDraft("");
            void persist(null);
          }}
          onCancel={() => {
            setDraft(goal ? toIntegerAmountString(goal) : "");
            setEditing(false);
          }}
        />
      ) : goal ? (
        <GoalReadout
          spent={spent}
          goal={goal}
          currency={currency}
          ratio={ratio}
          remaining={remaining}
          remainingLabel={t("remainingGoal")}
          overLabel={t("overGoal")}
        />
      ) : (
        <div className="mt-auto space-y-3">
          <p className="text-sm text-muted-foreground">{t("goalOptional")}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setEditing(true)}
          >
            {t("goalSet")}
          </Button>
        </div>
      )}
    </StatCard>
  );
}

function GoalReadout({
  spent,
  goal,
  currency,
  ratio,
  remaining,
  remainingLabel,
  overLabel,
}: {
  readonly spent: number;
  readonly goal: string;
  readonly currency: string;
  readonly ratio: number;
  readonly remaining: number;
  readonly remainingLabel: string;
  readonly overLabel: string;
}) {
  const over = remaining < 0;
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            AMOUNT_CLASS,
            over ? "text-rose-400" : "text-emerald-400",
          )}
        >
          {formatChartMoney(String(spent), currency)}
        </span>
        <span className="text-base font-normal text-muted-foreground">
          / {formatChartMoney(goal, currency)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            over ? "bg-rose-400" : "bg-emerald-400",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className={cn("text-sm", over ? "text-rose-400" : "text-muted-foreground")}>
        {over
          ? `${overLabel}: ${formatChartMoney(String(Math.abs(remaining)), currency)}`
          : `${remainingLabel}: ${formatChartMoney(String(remaining), currency)}`}
      </p>
    </>
  );
}

function GoalEditor({
  draft,
  saving,
  hasGoal,
  placeholder,
  saveLabel,
  clearLabel,
  cancelLabel,
  onDraftChange,
  onSave,
  onClear,
  onCancel,
}: {
  readonly draft: string;
  readonly saving: boolean;
  readonly hasGoal: boolean;
  readonly placeholder: string;
  readonly saveLabel: string;
  readonly clearLabel: string;
  readonly cancelLabel: string;
  readonly onDraftChange: (value: string) => void;
  readonly onSave: () => void;
  readonly onClear: () => void;
  readonly onCancel?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <AmountInput
        integerOnly
        value={draft}
        placeholder={placeholder}
        onValueChange={onDraftChange}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={saving || !draft.trim()}
          onClick={onSave}
        >
          {saveLabel}
        </Button>
        {hasGoal ? (
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClear}
          >
            {clearLabel}
          </Button>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function AmountBarRow({
  label,
  amount,
  widthPercent,
  barClassName,
  amountClassName,
}: {
  readonly label: string;
  readonly amount: string;
  readonly widthPercent: number;
  readonly barClassName: string;
  readonly amountClassName: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span
          className={cn(
            "text-sm font-medium tabular-nums sm:text-base",
            amountClassName,
          )}
        >
          {amount}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500 ease-out",
            barClassName,
          )}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
    </div>
  );
}

function barWidthPercent(value: number, peak: number): number {
  if (value <= 0) {
    return 0;
  }
  return Math.max((value / peak) * 100, BAR_FLOOR_PERCENT);
}
