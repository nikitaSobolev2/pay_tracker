"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionMobileList } from "@/features/transactions/transaction-mobile-list";
import { listTransactions } from "@/lib/api/transactions";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { useTravelCacheStore } from "@/stores/travel-cache.store";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";
import { useUiStore } from "@/stores/ui.store";
import {
  DateRangeType,
  TransactionFormMode,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TravelRealSpendingsListProps = {
  readonly travelId: string;
  readonly showAddButton?: boolean;
};

export function TravelRealSpendingsList({
  travelId,
  showAddButton = true,
}: TravelRealSpendingsListProps) {
  const t = useTranslations("travels");
  const openTransactionModal = useUiStore((state) => state.openTransactionModal);
  const openEditTransactionModal = useUiStore(
    (state) => state.openEditTransactionModal,
  );
  const putTransactions = useTravelCacheStore((state) => state.putTransactions);
  const getTransactions = useTravelCacheStore((state) => state.getTransactions);
  const cachedItems = useTravelCacheStore(
    (state) => state.transactionsByTravelId[travelId],
  );
  const hasPendingForTravel = useTravelOfflineQueueStore(
    (state) => state.hasPendingForTravel,
  );
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const pending = hasPendingForTravel(travelId);
    if (pending || (typeof navigator !== "undefined" && !navigator.onLine)) {
      setItems(getTransactions(travelId));
      setLoading(false);
      return;
    }
    try {
      const result = await listTransactions({
        type: TransactionType.Spending,
        travelId,
        dateRangeType: DateRangeType.AllTime,
        pageSize: 100,
      });
      putTransactions(travelId, result.items);
      setItems(result.items);
    } catch (error: unknown) {
      const cached = getTransactions(travelId);
      if (cached.length > 0 || isNetworkError(error)) {
        setItems(cached);
      } else {
        toast.error(error instanceof Error ? error.message : t("loadFailed"));
      }
    } finally {
      setLoading(false);
    }
  }, [getTransactions, hasPendingForTravel, putTransactions, t, travelId]);

  useEffect(() => {
    if (cachedItems) {
      setItems(cachedItems);
    }
  }, [cachedItems]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onChanged() {
      void load();
    }
    window.addEventListener("paytracker:transactions-changed", onChanged);
    window.addEventListener("paytracker:travel-offline-synced", onChanged);
    return () => {
      window.removeEventListener("paytracker:transactions-changed", onChanged);
      window.removeEventListener("paytracker:travel-offline-synced", onChanged);
    };
  }, [load]);

  return (
    <div className="space-y-3">
      {showAddButton ? (
        <div className="flex justify-end">
          <Button
            type="button"
            className="h-11 rounded-xl"
            onClick={() =>
              openTransactionModal(TransactionFormMode.Spending, {
                travelId,
              })
            }
          >
            {t("addTravelSpending")}
          </Button>
        </div>
      ) : null}

      <Card className="border-border/60 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t("realSpendings")}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("spendingEmptyCategory")}
            </p>
          ) : (
            <TransactionMobileList
              variant="plain"
              items={items}
              selected={selected}
              onToggleOne={(id) =>
                setSelected((prev) =>
                  prev.includes(id)
                    ? prev.filter((item) => item !== id)
                    : [...prev, id],
                )
              }
              onEnterSelection={(id) => setSelected([id])}
              onEdit={(tx) => openEditTransactionModal(tx)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
