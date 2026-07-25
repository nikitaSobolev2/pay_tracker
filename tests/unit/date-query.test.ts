import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseSearchDateQuery } from "../../src/lib/search/date-query";
import { classifySearchQuery } from "../../src/lib/search/query-classify";

describe("parseSearchDateQuery", () => {
  it("parses english and russian today/yesterday", () => {
    assert.ok(parseSearchDateQuery("today", "UTC"));
    assert.ok(parseSearchDateQuery("сегодня", "UTC"));
    assert.ok(parseSearchDateQuery("yesterday", "UTC"));
    assert.ok(parseSearchDateQuery("вчера", "UTC"));
  });

  it("parses month year in en and ru", () => {
    const en = parseSearchDateQuery("July 2024", "UTC");
    const ru = parseSearchDateQuery("июль 2024", "UTC");
    assert.ok(en);
    assert.ok(ru);
    assert.equal(en!.start.getUTCFullYear(), 2024);
    assert.equal(ru!.start.getUTCMonth(), 6);
  });

  it("parses iso, dotted, and from-to ranges", () => {
    assert.ok(parseSearchDateQuery("2024-07-25", "UTC"));
    assert.ok(parseSearchDateQuery("25.07.2024", "UTC"));
    assert.ok(parseSearchDateQuery("25/07/2024", "UTC"));
    assert.ok(parseSearchDateQuery("from 2024-01-01 to 2024-01-31", "UTC"));
    assert.ok(parseSearchDateQuery("2024", "UTC"));
  });

  it("parses dashed day ranges with optional spaces", () => {
    const spaced = parseSearchDateQuery("24.07.2026 - 25.07.2026", "UTC");
    const tight = parseSearchDateQuery("24.07.2026-25.07.2026", "UTC");
    assert.ok(spaced);
    assert.ok(tight);
    assert.equal(spaced!.start.toISOString(), tight!.start.toISOString());
    assert.equal(spaced!.end.toISOString(), tight!.end.toISOString());
    assert.equal(spaced!.start.toISOString(), "2026-07-24T00:00:00.000Z");
    assert.equal(spaced!.end.toISOString(), "2026-07-25T23:59:59.999Z");
  });

  it("parses month-year to year and year-year ranges", () => {
    const monthToYear = parseSearchDateQuery("July 2024-2025", "UTC");
    assert.ok(monthToYear);
    assert.equal(monthToYear!.start.toISOString(), "2024-07-01T00:00:00.000Z");
    assert.equal(monthToYear!.end.toISOString(), "2025-12-31T23:59:59.999Z");

    const years = parseSearchDateQuery("2024-2025", "UTC");
    assert.ok(years);
    assert.equal(years!.start.toISOString(), "2024-01-01T00:00:00.000Z");
    assert.equal(years!.end.toISOString(), "2025-12-31T23:59:59.999Z");

    const months = parseSearchDateQuery("July 2024 - August 2025", "UTC");
    assert.ok(months);
    assert.equal(months!.start.toISOString(), "2024-07-01T00:00:00.000Z");
    assert.equal(months!.end.toISOString(), "2025-08-31T23:59:59.999Z");
  });

  it("parses times on single days and ranges", () => {
    const single = parseSearchDateQuery("24.07.2026 14:30", "UTC");
    assert.ok(single);
    assert.equal(single!.start.toISOString(), "2026-07-24T14:30:00.000Z");
    assert.equal(single!.end.toISOString(), "2026-07-24T23:59:59.999Z");

    const shortHour = parseSearchDateQuery("24.07.2026 9:05", "UTC");
    assert.ok(shortHour);
    assert.equal(shortHour!.start.toISOString(), "2026-07-24T09:05:00.000Z");

    const ranged = parseSearchDateQuery(
      "24.07.2026 14:30 - 25.07.2026 9:00",
      "UTC",
    );
    assert.ok(ranged);
    assert.equal(ranged!.start.toISOString(), "2026-07-24T14:30:00.000Z");
    assert.equal(ranged!.end.toISOString(), "2026-07-25T09:00:00.000Z");
  });

  it("parses textual day-month-year forms", () => {
    const a = parseSearchDateQuery("25 July 2026", "UTC");
    const b = parseSearchDateQuery("July 25 2026", "UTC");
    const c = parseSearchDateQuery("25 июля 2026", "UTC");
    assert.ok(a);
    assert.ok(b);
    assert.ok(c);
    assert.equal(a!.start.toISOString(), "2026-07-25T00:00:00.000Z");
    assert.equal(b!.start.toISOString(), a!.start.toISOString());
    assert.equal(c!.start.toISOString(), a!.start.toISOString());
  });

  it("does not treat a single iso day as a dashed range", () => {
    const day = parseSearchDateQuery("2024-07-25", "UTC");
    assert.ok(day);
    assert.equal(day!.start.toISOString(), "2024-07-25T00:00:00.000Z");
    assert.equal(day!.end.toISOString(), "2024-07-25T23:59:59.999Z");
  });
});

describe("classifySearchQuery", () => {
  it("classifies amounts with more than 3 digits", () => {
    const result = classifySearchQuery("56789", "UTC");
    assert.equal(result?.kind, "amount");
  });

  it("keeps short digit strings as text", () => {
    const result = classifySearchQuery("123", "UTC");
    assert.equal(result?.kind, "text");
  });

  it("prefers dotted calendar dates over amounts", () => {
    const result = classifySearchQuery("25.07.2024", "UTC");
    assert.equal(result?.kind, "date");
  });

  it("treats bare years as date ranges", () => {
    const result = classifySearchQuery("2024", "UTC");
    assert.equal(result?.kind, "date");
  });

  it("classifies iso and month-year queries as dates", () => {
    assert.equal(classifySearchQuery("2024-07-25", "UTC")?.kind, "date");
    assert.equal(classifySearchQuery("July 2024", "UTC")?.kind, "date");
    assert.equal(
      classifySearchQuery("from 2024-01-01 to 2024-01-31", "UTC")?.kind,
      "date",
    );
  });

  it("classifies dashed ranges as dates", () => {
    assert.equal(
      classifySearchQuery("24.07.2026-25.07.2026", "UTC")?.kind,
      "date",
    );
    assert.equal(classifySearchQuery("July 2024-2025", "UTC")?.kind, "date");
    assert.equal(
      classifySearchQuery("24.07.2026 14:30 - 25.07.2026 9:00", "UTC")?.kind,
      "date",
    );
  });
});
