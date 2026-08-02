import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatChartMoney, formatMoney } from "../../src/lib/money";

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
