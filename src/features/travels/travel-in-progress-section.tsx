"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatChartMoney, toDecimal } from "@/lib/money";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { useUiStore } from "@/stores/ui.store";
import { TransactionFormMode } from "@/types/enums";

import { TravelGoalProgressCard, TravelMoneyCard } from "./travel-money-cards";
import { TravelRealSpendingsList } from "./travel-real-spendings-list";

export function TravelInProgressSection({
  travel,
}: {
  readonly travel: TravelDetailDto;
}) {
  const t = useTranslations("travels");
  const openTransactionModal = useUiStore((state) => state.openTransactionModal);

  const planned = toDecimal(travel.summary.plannedTotal);
  const actual = toDecimal(travel.summary.actualTotal);
  const delta = actual.minus(planned);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          type="button"
          className="h-11 rounded-xl"
          onClick={() =>
            openTransactionModal(TransactionFormMode.Spending, {
              travelId: travel.id,
            })
          }
        >
          {t("addTravelSpending")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TravelMoneyCard
          title={t("plannedTotal")}
          amount={travel.summary.plannedTotal}
          currency={travel.currency}
        />
        <TravelMoneyCard
          title={t("actualTotal")}
          amount={travel.summary.actualTotal}
          currency={travel.currency}
        />
        <TravelMoneyCard
          title={t("plannedVsActual")}
          amount={delta.abs().toString()}
          currency={travel.currency}
          hint={
            delta.gte(0)
              ? t("deltaOver", {
                  amount: formatChartMoney(delta.toString(), travel.currency),
                })
              : t("deltaUnder", {
                  amount: formatChartMoney(
                    delta.abs().toString(),
                    travel.currency,
                  ),
                })
          }
        />
        <TravelGoalProgressCard
          plannedTotal={travel.summary.plannedTotal}
          actualTotal={travel.summary.actualTotal}
          goal={travel.summary.maxSpendingGoal}
          currency={travel.currency}
          useActual
        />
      </div>

      <TravelRealSpendingsList travelId={travel.id} showAddButton={false} />
    </div>
  );
}
