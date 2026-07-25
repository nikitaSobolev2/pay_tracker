"use client";

import { format, parseISO } from "date-fns";
import type { enUS } from "date-fns/locale";
import type { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  type DateFilterPreset,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filter.types";
import { listCategories } from "@/lib/api/categories";
import {
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { DateRangeType, TransactionDebtRole, TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

type TransactionTranslator = ReturnType<typeof useTranslations<"transaction">>;

export const CALENDAR_OPTIONS = [
  DateRangeType.Day,
  DateRangeType.Month,
  DateRangeType.Year,
  DateRangeType.AllTime,
] as const;

export function toggleValue<T>(list: T[], item: T): T[] {
  return list.includes(item)
    ? list.filter((entry) => entry !== item)
    : [...list, item];
}

export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function parseDateKey(value: string): Date {
  return parseISO(value);
}

export function cloneFilterState(
  state: TransactionFilterState,
): TransactionFilterState {
  return {
    datePreset: { ...state.datePreset },
    debtRoles: [...state.debtRoles],
    categoryIds: [...state.categoryIds],
    counterpartyIds: [...state.counterpartyIds],
    hideUncategorized: state.hideUncategorized,
  };
}

/** Parses a raw rolling-window input into a positive integer, or null. */
export function parseRollingCount(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }
  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function formatCustomPeriodLabel(
  preset: DateFilterPreset,
  t: TransactionTranslator,
  dateLocale: typeof enUS,
): string {
  if (preset.kind === "rolling") {
    if (preset.unit === "days") {
      return t("lastNDays", { n: preset.n });
    }
    if (preset.unit === "months") {
      return t("lastNMonths", { n: preset.n });
    }
    return t("lastNYears", { n: preset.n });
  }
  if (preset.kind === "absolute") {
    const from = format(parseDateKey(preset.startDate), "d MMM", {
      locale: dateLocale,
    });
    const to = format(parseDateKey(preset.endDate), "d MMM", {
      locale: dateLocale,
    });
    return `${from} – ${to}`;
  }
  return t("customPeriod");
}

/** Loads categories for the active page type (or both types when unscoped). */
export function useFilterCategories(pageType?: TransactionType): {
  categories: TransactionCategoryDto[];
  loading: boolean;
} {
  const [categories, setCategories] = useState<TransactionCategoryDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        if (pageType) {
          const result = await listCategories(pageType);
          if (!cancelled) {
            setCategories(result.categories);
          }
          return;
        }
        const [spending, earning] = await Promise.all([
          listCategories(TransactionType.Spending),
          listCategories(TransactionType.Earning),
        ]);
        if (!cancelled) {
          setCategories([...spending.categories, ...earning.categories]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pageType]);

  return { categories, loading };
}

/** Loads counterparties scoped to the selected debt roles (or all). */
export function useFilterCounterparties(
  showLend: boolean,
  showBorrow: boolean,
): CounterpartyDto[] {
  const [counterparties, setCounterparties] = useState<CounterpartyDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results =
        showLend || showBorrow
          ? await Promise.all(
              [
                ...(showLend ? [TransactionDebtRole.Lend] : []),
                ...(showBorrow ? [TransactionDebtRole.Borrow] : []),
              ].map((debtRole) => listCounterparties({ debtRole })),
            )
          : [await listCounterparties({})];

      if (!cancelled) {
        const map = new Map<string, CounterpartyDto>();
        for (const result of results) {
          for (const item of result.counterparties) {
            map.set(item.id, item);
          }
        }
        setCounterparties([...map.values()]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [showLend, showBorrow]);

  return counterparties;
}
