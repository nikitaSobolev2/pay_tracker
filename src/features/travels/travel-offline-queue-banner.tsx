"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";
import { FastQueueStatus } from "@/types/enums";

export function TravelOfflineQueueBanner({
  travelId,
}: {
  readonly travelId: string;
}) {
  const t = useTranslations("travels");
  const items = useTravelOfflineQueueStore((state) => state.items);
  const hydrated = useTravelOfflineQueueStore((state) => state.hydrated);
  const retryPending = useTravelOfflineQueueStore((state) => state.retryPending);

  const travelItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.travelId === travelId &&
          (item.status === FastQueueStatus.Pending ||
            item.status === FastQueueStatus.Error),
      ),
    [items, travelId],
  );

  useEffect(() => {
    function onOnline() {
      void retryPending();
    }
    function onFocus() {
      void retryPending();
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [retryPending]);

  if (!hydrated || travelItems.length === 0) {
    return null;
  }

  const errorCount = travelItems.filter(
    (item) => item.status === FastQueueStatus.Error,
  ).length;
  const pendingCount = travelItems.length - errorCount;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm">
      {pendingCount > 0 ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : null}
      <span className="text-muted-foreground">{t("offlineSyncPending")}</span>
      {pendingCount > 0 ? (
        <Badge variant="secondary">
          {t("offlineSyncPendingCount", { count: pendingCount })}
        </Badge>
      ) : null}
      {errorCount > 0 ? (
        <Badge variant="destructive">
          {t("offlineSyncErrorCount", { count: errorCount })}
        </Badge>
      ) : null}
    </div>
  );
}
