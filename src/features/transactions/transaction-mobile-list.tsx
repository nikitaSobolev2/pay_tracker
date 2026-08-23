"use client";

import {
  CheckSquare,
  Eye,
  Pencil,
  RotateCcw,
  Split,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as SwipeType,
} from "react-swipeable-list";
import "react-swipeable-list/dist/styles.css";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  MobileRowActionSheet,
  type MobileRowAction,
} from "@/components/mobile-row-action-sheet";
import { RowOverflowMenu } from "@/components/row-overflow-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TransactionListAmount,
  TransactionListPrimary,
} from "@/features/transactions/transaction-list-primary";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLongPress } from "@/hooks/use-long-press";
import { useRouter } from "@/i18n/navigation";
import { canDivideTransaction } from "@/lib/can-divide-transaction";
import {
  deleteTransaction,
  restoreTransaction,
} from "@/lib/api/transactions";
import { useUiStore } from "@/stores/ui.store";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { cn } from "@/lib/utils";
import { useTravelCacheStore } from "@/stores/travel-cache.store";
import type { TransactionDto } from "@/types/transaction";

type TransactionMobileListProps = {
  readonly items: TransactionDto[];
  readonly loading?: boolean;
  readonly loadingMore?: boolean;
  readonly selected?: string[];
  readonly onToggleOne?: (id: string) => void;
  readonly onEnterSelection?: (id: string) => void;
  readonly onEdit: (item: TransactionDto) => void;
  readonly onSoftDeleted?: (id: string) => void;
  readonly onRestored?: (id: string) => void;
  readonly onDateClick?: (date: string) => void;
  /** card = bordered panel; plain = for embedding in StatCard */
  readonly variant?: "card" | "plain";
  readonly emptyLabel?: string;
  readonly skeletonCount?: number;
};

/** First swipe must reach this to snap open Edit/Delete. */
const OPEN_PROGRESS = 28;
/** Closed when end progress stays under this. */
const CLOSED_PROGRESS = 15;

const SKELETON_ROWS = 5;

export function TransactionMobileList({
  items,
  loading = false,
  loadingMore = false,
  selected = [],
  onToggleOne,
  onEnterSelection,
  onEdit,
  onSoftDeleted,
  onRestored,
  onDateClick,
  variant = "card",
  emptyLabel = "—",
  skeletonCount = SKELETON_ROWS,
}: TransactionMobileListProps) {
  const selectionMode = selected.length > 0;
  const isPlain = variant === "plain";
  const shellClass = cn(
    "select-none",
    isPlain ? "overflow-hidden" : "overflow-hidden rounded-xl border",
  );
  const skeletonListClass = cn(
    "select-none divide-y",
    isPlain ? "divide-border/50" : "divide-border/60 rounded-xl border",
  );

  if (loading) {
    return (
      <ul className={skeletonListClass}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <MobileSkeletonRow key={`skeleton-${index}`} />
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex h-24 items-center justify-center text-sm text-muted-foreground",
          !isPlain && "rounded-xl border",
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <SwipeableList
        type={SwipeType.IOS}
        fullSwipe={false}
        threshold={0.45}
        className={cn(
          "transaction-swipe-list",
          isPlain && "transaction-swipe-list--plain",
        )}
      >
        {items.map((item) => (
          <TransactionMobileRow
            key={item.id}
            item={item}
            selected={selected.includes(item.id)}
            selectionMode={selectionMode}
            onToggleOne={onToggleOne}
            onEnterSelection={onEnterSelection}
            onEdit={onEdit}
            onSoftDeleted={onSoftDeleted}
            onRestored={onRestored}
            onDateClick={onDateClick}
            showDivider={isPlain}
          />
        ))}
      </SwipeableList>

      {loadingMore
        ? Array.from({ length: 3 }, (_, index) => (
            <MobileSkeletonRow key={`more-${index}`} bordered={false} />
          ))
        : null}
    </div>
  );
}

type SwipeableListInjectedProps = {
  readonly fullSwipe?: boolean;
  readonly listType?: SwipeType;
  readonly threshold?: number;
  readonly actionDelay?: number;
  readonly destructiveCallbackDelay?: number;
  readonly optOutMouseEvents?: boolean;
  readonly scrollStartThreshold?: number;
  readonly swipeStartThreshold?: number;
  readonly clickedCallback?: (id: string) => void;
  readonly id?: string;
  readonly resetState?: (close: () => void) => void;
};

type TransactionMobileRowProps = {
  readonly item: TransactionDto;
  readonly selected: boolean;
  readonly selectionMode: boolean;
  readonly onToggleOne?: (id: string) => void;
  readonly onEnterSelection?: (id: string) => void;
  readonly onEdit: (item: TransactionDto) => void;
  readonly onSoftDeleted?: (id: string) => void;
  readonly onRestored?: (id: string) => void;
  readonly onDateClick?: (date: string) => void;
  readonly showDivider?: boolean;
} & SwipeableListInjectedProps;

function TransactionMobileRow({
  item,
  selected,
  selectionMode,
  onToggleOne,
  onEnterSelection,
  onEdit,
  onSoftDeleted,
  onRestored,
  onDateClick,
  showDivider = false,
  listType = SwipeType.IOS,
  actionDelay,
  optOutMouseEvents,
  scrollStartThreshold,
  swipeStartThreshold,
  clickedCallback,
  id,
  resetState,
}: TransactionMobileRowProps) {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const router = useRouter();
  const openDivideTransactionModal = useUiStore(
    (state) => state.openDivideTransactionModal,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionsRevealed, setActionsRevealed] = useState(false);
  const [softDeleted, setSoftDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastProgressRef = useRef(0);

  const performSoftDelete = useCallback(async () => {
    if (busy || softDeleted) {
      return;
    }
    setBusy(true);
    try {
      if (item.travelId) {
        useTravelCacheStore
          .getState()
          .removeTransaction(item.travelId, item.id);
        enqueueTravelOp({
          travelId: item.travelId,
          op: { kind: "deleteTransaction", entityId: item.id },
        });
      } else {
        await deleteTransaction(item.id);
      }
      setSoftDeleted(true);
      setActionsRevealed(false);
      onSoftDeleted?.(item.id);
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }, [busy, item.id, item.travelId, onSoftDeleted, softDeleted]);

  const performRestore = useCallback(async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await restoreTransaction(item.id);
      setSoftDeleted(false);
      onRestored?.(item.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  }, [busy, item.id, onRestored]);

  const useSheet = isMobile;

  const handleLongPress = useCallback(() => {
    if (!useSheet) {
      return;
    }
    setSheetOpen(true);
  }, [useSheet]);

  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeLongPress,
  } = useLongPress({
    onLongPress: handleLongPress,
    disabled: !useSheet || selectionMode || softDeleted || busy,
  });

  const trailingActions = softDeleted ? undefined : (
    <TrailingActions>
      <SwipeAction onClick={() => onEdit(item)}>
        <div className="transaction-swipe-action bg-muted px-3 text-xs font-medium text-foreground">
          <Pencil className="size-4 shrink-0" />
          <span>{tCommon("edit")}</span>
        </div>
      </SwipeAction>
      {/*
        When actions are already revealed, fullSwipe expands this main action
        across the row as the delete signal. Keep destructive=false so the row
        stays for the restore UI (lib's destructive removes the item).
      */}
      <SwipeAction onClick={() => void performSoftDelete()}>
        <div className="transaction-swipe-action transaction-swipe-action--delete bg-destructive px-3 text-xs font-medium text-destructive-foreground">
          <Trash2 className="size-4 shrink-0" />
          <span>{tCommon("delete")}</span>
        </div>
      </SwipeAction>
    </TrailingActions>
  );

  const sheetActions: MobileRowAction[] = [
    {
      id: "view",
      label: t("viewTransaction"),
      icon: Eye,
      onSelect: () => router.push(`/transactions/${item.id}`),
    },
    ...(canDivideTransaction(item)
      ? [
          {
            id: "divide",
            label: t("divide"),
            icon: Split,
            onSelect: () => openDivideTransactionModal(item),
          } satisfies MobileRowAction,
        ]
      : []),
    {
      id: "edit",
      label: tCommon("edit"),
      icon: Pencil,
      onSelect: () => onEdit(item),
    },
    ...(onEnterSelection
      ? [
          {
            id: "select",
            label: tCommon("select"),
            icon: CheckSquare,
            onSelect: () => onEnterSelection(item.id),
          } satisfies MobileRowAction,
        ]
      : []),
    {
      id: "delete",
      label: tCommon("delete"),
      icon: Trash2,
      onSelect: () => void performSoftDelete(),
      destructive: true,
    },
  ];

  return (
    <>
    <SwipeableListItem
      id={id}
      resetState={resetState}
      clickedCallback={clickedCallback}
      actionDelay={actionDelay}
      destructiveCallbackDelay={0}
      optOutMouseEvents={optOutMouseEvents}
      scrollStartThreshold={scrollStartThreshold}
      swipeStartThreshold={swipeStartThreshold}
      blockSwipe={!isMobile || selectionMode || busy || softDeleted}
      fullSwipe={actionsRevealed}
      threshold={0.45}
      listType={listType}
      trailingActions={trailingActions}
      onSwipeProgress={(progress) => {
        lastProgressRef.current = progress;
      }}
      onSwipeEnd={() => {
        const progress = lastProgressRef.current;
        if (actionsRevealed) {
          if (progress < CLOSED_PROGRESS) {
            setActionsRevealed(false);
          }
          return;
        }
        if (progress >= OPEN_PROGRESS) {
          setActionsRevealed(true);
        }
      }}
      onClick={() => {
        if (softDeleted) {
          return;
        }
        if (consumeLongPress()) {
          return;
        }
        if (actionsRevealed) {
          setActionsRevealed(false);
        }
        if (selectionMode) {
          onToggleOne?.(item.id);
        }
      }}
    >
      <div
        className={cn(
          "flex w-full items-center gap-2 px-3 py-2.5",
          showDivider && "border-b border-border/50",
          selected && !softDeleted && "bg-muted/40",
        )}
        onPointerDown={softDeleted ? undefined : onPointerDown}
        onPointerMove={softDeleted ? undefined : onPointerMove}
        onPointerUp={softDeleted ? undefined : onPointerUp}
        onPointerCancel={softDeleted ? undefined : onPointerCancel}
      >
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            softDeleted && "pointer-events-none opacity-40",
          )}
        >
          <TransactionListPrimary
            item={item}
            className="flex-1"
            selected={selected && !softDeleted}
            onDateClick={onDateClick}
          />
          <TransactionListAmount item={item} />
        </div>

        {softDeleted ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-11 shrink-0 gap-2 px-3"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              void performRestore();
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <RotateCcw className="size-4" />
            {t("restore")}
          </Button>
        ) : !selectionMode ? (
          <RowOverflowMenu
            className="hidden md:flex"
            actions={sheetActions}
          />
        ) : null}
      </div>
    </SwipeableListItem>
    {useSheet ? (
      <MobileRowActionSheet
        open={sheetOpen}
        actions={sheetActions}
        onOpenChange={setSheetOpen}
      />
    ) : null}
    </>
  );
}

function MobileSkeletonRow({ bordered = true }: { readonly bordered?: boolean }) {
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-3",
        bordered && "border-b border-border/60 last:border-b-0",
      )}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-4 w-36 max-w-[55%]" />
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
        <Skeleton className="h-3 w-40 max-w-[70%]" />
        <Skeleton className="h-3 w-24 max-w-[40%]" />
      </div>
      <Skeleton className="size-11 shrink-0 rounded-md" />
    </li>
  );
}
