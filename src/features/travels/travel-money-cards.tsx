"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BENTO_CARD_CLASS, BENTO_LABEL_CLASS } from "@/lib/bento";
import { formatChartMoney, toIntegerAmountString } from "@/lib/money";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { cn } from "@/lib/utils";
import { useTravelCacheStore } from "@/stores/travel-cache.store";

export function TravelMoneyCard({
  title,
  amount,
  currency,
  hint,
  className,
}: {
  readonly title: string;
  readonly amount: string;
  readonly currency: string;
  readonly hint?: string;
  readonly className?: string;
}) {
  return (
    <Card className={cn(BENTO_CARD_CLASS, "shadow-none", className)}>
      <CardHeader className="pb-2">
        <CardTitle className={BENTO_LABEL_CLASS}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatChartMoney(amount, currency)}
        </p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
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
  const [draft, setDraft] = useState(
    goal ? toIntegerAmountString(goal) : "",
  );
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
    <Card className={cn(BENTO_CARD_CLASS, "shadow-none")}>
      <CardHeader className="pb-2">
        <CardTitle className={BENTO_LABEL_CLASS}>{t("goalProgress")}</CardTitle>
        {goal && !editing ? (
          <CardAction>
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
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
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
          <div className="mt-auto">
            <GoalReadout
              spent={spent}
              goal={goal}
              currency={currency}
              ratio={ratio}
              remaining={remaining}
              remainingLabel={t("remainingGoal")}
              overLabel={t("overGoal")}
            />
          </div>
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
      </CardContent>
    </Card>
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
  return (
    <>
      <p className="text-2xl font-semibold tabular-nums">
        {formatChartMoney(String(spent), currency)}
        <span className="text-base font-normal text-muted-foreground">
          {" / "}
          {formatChartMoney(goal, currency)}
        </span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            remaining < 0 ? "bg-rose-500" : "bg-emerald-500",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {remaining >= 0
          ? `${remainingLabel}: ${formatChartMoney(String(remaining), currency)}`
          : `${overLabel}: ${formatChartMoney(String(Math.abs(remaining)), currency)}`}
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
