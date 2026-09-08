import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  datePresetLocalBounds,
  restorablePresetAfterLeavingRange,
  shiftTransactionDay,
} from "../../src/features/transactions/shift-transaction-day";
import { DateRangeType } from "../../src/types/enums";

const TODAY = new Date(2026, 8, 8, 18, 45, 0);

describe("datePresetLocalBounds", () => {
  it("returns today for the calendar day preset", () => {
    assert.deepEqual(
      datePresetLocalBounds(
        { kind: "calendar", range: DateRangeType.Day },
        TODAY,
      ),
      { startDate: "2026-09-08", endDate: "2026-09-08" },
    );
  });

  it("returns the current calendar month", () => {
    assert.deepEqual(
      datePresetLocalBounds(
        { kind: "calendar", range: DateRangeType.Month },
        TODAY,
      ),
      { startDate: "2026-09-01", endDate: "2026-09-30" },
    );
  });

  it("returns the current calendar year", () => {
    assert.deepEqual(
      datePresetLocalBounds(
        { kind: "calendar", range: DateRangeType.Year },
        TODAY,
      ),
      { startDate: "2026-01-01", endDate: "2026-12-31" },
    );
  });

  it("returns null for all-time", () => {
    assert.equal(
      datePresetLocalBounds({ kind: "all_time" }, TODAY),
      null,
    );
  });

  it("keeps absolute bounds as-is", () => {
    assert.deepEqual(
      datePresetLocalBounds(
        { kind: "absolute", startDate: "2026-08-10", endDate: "2026-08-20" },
        TODAY,
      ),
      { startDate: "2026-08-10", endDate: "2026-08-20" },
    );
  });

  it("resolves rolling days as today minus n-1 through today", () => {
    assert.deepEqual(
      datePresetLocalBounds(
        { kind: "rolling", unit: "days", n: 7 },
        TODAY,
      ),
      { startDate: "2026-09-02", endDate: "2026-09-08" },
    );
  });

  it("resolves rolling months from n months ago through today", () => {
    assert.deepEqual(
      datePresetLocalBounds(
        { kind: "rolling", unit: "months", n: 3 },
        TODAY,
      ),
      { startDate: "2026-06-08", endDate: "2026-09-08" },
    );
  });
});

describe("shiftTransactionDay", () => {
  it("steps a single calendar day forward and back without clamping", () => {
    const preset = { kind: "calendar" as const, range: DateRangeType.Day };
    assert.deepEqual(shiftTransactionDay(preset, "next", TODAY), {
      kind: "absolute",
      startDate: "2026-09-09",
      endDate: "2026-09-09",
    });
    assert.deepEqual(shiftTransactionDay(preset, "prev", TODAY), {
      kind: "absolute",
      startDate: "2026-09-07",
      endDate: "2026-09-07",
    });
  });

  it("steps an absolute single day by one calendar day", () => {
    const preset = {
      kind: "absolute" as const,
      startDate: "2026-08-10",
      endDate: "2026-08-10",
    };
    assert.deepEqual(shiftTransactionDay(preset, "next", TODAY), {
      kind: "absolute",
      startDate: "2026-08-11",
      endDate: "2026-08-11",
    });
    assert.deepEqual(shiftTransactionDay(preset, "prev", TODAY), {
      kind: "absolute",
      startDate: "2026-08-09",
      endDate: "2026-08-09",
    });
  });

  it("lands next on the first day of a multi-day range", () => {
    assert.deepEqual(
      shiftTransactionDay(
        { kind: "absolute", startDate: "2026-08-10", endDate: "2026-08-20" },
        "next",
        TODAY,
      ),
      { kind: "absolute", startDate: "2026-08-10", endDate: "2026-08-10" },
    );
  });

  it("lands prev on the last day of a multi-day range", () => {
    assert.deepEqual(
      shiftTransactionDay(
        { kind: "absolute", startDate: "2026-08-10", endDate: "2026-08-20" },
        "prev",
        TODAY,
      ),
      { kind: "absolute", startDate: "2026-08-20", endDate: "2026-08-20" },
    );
  });

  it("lands next on the first day of the current month", () => {
    assert.deepEqual(
      shiftTransactionDay(
        { kind: "calendar", range: DateRangeType.Month },
        "next",
        TODAY,
      ),
      { kind: "absolute", startDate: "2026-09-01", endDate: "2026-09-01" },
    );
  });

  it("lands prev on the last day of the current month", () => {
    assert.deepEqual(
      shiftTransactionDay(
        { kind: "calendar", range: DateRangeType.Month },
        "prev",
        TODAY,
      ),
      { kind: "absolute", startDate: "2026-09-30", endDate: "2026-09-30" },
    );
  });

  it("maps all-time next to today and prev to yesterday", () => {
    assert.deepEqual(shiftTransactionDay({ kind: "all_time" }, "next", TODAY), {
      kind: "absolute",
      startDate: "2026-09-08",
      endDate: "2026-09-08",
    });
    assert.deepEqual(shiftTransactionDay({ kind: "all_time" }, "prev", TODAY), {
      kind: "absolute",
      startDate: "2026-09-07",
      endDate: "2026-09-07",
    });
  });

  it("steps a one-day rolling window like a single day", () => {
    assert.deepEqual(
      shiftTransactionDay(
        { kind: "rolling", unit: "days", n: 1 },
        "next",
        TODAY,
      ),
      { kind: "absolute", startDate: "2026-09-09", endDate: "2026-09-09" },
    );
  });
});

describe("restorablePresetAfterLeavingRange", () => {
  it("keeps a multi-day preset so Back can restore it", () => {
    const preset = { kind: "calendar" as const, range: DateRangeType.Month };
    assert.deepEqual(restorablePresetAfterLeavingRange(preset), preset);
  });

  it("returns null when already on a single day", () => {
    assert.equal(
      restorablePresetAfterLeavingRange({
        kind: "absolute",
        startDate: "2026-09-08",
        endDate: "2026-09-08",
      }),
      null,
    );
  });
});
