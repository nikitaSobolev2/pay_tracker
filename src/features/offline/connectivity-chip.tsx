"use client";

import { Loader2, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { scheduleAllOfflineFlushes } from "@/lib/offline/offline-flush";
import { cn } from "@/lib/utils";
import { useFastTransactionQueueStore } from "@/stores/fast-transaction-queue.store";
import { useTransactionOfflineQueueStore } from "@/stores/transaction-offline-queue.store";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";
import { FastQueueStatus } from "@/types/enums";

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function useOnlineStatus() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function usePendingSyncCounts() {
  const travelItems = useTravelOfflineQueueStore((state) => state.items);
  const transactionItems = useTransactionOfflineQueueStore(
    (state) => state.items,
  );
  const fastItems = useFastTransactionQueueStore((state) => state.items);

  return useMemo(() => {
    // Count live items even before persist rehydrate finishes — offline
    // enqueues can land first and must still show on the chip.
    const pending = [
      ...travelItems,
      ...transactionItems,
      ...fastItems,
    ].filter(
      (item) =>
        item.status === FastQueueStatus.Pending ||
        item.status === FastQueueStatus.Error,
    );
    const errorCount = pending.filter(
      (item) => item.status === FastQueueStatus.Error,
    ).length;
    const pendingCount = pending.length - errorCount;
    return {
      pendingCount,
      errorCount,
      total: pending.length,
    };
  }, [fastItems, transactionItems, travelItems]);
}

/** Retries all offline queues when connectivity returns. */
export function ConnectivityRetryListener() {
  useEffect(() => {
    function onOnline() {
      scheduleAllOfflineFlushes({ immediate: true });
    }
    function onFocus() {
      scheduleAllOfflineFlushes();
    }
    // Catch-up after persist rehydrate (queues no longer auto-flush on load).
    scheduleAllOfflineFlushes();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return null;
}

function ConnectivityStatusChip({
  className,
  compact = false,
}: {
  readonly className?: string;
  readonly compact?: boolean;
}) {
  const t = useTranslations("connectivity");
  const online = useOnlineStatus();
  const { pendingCount, errorCount, total } = usePendingSyncCounts();

  let mode: "offline" | "syncing" | "hidden" = "hidden";
  if (!online) {
    mode = "offline";
  } else if (total > 0) {
    mode = "syncing";
  }
  if (mode === "hidden") {
    return null;
  }

  return (
    <div
      className={cn(
        "flex max-w-full items-center gap-1.5 border shadow-sm backdrop-blur transition-[background-color,border-color,color] duration-300",
        compact
          ? "h-8 rounded-xl px-2.5 text-xs"
          : "rounded-full px-3 py-1.5 text-sm shadow-md",
        mode === "offline"
          ? "border-amber-500/35 bg-amber-500/15 text-amber-900 dark:text-amber-100"
          : "border-border/60 bg-background/95 text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {mode === "offline" ? (
        <WifiOff className="size-3.5 shrink-0" />
      ) : (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      )}
      <span className={cn("truncate", compact && "max-w-44 xl:max-w-64")}>
        {mode === "offline" ? t("offline") : t("syncing")}
      </span>
      {pendingCount > 0 ? (
        <Badge
          variant="secondary"
          className="h-5 shrink-0 px-1.5 text-[10px]"
        >
          {t("pendingCount", { count: pendingCount })}
        </Badge>
      ) : null}
      {errorCount > 0 ? (
        <Badge
          variant="destructive"
          className="h-5 shrink-0 px-1.5 text-[10px]"
        >
          {t("errorCount", { count: errorCount })}
        </Badge>
      ) : null}
    </div>
  );
}

/** Desktop header chip (AppHeader is md+ only). */
export function ConnectivityHeaderChip() {
  return (
    <ConnectivityStatusChip compact className="mr-1 max-w-[min(100%,20rem)]" />
  );
}

/** Mobile: fixed chip at top; offline ↔ syncing on same chip. */
export function ConnectivityFloatingChip() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 flex justify-center px-3 md:hidden">
      <ConnectivityStatusChip className="pointer-events-auto" />
    </div>
  );
}
