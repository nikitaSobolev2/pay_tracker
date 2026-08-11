"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { listCategories } from "@/lib/api/categories";
import {
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import { listTravels } from "@/lib/api/travels";
import type {
  TravelListItemDto,
  TravelSuggestItemDto,
} from "@/server/services/travel-service.types";
import { TransactionKind, TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

type CategoriesByType = Partial<
  Record<TransactionType, TransactionCategoryDto[]>
>;
type CounterpartiesByKind = Partial<Record<TransactionKind, CounterpartyDto[]>>;

type TransactionFormLookupStore = {
  categoriesByType: CategoriesByType;
  counterpartiesByKind: CounterpartiesByKind;
  travels: TravelSuggestItemDto[];
  hydrated: boolean;
  refreshing: boolean;
  setHydrated: (value: boolean) => void;
  setCategories: (
    type: TransactionType,
    categories: TransactionCategoryDto[],
  ) => void;
  setCounterparties: (
    kind: TransactionKind,
    counterparties: CounterpartyDto[],
  ) => void;
  setTravels: (travels: TravelSuggestItemDto[]) => void;
  getCategories: (type: TransactionType) => TransactionCategoryDto[];
  getCounterparties: (kind: TransactionKind) => CounterpartyDto[];
  filterTravels: (query: string) => TravelSuggestItemDto[];
  refreshAll: () => Promise<void>;
};

function toSuggestItem(travel: TravelListItemDto): TravelSuggestItemDto {
  return {
    id: travel.id,
    title: travel.title,
    startsAt: travel.startsAt,
    endsAt: travel.endsAt,
    placeLabel: travel.placeLabel,
    imageUrl: travel.imageUrl,
    phase: travel.phase,
    currency: travel.currency,
  };
}

function matchesTravelQuery(
  travel: TravelSuggestItemDto,
  needle: string,
): boolean {
  if (!needle) {
    return true;
  }
  if (travel.title.toLowerCase().includes(needle)) {
    return true;
  }
  return (travel.placeLabel ?? "").toLowerCase().includes(needle);
}

export const useTransactionFormLookupStore =
  create<TransactionFormLookupStore>()(
    persist(
      (set, get) => ({
        categoriesByType: {},
        counterpartiesByKind: {},
        travels: [],
        hydrated: false,
        refreshing: false,
        setHydrated: (value) => set({ hydrated: value }),
        setCategories: (type, categories) =>
          set((state) => ({
            categoriesByType: {
              ...state.categoriesByType,
              [type]: categories,
            },
          })),
        setCounterparties: (kind, counterparties) =>
          set((state) => ({
            counterpartiesByKind: {
              ...state.counterpartiesByKind,
              [kind]: counterparties,
            },
          })),
        setTravels: (travels) => set({ travels }),
        getCategories: (type) => get().categoriesByType[type] ?? [],
        getCounterparties: (kind) => get().counterpartiesByKind[kind] ?? [],
        filterTravels: (query) => {
          const needle = query.trim().toLowerCase();
          return get().travels.filter((travel) =>
            matchesTravelQuery(travel, needle),
          );
        },
        refreshAll: async () => {
          if (get().refreshing) {
            return;
          }
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            return;
          }
          set({ refreshing: true });
          try {
            const [
              spendingCategories,
              earningCategories,
              loanCounterparties,
              debtCounterparties,
              travelsResult,
            ] = await Promise.all([
              listCategories(TransactionType.Spending),
              listCategories(TransactionType.Earning),
              listCounterparties({ kind: TransactionKind.Loan }),
              listCounterparties({ kind: TransactionKind.Debt }),
              listTravels(),
            ]);
            set({
              categoriesByType: {
                [TransactionType.Spending]: spendingCategories.categories,
                [TransactionType.Earning]: earningCategories.categories,
              },
              counterpartiesByKind: {
                [TransactionKind.Loan]: loanCounterparties.counterparties,
                [TransactionKind.Debt]: debtCounterparties.counterparties,
              },
              travels: travelsResult.travels.map(toSuggestItem),
            });
          } catch {
            // Keep persisted lookup cache when offline / network fails.
          } finally {
            set({ refreshing: false });
          }
        },
      }),
      {
        name: "paytracker-tx-form-lookup",
        partialize: (state) => ({
          categoriesByType: state.categoriesByType,
          counterpartiesByKind: state.counterpartiesByKind,
          travels: state.travels,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHydrated(true);
        },
      },
    ),
  );

/** Prefetch categories, people, and travels for the spending/earning modal. */
export function TransactionFormLookupWarmup() {
  const refreshAll = useTransactionFormLookupStore((state) => state.refreshAll);

  useEffect(() => {
    void refreshAll().catch(() => {
      // Keep persisted cache when network fails.
    });
    function onOnline() {
      void refreshAll().catch(() => undefined);
    }
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [refreshAll]);

  return null;
}
