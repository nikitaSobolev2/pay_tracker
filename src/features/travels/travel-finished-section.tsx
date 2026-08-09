"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { listTransactions } from "@/lib/api/transactions";
import { formatChartMoney, toDecimal } from "@/lib/money";
import type { CategorySlice } from "@/server/services/stats-service.types";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import { TravelMoneyCard } from "./travel-money-cards";

export function TravelFinishedSection({
  travel,
}: {
  readonly travel: TravelDetailDto;
}) {
  const t = useTranslations("travels");
  const [items, setItems] = useState<TransactionDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    listTransactions({
      type: TransactionType.Spending,
      travelId: travel.id,
      startDate: travel.startsAt.slice(0, 10),
      endDate: travel.endsAt.slice(0, 10),
      pageSize: 100,
    })
      .then((result) => {
        if (!cancelled) {
          setItems(result.items);
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t("loadFailed"));
      });
    return () => {
      cancelled = true;
    };
  }, [t, travel.endsAt, travel.id, travel.startsAt]);

  const planned = toDecimal(travel.summary.plannedTotal);
  const actual = toDecimal(travel.summary.actualTotal);
  const delta = actual.minus(planned);

  const dayBars = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const item of items) {
      const day = item.occurredAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + Number(item.displayAmount));
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [items]);

  const categorySlices = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      if (item.categories.length === 0) {
        totals.set("other", (totals.get("other") ?? 0) + Number(item.displayAmount));
        continue;
      }
      for (const category of item.categories) {
        totals.set(
          category.title,
          (totals.get(category.title) ?? 0) + Number(item.displayAmount),
        );
      }
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
  }, [items]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{t("overview")}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TravelMoneyCard
          title={t("actualTotal")}
          amount={travel.summary.actualTotal}
          currency={travel.currency}
        />
        <TravelMoneyCard
          title={t("avgActualPerDay")}
          amount={travel.summary.avgActualPerDay}
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
      </div>

      {categorySlices.length > 0 ? (
        <CategoryPieChart
          title={t("actualCategoryPie")}
          slices={categorySlices}
          currency={travel.currency}
          layout="stack"
        />
      ) : null}

      {dayBars.length > 0 ? (
        <Card className="border-border/60 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("dailySpend")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayBars}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <Tooltip
                  formatter={(value) =>
                    formatChartMoney(String(value ?? 0), travel.currency)
                  }
                />
                <Bar dataKey="amount" fill="var(--color-chart-1)" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
