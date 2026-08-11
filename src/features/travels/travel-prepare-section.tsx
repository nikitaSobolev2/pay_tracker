"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { toDecimal, toIntegerAmountString } from "@/lib/money";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import type { CategorySlice } from "@/server/services/stats-service.types";
import { useTravelCacheStore } from "@/stores/travel-cache.store";
import { TransactionType } from "@/types/enums";

import { TravelAiControls } from "./travel-ai-controls";
import {
  CATEGORY_LABEL_KEYS,
  CATEGORY_ORDER,
} from "./travel-planned-categories";
import { TravelGoalProgressCard, TravelMoneyCard } from "./travel-money-cards";
import { TravelPlannedSpendingsList } from "./travel-planned-spendings-list";
import { TravelRealSpendingsList } from "./travel-real-spendings-list";

export function TravelPrepareSection({
  travel,
  onRefresh,
}: {
  readonly travel: TravelDetailDto;
  readonly onRefresh: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const [goalDraft, setGoalDraft] = useState(
    travel.summary.maxSpendingGoal
      ? toIntegerAmountString(travel.summary.maxSpendingGoal)
      : "",
  );
  const [savingGoal, setSavingGoal] = useState(false);

  const slices = useMemo(() => {
    const total = toDecimal(travel.summary.plannedTotal);
    return CATEGORY_ORDER.map((category): CategorySlice => {
      const amount = travel.summary.plannedByCategory[category];
      const value = toDecimal(amount);
      return {
        categoryId: category,
        title: t(CATEGORY_LABEL_KEYS[category]),
        type: TransactionType.Spending,
        amount,
        percent: total.gt(0) ? value.div(total).mul(100).toNumber() : 0,
        children: [],
      };
    }).filter((slice) => toDecimal(slice.amount).gt(0));
  }, [t, travel.summary.plannedByCategory, travel.summary.plannedTotal]);

  async function saveGoal(next: string | null) {
    setSavingGoal(true);
    useTravelCacheStore.getState().patchTravel(travel.id, (current) => ({
      ...current,
      maxSpendingGoal: next,
      summary: {
        ...current.summary,
        maxSpendingGoal: next,
      },
    }));
    enqueueTravelOp({
      travelId: travel.id,
      op: { kind: "updateTravel", body: { maxSpendingGoal: next } },
    });
    await onRefresh();
    setSavingGoal(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("tripDays", { count: travel.summary.tripDays })}
        </p>
        <TravelAiControls travel={travel} onRefresh={onRefresh} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TravelMoneyCard
          title={t("plannedTotal")}
          amount={travel.summary.plannedTotal}
          currency={travel.currency}
        />
        <TravelMoneyCard
          title={t("avgPlannedPerDay")}
          amount={travel.summary.avgPlannedPerDay}
          currency={travel.currency}
        />
        <TravelGoalProgressCard
          plannedTotal={travel.summary.plannedTotal}
          actualTotal={travel.summary.actualTotal}
          goal={travel.summary.maxSpendingGoal}
          currency={travel.currency}
        />
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("goal")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <AmountInput
            integerOnly
            value={goalDraft}
            placeholder={t("goalOptional")}
            className="h-11 flex-1 rounded-xl"
            onValueChange={setGoalDraft}
          />
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={savingGoal || !goalDraft.trim()}
            onClick={() => void saveGoal(goalDraft.trim())}
          >
            {t("goalSet")}
          </Button>
          {travel.summary.maxSpendingGoal ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={savingGoal}
              onClick={() => {
                setGoalDraft("");
                void saveGoal(null);
              }}
            >
              {t("goalClear")}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {slices.length > 0 ? (
        <CategoryPieChart
          title={t("categoryPie")}
          slices={slices}
          currency={travel.currency}
          layout="stack"
        />
      ) : null}

      <TravelPlannedSpendingsList
        travelId={travel.id}
        currency={travel.currency}
        items={travel.plannedSpendings}
        categoryBudgets={travel.categoryBudgets}
        onChanged={onRefresh}
      />

      <TravelRealSpendingsList travelId={travel.id} />
    </div>
  );
}
