import Decimal from "decimal.js";

import { toDecimal } from "@/lib/money";
import { TransactionKind, TransactionType } from "@/types/enums";

export const RAW_TRANSACTION_ID_PREFIX = "raw:";

export type BoardColumn = "default" | "processing" | "done";

export type CutTarget =
  | { readonly kind: "me" }
  | { readonly kind: "person"; readonly counterpartyId: string; readonly name: string };

export type CalculatorCut = {
  readonly id: string;
  readonly transactionId: string;
  readonly target: CutTarget;
  readonly displayAmount: string;
  readonly displayCurrency: string;
  readonly sourceType: TransactionType;
};

export type CalculatorRawTransaction = {
  readonly id: string;
  readonly title: string;
  readonly displayAmount: string;
  readonly displayCurrency: string;
  readonly type: TransactionType;
  readonly occurredAt: string | null;
};

export const ME_PARTY_ID = "me";
export const ME_COLLAPSE_ID = ME_PARTY_ID;

export type CalculatorTransfer = {
  readonly id: string;
  readonly payerId: string;
  readonly payeeId: string;
  readonly displayAmount: string;
  readonly displayCurrency: string;
};

export type CalculatorWorkspace = {
  readonly cuts: readonly CalculatorCut[];
  readonly rawTransactions: readonly CalculatorRawTransaction[];
  readonly boardColumn: Readonly<Record<string, BoardColumn>>;
  readonly expandedTargetIds: readonly string[];
  readonly transfers: readonly CalculatorTransfer[];
};

export type CalculatorSession = {
  readonly selectedCounterpartyIds: readonly string[];
  readonly activeWorkspaceId: string;
  readonly workspaces: Readonly<Record<string, CalculatorWorkspace>>;
};

export function emptyWorkspace(workspaceId: string): CalculatorWorkspace {
  return {
    cuts: [],
    rawTransactions: [],
    boardColumn: {},
    expandedTargetIds: workspaceId === ME_PARTY_ID ? [ME_PARTY_ID] : [],
    transfers: [],
  };
}

export const EMPTY_CALCULATOR_SESSION: CalculatorSession = {
  selectedCounterpartyIds: [],
  activeWorkspaceId: ME_PARTY_ID,
  workspaces: {
    [ME_PARTY_ID]: emptyWorkspace(ME_PARTY_ID),
  },
};

const ZERO_EPSILON = 0.005;

export function isRawTransactionId(id: string): boolean {
  return id.startsWith(RAW_TRANSACTION_ID_PREFIX);
}

export function canUseInCalculator(item: {
  readonly kind: TransactionKind;
  readonly sourceTransactionId: string | null;
  readonly displayAmount: string;
}): boolean {
  if (item.sourceTransactionId) {
    return false;
  }
  if (item.kind !== TransactionKind.Default) {
    return false;
  }
  try {
    return toDecimal(item.displayAmount).gt(0);
  } catch {
    return false;
  }
}

export type CalculatorBoardItem = {
  readonly id: string;
  readonly title: string;
  readonly displayAmount: string;
  readonly displayCurrency: string;
  readonly type: TransactionType;
  readonly occurredAt: string | null;
  readonly isRaw: boolean;
};

export function leftoverAmount(
  displayAmount: string,
  cuts: readonly CalculatorCut[],
  transactionId: string,
): string {
  const total = toDecimal(displayAmount);
  const taken = cuts
    .filter((cut) => cut.transactionId === transactionId)
    .reduce((sum, cut) => sum.plus(toDecimal(cut.displayAmount)), toDecimal(0));
  const leftover = total.minus(taken);
  if (leftover.lte(0) || leftover.abs().lt(ZERO_EPSILON)) {
    return "0";
  }
  return leftover.toFixed(4);
}

export function leftoverForCutEdit(
  displayAmount: string,
  cuts: readonly CalculatorCut[],
  transactionId: string,
  editingCutId: string | null,
): string {
  const others = editingCutId
    ? cuts.filter((cut) => cut.id !== editingCutId)
    : cuts;
  return leftoverAmount(displayAmount, others, transactionId);
}

export function leftoverIsPartial(
  leftover: string,
  displayAmount: string,
): boolean {
  return toDecimal(leftover).lt(toDecimal(displayAmount));
}

export function evenCutAmounts(total: string, count: number): string[] {
  if (count <= 0) {
    return [];
  }
  const leftover = toDecimal(total);
  if (!leftover.isFinite() || leftover.lte(0)) {
    return [];
  }
  const base = leftover
    .dividedBy(count)
    .toDecimalPlaces(4, Decimal.ROUND_DOWN);
  const shares: string[] = [];
  let allocated = toDecimal(0);
  for (let index = 0; index < count; index += 1) {
    if (index === count - 1) {
      shares.push(leftover.minus(allocated).toFixed(4));
      continue;
    }
    shares.push(base.toFixed(4));
    allocated = allocated.plus(base);
  }
  return shares;
}

type EvenLeftoverCutsInput = {
  readonly cuts: readonly CalculatorCut[];
  readonly transactionId: string;
  readonly leftover: string;
  readonly targets: readonly CutTarget[];
  readonly displayCurrency: string;
  readonly sourceType: TransactionType;
  readonly createCutId: () => string;
};

export function applyEvenLeftoverCuts(
  input: EvenLeftoverCutsInput,
): CalculatorCut[] {
  const amounts = evenCutAmounts(input.leftover, input.targets.length);
  return input.targets.reduce(
    (cuts, target, index) =>
      addOrGrowCut(cuts, {
        transactionId: input.transactionId,
        target,
        amount: amounts[index] ?? "0",
        displayCurrency: input.displayCurrency,
        sourceType: input.sourceType,
        createCutId: input.createCutId,
      }),
    [...input.cuts],
  );
}

type PeoplePaneTargetsInput = {
  readonly sourceType: TransactionType;
  readonly selectedPeople: readonly { id: string; name: string }[];
  readonly activeWorkspaceId: string;
  readonly activePersonName: string;
};

export function peoplePaneDropTargets(
  input: PeoplePaneTargetsInput,
): CutTarget[] {
  if (input.sourceType === TransactionType.Earning) {
    return [
      selfTargetForWorkspace(input.activeWorkspaceId, input.activePersonName),
    ];
  }
  return spendingPaneTargets(input.selectedPeople);
}

function spendingPaneTargets(
  people: readonly { id: string; name: string }[],
): CutTarget[] {
  return [
    { kind: "me" },
    ...people.map((person) => ({
      kind: "person" as const,
      counterpartyId: person.id,
      name: person.name,
    })),
  ];
}

type PeoplePaneDropInput = {
  readonly workspace: CalculatorWorkspace;
  readonly item: Pick<
    CalculatorBoardItem,
    "id" | "displayAmount" | "displayCurrency" | "type"
  >;
  readonly selectedPeople: readonly { id: string; name: string }[];
  readonly activeWorkspaceId: string;
  readonly activePersonName: string;
  readonly createCutId: () => string;
};

export type PeoplePaneDropResult =
  | { readonly ok: true; readonly workspace: CalculatorWorkspace }
  | { readonly ok: false; readonly reason: "nothing-to-cut" };

export function applyPeoplePaneDrop(
  input: PeoplePaneDropInput,
): PeoplePaneDropResult {
  const leftover = leftoverAmount(
    input.item.displayAmount,
    input.workspace.cuts,
    input.item.id,
  );
  if (toDecimal(leftover).lte(0)) {
    return { ok: false, reason: "nothing-to-cut" };
  }
  return {
    ok: true,
    workspace: workspaceWithPaneCuts(
      input,
      leftover,
      peoplePaneDropTargets({
        sourceType: input.item.type,
        selectedPeople: input.selectedPeople,
        activeWorkspaceId: input.activeWorkspaceId,
        activePersonName: input.activePersonName,
      }),
    ),
  };
}

function workspaceWithPaneCuts(
  input: PeoplePaneDropInput,
  leftover: string,
  targets: readonly CutTarget[],
): CalculatorWorkspace {
  return {
    ...input.workspace,
    cuts: applyEvenLeftoverCuts({
      cuts: input.workspace.cuts,
      transactionId: input.item.id,
      leftover,
      targets,
      displayCurrency: input.item.displayCurrency,
      sourceType: input.item.type,
      createCutId: input.createCutId,
    }),
    boardColumn: withBoardColumn(
      input.workspace.boardColumn,
      input.item.id,
      "done",
    ),
  };
}

function addOrGrowCut(
  cuts: CalculatorCut[],
  part: {
    readonly transactionId: string;
    readonly target: CutTarget;
    readonly amount: string;
    readonly displayCurrency: string;
    readonly sourceType: TransactionType;
    readonly createCutId: () => string;
  },
): CalculatorCut[] {
  if (toDecimal(part.amount).lte(0)) {
    return cuts;
  }
  const existing = existingCutForTarget(
    cuts,
    part.transactionId,
    part.target,
  );
  if (!existing) {
    return [
      ...cuts,
      {
        id: part.createCutId(),
        transactionId: part.transactionId,
        target: part.target,
        displayAmount: part.amount,
        displayCurrency: part.displayCurrency,
        sourceType: part.sourceType,
      },
    ];
  }
  const combined = toDecimal(existing.displayAmount)
    .plus(toDecimal(part.amount))
    .toFixed(4);
  return cuts.map((cut) =>
    cut.id === existing.id ? { ...existing, displayAmount: combined } : cut,
  );
}

export function hasCutsForTransaction(
  cuts: readonly CalculatorCut[],
  transactionId: string,
): boolean {
  return cuts.some((cut) => cut.transactionId === transactionId);
}

export function autoBoardColumn(
  leftover: string,
  hasCuts: boolean,
): BoardColumn {
  const remaining = toDecimal(leftover);
  if (!hasCuts) {
    return "default";
  }
  if (remaining.lte(0) || remaining.abs().lt(ZERO_EPSILON)) {
    return "done";
  }
  return "processing";
}

export function resolveBoardColumn(
  transactionId: string,
  leftover: string,
  hasCuts: boolean,
  boardColumn: Readonly<Record<string, BoardColumn>>,
): BoardColumn {
  const override = boardColumn[transactionId];
  if (override) {
    return override;
  }
  return autoBoardColumn(leftover, hasCuts);
}

export function clampCutAmount(
  requested: string,
  leftoverIncludingThisCut: string,
): string | null {
  let amount: ReturnType<typeof toDecimal>;
  try {
    amount = toDecimal(requested);
  } catch {
    return null;
  }
  if (!amount.isFinite() || amount.lte(0)) {
    return null;
  }
  const max = toDecimal(leftoverIncludingThisCut);
  if (amount.gt(max)) {
    return null;
  }
  return amount.toFixed(4);
}

export type PersonCutTotals = {
  readonly spending: string;
  readonly earning: string;
  readonly net: string;
};

export function personCutTotals(
  cuts: readonly CalculatorCut[],
  counterpartyId: string,
): PersonCutTotals {
  return sumCuts(
    cuts.filter(
      (cut) =>
        cut.target.kind === "person" &&
        cut.target.counterpartyId === counterpartyId,
    ),
  );
}

export function meCutTotals(cuts: readonly CalculatorCut[]): PersonCutTotals {
  return sumCuts(cuts.filter((cut) => cut.target.kind === "me"));
}

function sumCuts(cuts: readonly CalculatorCut[]): PersonCutTotals {
  let spending = toDecimal(0);
  let earning = toDecimal(0);
  for (const cut of cuts) {
    const amount = toDecimal(cut.displayAmount);
    if (cut.sourceType === TransactionType.Earning) {
      earning = earning.plus(amount);
    } else {
      spending = spending.plus(amount);
    }
  }
  return {
    spending: spending.toFixed(4),
    earning: earning.toFixed(4),
    net: spending.minus(earning).toFixed(4),
  };
}

/** Positive net = they owe you (LOAN). Negative = you owe them (DEBT). */
export function netDebtKind(net: string): "loan" | "debt" | "zero" {
  const value = toDecimal(net);
  if (value.abs().lt(ZERO_EPSILON)) {
    return "zero";
  }
  return value.gt(0) ? "loan" : "debt";
}

export function cutsForTransaction(
  cuts: readonly CalculatorCut[],
  transactionId: string,
): CalculatorCut[] {
  return cuts.filter((cut) => cut.transactionId === transactionId);
}

export function removeCutsForCounterparty(
  cuts: readonly CalculatorCut[],
  counterpartyId: string,
): CalculatorCut[] {
  return cuts.filter(
    (cut) =>
      cut.target.kind !== "person" ||
      cut.target.counterpartyId !== counterpartyId,
  );
}

export function removeCutsForTransaction(
  cuts: readonly CalculatorCut[],
  transactionId: string,
): CalculatorCut[] {
  return cuts.filter((cut) => cut.transactionId !== transactionId);
}

export function percentOfAmount(amount: string, percent: number): string | null {
  if (!Number.isFinite(percent) || percent <= 0) {
    return null;
  }
  try {
    const value = toDecimal(amount).times(percent).dividedBy(100);
    if (!value.isFinite() || value.lte(0)) {
      return null;
    }
    return value.toFixed(4);
  } catch {
    return null;
  }
}

export function withBoardColumn(
  boardColumn: Readonly<Record<string, BoardColumn>>,
  transactionId: string,
  column: BoardColumn,
): Record<string, BoardColumn> {
  return { ...boardColumn, [transactionId]: column };
}

export function omitBoardColumn(
  boardColumn: Readonly<Record<string, BoardColumn>>,
  transactionId: string,
): Record<string, BoardColumn> {
  const next = { ...boardColumn };
  delete next[transactionId];
  return next;
}

type PeriodTransaction = {
  readonly id: string;
  readonly title: string | null;
  readonly displayAmount: string;
  readonly displayCurrency: string;
  readonly type: TransactionType;
  readonly occurredAt: string;
  readonly kind: TransactionKind;
  readonly sourceTransactionId: string | null;
};

export function mergeCalculatorBoardItems(
  periodTransactions: readonly PeriodTransaction[],
  rawTransactions: readonly CalculatorRawTransaction[],
): CalculatorBoardItem[] {
  const fromPeriod = periodTransactions
    .filter(canUseInCalculator)
    .map((transaction) => ({
      id: transaction.id,
      title: transaction.title ?? "",
      displayAmount: transaction.displayAmount,
      displayCurrency: transaction.displayCurrency,
      type: transaction.type,
      occurredAt: transaction.occurredAt,
      isRaw: false,
    }));
  const fromRaw = rawTransactions.map((raw) => ({
    id: raw.id,
    title: raw.title,
    displayAmount: raw.displayAmount,
    displayCurrency: raw.displayCurrency,
    type: raw.type,
    occurredAt: raw.occurredAt,
    isRaw: true,
  }));
  return [...fromPeriod, ...fromRaw].sort(compareBoardItems);
}

export function groupBoardItemsByColumn(
  items: readonly CalculatorBoardItem[],
  cuts: readonly CalculatorCut[],
  boardColumn: Readonly<Record<string, BoardColumn>>,
): Record<BoardColumn, CalculatorBoardItem[]> {
  const groups: Record<BoardColumn, CalculatorBoardItem[]> = {
    default: [],
    processing: [],
    done: [],
  };
  for (const item of items) {
    const leftover = leftoverAmount(item.displayAmount, cuts, item.id);
    const column = resolveBoardColumn(
      item.id,
      leftover,
      hasCutsForTransaction(cuts, item.id),
      boardColumn,
    );
    groups[column].push(item);
  }
  return groups;
}

function compareBoardItems(
  left: CalculatorBoardItem,
  right: CalculatorBoardItem,
): number {
  if (left.occurredAt == null && right.occurredAt == null) {
    return 0;
  }
  if (left.occurredAt == null) {
    return 1;
  }
  if (right.occurredAt == null) {
    return -1;
  }
  return right.occurredAt.localeCompare(left.occurredAt);
}

export function sameCutTarget(left: CutTarget, right: CutTarget): boolean {
  if (left.kind === "me" && right.kind === "me") {
    return true;
  }
  return (
    left.kind === "person" &&
    right.kind === "person" &&
    left.counterpartyId === right.counterpartyId
  );
}

export function existingCutForTarget(
  cuts: readonly CalculatorCut[],
  transactionId: string,
  target: CutTarget,
): CalculatorCut | null {
  const matches = cuts.filter(
    (cut) =>
      cut.transactionId === transactionId && sameCutTarget(cut.target, target),
  );
  return matches[matches.length - 1] ?? null;
}

export function collapseIdForTarget(target: CutTarget): string {
  return target.kind === "me" ? ME_COLLAPSE_ID : target.counterpartyId;
}

export function isCalculatorTargetCollapsed(
  expandedTargetIds: readonly string[],
  target: CutTarget,
): boolean {
  return !expandedTargetIds.includes(collapseIdForTarget(target));
}

export function withExpandedTarget(
  expandedTargetIds: readonly string[],
  targetId: string,
  expanded: boolean,
): string[] {
  const without = expandedTargetIds.filter((id) => id !== targetId);
  if (!expanded) {
    return without;
  }
  return [...without, targetId];
}

export function isMeWorkspace(workspaceId: string): boolean {
  return workspaceId === ME_PARTY_ID;
}

export function workspaceState(
  session: CalculatorSession,
  workspaceId: string,
): CalculatorWorkspace {
  return session.workspaces[workspaceId] ?? emptyWorkspace(workspaceId);
}

export function activeWorkspace(session: CalculatorSession): CalculatorWorkspace {
  return workspaceState(session, session.activeWorkspaceId);
}

export function withWorkspace(
  session: CalculatorSession,
  workspaceId: string,
  workspace: CalculatorWorkspace,
): CalculatorSession {
  return {
    ...session,
    workspaces: { ...session.workspaces, [workspaceId]: workspace },
  };
}

export function withActiveWorkspace(
  session: CalculatorSession,
  workspace: CalculatorWorkspace,
): CalculatorSession {
  return withWorkspace(session, session.activeWorkspaceId, workspace);
}

export function activateWorkspace(
  session: CalculatorSession,
  workspaceId: string,
): CalculatorSession {
  const existing = session.workspaces[workspaceId];
  if (existing) {
    return { ...session, activeWorkspaceId: workspaceId };
  }
  return {
    ...session,
    activeWorkspaceId: workspaceId,
    workspaces: {
      ...session.workspaces,
      [workspaceId]: emptyWorkspace(workspaceId),
    },
  };
}

export function partyIdForTarget(target: CutTarget): string {
  return collapseIdForTarget(target);
}

export function selfTargetForWorkspace(
  workspaceId: string,
  name: string,
): CutTarget {
  if (isMeWorkspace(workspaceId)) {
    return { kind: "me" };
  }
  return { kind: "person", counterpartyId: workspaceId, name };
}

export function parsePositiveAmount(requested: string): string | null {
  try {
    const amount = toDecimal(requested);
    if (!amount.isFinite() || amount.lte(0)) {
      return null;
    }
    return amount.toFixed(4);
  } catch {
    return null;
  }
}

export function applyTransfersToCutNet(
  totals: PersonCutTotals,
  transfers: readonly CalculatorTransfer[],
  partyId: string,
): PersonCutTotals {
  let paid = toDecimal(0);
  let received = toDecimal(0);
  for (const transfer of transfers) {
    const amount = toDecimal(transfer.displayAmount);
    if (transfer.payerId === partyId) {
      paid = paid.plus(amount);
    }
    if (transfer.payeeId === partyId) {
      received = received.plus(amount);
    }
  }
  return {
    spending: totals.spending,
    earning: totals.earning,
    net: toDecimal(totals.net).minus(paid).plus(received).toFixed(4),
  };
}

export function transfersForParty(
  transfers: readonly CalculatorTransfer[],
  partyId: string,
): CalculatorTransfer[] {
  return transfers.filter(
    (transfer) => transfer.payerId === partyId || transfer.payeeId === partyId,
  );
}

export function allWorkspaceCuts(
  session: CalculatorSession,
): CalculatorCut[] {
  return Object.values(session.workspaces).flatMap(
    (workspace) => workspace.cuts,
  );
}
