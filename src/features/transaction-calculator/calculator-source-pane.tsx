"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  readDragTransactionId,
  useCalculatorDropHover,
} from "@/features/transaction-calculator/calculator-dnd";
import {
  leftoverAmount,
  hasCutsForTransaction,
  type BoardColumn,
  type CalculatorBoardItem,
  type CalculatorCut,
  type CalculatorSession,
} from "@/features/transaction-calculator/calculator-session";
import { CalculatorTransactionCard } from "@/features/transaction-calculator/calculator-transaction-card";
import { CalculatorWorkspaceSwitcher } from "@/features/transaction-calculator/calculator-workspace-switcher";
import { cn } from "@/lib/utils";
import type { CounterpartyDto } from "@/lib/api/counterparties";

type CalculatorSourcePaneProps = {
  readonly counterparties: readonly CounterpartyDto[];
  readonly session: CalculatorSession;
  readonly cuts: readonly CalculatorCut[];
  readonly columns: Record<BoardColumn, CalculatorBoardItem[]>;
  readonly switcherPeople: readonly { id: string; name: string }[];
  readonly draggingItem: CalculatorBoardItem | null;
  readonly formatDate: (value: string) => string;
  readonly onTogglePerson: (counterpartyId: string) => void;
  readonly onSelectWorkspace: (workspaceId: string) => void;
  readonly onDropColumn: (transactionId: string, column: BoardColumn) => void;
  readonly onDragBegin: (transactionId: string) => void;
  readonly onDragFinish: () => void;
  readonly onEditRaw: (transactionId: string) => void;
  readonly onDeleteRaw: (transactionId: string) => void;
  readonly onClearCuts: (transactionId: string) => void;
};

const BOARD_COLUMNS: readonly BoardColumn[] = ["default", "processing", "done"];

export function CalculatorSourcePane({
  counterparties,
  session,
  cuts,
  columns,
  switcherPeople,
  draggingItem,
  formatDate,
  onTogglePerson,
  onSelectWorkspace,
  onDropColumn,
  onDragBegin,
  onDragFinish,
  onEditRaw,
  onDeleteRaw,
  onClearCuts,
}: CalculatorSourcePaneProps) {
  const t = useTranslations("calculator");

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-2 lg:gap-3">
      <p className="shrink-0 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {t("counterparties")}
      </p>
      <ChipRow>
        {counterparties.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPeople")}</p>
        ) : (
          counterparties.map((person) => {
            const selected = session.selectedCounterpartyIds.includes(
              person.id,
            );
            return (
              <button
                key={person.id}
                type="button"
                className="max-w-full min-w-0"
                onClick={() => onTogglePerson(person.id)}
              >
                <Badge
                  variant={selected ? "default" : "outline"}
                  className="h-8 max-w-40 rounded-full px-3 text-sm"
                >
                  <span className="truncate">{person.name}</span>
                </Badge>
              </button>
            );
          })
        )}
      </ChipRow>
      <div className="flex shrink-0 flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {t("workspace")}
        </p>
        <CalculatorWorkspaceSwitcher
          activeId={session.activeWorkspaceId}
          meLabel={t("me")}
          people={switcherPeople}
          onSelect={onSelectWorkspace}
        />
      </div>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-3 gap-1.5 lg:gap-2">
        {BOARD_COLUMNS.map((column) => (
          <KanbanColumn
            key={column}
            column={column}
            title={columnTitle(column, t)}
            items={columns[column]}
            cuts={cuts}
            draggingItem={draggingItem}
            emptyLabel={t("emptyColumn")}
            formatDate={formatDate}
            onDropColumn={onDropColumn}
            onDragBegin={onDragBegin}
            onDragFinish={onDragFinish}
            onEditRaw={onEditRaw}
            onDeleteRaw={onDeleteRaw}
            onClearCuts={onClearCuts}
          />
        ))}
      </div>
    </div>
  );
}

function columnTitle(
  column: BoardColumn,
  t: (key: "columnDefault" | "columnProcessing" | "columnDone") => string,
): string {
  if (column === "default") {
    return t("columnDefault");
  }
  if (column === "processing") {
    return t("columnProcessing");
  }
  return t("columnDone");
}

function ChipRow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex max-h-20 shrink-0 flex-wrap content-start gap-1.5 overflow-y-auto">
      {children}
    </div>
  );
}

function KanbanColumn({
  column,
  title,
  items,
  cuts,
  draggingItem,
  emptyLabel,
  formatDate,
  onDropColumn,
  onDragBegin,
  onDragFinish,
  onEditRaw,
  onDeleteRaw,
  onClearCuts,
}: {
  readonly column: BoardColumn;
  readonly title: string;
  readonly items: readonly CalculatorBoardItem[];
  readonly cuts: readonly CalculatorCut[];
  readonly draggingItem: CalculatorBoardItem | null;
  readonly emptyLabel: string;
  readonly formatDate: (value: string) => string;
  readonly onDropColumn: (transactionId: string, column: BoardColumn) => void;
  readonly onDragBegin: (transactionId: string) => void;
  readonly onDragFinish: () => void;
  readonly onEditRaw: (transactionId: string) => void;
  readonly onDeleteRaw: (transactionId: string) => void;
  readonly onClearCuts: (transactionId: string) => void;
}) {
  const t = useTranslations("calculator");
  const hover = useCalculatorDropHover(`column:${column}`, "transaction");
  const alreadyHere =
    draggingItem != null && items.some((item) => item.id === draggingItem.id);
  const showPreview = hover.isOver && draggingItem != null && !alreadyHere;

  return (
    <section
      data-calculator-drop={`column:${column}`}
      className={cn(
        "flex min-h-0 min-w-0 flex-col rounded-xl border border-border/60 bg-muted/25",
        "data-[drop-over]:border-primary/70 data-[drop-over]:ring-1 data-[drop-over]:ring-primary/60",
      )}
      onDragOver={hover.onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        const transactionId = readDragTransactionId(event);
        hover.resetHover();
        onDragFinish();
        if (transactionId) {
          onDropColumn(transactionId, column);
        }
      }}
    >
      <header className="flex shrink-0 items-center justify-between gap-1 border-b border-border/50 px-2 py-1.5 lg:gap-2 lg:px-3 lg:py-2">
        <h3 className="truncate text-xs font-semibold lg:text-sm">{title}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-1.5 lg:p-2">
        {items.length === 0 && !showPreview ? (
          <p className="px-1 py-3 text-center text-xs text-muted-foreground lg:py-8 lg:text-sm">
            {emptyLabel}
          </p>
        ) : (
          items.map((item) => (
            <CalculatorTransactionCard
              key={item.id}
              item={item}
              leftover={leftoverAmount(item.displayAmount, cuts, item.id)}
              dateLabel={
                item.occurredAt ? formatDate(item.occurredAt) : t("noDate")
              }
              highlighted={
                hover.isOver && alreadyHere && item.id === draggingItem?.id
              }
              onDragBegin={onDragBegin}
              onDragFinish={onDragFinish}
              onEditRaw={item.isRaw ? () => onEditRaw(item.id) : undefined}
              onDeleteRaw={item.isRaw ? () => onDeleteRaw(item.id) : undefined}
              onClearCuts={
                hasCutsForTransaction(cuts, item.id)
                  ? () => onClearCuts(item.id)
                  : undefined
              }
            />
          ))
        )}
        {showPreview && draggingItem ? (
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
    </section>
  );
}
