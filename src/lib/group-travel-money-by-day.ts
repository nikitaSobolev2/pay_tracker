import { TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

export type TravelDayMoney = {
  readonly date: string;
  readonly spending: number;
  readonly earning: number;
  readonly net: number;
};

type TravelMoneySource = Pick<
  TransactionDto,
  "occurredAt" | "displayAmount" | "type"
>;

/** Groups travel-linked transactions into daily spend, earn, and net (spend − earn). */
export function groupTravelMoneyByDay(
  items: readonly TravelMoneySource[],
): TravelDayMoney[] {
  const byDay = new Map<string, { spending: number; earning: number }>();
  for (const item of items) {
    addItemToDay(byDay, item);
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, totals]) => ({
      date,
      spending: totals.spending,
      earning: totals.earning,
      net: totals.spending - totals.earning,
    }));
}

export function sumTravelDayNets(days: readonly TravelDayMoney[]): number {
  return sumTravelMoneyTotals(days).net;
}

export function sumTravelMoneyTotals(
  days: readonly TravelDayMoney[],
): { spending: number; earning: number; net: number } {
  return days.reduce(
    (sum, day) => ({
      spending: sum.spending + day.spending,
      earning: sum.earning + day.earning,
      net: sum.net + day.net,
    }),
    { spending: 0, earning: 0, net: 0 },
  );
}

function addItemToDay(
  byDay: Map<string, { spending: number; earning: number }>,
  item: TravelMoneySource,
): void {
  const day = item.occurredAt.slice(0, 10);
  const amount = Number(item.displayAmount);
  const current = byDay.get(day) ?? { spending: 0, earning: 0 };
  if (item.type === TransactionType.Spending) {
    current.spending += amount;
  } else if (item.type === TransactionType.Earning) {
    current.earning += amount;
  }
  byDay.set(day, current);
}
