"use client";

import { useTranslations } from "next-intl";

import { HideablePageBlock } from "@/components/hideable-page-block";
import { formatChartMoney } from "@/lib/money";
import { travelPageBlockScope } from "@/lib/page-block-visibility";
import type { TravelDetailDto } from "@/server/services/travel-service.types";

import { TravelExpenseChartsForTravel } from "./travel-expense-charts";
import {
  TravelGoalProgressCard,
  TravelMoneyCard,
  TravelPlanVsActualCard,
} from "./travel-money-cards";
import { TravelRealSpendingsList } from "./travel-real-spendings-list";

export function TravelInProgressSection({
  travel,
  onRefresh,
}: {
  readonly travel: TravelDetailDto;
  readonly onRefresh: () => Promise<void>;
}) {
  const t = useTranslations("travels");
  const blockScope = travelPageBlockScope(travel.id);

  return (
    <div className="space-y-4">
      <HideablePageBlock
        scope={blockScope}
        blockId="overview"
        title={t("overview")}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TravelPlanVsActualCard
            planned={travel.summary.plannedTotal}
            actual={travel.summary.actualTotal}
            currency={travel.currency}
          />
          <TravelMoneyCard
            title={t("actualTotal")}
            amount={travel.summary.actualTotal}
            currency={travel.currency}
            amountClassName="text-rose-400"
            details={[
              {
                label: t("avgActualPerDay"),
                value: formatChartMoney(
                  travel.summary.avgActualPerDay,
                  travel.currency,
                ),
                valueClassName: "text-rose-400",
              },
            ]}
          />
          <TravelGoalProgressCard
            travelId={travel.id}
            plannedTotal={travel.summary.plannedTotal}
            actualTotal={travel.summary.actualTotal}
            goal={travel.summary.maxSpendingGoal}
            currency={travel.currency}
            useActual
            onRefresh={onRefresh}
          />
        </div>
      </HideablePageBlock>

      <TravelExpenseChartsForTravel
        travelId={travel.id}
        currency={travel.currency}
      />
      <TravelRealSpendingsList travelId={travel.id} />
    </div>
  );
}
