import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isCashflowExcludedKind,
  TransactionKind,
} from "../../src/types/enums";

describe("isCashflowExcludedKind", () => {
  it("excludes only TRANSFER from cashflow charts", () => {
    assert.equal(isCashflowExcludedKind(TransactionKind.Transfer), true);
    assert.equal(isCashflowExcludedKind(TransactionKind.Default), false);
    assert.equal(isCashflowExcludedKind(TransactionKind.Loan), false);
    assert.equal(isCashflowExcludedKind(TransactionKind.Debt), false);
    assert.equal(isCashflowExcludedKind(TransactionKind.Refund), false);
  });
});
