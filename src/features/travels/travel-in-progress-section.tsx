"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionMobileList } from "@/features/transactions/transaction-mobile-list";
import { listTransactions } from "@/lib/api/transactions";
import { formatChartMoney, toDecimal } from "@/lib/money";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { useUiStore } from "@/stores/ui.store";
import { TransactionFormMode, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import { TravelGoalProgressCard, TravelMoneyCard } from "./travel-money-cards";

export function TravelInProgressSection({
  travel,
}: {
  readonly travel: TravelDetailDto;
}) {
  const t = useTranslations("travels");
  const openTransactionModal = useUiStore((state) => state.openTransactionModal);
  const openEditTransactionModal = useUiStore(
    (state) => state.openEditTransactionModal,
  );
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void listTransactions({
      type: TransactionType.Spending,
      travelId: travel.id,
      startDate: travel.startsAt.slice(0, 10),
      endDate: travel.endsAt.slice(0, 10),
      pageSize: 100,
    })
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("loadFailed"));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t, travel.endsAt, travel.id, travel.startsAt]);

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

      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t("realSpendings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("spendingEmptyCategory")}
            </p>
          ) : (
            <TransactionMobileList
              variant="plain"
              items={items}
              selected={selected}
              onToggleOne={(id) =>
                setSelected((prev) =>
                  prev.includes(id)
                    ? prev.filter((item) => item !== id)
                    : [...prev, id],
                )
              }
              onEnterSelection={(id) => setSelected([id])}
              onEdit={(tx) => openEditTransactionModal(tx)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
