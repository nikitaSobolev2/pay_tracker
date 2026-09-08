import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "date-fns";

import { DateRangeType } from "@/types/enums";

import { DEFAULT_TRANSACTION_FILTERS } from "../../src/features/transactions/transaction-filter.types";
import {
  clampDateKeysToRange,
  defaultTravelDatePreset,
  travelDefaultPresetIfNeeded,
  travelFilterDateBounds,
  travelPeriodMode,
  travelPickerDateKeys,
  withTravelFilter,
} from "../../src/features/transactions/travel-filter-date-range";

const TRIP = {
  startsAt: "2026-08-10T12:00:00.000Z",
  endsAt: "2026-08-20T12:00:00.000Z",
};

function dateKey(iso: string): string {
  return format(new Date(iso), "yyyy-MM-dd");
}

describe("travelFilterDateBounds", () => {
  it("uses trip dates when there are no spendings", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: null,
      lastSpendingAt: null,
    });
    assert.equal(bounds.spendingsKnown, true);
    assert.equal(bounds.spendingStartDate, null);
    assert.equal(bounds.tripStartDate, dateKey(TRIP.startsAt));
    assert.equal(bounds.tripEndDate, dateKey(TRIP.endsAt));
  });

  it("treats missing spending fields as not yet known", () => {
    const bounds = travelFilterDateBounds(TRIP);
    assert.equal(bounds.spendingsKnown, false);
    assert.equal(bounds.spendingStartDate, null);
  });

  it("orders spending dates from first to last", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: "2026-08-18T12:00:00.000Z",
      lastSpendingAt: "2026-08-12T12:00:00.000Z",
    });
    assert.equal(bounds.spendingStartDate, dateKey("2026-08-12T12:00:00.000Z"));
    assert.equal(bounds.spendingEndDate, dateKey("2026-08-18T12:00:00.000Z"));
  });
});

describe("defaultTravelDatePreset", () => {
  it("defaults to spendings when they exist", () => {
    const preset = defaultTravelDatePreset(
      travelFilterDateBounds({
        ...TRIP,
        firstSpendingAt: "2026-08-12T12:00:00.000Z",
        lastSpendingAt: "2026-08-18T12:00:00.000Z",
      }),
    );
    assert.deepEqual(preset, {
      kind: "absolute",
      startDate: dateKey("2026-08-12T12:00:00.000Z"),
      endDate: dateKey("2026-08-18T12:00:00.000Z"),
    });
  });

  it("falls back to trip dates without spendings", () => {
    const preset = defaultTravelDatePreset(
      travelFilterDateBounds({ ...TRIP, firstSpendingAt: null, lastSpendingAt: null }),
    );
    assert.deepEqual(preset, {
      kind: "absolute",
      startDate: dateKey(TRIP.startsAt),
      endDate: dateKey(TRIP.endsAt),
    });
  });
});

describe("travelPeriodMode", () => {
  it("detects trip dates when they differ from spendings", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: "2026-08-12T12:00:00.000Z",
      lastSpendingAt: "2026-08-18T12:00:00.000Z",
    });
    assert.equal(
      travelPeriodMode(
        {
          kind: "absolute",
          startDate: dateKey(TRIP.startsAt),
          endDate: dateKey(TRIP.endsAt),
        },
        bounds,
      ),
      "trip",
    );
  });

  it("treats a narrowed absolute range as custom", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: "2026-08-12T12:00:00.000Z",
      lastSpendingAt: "2026-08-18T12:00:00.000Z",
    });
    assert.equal(
      travelPeriodMode(
        {
          kind: "absolute",
          startDate: dateKey("2026-08-13T12:00:00.000Z"),
          endDate: dateKey("2026-08-14T12:00:00.000Z"),
        },
        bounds,
      ),
      "custom",
    );
  });
});

describe("travelDefaultPresetIfNeeded", () => {
  it("replaces calendar presets and keeps absolute ranges", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: "2026-08-12T12:00:00.000Z",
      lastSpendingAt: "2026-08-18T12:00:00.000Z",
    });
    assert.deepEqual(
      travelDefaultPresetIfNeeded(
        { kind: "calendar", range: DateRangeType.Month },
        bounds,
      ),
      { kind: "absolute", startDate: dateKey("2026-08-12T12:00:00.000Z"), endDate: dateKey("2026-08-18T12:00:00.000Z") },
    );
    assert.equal(
      travelDefaultPresetIfNeeded(
        {
          kind: "absolute",
          startDate: dateKey(TRIP.startsAt),
          endDate: dateKey(TRIP.endsAt),
        },
        bounds,
      ),
      null,
    );
  });

  it("waits when spending bounds are not known", () => {
    assert.equal(
      travelDefaultPresetIfNeeded(
        { kind: "calendar", range: DateRangeType.Month },
        travelFilterDateBounds(TRIP),
      ),
      null,
    );
  });
});

describe("withTravelFilter", () => {
  it("sets spending range when selecting a travel and restores the previous preset on clear", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: "2026-08-12T12:00:00.000Z",
      lastSpendingAt: "2026-08-18T12:00:00.000Z",
    });
    const selected = withTravelFilter(
      DEFAULT_TRANSACTION_FILTERS,
      "tr-1",
      bounds,
      DEFAULT_TRANSACTION_FILTERS.datePreset,
    );
    assert.equal(selected.filters.travelId, "tr-1");
    assert.deepEqual(selected.filters.datePreset, {
      kind: "absolute",
      startDate: dateKey("2026-08-12T12:00:00.000Z"),
      endDate: dateKey("2026-08-18T12:00:00.000Z"),
    });
    assert.deepEqual(
      selected.previousDatePreset,
      DEFAULT_TRANSACTION_FILTERS.datePreset,
    );

    const cleared = withTravelFilter(
      selected.filters,
      null,
      null,
      selected.previousDatePreset,
    );
    assert.equal(cleared.filters.travelId, null);
    assert.deepEqual(
      cleared.filters.datePreset,
      DEFAULT_TRANSACTION_FILTERS.datePreset,
    );
  });

  it("keeps the current preset until spending bounds are known", () => {
    const selected = withTravelFilter(
      DEFAULT_TRANSACTION_FILTERS,
      "tr-1",
      travelFilterDateBounds(TRIP),
      DEFAULT_TRANSACTION_FILTERS.datePreset,
    );
    assert.equal(selected.filters.travelId, "tr-1");
    assert.deepEqual(
      selected.filters.datePreset,
      DEFAULT_TRANSACTION_FILTERS.datePreset,
    );
  });
});

describe("travelPickerDateKeys", () => {
  it("spans trip dates and travel transactions", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: "2026-08-12T12:00:00.000Z",
      lastSpendingAt: "2026-08-18T12:00:00.000Z",
      firstTransactionAt: "2026-08-08T12:00:00.000Z",
      lastTransactionAt: "2026-08-21T12:00:00.000Z",
    });
    assert.deepEqual(travelPickerDateKeys(bounds), {
      startDate: dateKey("2026-08-08T12:00:00.000Z"),
      endDate: dateKey("2026-08-21T12:00:00.000Z"),
    });
  });

  it("keeps trip dates selectable when there are no transactions", () => {
    const bounds = travelFilterDateBounds({
      ...TRIP,
      firstSpendingAt: null,
      lastSpendingAt: null,
    });
    assert.deepEqual(travelPickerDateKeys(bounds), {
      startDate: dateKey(TRIP.startsAt),
      endDate: dateKey(TRIP.endsAt),
    });
  });
});

describe("clampDateKeysToRange", () => {
  it("clamps a range to the travel transaction window", () => {
    assert.deepEqual(
      clampDateKeysToRange("2026-08-01", "2026-08-30", {
        startDate: "2026-08-12",
        endDate: "2026-08-18",
      }),
      { startDate: "2026-08-12", endDate: "2026-08-18" },
    );
  });
});
