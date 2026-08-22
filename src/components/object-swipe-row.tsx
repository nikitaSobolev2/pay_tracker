"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, type ReactNode } from "react";
import {
  SwipeableList,
  SwipeableListItem,
  SwipeAction,
  TrailingActions,
  Type as SwipeType,
} from "react-swipeable-list";

import {
  MobileRowActionSheet,
  type MobileRowAction,
} from "@/components/mobile-row-action-sheet";
import { useLongPress } from "@/hooks/use-long-press";
import { cn } from "@/lib/utils";

export type ObjectSwipeInjectedProps = {
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

type ObjectSwipeRowProps = {
  readonly children: ReactNode;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly extraActions?: readonly MobileRowAction[];
  readonly blockSwipe?: boolean;
  readonly sheetTitle?: string;
} & ObjectSwipeInjectedProps;

export function ObjectSwipeRow({
  children,
  onEdit,
  onDelete,
  extraActions = [],
  blockSwipe = false,
  sheetTitle,
  listType = SwipeType.IOS,
  ...swipeProps
}: ObjectSwipeRowProps) {
  const tCommon = useTranslations("common");
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLongPress = useCallback(() => {
    setSheetOpen(true);
  }, []);

  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeLongPress,
  } = useLongPress({
    onLongPress: handleLongPress,
  });

  const actions: MobileRowAction[] = [
    ...extraActions,
    {
      id: "edit",
      label: tCommon("edit"),
      icon: Pencil,
      onSelect: onEdit,
    },
    {
      id: "delete",
      label: tCommon("delete"),
      icon: Trash2,
      onSelect: onDelete,
      destructive: true,
    },
  ];

  return (
    <SwipeableListItem
      {...swipeProps}
      listType={listType}
      blockSwipe={blockSwipe}
      trailingActions={
        <TrailingActions>
          <SwipeAction onClick={onEdit}>
            <div className="object-swipe-action bg-muted text-foreground">
              <Pencil className="size-4" />
              <span>{tCommon("edit")}</span>
            </div>
          </SwipeAction>
          <SwipeAction onClick={onDelete}>
            <div className="object-swipe-action bg-destructive text-destructive-foreground">
              <Trash2 className="size-4" />
              <span>{tCommon("delete")}</span>
            </div>
          </SwipeAction>
        </TrailingActions>
      }
    >
      <div
        className="w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={(event) => {
          if (consumeLongPress()) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        {children}
      </div>
      <MobileRowActionSheet
        open={sheetOpen}
        title={sheetTitle}
        actions={actions}
        onOpenChange={setSheetOpen}
      />
    </SwipeableListItem>
  );
}

/** Swipe list on mobile; stacked cards on desktop so layout is not clipped. */
export function ObjectActionList({
  swipe,
  children,
  variant = "card",
}: {
  readonly swipe: boolean;
  readonly children: ReactNode;
  readonly variant?: "card" | "pass";
}) {
  if (!swipe) {
    return <div className="flex flex-col gap-2">{children}</div>;
  }
  return (
    <SwipeableList
      type={SwipeType.IOS}
      fullSwipe={false}
      threshold={0.45}
      className={cn(
        "object-swipe-list",
        variant === "pass" && "object-swipe-list--pass",
      )}
    >
      {children}
    </SwipeableList>
  );
}
