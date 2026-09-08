"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { HideablePageBlock } from "@/components/hideable-page-block";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { TopCategoriesCard } from "@/features/charts/money-summary-cards";
import { listTransactions } from "@/lib/api/transactions";
import {
  groupTravelMoneyByDay,
  sumTravelMoneyTotals,
} from "@/lib/group-travel-money-by-day";
import { formatChartMoney } from "@/lib/money";
import { travelPageBlockScope } from "@/lib/page-block-visibility";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import type { CategorySlice } from "@/server/services/stats-service.types";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { DateRangeType, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import { TravelExpenseCharts } from "./travel-expense-charts";
import {
  TravelMoneyCard,
  TravelPlanVsActualCard,
  TravelSpendEarnCard,
} from "./travel-money-cards";
import { TravelRealSpendingsList } from "./travel-real-spendings-list";

export function TravelFinishedSection({
  travel,
}: {
  readonly travel: TravelDetailDto;
}) {
  const t = useTranslations("travels");
  const blockScope = travelPageBlockScope(travel.id);
  const [items, setItems] = useState<TransactionDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      listTransactions({
        travelId: travel.id,
        dateRangeType: DateRangeType.AllTime,
        pageSize: 100,
      })
        .then((result) => {
          if (!cancelled) {
            setItems(result.items);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled && !isNetworkError(error)) {
            toast.error(error instanceof Error ? error.message : t("loadFailed"));
          }
        });
    }
    load();
    window.addEventListener("paytracker:transactions-changed", load);
    window.addEventListener("paytracker:travel-offline-synced", load);
    return () => {
      cancelled = true;
      window.removeEventListener("paytracker:transactions-changed", load);
      window.removeEventListener("paytracker:travel-offline-synced", load);
    };
  }, [t, travel.id]);

  const money = sumTravelMoneyTotals(groupTravelMoneyByDay(items));
  const categorySlices = useMemo(
    () => spendingCategorySlices(items),
    [items],
  );

  return (
    <div className="space-y-4">
      <HideablePageBlock
        scope={blockScope}
        blockId="overview"
        title={t("overview")}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TravelSpendEarnCard
            spending={money.spending}
            earning={money.earning}
            currency={travel.currency}
          />
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
              {
                label: t("netExpenses"),
                value: formatChartMoney(String(money.net), travel.currency),
                valueClassName: signedExpenseClass(money.net),
              },
            ]}
          />
        </div>
      </HideablePageBlock>

      {categorySlices.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <TopCategoriesCard
            title={t("actualCategoryPie")}
            items={categorySlices}
            currency={travel.currency}
          />
          <CategoryPieChart
            title={t("actualCategoryPie")}
            slices={categorySlices}
            currency={travel.currency}
            layout="stack"
          />
        </div>
      ) : null}

      <TravelExpenseCharts
        travelId={travel.id}
        currency={travel.currency}
        items={items}
      />
      <TravelRealSpendingsList travelId={travel.id} />
    </div>
  );
}

function spendingCategorySlices(
  items: readonly TransactionDto[],
): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.type !== TransactionType.Spending) {
      continue;
    }
    addSpendingToCategoryTotals(totals, item);
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()].map(
    ([title, amount]): CategorySlice => ({
      categoryId: title,
      title,
      type: TransactionType.Spending,
      amount: String(amount),
      percent: total > 0 ? (amount / total) * 100 : 0,
      children: [],
    }),
  );
}

function addSpendingToCategoryTotals(
  totals: Map<string, number>,
  item: TransactionDto,
): void {
  if (item.categories.length === 0) {
    totals.set("other", (totals.get("other") ?? 0) + Number(item.displayAmount));
    return;
  }
  for (const category of item.categories) {
    totals.set(
      category.title,
      (totals.get(category.title) ?? 0) + Number(item.displayAmount),
    );
  }
}

function signedExpenseClass(amount: number): string | undefined {
  if (amount > 0) {
    return "text-rose-400";
  }
  if (amount < 0) {
    return "text-emerald-400";
  }
  return undefined;
}
