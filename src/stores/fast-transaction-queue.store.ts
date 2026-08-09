"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createTransaction } from "@/lib/api/transactions";
import { useActiveTravelStore } from "@/stores/active-travel.store";
import type { FastQueueItem } from "@/stores/fast-transaction-queue.types";
import { FastQueueStatus, TransactionKind, TransactionType } from "@/types/enums";

type FastQueueStore = {
  items: FastQueueItem[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  enqueue: (
    item: Omit<FastQueueItem, "status" | "createdAtLocal"> & {
      createdAtLocal?: string;
    },
  ) => void;
  updateItem: (localId: string, patch: Partial<FastQueueItem>) => void;
  purgeSuccess: () => void;
  submitItem: (localId: string) => Promise<void>;
  retryPending: () => Promise<void>;
};

const inFlight = new Set<string>();

export const useFastTransactionQueueStore = create<FastQueueStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      enqueue: (item) =>
        set((state) => ({
          items: [
            {
              ...item,
              createdAtLocal: item.createdAtLocal ?? new Date().toISOString(),
              status: FastQueueStatus.Pending,
            },
            ...state.items,
          ],
        })),
      updateItem: (localId, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.localId === localId ? { ...item, ...patch } : item,
          ),
        })),
      purgeSuccess: () =>
        set((state) => ({
          items: state.items.filter(
            (item) => item.status !== FastQueueStatus.Success,
          ),
        })),
      submitItem: async (localId) => {
        if (inFlight.has(localId)) {
          return;
        }
        const item = get().items.find((row) => row.localId === localId);
        if (!item) {
          return;
        }
        inFlight.add(localId);
        get().updateItem(localId, {
          status: FastQueueStatus.Pending,
          errorMessage: undefined,
        });
        try {
          const result = await createTransaction({
            type: item.type,
            originalAmount: item.amount,
            inputCurrency: item.currency,
            occurredAt: item.occurredAt,
            kind: TransactionKind.Default,
            categoryIds: [],
            travelId:
              item.type === TransactionType.Spending
                ? (item.travelId ?? null)
                : null,
            idempotencyKey: item.idempotencyKey,
          });
          get().updateItem(localId, {
            status: FastQueueStatus.Success,
            transactionId: result.transaction.id,
            errorMessage: undefined,
          });
          // Notify after save succeeds — FX for non-RUB can outlast an early reload.
          window.dispatchEvent(
            new CustomEvent("paytracker:transactions-changed"),
          );
        } catch (error) {
          get().updateItem(localId, {
            status: FastQueueStatus.Error,
            errorMessage:
              error instanceof Error ? error.message : "Request failed",
          });
        } finally {
          inFlight.delete(localId);
        }
      },
      retryPending: async () => {
        const targets = get().items.filter(
          (item) =>
            item.status === FastQueueStatus.Pending ||
            item.status === FastQueueStatus.Error,
        );
        await Promise.all(targets.map((item) => get().submitItem(item.localId)));
      },
    }),
    {
      name: "paytracker-fast-queue",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.purgeSuccess();
        state?.setHydrated(true);
        void state?.retryPending();
      },
    },
  ),
);

export function enqueueFastTransaction(input: {
  type: TransactionType;
  amount: string;
  currency: string;
  occurredAt: string;
  idempotencyKey: string;
  localId: string;
  travelId?: string | null;
}) {
  const activeTravelId =
    input.type === TransactionType.Spending
      ? (input.travelId ??
        useActiveTravelStore.getState().travel?.id ??
        null)
      : null;
  const store = useFastTransactionQueueStore.getState();
  store.enqueue({ ...input, travelId: activeTravelId });
  void store.submitItem(input.localId);
}
