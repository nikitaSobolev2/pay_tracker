import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCsvDuplicateHash,
  parseCsvImportRow,
  resolveCsvTransactionKind,
} from "../../src/lib/csv-transaction-row";
import { TransactionKind, TransactionType } from "../../src/types/enums";

describe("resolveCsvTransactionKind", () => {
  it("reads kind column", () => {
    const errors: string[] = [];
    assert.equal(
      resolveCsvTransactionKind({ kind: "REFUND" }, errors),
      TransactionKind.Refund,
    );
    assert.deepEqual(errors, []);
  });

  it("reads TRANSFER kind", () => {
    const errors: string[] = [];
    assert.equal(
      resolveCsvTransactionKind({ kind: "TRANSFER" }, errors),
      TransactionKind.Transfer,
    );
    assert.deepEqual(errors, []);
  });

  it("defaults to DEFAULT when kind is missing", () => {
    const errors: string[] = [];
    assert.equal(
      resolveCsvTransactionKind({}, errors),
      TransactionKind.Default,
    );
    assert.deepEqual(errors, []);
  });

  it("rejects invalid kind", () => {
    const errors: string[] = [];
    resolveCsvTransactionKind({ kind: "LEND" }, errors);
    assert.deepEqual(errors, ["Invalid kind"]);
  });
});

describe("parseCsvImportRow", () => {
  const base = {
    type: "SPENDING",
    originalAmount: "100",
    inputCurrency: "RUB",
    occurredAt: "2026-01-15T12:00:00.000Z",
    title: "Lunch",
    categories: "Food/Chinese|Transport",
  };

  it("parses transaction row with kind", () => {
    const errors: string[] = [];
    const row = parseCsvImportRow(
      { ...base, kind: "LOAN", counterparty: "Ann" },
      errors,
    );
    assert.deepEqual(errors, []);
    assert.equal(row?.kind, TransactionKind.Loan);
    assert.equal(row?.type, TransactionType.Spending);
    assert.deepEqual(row?.categories, ["Food/Chinese", "Transport"]);
    assert.equal(row?.counterparty, "Ann");
  });
});

describe("buildCsvDuplicateHash", () => {
  it("treats category order as insignificant", () => {
    const a = buildCsvDuplicateHash({
      type: TransactionType.Spending,
      originalAmount: "10",
      inputCurrency: "rub",
      occurredAt: "2026-01-01T00:00:00.000Z",
      title: "x",
      kind: TransactionKind.Default,
      categories: ["B", "A"],
    });
    const b = buildCsvDuplicateHash({
      type: TransactionType.Spending,
      originalAmount: "10",
      inputCurrency: "RUB",
      occurredAt: "2026-01-01T00:00:00.000Z",
      title: "x",
      kind: TransactionKind.Default,
      categories: ["A", "B"],
    });
    assert.equal(a, b);
  });

  it("changes when kind differs", () => {
    const base = {
      type: TransactionType.Spending,
      originalAmount: "10",
      inputCurrency: "RUB",
      occurredAt: "2026-01-01T00:00:00.000Z",
      title: "x",
      counterparty: "Ann",
    };
    assert.notEqual(
      buildCsvDuplicateHash({ ...base, kind: TransactionKind.Loan }),
      buildCsvDuplicateHash({ ...base, kind: TransactionKind.Debt }),
    );
  });
});
