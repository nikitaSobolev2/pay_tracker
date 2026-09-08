"use client";

import {
  ChevronDown,
  ChevronRight,
  HandCoins,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { DragEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  endCalculatorDrag,
  readDragPersonId,
  readDragTransactionId,
  setDragPersonId,
  useCalculatorDropHover,
} from "@/features/transaction-calculator/calculator-dnd";
import {
  applyTransfersToCutNet,
  collapseIdForTarget,
  existingCutForTarget,
  leftoverAmount,
  meCutTotals,
  netDebtKind,
  partyIdForTarget,
  personCutTotals,
  transfersForParty,
  type CalculatorBoardItem,
  type CalculatorCut,
  type CalculatorTransfer,
  type CutTarget,
  type PersonCutTotals,
} from "@/features/transaction-calculator/calculator-session";
import { CalculatorTransactionCard } from "@/features/transaction-calculator/calculator-transaction-card";
import { formatCeiledMoney, formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";

type CalculatorPersonColumnProps = {
  readonly title: string;
  readonly target: CutTarget;
  readonly cuts: readonly CalculatorCut[];
  readonly transfers: readonly CalculatorTransfer[];
  readonly boardItems: readonly CalculatorBoardItem[];
  readonly canPostDebt: boolean;
  readonly posting: boolean;
  readonly collapsed: boolean;
  readonly draggingItem: CalculatorBoardItem | null;
  readonly partyName: (partyId: string) => string;
  readonly formatDate: (value: string) => string;
  readonly onToggleCollapsed: () => void;
  readonly onDropTransaction: (
    transactionId: string,
    target: CutTarget,
  ) => void;
  readonly onDropPerson: (payerId: string, payeeTarget: CutTarget) => void;
  readonly onDragFinish: () => void;
  readonly onEditCut: (cut: CalculatorCut) => void;
  readonly onDeleteCut: (cutId: string) => void;
  readonly onEditTransfer: (transfer: CalculatorTransfer) => void;
  readonly onDeleteTransfer: (transferId: string) => void;
  readonly onAddToDebt?: () => void;
};

export function CalculatorPersonColumn({
  title,
  target,
  cuts,
  transfers,
  boardItems,
  canPostDebt,
  posting,
  collapsed,
  draggingItem,
  partyName,
  formatDate,
  onToggleCollapsed,
  onDropTransaction,
  onDropPerson,
  onDragFinish,
  onEditCut,
  onDeleteCut,
  onEditTransfer,
  onDeleteTransfer,
  onAddToDebt,
}: CalculatorPersonColumnProps) {
  const partyId = partyIdForTarget(target);
  const hover = useCalculatorDropHover(collapseIdForTarget(target));
  const totals = columnTotals(target, cuts, transfers, partyId);
  const netKind = netDebtKind(totals.net);
  const currency =
    cuts[0]?.displayCurrency ??
    transfers[0]?.displayCurrency ??
    boardItems[0]?.displayCurrency ??
    "RUB";
  const existingPreviewCut = draggingItem
    ? existingCutForTarget(cuts, draggingItem.id, target)
    : null;
  const showGhostPreview =
    hover.isOver &&
    draggingItem != null &&
    existingPreviewCut == null &&
    !collapsed;
  const partyTransfers = transfersForParty(transfers, partyId);

  return (
    <section
      data-calculator-drop={collapseIdForTarget(target)}
      className={cn(
        "flex h-auto w-full min-w-0 flex-col rounded-xl border border-border/60 bg-muted/20",
        collapsed
          ? "data-[drop-over]:border-primary data-[drop-over]:ring-2 data-[drop-over]:ring-primary"
          : "data-[drop-over]:border-primary/70 data-[drop-over]:ring-1 data-[drop-over]:ring-primary/60",
      )}
      onDragOver={(event) => {
        event.stopPropagation();
        hover.onDragOver(event);
      }}
      onDrop={(event) =>
        handleColumnDrop(event, {
          partyId,
          target,
          hoverReset: hover.resetHover,
          onDragFinish,
          onDropPerson,
          onDropTransaction,
        })
      }
    >
      <PersonColumnHeader
        title={title}
        partyId={partyId}
        collapsed={collapsed}
        canPostDebt={canPostDebt}
        posting={posting}
        netKind={netKind}
        onToggleCollapsed={onToggleCollapsed}
        onDragFinish={onDragFinish}
        onAddToDebt={onAddToDebt}
      />
      {collapsed ? (
        <div className="p-2 lg:p-3">
          <TotalsBlock totals={totals} currency={currency} />
        </div>
      ) : (
        <PersonColumnExpanded
          cuts={cuts}
          partyTransfers={partyTransfers}
          boardItems={boardItems}
          draggingItem={draggingItem}
          showGhostPreview={showGhostPreview}
          existingPreviewCutId={existingPreviewCut?.id ?? null}
          isOver={hover.isOver}
          partyId={partyId}
          partyName={partyName}
          totals={totals}
          currency={currency}
          formatDate={formatDate}
          onEditCut={onEditCut}
          onDeleteCut={onDeleteCut}
          onEditTransfer={onEditTransfer}
          onDeleteTransfer={onDeleteTransfer}
        />
      )}
    </section>
  );
}

function columnTotals(
  target: CutTarget,
  cuts: readonly CalculatorCut[],
  transfers: readonly CalculatorTransfer[],
  partyId: string,
): PersonCutTotals {
  const cutTotals =
    target.kind === "me"
      ? meCutTotals(cuts)
      : personCutTotals(cuts, target.counterpartyId);
  return applyTransfersToCutNet(cutTotals, transfers, partyId);
}

function handleColumnDrop(
  event: DragEvent,
  handlers: {
    readonly partyId: string;
    readonly target: CutTarget;
    readonly hoverReset: () => void;
    readonly onDragFinish: () => void;
    readonly onDropPerson: (payerId: string, payeeTarget: CutTarget) => void;
    readonly onDropTransaction: (
      transactionId: string,
      target: CutTarget,
    ) => void;
  },
): void {
  event.preventDefault();
  event.stopPropagation();
  const payerId = readDragPersonId(event);
  const transactionId = readDragTransactionId(event);
  handlers.hoverReset();
  handlers.onDragFinish();
  if (payerId && payerId !== handlers.partyId) {
    handlers.onDropPerson(payerId, handlers.target);
    return;
  }
  if (transactionId) {
    handlers.onDropTransaction(transactionId, handlers.target);
  }
}

function PersonColumnHeader({
  title,
  partyId,
  collapsed,
  canPostDebt,
  posting,
  netKind,
  onToggleCollapsed,
  onDragFinish,
  onAddToDebt,
}: {
  readonly title: string;
  readonly partyId: string;
  readonly collapsed: boolean;
  readonly canPostDebt: boolean;
  readonly posting: boolean;
  readonly netKind: ReturnType<typeof netDebtKind>;
  readonly onToggleCollapsed: () => void;
  readonly onDragFinish: () => void;
  readonly onAddToDebt?: () => void;
}) {
  const t = useTranslations("calculator");
  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-border/50 px-2 py-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={collapsed ? t("expand") : t("collapse")}
        onClick={onToggleCollapsed}
      >
        {collapsed ? <ChevronRight /> : <ChevronDown />}
      </Button>
      <h3
        draggable
        className="min-w-0 flex-1 cursor-grab truncate text-sm font-semibold active:cursor-grabbing"
        onDragStart={(event) => {
          setDragPersonId(event, partyId);
        }}
        onDragEnd={() => {
          endCalculatorDrag();
          onDragFinish();
        }}
      >
        {title}
      </h3>
      {onAddToDebt && !collapsed ? (
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="shrink-0"
          disabled={!canPostDebt || netKind === "zero" || posting}
          aria-label={t("addToDebt")}
          onClick={onAddToDebt}
        >
          {posting ? <Loader2 className="animate-spin" /> : <HandCoins />}
        </Button>
      ) : null}
    </header>
  );
}

function PersonColumnExpanded({
  cuts,
  partyTransfers,
  boardItems,
  draggingItem,
  showGhostPreview,
  existingPreviewCutId,
  isOver,
  partyId,
  partyName,
  totals,
  currency,
  formatDate,
  onEditCut,
  onDeleteCut,
  onEditTransfer,
  onDeleteTransfer,
}: {
  readonly cuts: readonly CalculatorCut[];
  readonly partyTransfers: readonly CalculatorTransfer[];
  readonly boardItems: readonly CalculatorBoardItem[];
  readonly draggingItem: CalculatorBoardItem | null;
  readonly showGhostPreview: boolean;
  readonly existingPreviewCutId: string | null;
  readonly isOver: boolean;
  readonly partyId: string;
  readonly partyName: (partyId: string) => string;
  readonly totals: PersonCutTotals;
  readonly currency: string;
  readonly formatDate: (value: string) => string;
  readonly onEditCut: (cut: CalculatorCut) => void;
  readonly onDeleteCut: (cutId: string) => void;
  readonly onEditTransfer: (transfer: CalculatorTransfer) => void;
  readonly onDeleteTransfer: (transferId: string) => void;
}) {
  const t = useTranslations("calculator");
  const isEmpty =
    cuts.length === 0 && partyTransfers.length === 0 && !showGhostPreview;
  return (
    <>
      <div className="flex flex-col gap-2 p-2">
        {isEmpty ? (
          <p className="px-1 py-3 text-center text-sm text-muted-foreground lg:py-6">
            {t("emptyColumn")}
          </p>
        ) : (
          <ColumnRows
            cuts={cuts}
            partyTransfers={partyTransfers}
            boardItems={boardItems}
            existingPreviewCutId={existingPreviewCutId}
            isOver={isOver}
            partyId={partyId}
            partyName={partyName}
            onEditCut={onEditCut}
            onDeleteCut={onDeleteCut}
            onEditTransfer={onEditTransfer}
            onDeleteTransfer={onDeleteTransfer}
          />
        )}
        {showGhostPreview && draggingItem ? (
          <CalculatorTransactionCard
            item={draggingItem}
            leftover={leftoverAmount(
              draggingItem.displayAmount,
              cuts,
              draggingItem.id,
            )}
            dateLabel={
              draggingItem.occurredAt
                ? formatDate(draggingItem.occurredAt)
                : t("noDate")
            }
            preview
          />
        ) : null}
      </div>
      <footer className="shrink-0 border-t border-border/50 p-3">
        <TotalsBlock totals={totals} currency={currency} />
      </footer>
    </>
  );
}

function ColumnRows({
  cuts,
  partyTransfers,
  boardItems,
  existingPreviewCutId,
  isOver,
  partyId,
  partyName,
  onEditCut,
  onDeleteCut,
  onEditTransfer,
  onDeleteTransfer,
}: {
  readonly cuts: readonly CalculatorCut[];
  readonly partyTransfers: readonly CalculatorTransfer[];
  readonly boardItems: readonly CalculatorBoardItem[];
  readonly existingPreviewCutId: string | null;
  readonly isOver: boolean;
  readonly partyId: string;
  readonly partyName: (partyId: string) => string;
  readonly onEditCut: (cut: CalculatorCut) => void;
  readonly onDeleteCut: (cutId: string) => void;
  readonly onEditTransfer: (transfer: CalculatorTransfer) => void;
  readonly onDeleteTransfer: (transferId: string) => void;
}) {
  const tCommon = useTranslations("common");
  const tTransaction = useTranslations("transaction");
  return (
    <>
      {cuts.map((cut) => (
        <CutRow
          key={cut.id}
          cut={cut}
          item={
            boardItems.find((item) => item.id === cut.transactionId) ?? null
          }
          highlighted={isOver && existingPreviewCutId === cut.id}
          spendingLabel={tTransaction("spending")}
          earningLabel={tTransaction("earning")}
          editLabel={tCommon("edit")}
          deleteLabel={tCommon("delete")}
          onEdit={() => onEditCut(cut)}
          onDelete={() => onDeleteCut(cut.id)}
        />
      ))}
      {partyTransfers.map((transfer) => (
        <TransferRow
          key={transfer.id}
          transfer={transfer}
          partyId={partyId}
          partyName={partyName}
          editLabel={tCommon("edit")}
          deleteLabel={tCommon("delete")}
          onEdit={() => onEditTransfer(transfer)}
          onDelete={() => onDeleteTransfer(transfer.id)}
        />
      ))}
    </>
  );
}

function TotalsBlock({
  totals,
  currency,
}: {
  readonly totals: PersonCutTotals;
  readonly currency: string;
}) {
  const t = useTranslations("calculator");
  return (
    <dl className="space-y-1 text-sm">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-muted-foreground">{t("spending")}</dt>
        <dd className="tabular-nums text-rose-400">
          {formatCeiledMoney(totals.spending, currency)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-muted-foreground">{t("earning")}</dt>
        <dd className="tabular-nums text-emerald-400">
          {formatCeiledMoney(totals.earning, currency)}
        </dd>
      </div>
      <div className="flex items-center justify-between gap-2 font-medium">
        <dt>{t("net")}</dt>
        <dd className="tabular-nums">
          {formatCeiledMoney(totals.net, currency)}
        </dd>
      </div>
    </dl>
  );
}

function CutRow({
  cut,
  item,
  highlighted,
  spendingLabel,
  earningLabel,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  readonly cut: CalculatorCut;
  readonly item: CalculatorBoardItem | null;
  readonly highlighted: boolean;
  readonly spendingLabel: string;
  readonly earningLabel: string;
  readonly editLabel: string;
  readonly deleteLabel: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const isSpending = cut.sourceType === TransactionType.Spending;
  const title =
    item?.title.trim() || (isSpending ? spendingLabel : earningLabel);

  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-1 rounded-lg border border-border/50 bg-card px-2 py-1.5",
        highlighted ? "ring-2 ring-primary" : null,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p
          className={cn(
            "text-sm font-semibold tabular-nums",
            isSpending ? "text-rose-400" : "text-emerald-400",
          )}
        >
          {formatMoney(cut.displayAmount, cut.displayCurrency)}
        </p>
      </div>
      <RowActions
        editLabel={editLabel}
        deleteLabel={deleteLabel}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function TransferRow({
  transfer,
  partyId,
  partyName,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  readonly transfer: CalculatorTransfer;
  readonly partyId: string;
  readonly partyName: (partyId: string) => string;
  readonly editLabel: string;
  readonly deleteLabel: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("calculator");
  const amount = formatMoney(transfer.displayAmount, transfer.displayCurrency);
  const paid = transfer.payerId === partyId;
  const otherId = paid ? transfer.payeeId : transfer.payerId;
  const label = paid
    ? t("paidTo", { name: partyName(otherId), amount })
    : t("receivedFrom", { name: partyName(otherId), amount });

  return (
    <div className="flex min-w-0 items-start gap-1 rounded-lg border border-dashed border-border/50 bg-card px-2 py-1.5">
      <p className="min-w-0 flex-1 text-sm">{label}</p>
      <RowActions
        editLabel={editLabel}
        deleteLabel={deleteLabel}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  readonly editLabel: string;
  readonly deleteLabel: string;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={editLabel}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
