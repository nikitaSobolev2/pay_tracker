"use client";

import { Eraser, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  endCalculatorDrag,
  setDragTransactionId,
} from "@/features/transaction-calculator/calculator-dnd";
import {
  leftoverIsPartial,
  type CalculatorBoardItem,
} from "@/features/transaction-calculator/calculator-session";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";

type CalculatorTransactionCardProps = {
  readonly item: CalculatorBoardItem;
  readonly leftover: string;
  readonly dateLabel: string;
  readonly preview?: boolean;
  readonly highlighted?: boolean;
  readonly onDragBegin?: (transactionId: string) => void;
  readonly onDragFinish?: () => void;
  readonly onEditRaw?: () => void;
  readonly onDeleteRaw?: () => void;
  readonly onClearCuts?: () => void;
};

export function CalculatorTransactionCard({
  item,
  leftover,
  dateLabel,
  preview = false,
  highlighted = false,
  onDragBegin,
  onDragFinish,
  onEditRaw,
  onDeleteRaw,
  onClearCuts,
}: CalculatorTransactionCardProps) {
  const t = useTranslations("calculator");
  const tTransaction = useTranslations("transaction");
  const isSpending = item.type === TransactionType.Spending;
  const title =
    item.title.trim() ||
    (isSpending ? tTransaction("spending") : tTransaction("earning"));
  const showLeftover = leftoverIsPartial(leftover, item.displayAmount);

  return (
    <article
      draggable={!preview}
      onDragStart={(event) => {
        if (preview) {
          return;
        }
        setDragTransactionId(event, item.id);
        onDragBegin?.(item.id);
      }}
      onDragEnd={() => {
        endCalculatorDrag();
        onDragFinish?.();
      }}
      className={cn(
        "w-full min-w-0 rounded-xl border border-border/70 bg-card py-2 pl-3 pr-2.5 shadow-sm",
        "border-l-4",
        isSpending ? "border-l-rose-400" : "border-l-emerald-400",
        preview
          ? "pointer-events-none border-dashed opacity-70 ring-2 ring-primary/70"
          : "cursor-grab active:cursor-grabbing",
        highlighted ? "ring-2 ring-primary" : null,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-start gap-1">
          <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug">
            {title}
          </p>
          <CardActions
            preview={preview}
            onClearCuts={onClearCuts}
            onEditRaw={onEditRaw}
            onDeleteRaw={onDeleteRaw}
          />
        </div>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isSpending ? "text-rose-400" : "text-emerald-400",
          )}
        >
          {formatMoney(item.displayAmount, item.displayCurrency)}
        </p>
        {showLeftover ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {t("leftover", {
              amount: formatMoney(leftover, item.displayCurrency),
            })}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
      </div>
    </article>
  );
}

function CardActions({
  preview,
  onClearCuts,
  onEditRaw,
  onDeleteRaw,
}: {
  readonly preview: boolean;
  readonly onClearCuts?: () => void;
  readonly onEditRaw?: () => void;
  readonly onDeleteRaw?: () => void;
}) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  if (preview || (!onClearCuts && !onEditRaw && !onDeleteRaw)) {
    return null;
  }
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onClearCuts ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("clearCuts")}
          onClick={(event) => {
            event.stopPropagation();
            onClearCuts();
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Eraser />
        </Button>
      ) : null}
      {onEditRaw ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={tCommon("edit")}
          onClick={onEditRaw}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Pencil />
        </Button>
      ) : null}
      {onDeleteRaw ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={tCommon("delete")}
          onClick={onDeleteRaw}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Trash2 />
        </Button>
      ) : null}
    </div>
  );
}
