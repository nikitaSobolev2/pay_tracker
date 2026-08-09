import { toDecimal } from "@/lib/money";
import { countTravelDays } from "@/lib/travel-phase";
import { TravelPlannedCategory } from "@/types/enums";

const FIXED_CATEGORIES = new Set<TravelPlannedCategory>([
  TravelPlannedCategory.Housing,
  TravelPlannedCategory.TravelExpenses,
]);

export type TravelAnalysisItem = {
  readonly id: string;
  readonly title: string;
  readonly category: TravelPlannedCategory;
  readonly amount: string;
  readonly note: string | null;
};

export type TravelAnalysisContext = {
  readonly title: string;
  readonly currency: string;
  readonly placeLabel: string | null;
  readonly placeCountry: string | null;
  readonly placeCity: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly tripDays: number;
  readonly maxSpendingGoal: string | null;
  readonly contextMessage: string | null;
  readonly items: readonly TravelAnalysisItem[];
  readonly fixedTotal: string;
  readonly flexibleTotal: string;
  readonly grandTotal: string;
};

export function buildTravelAnalysisContext(input: {
  readonly title: string;
  readonly currency: string;
  readonly placeLabel: string | null;
  readonly placeCountry: string | null;
  readonly placeCity: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly maxSpendingGoal: string | null;
  readonly contextMessage: string | null;
  readonly items: readonly TravelAnalysisItem[];
}): TravelAnalysisContext {
  let fixedTotal = toDecimal("0");
  let flexibleTotal = toDecimal("0");

  for (const item of input.items) {
    const amount = toDecimal(item.amount);
    if (FIXED_CATEGORIES.has(item.category)) {
      fixedTotal = fixedTotal.plus(amount);
    } else {
      flexibleTotal = flexibleTotal.plus(amount);
    }
  }

  return {
    title: input.title,
    currency: input.currency,
    placeLabel: input.placeLabel,
    placeCountry: input.placeCountry,
    placeCity: input.placeCity,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    tripDays: countTravelDays(input.startsAt, input.endsAt),
    maxSpendingGoal: input.maxSpendingGoal,
    contextMessage: input.contextMessage,
    items: input.items,
    fixedTotal: fixedTotal.toString(),
    flexibleTotal: flexibleTotal.toString(),
    grandTotal: fixedTotal.plus(flexibleTotal).toString(),
  };
}
