"use client";

import { useFastTransactionQueueStore } from "@/stores/fast-transaction-queue.store";
import { useTransactionOfflineQueueStore } from "@/stores/transaction-offline-queue.store";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";

const FLUSH_DEBOUNCE_MS = 450;

let travelFlushTimer: ReturnType<typeof setTimeout> | null = null;
let transactionFlushTimer: ReturnType<typeof setTimeout> | null = null;
let fastFlushTimer: ReturnType<typeof setTimeout> | null = null;

function canFlushNow(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function scheduleTravelOfflineFlush(options?: {
  readonly immediate?: boolean;
}): void {
  if (travelFlushTimer) {
    clearTimeout(travelFlushTimer);
    travelFlushTimer = null;
  }
  const run = () => {
    travelFlushTimer = null;
    if (!canFlushNow()) {
      return;
    }
    void useTravelOfflineQueueStore
      .getState()
      .retryPending()
      .catch(() => undefined);
  };
  if (options?.immediate) {
    run();
    return;
  }
  travelFlushTimer = setTimeout(run, FLUSH_DEBOUNCE_MS);
}

export function scheduleTransactionOfflineFlush(options?: {
  readonly immediate?: boolean;
}): void {
  if (transactionFlushTimer) {
    clearTimeout(transactionFlushTimer);
    transactionFlushTimer = null;
  }
  const run = () => {
    transactionFlushTimer = null;
    if (!canFlushNow()) {
      return;
    }
    void useTransactionOfflineQueueStore
      .getState()
      .retryPending()
      .catch(() => undefined);
  };
  if (options?.immediate) {
    run();
    return;
  }
  transactionFlushTimer = setTimeout(run, FLUSH_DEBOUNCE_MS);
}

export function scheduleFastQueueFlush(options?: {
  readonly immediate?: boolean;
}): void {
  if (fastFlushTimer) {
    clearTimeout(fastFlushTimer);
    fastFlushTimer = null;
  }
  const run = () => {
    fastFlushTimer = null;
    if (!canFlushNow()) {
      return;
    }
    void useFastTransactionQueueStore
      .getState()
      .retryPending()
      .catch(() => undefined);
  };
  if (options?.immediate) {
    run();
    return;
  }
  fastFlushTimer = setTimeout(run, FLUSH_DEBOUNCE_MS);
}

export function scheduleAllOfflineFlushes(options?: {
  readonly immediate?: boolean;
}): void {
  scheduleTravelOfflineFlush(options);
  scheduleTransactionOfflineFlush(options);
  scheduleFastQueueFlush(options);
}
