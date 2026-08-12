"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { TopCategoriesCard } from "@/features/charts/money-summary-cards";
import { toDecimal } from "@/lib/money";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import type { CategorySlice } from "@/server/services/stats-service.types";
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
          travelId={travel.id}
          plannedTotal={travel.summary.plannedTotal}
          actualTotal={travel.summary.actualTotal}
          goal={travel.summary.maxSpendingGoal}
          currency={travel.currency}
          onRefresh={onRefresh}
        />
      </div>

      {slices.length > 0 ? (
        <TopCategoriesCard
          title={t("categoryPie")}
          items={slices}
          currency={travel.currency}
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
