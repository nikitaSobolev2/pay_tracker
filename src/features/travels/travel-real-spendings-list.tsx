"use client";

import { Plus, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionMobileList } from "@/features/transactions/transaction-mobile-list";
import { listTransactions } from "@/lib/api/transactions";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { useTravelCacheStore } from "@/stores/travel-cache.store";
import { useUiStore } from "@/stores/ui.store";
import {
  DateRangeType,
  TransactionFormMode,
  TransactionType,
} from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import {
  TravelSectionEmpty,
  TravelSectionHeader,
} from "./travel-section-card";

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
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline) {
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
      // Keep unsynced local creates while other travel ops may still be pending.
      const cached = getTransactions(travelId);
      const serverIds = new Set(result.items.map((item) => item.id));
      const localOnly = cached.filter(
        (item) => item.id.startsWith("local:") && !serverIds.has(item.id),
      );
      const merged = [...localOnly, ...result.items];
      putTransactions(travelId, merged);
      setItems(merged);
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
  }, [getTransactions, putTransactions, t, travelId]);

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
    <Card className="border-border/60 bg-card/90 shadow-none">
      <TravelSectionHeader
        icon={Wallet}
        title={t("realSpendings")}
        count={items.length > 0 ? String(items.length) : undefined}
        action={
          showAddButton ? (
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg"
              onClick={() =>
                openTransactionModal(TransactionFormMode.Spending, {
                  travelId,
                })
              }
            >
              <Plus className="size-4" />
              {t("addSpending")}
            </Button>
          ) : undefined
        }
      />
      <CardContent className="p-3 sm:p-4">
        <RealSpendingsContent
          loading={loading}
          items={items}
          emptyText={t("spendingEmptyCategory")}
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
      </CardContent>
    </Card>
  );
}

function RealSpendingsContent({
  loading,
  items,
  emptyText,
  selected,
  onToggleOne,
  onEnterSelection,
  onEdit,
}: {
  readonly loading: boolean;
  readonly items: TransactionDto[];
  readonly emptyText: string;
  readonly selected: string[];
  readonly onToggleOne: (id: string) => void;
  readonly onEnterSelection: (id: string) => void;
  readonly onEdit: (item: TransactionDto) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }
  if (items.length === 0) {
    return <TravelSectionEmpty icon={Wallet} text={emptyText} />;
  }
  return (
    <TransactionMobileList
      variant="plain"
      items={items}
      selected={selected}
      onToggleOne={onToggleOne}
      onEnterSelection={onEnterSelection}
      onEdit={onEdit}
    />
  );
}
