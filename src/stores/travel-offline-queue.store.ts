"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { coalesceTravelQueueItems } from "@/lib/offline/travel-offline-coalesce";
import {
  executeTravelOfflineOp,
  isNetworkError,
} from "@/lib/offline/travel-offline-execute";
import type {
  TravelOfflineOp,
  TravelOfflineQueueItem,
} from "@/stores/travel-offline-queue.types";
import { FastQueueStatus } from "@/types/enums";

type TravelOfflineQueueStore = {
  items: TravelOfflineQueueItem[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  enqueue: (input: {
    localId: string;
    travelId: string;
    op: TravelOfflineOp;
    createdAtLocal?: string;
    baseline?: Record<string, unknown>;
  }) => void;
  updateItem: (localId: string, patch: Partial<TravelOfflineQueueItem>) => void;
  remapEntityIdsInQueue: (localId: string, serverId: string) => void;
  purgeSuccess: () => void;
  submitItem: (localId: string) => Promise<void>;
  retryPending: () => Promise<void>;
  hasPendingForTravel: (travelId: string) => boolean;
};

const inFlight = new Set<string>();
let flushChain: Promise<void> = Promise.resolve();

function rewriteOpEntityId(
  op: TravelOfflineOp,
  localId: string,
  serverId: string,
): TravelOfflineOp {
  switch (op.kind) {
    case "updatePlace":
    case "deletePlace":
      return op.entityId === localId ? { ...op, entityId: serverId } : op;
    case "updateThing":
    case "deleteThing":
      return op.entityId === localId ? { ...op, entityId: serverId } : op;
    case "updatePlanned":
    case "deletePlanned":
      return op.entityId === localId ? { ...op, entityId: serverId } : op;
    case "updateTicket":
    case "deleteTicket":
      return op.entityId === localId ? { ...op, entityId: serverId } : op;
    case "updateTransaction":
    case "deleteTransaction":
      return op.entityId === localId ? { ...op, entityId: serverId } : op;
    case "createPlace":
    case "createThing":
    case "createPlanned":
    case "createTicket":
    case "createTransaction":
      return op.entityLocalId === localId
        ? { ...op, entityLocalId: serverId }
        : op;
    default:
      return op;
  }
}

export const useTravelOfflineQueueStore = create<TravelOfflineQueueStore>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      enqueue: (input) =>
        set((state) => ({
          items: coalesceTravelQueueItems(
            state.items,
            {
              localId: input.localId,
              travelId: input.travelId,
              op: input.op,
              createdAtLocal: input.createdAtLocal ?? new Date().toISOString(),
              status: FastQueueStatus.Pending,
              baseline: input.baseline,
            },
            inFlight,
          ),
        })),
      updateItem: (localId, patch) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.localId === localId ? { ...item, ...patch } : item,
          ),
        })),
      remapEntityIdsInQueue: (localId, serverId) =>
        set((state) => ({
          items: state.items.map((item) => ({
            ...item,
            op: rewriteOpEntityId(item.op, localId, serverId),
          })),
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
        if (
          item.status !== FastQueueStatus.Pending &&
          item.status !== FastQueueStatus.Error
        ) {
          return;
        }
        inFlight.add(localId);
        get().updateItem(localId, {
          status: FastQueueStatus.Pending,
          errorMessage: undefined,
        });
        try {
          const latest = get().items.find((row) => row.localId === localId);
          if (!latest) {
            return;
          }
          const remaps = await executeTravelOfflineOp(latest);
          for (const remap of remaps) {
            get().remapEntityIdsInQueue(remap.localId, remap.serverId);
          }
          get().updateItem(localId, {
            status: FastQueueStatus.Success,
            errorMessage: undefined,
          });
          window.dispatchEvent(
            new CustomEvent("paytracker:travel-offline-synced", {
              detail: { travelId: latest.travelId },
            }),
          );
          if (
            latest.op.kind === "createTransaction" ||
            latest.op.kind === "updateTransaction" ||
            latest.op.kind === "deleteTransaction"
          ) {
            window.dispatchEvent(
              new CustomEvent("paytracker:transactions-changed"),
            );
          }
        } catch (error) {
          if (isNetworkError(error)) {
            get().updateItem(localId, {
              status: FastQueueStatus.Pending,
              errorMessage: undefined,
            });
          } else {
            get().updateItem(localId, {
              status: FastQueueStatus.Error,
              errorMessage:
                error instanceof Error ? error.message : "Request failed",
            });
          }
        } finally {
          inFlight.delete(localId);
        }
      },
      retryPending: async () => {
        flushChain = flushChain.then(async () => {
          const targets = get().items.filter(
            (item) =>
              item.status === FastQueueStatus.Pending ||
              item.status === FastQueueStatus.Error,
          );
          for (const item of targets) {
            await get().submitItem(item.localId);
          }
          get().purgeSuccess();
        });
        await flushChain;
      },
      hasPendingForTravel: (travelId) =>
        get().items.some(
          (item) =>
            item.travelId === travelId &&
            (item.status === FastQueueStatus.Pending ||
              item.status === FastQueueStatus.Error),
        ),
    }),
    {
      name: "paytracker-travel-offline-queue",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state, _error) => {
        try {
          state?.purgeSuccess();
        } finally {
          useTravelOfflineQueueStore.setState({ hydrated: true });
        }
      },
    },
  ),
);

if (typeof window !== "undefined") {
  useTravelOfflineQueueStore.persist.onFinishHydration(() => {
    useTravelOfflineQueueStore.setState({ hydrated: true });
  });
  if (useTravelOfflineQueueStore.persist.hasHydrated()) {
    useTravelOfflineQueueStore.setState({ hydrated: true });
  }
}
