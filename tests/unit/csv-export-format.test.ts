import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSectionedCsv,
  CATEGORY_COLUMNS,
  COUNTERPARTY_COLUMNS,
  CSV_EXPORT_MARKER,
  isPaytrackerExportV2,
  joinKeywords,
  parseSectionedCsv,
  splitKeywords,
  TRANSACTION_CATEGORY_COLUMNS,
  TRANSACTION_COLUMNS,
} from "../../src/lib/csv-export-format";

describe("csv export format", () => {
  it("round-trips sectioned catalogs and links", () => {
    const csv = buildSectionedCsv({
      categories: [
        {
          id: "c1",
          title: "Food",
          type: "SPENDING",
          parentCategoryId: "",
          keywords: joinKeywords(["eat", "grocery"]),
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          title: "Chinese",
          type: "SPENDING",
          parentCategoryId: "c1",
          keywords: "",
          createdAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      counterparties: [
        {
          id: "p1",
          name: "Alice",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      transactions: [
        {
          id: "t1",
          type: "SPENDING",
          amount: "100",
          inputCurrency: "RUB",
          originalAmount: "100",
          rateToRub: "1",
          fxRateDate: "2026-01-03",
          title: "Lunch",
          occurredAt: "2026-01-03T12:00:00.000Z",
          kind: "DEFAULT",
          counterpartyId: "",
          counterparty: "",
          createdAt: "2026-01-03T12:00:00.000Z",
        },
      ],
      transactionCategories: [
        { transactionId: "t1", categoryId: "c2" },
      ],
    });

    assert.equal(isPaytrackerExportV2(csv), true);
    assert.ok(csv.includes(CSV_EXPORT_MARKER));
    assert.ok(csv.includes("#SECTION categories"));
    assert.ok(csv.includes("#SECTION counterparties"));
    assert.ok(csv.includes("#SECTION transactions"));
    assert.ok(csv.includes("#SECTION transaction_categories"));

    const parsed = parseSectionedCsv(csv);
    assert.equal(parsed.categories.length, 2);
    assert.equal(parsed.categories[0]?.title, "Food");
    assert.deepEqual(splitKeywords(parsed.categories[0]?.keywords ?? ""), [
      "eat",
      "grocery",
    ]);
    assert.equal(parsed.categories[1]?.parentCategoryId, "c1");
    assert.equal(parsed.counterparties[0]?.name, "Alice");
    assert.equal(parsed.transactions[0]?.id, "t1");
    assert.equal(parsed.transactionCategories[0]?.categoryId, "c2");
  });

  it("exposes expected column sets for each entity", () => {
    assert.deepEqual([...CATEGORY_COLUMNS], [
      "id",
      "title",
      "type",
      "parentCategoryId",
      "keywords",
      "createdAt",
    ]);
    assert.deepEqual([...COUNTERPARTY_COLUMNS], ["id", "name", "createdAt"]);
    assert.ok((TRANSACTION_COLUMNS as readonly string[]).includes("counterpartyId"));
    assert.ok(!(TRANSACTION_COLUMNS as readonly string[]).includes("categories"));
    assert.deepEqual([...TRANSACTION_CATEGORY_COLUMNS], [
      "transactionId",
      "categoryId",
    ]);
  });
});
