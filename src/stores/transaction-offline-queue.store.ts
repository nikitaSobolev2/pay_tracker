"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  createTransaction,
  type CreateTransactionInput,
} from "@/lib/api/transactions";
import { scheduleTransactionOfflineFlush } from "@/lib/offline/offline-flush";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import type { TransactionOfflineQueueItem } from "@/stores/transaction-offline-queue.types";
import { FastQueueStatus } from "@/types/enums";

type TransactionOfflineQueueStore = {
  items: TransactionOfflineQueueItem[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  enqueue: (
    item: Omit<TransactionOfflineQueueItem, "status" | "createdAtLocal"> & {
      createdAtLocal?: string;
    },
  ) => void;
  updateItem: (
    localId: string,
    patch: Partial<TransactionOfflineQueueItem>,
  ) => void;
  purgeSuccess: () => void;
  submitItem: (localId: string) => Promise<void>;
  retryPending: () => Promise<void>;
};

const inFlight = new Set<string>();

export const useTransactionOfflineQueueStore =
  create<TransactionOfflineQueueStore>()(
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
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            get().updateItem(localId, {
              status: FastQueueStatus.Pending,
              errorMessage: undefined,
            });
            return;
          }
          inFlight.add(localId);
          get().updateItem(localId, {
            status: FastQueueStatus.Pending,
            errorMessage: undefined,
          });
          try {
            const result = await createTransaction(item.body);
            get().updateItem(localId, {
              status: FastQueueStatus.Success,
              transactionId: result.transaction.id,
              errorMessage: undefined,
            });
            window.dispatchEvent(
              new CustomEvent("paytracker:transactions-changed"),
            );
            get().purgeSuccess();
          } catch (error) {
            if (isNetworkError(error)) {
              get().updateItem(localId, {
                status: FastQueueStatus.Pending,
                errorMessage: undefined,
              });
              return;
            }
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
          await Promise.all(
            targets.map((item) => get().submitItem(item.localId)),
          );
        },
      }),
      {
        name: "paytracker-transaction-offline-queue",
        partialize: (state) => ({ items: state.items }),
        onRehydrateStorage: () => (state, _error) => {
          state?.purgeSuccess();
          useTransactionOfflineQueueStore.setState({ hydrated: true });
        },
      },
    ),
  );

export function enqueueOfflineTransactionCreate(
  body: CreateTransactionInput,
): string {
  const localId = crypto.randomUUID();
  const store = useTransactionOfflineQueueStore.getState();
  store.enqueue({ localId, body });
  scheduleTransactionOfflineFlush();
  return localId;
}
