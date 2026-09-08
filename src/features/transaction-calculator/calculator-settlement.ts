import {
  ME_PARTY_ID,
  partyIdForTarget,
  type CalculatorCut,
  type CalculatorSession,
  type CalculatorTransfer,
} from "@/features/transaction-calculator/calculator-session";
import { debtBalanceDelta } from "@/lib/debt-episodes";
import { toDecimal } from "@/lib/money";
import { TransactionKind, TransactionType } from "@/types/enums";
import type Decimal from "decimal.js";

const ZERO_EPSILON = 0.005;

export type CalculatorLedgerRow = {
  readonly kind: TransactionKind;
  readonly type: TransactionType;
  readonly displayAmount: string;
  readonly displayCurrency: string;
  readonly counterpartyId: string | null;
};

export type SettlementPosition = {
  readonly partyId: string;
  readonly amount: string;
  readonly currency: string;
};

export type SettlementPayment = {
  readonly fromId: string;
  readonly toId: string;
  readonly amount: string;
  readonly currency: string;
};

export type CalculatorSettlement = {
  readonly positions: readonly SettlementPosition[];
  readonly payments: readonly SettlementPayment[];
};

export type CalculatorSettlementOptions = {
  readonly includeLedgerDebts?: boolean;
};

type CurrencyPositions = Map<string, Map<string, Decimal>>;

export function buildCalculatorSettlement(
  session: CalculatorSession,
  ledgerRows: readonly CalculatorLedgerRow[],
  options: CalculatorSettlementOptions = {},
): CalculatorSettlement {
  const allowed = allowedPartyIds(session.selectedCounterpartyIds);
  const positions = emptyPositions();
  for (const [workspaceId, workspace] of Object.entries(session.workspaces)) {
    if (!allowed.has(workspaceId)) {
      continue;
    }
    applyCutsToPositions(
      positions,
      workspaceId,
      cutsForAllowedParties(workspace.cuts, allowed),
    );
    applyTransfersToPositions(
      positions,
      transfersForAllowedParties(workspace.transfers, allowed),
    );
  }
  if (options.includeLedgerDebts) {
    applyLedgerToPositions(
      positions,
      ledgerForAllowedParties(ledgerRows, allowed),
    );
  }
  return {
    positions: flattenPositions(positions),
    payments: simplifyAllCurrencies(positions),
  };
}

export function applyCutsToPositions(
  positions: CurrencyPositions,
  workspaceId: string,
  cuts: readonly CalculatorCut[],
): void {
  for (const cut of cuts) {
    const targetId = partyIdForTarget(cut.target);
    if (targetId === workspaceId) {
      continue;
    }
    const amount = toDecimal(cut.displayAmount);
    const currency = cut.displayCurrency;
    if (cut.sourceType === TransactionType.Earning) {
      addPosition(positions, currency, workspaceId, amount.negated());
      addPosition(positions, currency, targetId, amount);
    } else {
      addPosition(positions, currency, targetId, amount.negated());
      addPosition(positions, currency, workspaceId, amount);
    }
  }
}

export function applyTransfersToPositions(
  positions: CurrencyPositions,
  transfers: readonly CalculatorTransfer[],
): void {
  for (const transfer of transfers) {
    const amount = toDecimal(transfer.displayAmount);
    addPosition(positions, transfer.displayCurrency, transfer.payerId, amount);
    addPosition(
      positions,
      transfer.displayCurrency,
      transfer.payeeId,
      amount.negated(),
    );
  }
}

export function applyLedgerToPositions(
  positions: CurrencyPositions,
  ledgerRows: readonly CalculatorLedgerRow[],
): void {
  for (const row of ledgerRows) {
    if (!row.counterpartyId) {
      continue;
    }
    if (
      row.kind !== TransactionKind.Loan &&
      row.kind !== TransactionKind.Debt
    ) {
      continue;
    }
    const amount = toDecimal(row.displayAmount).abs();
    const sign = debtBalanceDelta(row.kind, row.type);
    if (sign === 0) {
      continue;
    }
    const delta = amount.times(sign);
    addPosition(positions, row.displayCurrency, ME_PARTY_ID, delta);
    addPosition(positions, row.displayCurrency, row.counterpartyId, delta.negated());
  }
}

export function simplifySettlement(
  partyAmounts: Readonly<Record<string, string>>,
  currency: string,
): SettlementPayment[] {
  const remaining = new Map<string, Decimal>();
  for (const [partyId, amount] of Object.entries(partyAmounts)) {
    remaining.set(partyId, toDecimal(amount));
  }
  const payments: SettlementPayment[] = [];
  const maxSteps = Math.max(1, remaining.size * remaining.size);
  for (let step = 0; step < maxSteps; step += 1) {
    const debtor = extremeParty(remaining, "debtor");
    const creditor = extremeParty(remaining, "creditor");
    if (!debtor || !creditor) {
      break;
    }
    const payment = debtor.value.negated().lessThan(creditor.value)
      ? debtor.value.negated()
      : creditor.value;
    if (payment.lte(0) || payment.abs().lt(ZERO_EPSILON)) {
      break;
    }
    remaining.set(debtor.partyId, debtor.value.plus(payment));
    remaining.set(creditor.partyId, creditor.value.minus(payment));
    payments.push({
      fromId: debtor.partyId,
      toId: creditor.partyId,
      amount: payment.toFixed(4),
      currency,
    });
  }
  return payments;
}

export function emptyPositions(): CurrencyPositions {
  return new Map();
}

function allowedPartyIds(selectedIds: readonly string[]): Set<string> {
  return new Set([ME_PARTY_ID, ...selectedIds]);
}

function cutsForAllowedParties(
  cuts: readonly CalculatorCut[],
  allowed: ReadonlySet<string>,
): CalculatorCut[] {
  return cuts.filter((cut) => allowed.has(partyIdForTarget(cut.target)));
}

function transfersForAllowedParties(
  transfers: readonly CalculatorTransfer[],
  allowed: ReadonlySet<string>,
): CalculatorTransfer[] {
  return transfers.filter(
    (transfer) =>
      allowed.has(transfer.payerId) && allowed.has(transfer.payeeId),
  );
}

function ledgerForAllowedParties(
  rows: readonly CalculatorLedgerRow[],
  allowed: ReadonlySet<string>,
): CalculatorLedgerRow[] {
  return rows.filter(
    (row) => row.counterpartyId != null && allowed.has(row.counterpartyId),
  );
}

function addPosition(
  positions: CurrencyPositions,
  currency: string,
  partyId: string,
  delta: Decimal,
): void {
  const byParty = positions.get(currency) ?? new Map<string, Decimal>();
  const current = byParty.get(partyId) ?? toDecimal(0);
  byParty.set(partyId, current.plus(delta));
  positions.set(currency, byParty);
}

function flattenPositions(
  positions: CurrencyPositions,
): SettlementPosition[] {
  const rows: SettlementPosition[] = [];
  for (const [currency, byParty] of [...positions.entries()].sort(sortPair)) {
    const parties = [...byParty.entries()].sort(sortPair);
    for (const [partyId, amount] of parties) {
      if (amount.abs().lt(ZERO_EPSILON)) {
        continue;
      }
      rows.push({
        partyId,
        amount: amount.toFixed(4),
        currency,
      });
    }
  }
  return rows;
}

function simplifyAllCurrencies(
  positions: CurrencyPositions,
): SettlementPayment[] {
  const payments: SettlementPayment[] = [];
  for (const [currency, byParty] of [...positions.entries()].sort(sortPair)) {
    const amounts: Record<string, string> = {};
    for (const [partyId, amount] of byParty) {
      amounts[partyId] = amount.toFixed(4);
    }
    payments.push(...simplifySettlement(amounts, currency));
  }
  return payments;
}

function extremeParty(
  remaining: Map<string, Decimal>,
  side: "debtor" | "creditor",
): { readonly partyId: string; readonly value: Decimal } | null {
  let best: { partyId: string; value: Decimal } | null = null;
  for (const [partyId, value] of remaining) {
    if (side === "debtor") {
      if (value.gte(-ZERO_EPSILON)) {
        continue;
      }
      if (!best || value.lt(best.value) || sameAmountEarlierId(value, best, partyId)) {
        best = { partyId, value };
      }
      continue;
    }
    if (value.lte(ZERO_EPSILON)) {
      continue;
    }
    if (!best || value.gt(best.value) || sameAmountEarlierId(value, best, partyId)) {
      best = { partyId, value };
    }
  }
  return best;
}

function sameAmountEarlierId(
  value: Decimal,
  best: { partyId: string; value: Decimal },
  partyId: string,
): boolean {
  return value.eq(best.value) && partyId < best.partyId;
}

function sortPair(left: [string, unknown], right: [string, unknown]): number {
  return left[0].localeCompare(right[0]);
}
