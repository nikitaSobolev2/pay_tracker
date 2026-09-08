import { TransactionType } from "@/types/enums";

import {
  EMPTY_CALCULATOR_SESSION,
  ME_PARTY_ID,
  emptyWorkspace,
  type BoardColumn,
  type CalculatorCut,
  type CalculatorRawTransaction,
  type CalculatorSession,
  type CalculatorTransfer,
  type CalculatorWorkspace,
  type CutTarget,
} from "@/features/transaction-calculator/calculator-session";

const STORAGE_VERSION = 2;
const LEGACY_STORAGE_VERSION = 1;

type StoredSession = {
  readonly version: number;
  readonly selectedCounterpartyIds?: unknown;
  readonly activeWorkspaceId?: unknown;
  readonly workspaces?: unknown;
  readonly cuts?: unknown;
  readonly rawTransactions?: unknown;
  readonly boardColumn?: unknown;
  readonly expandedTargetIds?: unknown;
};

export function calculatorStorageKey(userId: string): string {
  return `paytracker:calculator:${userId}`;
}

export function parseCalculatorSession(raw: string | null): CalculatorSession {
  if (!raw) {
    return EMPTY_CALCULATOR_SESSION;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed !== "object" || parsed == null) {
      return EMPTY_CALCULATOR_SESSION;
    }
    if (parsed.version === STORAGE_VERSION) {
      return parseV2Session(parsed);
    }
    if (parsed.version === LEGACY_STORAGE_VERSION) {
      return migrateV1Session(parsed);
    }
    return EMPTY_CALCULATOR_SESSION;
  } catch {
    return EMPTY_CALCULATOR_SESSION;
  }
}

export function serializeCalculatorSession(session: CalculatorSession): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    selectedCounterpartyIds: session.selectedCounterpartyIds,
    activeWorkspaceId: session.activeWorkspaceId,
    workspaces: session.workspaces,
  });
}

function parseV2Session(parsed: StoredSession): CalculatorSession {
  const workspaces = parseWorkspaces(parsed.workspaces);
  const activeWorkspaceId =
    typeof parsed.activeWorkspaceId === "string" && parsed.activeWorkspaceId
      ? parsed.activeWorkspaceId
      : ME_PARTY_ID;
  return {
    selectedCounterpartyIds: parseIdList(parsed.selectedCounterpartyIds),
    activeWorkspaceId,
    workspaces,
  };
}

function migrateV1Session(parsed: StoredSession): CalculatorSession {
  return {
    selectedCounterpartyIds: parseIdList(parsed.selectedCounterpartyIds),
    activeWorkspaceId: ME_PARTY_ID,
    workspaces: {
      [ME_PARTY_ID]: {
        cuts: parseCuts(parsed.cuts),
        rawTransactions: parseRawTransactions(parsed.rawTransactions),
        boardColumn: parseBoardColumn(parsed.boardColumn),
        expandedTargetIds: parseExpandedTargetIds(parsed.expandedTargetIds),
        transfers: [],
      },
    },
  };
}

function parseWorkspaces(
  value: unknown,
): Record<string, CalculatorWorkspace> {
  const workspaces: Record<string, CalculatorWorkspace> = {};
  if (isRecord(value)) {
    for (const [workspaceId, raw] of Object.entries(value)) {
      if (!isRecord(raw)) {
        continue;
      }
      workspaces[workspaceId] = parseWorkspace(raw, workspaceId);
    }
  }
  if (!workspaces[ME_PARTY_ID]) {
    workspaces[ME_PARTY_ID] = emptyWorkspace(ME_PARTY_ID);
  }
  return workspaces;
}

function parseWorkspace(
  value: Record<string, unknown>,
  workspaceId: string,
): CalculatorWorkspace {
  return {
    cuts: parseCuts(value.cuts),
    rawTransactions: parseRawTransactions(value.rawTransactions),
    boardColumn: parseBoardColumn(value.boardColumn),
    expandedTargetIds: parseExpandedTargetIds(
      value.expandedTargetIds,
      workspaceId,
    ),
    transfers: parseTransfers(value.transfers),
  };
}

function parseIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function parseExpandedTargetIds(
  value: unknown,
  workspaceId: string = ME_PARTY_ID,
): string[] {
  if (value == null) {
    return workspaceId === ME_PARTY_ID ? [ME_PARTY_ID] : [];
  }
  return parseIdList(value);
}

function parseCuts(value: unknown): CalculatorCut[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const cuts: CalculatorCut[] = [];
  for (const item of value) {
    const cut = parseCut(item);
    if (cut) {
      cuts.push(cut);
    }
  }
  return cuts;
}

function parseCut(value: unknown): CalculatorCut | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.transactionId !== "string" ||
    typeof value.displayAmount !== "string" ||
    typeof value.displayCurrency !== "string"
  ) {
    return null;
  }
  const sourceType = parseTransactionType(value.sourceType);
  const target = parseTarget(value.target);
  if (!sourceType || !target) {
    return null;
  }
  return {
    id: value.id,
    transactionId: value.transactionId,
    displayAmount: value.displayAmount,
    displayCurrency: value.displayCurrency,
    sourceType,
    target,
  };
}

function parseTarget(value: unknown): CutTarget | null {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return null;
  }
  if (value.kind === "me") {
    return { kind: "me" };
  }
  if (
    value.kind === "person" &&
    typeof value.counterpartyId === "string" &&
    typeof value.name === "string"
  ) {
    return {
      kind: "person",
      counterpartyId: value.counterpartyId,
      name: value.name,
    };
  }
  return null;
}

function parseTransfers(value: unknown): CalculatorTransfer[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const transfers: CalculatorTransfer[] = [];
  for (const item of value) {
    const transfer = parseTransfer(item);
    if (transfer) {
      transfers.push(transfer);
    }
  }
  return transfers;
}

function parseTransfer(value: unknown): CalculatorTransfer | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== "string" ||
    typeof value.payerId !== "string" ||
    typeof value.payeeId !== "string" ||
    typeof value.displayAmount !== "string" ||
    typeof value.displayCurrency !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    payerId: value.payerId,
    payeeId: value.payeeId,
    displayAmount: value.displayAmount,
    displayCurrency: value.displayCurrency,
  };
}

function parseRawTransactions(value: unknown): CalculatorRawTransaction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items: CalculatorRawTransaction[] = [];
  for (const item of value) {
    const raw = parseRawTransaction(item);
    if (raw) {
      items.push(raw);
    }
  }
  return items;
}

function parseRawTransaction(value: unknown): CalculatorRawTransaction | null {
  if (!isRecord(value)) {
    return null;
  }
  const type = parseTransactionType(value.type);
  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.displayAmount !== "string" ||
    typeof value.displayCurrency !== "string" ||
    !type
  ) {
    return null;
  }
  const occurredAt =
    value.occurredAt === null
      ? null
      : typeof value.occurredAt === "string"
        ? value.occurredAt
        : null;
  return {
    id: value.id,
    title: value.title,
    displayAmount: value.displayAmount,
    displayCurrency: value.displayCurrency,
    type,
    occurredAt,
  };
}

function parseBoardColumn(
  value: unknown,
): Record<string, BoardColumn> {
  if (!isRecord(value)) {
    return {};
  }
  const next: Record<string, BoardColumn> = {};
  for (const [key, column] of Object.entries(value)) {
    if (column === "default" || column === "processing" || column === "done") {
      next[key] = column;
    }
  }
  return next;
}

function parseTransactionType(value: unknown): TransactionType | null {
  if (value === TransactionType.Spending || value === TransactionType.Earning) {
    return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null;
}
