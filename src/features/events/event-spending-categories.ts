import {
  Beer,
  CupSoda,
  Home,
  Package,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { EventSpendingCategory } from "@/types/enums";

export const CATEGORY_LABEL_KEYS: Record<EventSpendingCategory, string> = {
  [EventSpendingCategory.Food]: "categoryFood",
  [EventSpendingCategory.Drinks]: "categoryDrinks",
  [EventSpendingCategory.Alcohol]: "categoryAlcohol",
  [EventSpendingCategory.Housing]: "categoryHousing",
  [EventSpendingCategory.Other]: "categoryOther",
};

export const CATEGORY_ICONS: Record<EventSpendingCategory, LucideIcon> = {
  [EventSpendingCategory.Food]: UtensilsCrossed,
  [EventSpendingCategory.Drinks]: CupSoda,
  [EventSpendingCategory.Alcohol]: Beer,
  [EventSpendingCategory.Housing]: Home,
  [EventSpendingCategory.Other]: Package,
};

/** Solid accents for pie slices / legend dots. */
export const CATEGORY_COLORS: Record<EventSpendingCategory, string> = {
  [EventSpendingCategory.Food]: "#34d399",
  [EventSpendingCategory.Drinks]: "#38bdf8",
  [EventSpendingCategory.Alcohol]: "#f472b6",
  [EventSpendingCategory.Housing]: "#a78bfa",
  [EventSpendingCategory.Other]: "#fbbf24",
};

/** Soft row/section fills in the spendings list. */
export const CATEGORY_SURFACE_CLASS: Record<EventSpendingCategory, string> = {
  [EventSpendingCategory.Food]: "bg-emerald-500/10",
  [EventSpendingCategory.Drinks]: "bg-sky-500/10",
  [EventSpendingCategory.Alcohol]: "bg-pink-500/10",
  [EventSpendingCategory.Housing]: "bg-violet-500/10",
  [EventSpendingCategory.Other]: "bg-amber-500/10",
};

/** Slightly darker fill for every 2nd row inside a category group. */
export const CATEGORY_ALT_SURFACE_CLASS: Record<EventSpendingCategory, string> =
  {
    [EventSpendingCategory.Food]: "bg-emerald-500/16",
    [EventSpendingCategory.Drinks]: "bg-sky-500/16",
    [EventSpendingCategory.Alcohol]: "bg-pink-500/16",
    [EventSpendingCategory.Housing]: "bg-violet-500/16",
    [EventSpendingCategory.Other]: "bg-amber-500/16",
  };

/** Stronger fill for the group header strip. */
export const CATEGORY_HEADER_SURFACE_CLASS: Record<
  EventSpendingCategory,
  string
> = {
  [EventSpendingCategory.Food]: "bg-emerald-500/18",
  [EventSpendingCategory.Drinks]: "bg-sky-500/18",
  [EventSpendingCategory.Alcohol]: "bg-pink-500/18",
  [EventSpendingCategory.Housing]: "bg-violet-500/18",
  [EventSpendingCategory.Other]: "bg-amber-500/18",
};

/** Fixed order keeps the grouped spendings list stable between renders. */
export const CATEGORY_ORDER: readonly EventSpendingCategory[] = [
  EventSpendingCategory.Food,
  EventSpendingCategory.Drinks,
  EventSpendingCategory.Alcohol,
  EventSpendingCategory.Housing,
  EventSpendingCategory.Other,
];
