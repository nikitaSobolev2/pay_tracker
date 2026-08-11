"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  TravelCategoryBudgetDto,
  TravelDetailDto,
  TravelPlaceToVisitDto,
  TravelPlannedSpendingDto,
  TravelThingToGrabDto,
  TravelTicketDto,
} from "@/server/services/travel-service.types";
import type { TravelPlannedCategory } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TravelCacheStore = {
  byId: Record<string, TravelDetailDto>;
  transactionsByTravelId: Record<string, TransactionDto[]>;
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  putTravel: (travel: TravelDetailDto) => void;
  getTravel: (travelId: string) => TravelDetailDto | null;
  patchTravel: (
    travelId: string,
    patch: Partial<TravelDetailDto> | ((current: TravelDetailDto) => TravelDetailDto),
  ) => void;
  putTransactions: (travelId: string, items: TransactionDto[]) => void;
  getTransactions: (travelId: string) => TransactionDto[];
  upsertTransaction: (travelId: string, item: TransactionDto) => void;
  removeTransaction: (travelId: string, transactionId: string) => void;
  remapEntityId: (
    travelId: string,
    kind: "place" | "thing" | "planned" | "ticket" | "transaction",
    localId: string,
    serverId: string,
  ) => void;
};

function mapList<T extends { id: string }>(
  items: readonly T[],
  id: string,
  mapper: (item: T) => T,
): T[] {
  return items.map((item) => (item.id === id ? mapper(item) : item));
}

export const useTravelCacheStore = create<TravelCacheStore>()(
  persist(
    (set, get) => ({
      byId: {},
      transactionsByTravelId: {},
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      putTravel: (travel) =>
        set((state) => ({
          byId: { ...state.byId, [travel.id]: travel },
        })),
      getTravel: (travelId) => get().byId[travelId] ?? null,
      patchTravel: (travelId, patch) =>
        set((state) => {
          const current = state.byId[travelId];
          if (!current) {
            return state;
          }
          const next =
            typeof patch === "function" ? patch(current) : { ...current, ...patch };
          return { byId: { ...state.byId, [travelId]: next } };
        }),
      putTransactions: (travelId, items) =>
        set((state) => ({
          transactionsByTravelId: {
            ...state.transactionsByTravelId,
            [travelId]: items,
          },
        })),
      getTransactions: (travelId) =>
        get().transactionsByTravelId[travelId] ?? [],
      upsertTransaction: (travelId, item) =>
        set((state) => {
          const existing = state.transactionsByTravelId[travelId] ?? [];
          const index = existing.findIndex((row) => row.id === item.id);
          const next =
            index >= 0
              ? existing.map((row, i) => (i === index ? item : row))
              : [item, ...existing];
          return {
            transactionsByTravelId: {
              ...state.transactionsByTravelId,
              [travelId]: next,
            },
          };
        }),
      removeTransaction: (travelId, transactionId) =>
        set((state) => ({
          transactionsByTravelId: {
            ...state.transactionsByTravelId,
            [travelId]: (state.transactionsByTravelId[travelId] ?? []).filter(
              (row) => row.id !== transactionId,
            ),
          },
        })),
      remapEntityId: (travelId, kind, localId, serverId) => {
        if (kind === "transaction") {
          set((state) => {
            const items = state.transactionsByTravelId[travelId] ?? [];
            return {
              transactionsByTravelId: {
                ...state.transactionsByTravelId,
                [travelId]: items.map((row) =>
                  row.id === localId ? { ...row, id: serverId } : row,
                ),
              },
            };
          });
          return;
        }
        get().patchTravel(travelId, (current) => {
          if (kind === "place") {
            return {
              ...current,
              placesToVisit: mapList(current.placesToVisit, localId, (item) => ({
                ...item,
                id: serverId,
              })),
            };
          }
          if (kind === "thing") {
            return {
              ...current,
              thingsToGrab: mapList(current.thingsToGrab, localId, (item) => ({
                ...item,
                id: serverId,
              })),
            };
          }
          if (kind === "planned") {
            return {
              ...current,
              plannedSpendings: mapList(
                current.plannedSpendings,
                localId,
                (item) => ({ ...item, id: serverId }),
              ),
            };
          }
          return {
            ...current,
            tickets: mapList(current.tickets, localId, (item) => ({
              ...item,
              id: serverId,
            })),
          };
        });
      },
    }),
    {
      name: "paytracker-travel-cache",
      partialize: (state) => ({
        byId: state.byId,
        transactionsByTravelId: state.transactionsByTravelId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function upsertPlaceInCache(
  travelId: string,
  place: TravelPlaceToVisitDto,
) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => {
    const exists = current.placesToVisit.some((row) => row.id === place.id);
    return {
      ...current,
      placesToVisit: exists
        ? mapList(current.placesToVisit, place.id, () => place)
        : [place, ...current.placesToVisit],
    };
  });
}

export function removePlaceFromCache(travelId: string, placeId: string) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => ({
    ...current,
    placesToVisit: current.placesToVisit.filter((row) => row.id !== placeId),
  }));
}

export function upsertThingInCache(
  travelId: string,
  item: TravelThingToGrabDto,
) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => {
    const exists = current.thingsToGrab.some((row) => row.id === item.id);
    return {
      ...current,
      thingsToGrab: exists
        ? mapList(current.thingsToGrab, item.id, () => item)
        : [item, ...current.thingsToGrab],
    };
  });
}

export function removeThingFromCache(travelId: string, itemId: string) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => ({
    ...current,
    thingsToGrab: current.thingsToGrab.filter((row) => row.id !== itemId),
  }));
}

export function upsertPlannedInCache(
  travelId: string,
  spending: TravelPlannedSpendingDto,
) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => {
    const exists = current.plannedSpendings.some(
      (row) => row.id === spending.id,
    );
    return {
      ...current,
      plannedSpendings: exists
        ? mapList(current.plannedSpendings, spending.id, () => spending)
        : [spending, ...current.plannedSpendings],
    };
  });
}

export function removePlannedFromCache(travelId: string, spendingId: string) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => ({
    ...current,
    plannedSpendings: current.plannedSpendings.filter(
      (row) => row.id !== spendingId,
    ),
  }));
}

export function upsertTicketInCache(
  travelId: string,
  ticket: TravelTicketDto,
) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => {
    const exists = current.tickets.some((row) => row.id === ticket.id);
    return {
      ...current,
      tickets: exists
        ? mapList(current.tickets, ticket.id, () => ticket)
        : [ticket, ...current.tickets],
    };
  });
}

export function removeTicketFromCache(travelId: string, ticketId: string) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => ({
    ...current,
    tickets: current.tickets.filter((row) => row.id !== ticketId),
  }));
}

export function upsertCategoryBudgetInCache(
  travelId: string,
  category: TravelPlannedCategory,
  amount: string | null,
) {
  useTravelCacheStore.getState().patchTravel(travelId, (current) => {
    const without = current.categoryBudgets.filter(
      (row) => row.category !== category,
    );
    const next: TravelCategoryBudgetDto[] =
      amount === null || amount === ""
        ? without
        : [...without, { category, amount }];
    return { ...current, categoryBudgets: next };
  });
}

export function makeLocalEntityId(): string {
  return `local:${crypto.randomUUID()}`;
}

export function isLocalEntityId(id: string): boolean {
  return id.startsWith("local:");
}
