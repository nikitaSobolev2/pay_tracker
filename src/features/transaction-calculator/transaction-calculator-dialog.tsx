"use client";

import { Eraser, Loader2, Plus, Printer, Save, Scale, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  calculatorBoardQueryFromPage,
  normalizeBoardTitle,
} from "@/features/transaction-calculator/calculator-board-payload";
import {
  CalculatorCutModal,
  type CalculatorCutDraft,
} from "@/features/transaction-calculator/calculator-cut-modal";
import { CalculatorPeopleBento } from "@/features/transaction-calculator/calculator-people-bento";
import { CalculatorPersonColumn } from "@/features/transaction-calculator/calculator-person-column";
import { CalculatorPrintReport } from "@/features/transaction-calculator/calculator-print";
import { CalculatorRawTransactionModal } from "@/features/transaction-calculator/calculator-raw-transaction-modal";
import { CalculatorSplitLayout } from "@/features/transaction-calculator/calculator-split-layout";
import {
  activateWorkspace,
  activeWorkspace,
  allWorkspaceCuts,
  applyTransfersToCutNet,
  applyPeoplePaneDrop,
  collapseIdForTarget,
  EMPTY_CALCULATOR_SESSION,
  existingCutForTarget,
  groupBoardItemsByColumn,
  isCalculatorTargetCollapsed,
  isMeWorkspace,
  leftoverForCutEdit,
  ME_PARTY_ID,
  mergeCalculatorBoardItems,
  netDebtKind,
  omitBoardColumn,
  partyIdForTarget,
  personCutTotals,
  removeCutsForTransaction,
  withActiveWorkspace,
  withBoardColumn,
  withExpandedTarget,
  type BoardColumn,
  type CalculatorCut,
  type CalculatorRawTransaction,
  type CalculatorSession,
  type CalculatorTransfer,
  type CalculatorWorkspace,
  type CutTarget,
} from "@/features/transaction-calculator/calculator-session";
import { type CalculatorLedgerRow } from "@/features/transaction-calculator/calculator-settlement";
import { CalculatorSourcePane } from "@/features/transaction-calculator/calculator-source-pane";
import {
  CalculatorTotalsModal,
  calculatorPartyLabel,
} from "@/features/transaction-calculator/calculator-totals-modal";
import {
  CalculatorTransferModal,
  type CalculatorTransferDraft,
} from "@/features/transaction-calculator/calculator-transfer-modal";
import {
  calculatorLedgerQuery,
  calculatorPeriodQuery,
  fetchAllCalculatorTransactions,
} from "@/features/transaction-calculator/fetch-calculator-period";
import { useCalculatorDialogSession } from "@/features/transaction-calculator/use-calculator-dialog-session";
import { useAppUser } from "@/hooks/use-app-user";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  createCalculatorBoard,
  updateCalculatorBoard,
} from "@/lib/api/calculator-boards";
import {
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import {
  createTransaction,
  type TransactionListParams,
} from "@/lib/api/transactions";
import { decimalToString, toDecimal } from "@/lib/money";
import { TransactionKind, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TransactionCalculatorDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly queryBase: TransactionListParams;
  readonly periodLabel: string;
  readonly mode?: "draft" | "board";
  readonly initialSession?: CalculatorSession;
  readonly onPersistBoard?: (session: CalculatorSession) => Promise<void>;
};

const NO_PERIOD_TRANSACTIONS: TransactionDto[] = [];
const HEADER_ACTION_CLASS = "rounded-xl lg:h-11 lg:w-auto lg:px-3.5";

export function TransactionCalculatorDialog({
  open,
  onOpenChange,
  queryBase,
  periodLabel,
  mode = "draft",
  initialSession,
  onPersistBoard,
}: TransactionCalculatorDialogProps) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const { user } = useAppUser();
  const formatDate = useReadableDateTime();
  const isDraft = mode === "draft";
  const {
    session,
    setSession,
    linkedBoardId,
    rememberBoardId,
    clearDraft,
    isDirty,
    markClean,
  } = useCalculatorDialogSession({
    mode,
    userId: user?.id ?? null,
    initialSession,
  });
  const workspace = activeWorkspace(session);
  const [periodTransactions, setPeriodTransactions] = useState<
    TransactionDto[]
  >([]);
  const [ledgerRows, setLedgerRows] = useState<CalculatorLedgerRow[]>([]);
  const [counterparties, setCounterparties] = useState<CounterpartyDto[]>([]);
  const [cutDraft, setCutDraft] = useState<CalculatorCutDraft | null>(null);
  const [transferDraft, setTransferDraft] =
    useState<CalculatorTransferDraft | null>(null);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [editingRaw, setEditingRaw] = useState<CalculatorRawTransaction | null>(
    null,
  );
  const [rawToDelete, setRawToDelete] = useState<string | null>(null);
  const [postingPersonId, setPostingPersonId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const requestKey = open
    ? JSON.stringify(calculatorPeriodQuery(queryBase))
    : null;
  if (!open && loadedKey !== null) {
    setLoadedKey(null);
  }
  const loading = Boolean(open && loadedKey !== requestKey);

  useEffect(() => {
    if (!requestKey) {
      return;
    }
    let cancelled = false;
    void Promise.all([
      fetchAllCalculatorTransactions(calculatorPeriodQuery(queryBase)),
      fetchAllCalculatorTransactions(calculatorLedgerQuery(queryBase)),
      listCounterparties({ all: true }),
    ])
      .then(([transactions, ledgerTransactions, people]) => {
        if (cancelled) {
          return;
        }
        setPeriodTransactions(transactions);
        setLedgerRows(ledgerTransactions.map(toLedgerRow));
        setCounterparties(people.counterparties);
        setLoadedKey(requestKey);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("loading"));
          setLoadedKey(requestKey);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, queryBase, requestKey, t]);

  const periodForBoard = isMeWorkspace(session.activeWorkspaceId)
    ? periodTransactions
    : NO_PERIOD_TRANSACTIONS;
  const boardItems = useMemo(
    () => mergeCalculatorBoardItems(periodForBoard, workspace.rawTransactions),
    [periodForBoard, workspace.rawTransactions],
  );
  const columns = useMemo(
    () =>
      groupBoardItemsByColumn(
        boardItems,
        workspace.cuts,
        workspace.boardColumn,
      ),
    [boardItems, workspace.boardColumn, workspace.cuts],
  );
  const boardIdSet = useMemo(
    () => new Set(boardItems.map((item) => item.id)),
    [boardItems],
  );
  const visibleCuts = useMemo(
    () => workspace.cuts.filter((cut) => boardIdSet.has(cut.transactionId)),
    [boardIdSet, workspace.cuts],
  );
  const selectedPeople = useMemo(
    () =>
      session.selectedCounterpartyIds.map((id) => ({
        id,
        name: personName(id, counterparties, session),
      })),
    [counterparties, session],
  );
  const displayCurrency =
    user?.defaultCurrency ?? boardItems[0]?.displayCurrency ?? "RUB";
  const draggingItem =
    boardItems.find((item) => item.id === draggingId) ?? null;
  const rightColumns = rightPaneColumns(
    session.activeWorkspaceId,
    selectedPeople,
    t("me"),
  );

  const patchWorkspace = useCallback(
    (next: CalculatorWorkspace) => {
      setSession(withActiveWorkspace(session, next));
    },
    [session, setSession],
  );

  const togglePerson = useCallback(
    (counterpartyId: string) => {
      if (session.selectedCounterpartyIds.includes(counterpartyId)) {
        const nextActive =
          session.activeWorkspaceId === counterpartyId
            ? ME_PARTY_ID
            : session.activeWorkspaceId;
        setSession({
          ...session,
          selectedCounterpartyIds: session.selectedCounterpartyIds.filter(
            (id) => id !== counterpartyId,
          ),
          activeWorkspaceId: nextActive,
        });
        return;
      }
      setSession({
        ...session,
        selectedCounterpartyIds: [
          ...session.selectedCounterpartyIds,
          counterpartyId,
        ],
      });
    },
    [session, setSession],
  );

  function dropOnColumn(transactionId: string, column: BoardColumn) {
    if (!boardIdSet.has(transactionId)) {
      return;
    }
    patchWorkspace({
      ...workspace,
      boardColumn: withBoardColumn(
        workspace.boardColumn,
        transactionId,
        column,
      ),
    });
  }

  function dropOnPeoplePane(transactionId: string) {
    const item = boardItems.find((row) => row.id === transactionId);
    if (!item) {
      return;
    }
    const result = applyPeoplePaneDrop({
      workspace,
      item,
      selectedPeople,
      activeWorkspaceId: session.activeWorkspaceId,
      activePersonName: personName(
        session.activeWorkspaceId,
        counterparties,
        session,
      ),
      createCutId: uuidv4,
    });
    if (!result.ok) {
      toast.error(t("nothingToCut"));
      return;
    }
    patchWorkspace(result.workspace);
  }

  function dropOnTarget(transactionId: string, target: CutTarget) {
    const item = boardItems.find((row) => row.id === transactionId);
    if (!item) {
      return;
    }
    const existing = existingCutForTarget(
      workspace.cuts,
      transactionId,
      target,
    );
    if (existing) {
      setCutDraft({ transactionId, target, editingCut: existing });
      return;
    }
    const leftover = leftoverForCutEdit(
      item.displayAmount,
      workspace.cuts,
      transactionId,
      null,
    );
    if (toDecimal(leftover).lte(0)) {
      toast.error(t("nothingToCut"));
      return;
    }
    setCutDraft({ transactionId, target, editingCut: null });
  }

  function dropOnPerson(payerId: string, payeeTarget: CutTarget) {
    const payeeId = partyIdForTarget(payeeTarget);
    if (payerId === payeeId) {
      return;
    }
    setTransferDraft({
      payerId,
      payeeId,
      payerName: partyLabel(payerId),
      payeeName: partyLabel(payeeId),
      displayCurrency,
      editing: null,
    });
  }

  function toggleCollapsed(target: CutTarget) {
    const targetId = collapseIdForTarget(target);
    const expanded = workspace.expandedTargetIds.includes(targetId);
    patchWorkspace({
      ...workspace,
      expandedTargetIds: withExpandedTarget(
        workspace.expandedTargetIds,
        targetId,
        !expanded,
      ),
    });
  }

  function saveCut(cut: CalculatorCut) {
    const without = workspace.cuts.filter((item) => item.id !== cut.id);
    patchWorkspace({ ...workspace, cuts: [...without, cut] });
    setCutDraft(null);
  }

  function deleteCut(cutId: string) {
    patchWorkspace({
      ...workspace,
      cuts: workspace.cuts.filter((cut) => cut.id !== cutId),
    });
  }

  function saveTransfer(transfer: CalculatorTransfer) {
    const without = workspace.transfers.filter(
      (item) => item.id !== transfer.id,
    );
    patchWorkspace({ ...workspace, transfers: [...without, transfer] });
    setTransferDraft(null);
  }

  function deleteTransfer(transferId: string) {
    patchWorkspace({
      ...workspace,
      transfers: workspace.transfers.filter((item) => item.id !== transferId),
    });
  }

  function saveRaw(raw: CalculatorRawTransaction) {
    const exists = workspace.rawTransactions.some((item) => item.id === raw.id);
    patchWorkspace({
      ...workspace,
      rawTransactions: exists
        ? workspace.rawTransactions.map((item) =>
            item.id === raw.id ? raw : item,
          )
        : [...workspace.rawTransactions, raw],
    });
    setRawOpen(false);
    setEditingRaw(null);
  }

  function deleteRaw(transactionId: string) {
    patchWorkspace({
      ...workspace,
      rawTransactions: workspace.rawTransactions.filter(
        (item) => item.id !== transactionId,
      ),
      cuts: removeCutsForTransaction(workspace.cuts, transactionId),
      boardColumn: omitBoardColumn(workspace.boardColumn, transactionId),
    });
    setRawToDelete(null);
  }

  function clearTransactionCuts(transactionId: string) {
    patchWorkspace({
      ...workspace,
      cuts: removeCutsForTransaction(workspace.cuts, transactionId),
      boardColumn: omitBoardColumn(workspace.boardColumn, transactionId),
    });
  }

  function requestDeleteRaw(transactionId: string) {
    const hasCuts = workspace.cuts.some(
      (cut) => cut.transactionId === transactionId,
    );
    if (hasCuts) {
      setRawToDelete(transactionId);
      return;
    }
    deleteRaw(transactionId);
  }

  async function addToDebt(person: {
    readonly id: string;
    readonly name: string;
  }) {
    if (!isMeWorkspace(session.activeWorkspaceId)) {
      return;
    }
    const personCuts = visibleCuts.filter(
      (cut) =>
        cut.target.kind === "person" && cut.target.counterpartyId === person.id,
    );
    const totals = applyTransfersToCutNet({
      totals: personCutTotals(personCuts, person.id),
      transfers: workspace.transfers,
      partyId: person.id,
      workspaceId: session.activeWorkspaceId,
    });
    const kind = netDebtKind(totals.net);
    if (kind === "zero") {
      return;
    }
    const currency =
      personCuts[0]?.displayCurrency ??
      workspace.transfers[0]?.displayCurrency ??
      displayCurrency;
    setPostingPersonId(person.id);
    try {
      await createTransaction({
        type:
          kind === "loan" ? TransactionType.Spending : TransactionType.Earning,
        originalAmount: decimalToString(toDecimal(totals.net).abs()),
        inputCurrency: currency,
        title: t("debtTitle", { period: periodLabel }),
        occurredAt: new Date().toISOString(),
        kind: kind === "loan" ? TransactionKind.Loan : TransactionKind.Debt,
        counterpartyName: person.name,
        categoryIds: [],
        idempotencyKey: uuidv4(),
      });
      const postedIds = new Set(personCuts.map((cut) => cut.id));
      patchWorkspace({
        ...workspace,
        cuts: workspace.cuts.filter((cut) => !postedIds.has(cut.id)),
        transfers: workspace.transfers.filter(
          (transfer) =>
            transfer.payerId !== person.id && transfer.payeeId !== person.id,
        ),
      });
      toast.success(t("debtPosted"));
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("debtFailed"));
    } finally {
      setPostingPersonId(null);
    }
  }

  function partyLabel(partyId: string): string {
    return calculatorPartyLabel(partyId, t("me"), (id) =>
      personName(id, counterparties, session),
    );
  }

  function resetTransientUi() {
    setCutDraft(null);
    setTransferDraft(null);
    setTotalsOpen(false);
    setRawOpen(false);
    setEditingRaw(null);
    setRawToDelete(null);
    setDraggingId(null);
    setClearOpen(false);
    setDiscardOpen(false);
  }

  function requestClose() {
    if (!isDraft && isDirty) {
      setDiscardOpen(true);
      return;
    }
    resetTransientUi();
    onOpenChange(false);
  }

  function confirmDiscard() {
    resetTransientUi();
    onOpenChange(false);
  }

  function confirmClearAll() {
    resetTransientUi();
    setSession(EMPTY_CALCULATOR_SESSION);
    clearDraft();
  }

  async function saveDraftBoard() {
    if (!user) {
      return;
    }
    setSaving(true);
    try {
      const query = calculatorBoardQueryFromPage(queryBase, periodLabel);
      const title = normalizeBoardTitle(periodLabel);
      if (linkedBoardId) {
        await updateCalculatorBoard(linkedBoardId, {
          title,
          query,
          session,
        });
      } else {
        const created = await createCalculatorBoard({
          title,
          query,
          session,
        });
        rememberBoardId(created.board.id);
      }
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveBoardChanges() {
    if (!onPersistBoard) {
      return;
    }
    setSaving(true);
    try {
      await onPersistBoard(session);
      markClean();
      toast.success(t("saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            requestClose();
            return;
          }
          onOpenChange(next);
        }}
      >
        <ResponsiveDialogContent
          size="full"
          showCloseButton={false}
          className="min-h-0"
        >
          <div className="calculator-no-print flex min-h-0 flex-1 flex-col">
            <ResponsiveDialogHeader>
              <ResponsiveDialogHeaderInner className="flex-row items-center justify-between gap-3 pr-4 sm:pr-5">
                <div className="min-w-0">
                  <DialogTitle>{t("title")}</DialogTitle>
                  <DialogDescription className="truncate">
                    {periodLabel}
                  </DialogDescription>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={HEADER_ACTION_CLASS}
                    aria-label={t("addRaw")}
                    onClick={() => {
                      setEditingRaw(null);
                      setRawOpen(true);
                    }}
                  >
                    <Plus />
                    <span className="hidden lg:inline">{t("addRaw")}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={HEADER_ACTION_CLASS}
                    aria-label={t("getTotals")}
                    onClick={() => setTotalsOpen(true)}
                  >
                    <Scale />
                    <span className="hidden lg:inline">{t("getTotals")}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={HEADER_ACTION_CLASS}
                    aria-label={t("print")}
                    onClick={() => window.print()}
                  >
                    <Printer />
                    <span className="hidden lg:inline">{t("print")}</span>
                  </Button>
                  {isDraft ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={HEADER_ACTION_CLASS}
                        aria-label={t("clearAll")}
                        onClick={() => setClearOpen(true)}
                      >
                        <Eraser />
                        <span className="hidden lg:inline">{t("clearAll")}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className={HEADER_ACTION_CLASS}
                        aria-label={t("save")}
                        disabled={saving}
                        onClick={() => void saveDraftBoard()}
                      >
                        {saving ? <Loader2 className="animate-spin" /> : <Save />}
                        <span className="hidden lg:inline">{t("save")}</span>
                      </Button>
                    </>
                  ) : null}
                  {isDraft ? (
                    <DialogClose
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={HEADER_ACTION_CLASS}
                          aria-label={tCommon("close")}
                        />
                      }
                    >
                      <X />
                      <span className="hidden lg:inline">{tCommon("close")}</span>
                    </DialogClose>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className={HEADER_ACTION_CLASS}
                      aria-label={tCommon("close")}
                      onClick={requestClose}
                    >
                      <X />
                      <span className="hidden lg:inline">{tCommon("close")}</span>
                    </Button>
                  )}
                </div>
              </ResponsiveDialogHeaderInner>
            </ResponsiveDialogHeader>
            {loading ? (
              <div className="grid flex-1 grid-cols-1 grid-rows-2 gap-3 p-3 lg:grid-cols-3 lg:grid-rows-1 lg:p-4">
                <Skeleton className="h-full min-h-32 rounded-xl lg:min-h-64" />
                <Skeleton className="h-full min-h-32 rounded-xl lg:min-h-64" />
                <Skeleton className="hidden h-full min-h-64 rounded-xl lg:block" />
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-4">
                <CalculatorSplitLayout
                  source={
                    <CalculatorSourcePane
                      counterparties={counterparties}
                      session={session}
                      cuts={workspace.cuts}
                      columns={columns}
                      switcherPeople={selectedPeople}
                      draggingItem={draggingItem}
                      formatDate={formatDate}
                      onTogglePerson={togglePerson}
                      onSelectWorkspace={(workspaceId) =>
                        setSession(activateWorkspace(session, workspaceId))
                      }
                      onDropColumn={dropOnColumn}
                      onDragBegin={setDraggingId}
                      onDragFinish={() => setDraggingId(null)}
                      onEditRaw={(transactionId) => {
                        const raw = workspace.rawTransactions.find(
                          (item) => item.id === transactionId,
                        );
                        if (!raw) {
                          return;
                        }
                        setEditingRaw(raw);
                        setRawOpen(true);
                      }}
                      onDeleteRaw={requestDeleteRaw}
                      onClearCuts={clearTransactionCuts}
                    />
                  }
                  people={
                  <CalculatorPeopleBento
                    items={rightColumns}
                    itemKey={(column) => column.key}
                    onDropTransaction={dropOnPeoplePane}
                    onDragFinish={() => setDraggingId(null)}
                  >
                      {(column) => (
                        <CalculatorPersonColumn
                          title={column.title}
                          target={column.target}
                          cuts={visibleCuts.filter((cut) =>
                            sameParty(cut.target, column.target),
                          )}
                          transfers={workspace.transfers}
                          boardItems={boardItems}
                          canPostDebt={column.canPostDebt}
                          posting={
                            column.target.kind === "person" &&
                            postingPersonId === column.target.counterpartyId
                          }
                          collapsed={isCalculatorTargetCollapsed(
                            workspace.expandedTargetIds,
                            column.target,
                          )}
                          draggingItem={draggingItem}
                          partyName={partyLabel}
                          formatDate={formatDate}
                          onToggleCollapsed={() =>
                            toggleCollapsed(column.target)
                          }
                          onDropTransaction={dropOnTarget}
                          onDropPerson={dropOnPerson}
                          onDragFinish={() => setDraggingId(null)}
                          onEditCut={(cut) =>
                            setCutDraft({
                              transactionId: cut.transactionId,
                              target: cut.target,
                              editingCut: cut,
                            })
                          }
                          onDeleteCut={deleteCut}
                          onEditTransfer={(transfer) =>
                            setTransferDraft({
                              payerId: transfer.payerId,
                              payeeId: transfer.payeeId,
                              payerName: partyLabel(transfer.payerId),
                              payeeName: partyLabel(transfer.payeeId),
                              displayCurrency: transfer.displayCurrency,
                              editing: transfer,
                            })
                          }
                          onDeleteTransfer={deleteTransfer}
                          onAddToDebt={personDebtHandler(column, addToDebt)}
                          workspaceId={session.activeWorkspaceId}
                        />
                      )}
                    </CalculatorPeopleBento>
                  }
                />
              </div>
            )}
          </div>
          <CalculatorPrintReport
            periodLabel={periodLabel}
            boardItems={boardItems}
            cuts={visibleCuts}
            people={selectedPeople}
            rawTransactions={workspace.rawTransactions}
          />
          {!isDraft ? (
            <ResponsiveDialogFooter className="calculator-no-print">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={requestClose}
              >
                {tCommon("close")}
              </Button>
              <Button
                type="button"
                className="h-11 rounded-xl"
                disabled={saving || !isDirty}
                onClick={() => void saveBoardChanges()}
              >
                {saving ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  t("saveChanges")
                )}
              </Button>
            </ResponsiveDialogFooter>
          ) : null}
        </ResponsiveDialogContent>
      </Dialog>
      <CalculatorCutModal
        draft={cutDraft}
        cuts={workspace.cuts}
        boardItems={boardItems}
        onClose={() => setCutDraft(null)}
        onSave={saveCut}
      />
      <CalculatorTransferModal
        draft={transferDraft}
        onClose={() => setTransferDraft(null)}
        onSave={saveTransfer}
      />
      <CalculatorTotalsModal
        open={totalsOpen}
        session={session}
        ledgerRows={ledgerRows}
        partyName={partyLabel}
        onClose={() => setTotalsOpen(false)}
      />
      <CalculatorRawTransactionModal
        open={rawOpen}
        editing={editingRaw}
        displayCurrency={displayCurrency}
        onClose={() => {
          setRawOpen(false);
          setEditingRaw(null);
        }}
        onSave={saveRaw}
      />
      <Dialog
        open={rawToDelete != null}
        onOpenChange={(next) => {
          if (!next) {
            setRawToDelete(null);
          }
        }}
      >
        <ResponsiveDialogContent
          size="md"
          showCloseButton
          container={
            typeof document === "undefined" ? undefined : document.body
          }
          overlayClassName="bg-black/70"
          style={{ zIndex: 1250 }}
          overlayStyle={{ zIndex: 1250 }}
        >
          <ResponsiveDialogHeader>
            <ResponsiveDialogHeaderInner>
              <DialogTitle>{tCommon("confirm")}</DialogTitle>
              <DialogDescription>{t("deleteRawConfirm")}</DialogDescription>
            </ResponsiveDialogHeaderInner>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setRawToDelete(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              onClick={() => {
                if (rawToDelete) {
                  deleteRaw(rawToDelete);
                }
              }}
            >
              {tCommon("delete")}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </Dialog>
      <ConfirmPrompt
        open={clearOpen}
        title={tCommon("confirm")}
        description={t("clearAllConfirm")}
        cancelLabel={tCommon("cancel")}
        confirmLabel={t("clearAll")}
        destructive
        onCancel={() => setClearOpen(false)}
        onConfirm={confirmClearAll}
      />
      <ConfirmPrompt
        open={discardOpen}
        title={tCommon("confirm")}
        description={t("discardChanges")}
        cancelLabel={tCommon("cancel")}
        confirmLabel={tCommon("close")}
        onCancel={() => setDiscardOpen(false)}
        onConfirm={confirmDiscard}
      />
    </>
  );
}

function ConfirmPrompt({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  destructive = false,
  onCancel,
  onConfirm,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
    >
      <ResponsiveDialogContent
        size="md"
        showCloseButton
        container={typeof document === "undefined" ? undefined : document.body}
        overlayClassName="bg-black/70"
        style={{ zIndex: 1250 }}
        overlayStyle={{ zIndex: 1250 }}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className="h-11 rounded-xl"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

type RightPaneColumn = {
  readonly key: string;
  readonly title: string;
  readonly target: CutTarget;
  readonly canPostDebt: boolean;
};

function personDebtHandler(
  column: RightPaneColumn,
  addToDebt: (person: {
    readonly id: string;
    readonly name: string;
  }) => Promise<void>,
): (() => void) | undefined {
  if (!column.canPostDebt || column.target.kind !== "person") {
    return undefined;
  }
  const { counterpartyId, name } = column.target;
  return () => {
    void addToDebt({ id: counterpartyId, name });
  };
}

function rightPaneColumns(
  workspaceId: string,
  selectedPeople: readonly { id: string; name: string }[],
  meLabel: string,
): RightPaneColumn[] {
  if (isMeWorkspace(workspaceId)) {
    return [
      {
        key: "self-me",
        title: meLabel,
        target: { kind: "me" },
        canPostDebt: false,
      },
      ...selectedPeople.map((person) => ({
        key: person.id,
        title: person.name,
        target: {
          kind: "person" as const,
          counterpartyId: person.id,
          name: person.name,
        },
        canPostDebt: true,
      })),
    ];
  }
  const selfName =
    selectedPeople.find((person) => person.id === workspaceId)?.name ??
    workspaceId;
  return [
    {
      key: `self-${workspaceId}`,
      title: selfName,
      target: {
        kind: "person",
        counterpartyId: workspaceId,
        name: selfName,
      },
      canPostDebt: false,
    },
    {
      key: "me",
      title: meLabel,
      target: { kind: "me" },
      canPostDebt: false,
    },
    ...selectedPeople
      .filter((person) => person.id !== workspaceId)
      .map((person) => ({
        key: person.id,
        title: person.name,
        target: {
          kind: "person" as const,
          counterpartyId: person.id,
          name: person.name,
        },
        canPostDebt: false,
      })),
  ];
}

function sameParty(left: CutTarget, right: CutTarget): boolean {
  return partyIdForTarget(left) === partyIdForTarget(right);
}

function personName(
  counterpartyId: string,
  counterparties: readonly CounterpartyDto[],
  session: CalculatorSession,
): string {
  const listed = counterparties.find((person) => person.id === counterpartyId);
  if (listed) {
    return listed.name;
  }
  const fromCut = allWorkspaceCuts(session).find(
    (cut) =>
      cut.target.kind === "person" &&
      cut.target.counterpartyId === counterpartyId,
  );
  if (fromCut?.target.kind === "person") {
    return fromCut.target.name;
  }
  return counterpartyId;
}

function toLedgerRow(transaction: TransactionDto): CalculatorLedgerRow {
  return {
    kind: transaction.kind,
    type: transaction.type,
    displayAmount: transaction.displayAmount,
    displayCurrency: transaction.displayCurrency,
    counterpartyId: transaction.counterpartyId,
  };
}
