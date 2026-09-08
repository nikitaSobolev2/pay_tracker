import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatChartMoney,
  formatCeiledMoney,
  formatMoney,
  toCeilIntegerAmountString,
} from "../../src/lib/money";

describe("formatChartMoney", () => {
  it("rounds half-up to whole currency units", () => {
    assert.match(formatChartMoney("10.4", "RUB"), /10/);
    assert.doesNotMatch(formatChartMoney("10.4", "RUB"), /10[.,]4/);
    assert.match(formatChartMoney("10.5", "RUB"), /11/);
    assert.match(formatChartMoney("10.49", "RUB"), /10/);
  });

  it("never keeps fractional digits", () => {
    const formatted = formatChartMoney("1234.56", "USD");
    assert.doesNotMatch(formatted, /[.,]\d{2}\b/);
    assert.match(formatted, /1.?235/);
  });
});

describe("formatMoney", () => {
  it("keeps two fraction digits by default", () => {
    const formatted = formatMoney("10.5", "USD");
    assert.match(formatted, /10[.,]50/);
  });
});

describe("toCeilIntegerAmountString", () => {
  it("ceils a fractional amount to the next whole unit", () => {
    assert.equal(toCeilIntegerAmountString("33.1"), "34");
    assert.equal(toCeilIntegerAmountString("33.0000"), "33");
  });
});

describe("formatCeiledMoney", () => {
  it("ceils fractional amounts to the next whole unit", () => {
    assert.match(formatCeiledMoney("1666.67", "RUB"), /1.?667/);
    assert.doesNotMatch(formatCeiledMoney("1666.67", "RUB"), /[.,]67/);
  });

  it("ceils a negative amount away from zero", () => {
    assert.match(formatCeiledMoney("-1.1", "RUB"), /-.*2/);
  });
});
