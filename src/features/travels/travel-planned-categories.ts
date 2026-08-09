import {
  BedDouble,
  Bus,
  Gift,
  MoreHorizontal,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import { TravelPlannedCategory } from "@/types/enums";

export const CATEGORY_ORDER: readonly TravelPlannedCategory[] = [
  TravelPlannedCategory.FoodDrinks,
  TravelPlannedCategory.TravelExpenses,
  TravelPlannedCategory.Housing,
  TravelPlannedCategory.Souvenirs,
  TravelPlannedCategory.Other,
];

export const CATEGORY_LABEL_KEYS: Record<TravelPlannedCategory, string> = {
  [TravelPlannedCategory.FoodDrinks]: "categoryFoodDrinks",
  [TravelPlannedCategory.TravelExpenses]: "categoryTravelExpenses",
  [TravelPlannedCategory.Housing]: "categoryHousing",
  [TravelPlannedCategory.Souvenirs]: "categorySouvenirs",
  [TravelPlannedCategory.Other]: "categoryOther",
};

export const CATEGORY_ICONS: Record<TravelPlannedCategory, LucideIcon> = {
  [TravelPlannedCategory.FoodDrinks]: UtensilsCrossed,
  [TravelPlannedCategory.TravelExpenses]: Bus,
  [TravelPlannedCategory.Housing]: BedDouble,
  [TravelPlannedCategory.Souvenirs]: Gift,
  [TravelPlannedCategory.Other]: MoreHorizontal,
};

export const CATEGORY_SURFACE_CLASS: Record<TravelPlannedCategory, string> = {
  [TravelPlannedCategory.FoodDrinks]: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  [TravelPlannedCategory.TravelExpenses]: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  [TravelPlannedCategory.Housing]: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  [TravelPlannedCategory.Souvenirs]: "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  [TravelPlannedCategory.Other]: "bg-muted text-muted-foreground",
};
