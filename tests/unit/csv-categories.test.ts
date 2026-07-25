import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  joinCsvCategories,
  splitCsvCategories,
} from "../../src/lib/csv-categories";

describe("csv category path helpers", () => {
  it("joins nested paths with pipe delimiter", () => {
    assert.equal(
      joinCsvCategories(["Food/Chinese", "Transport"]),
      "Food/Chinese|Transport",
    );
  });

  it("splits nested paths without breaking hierarchy", () => {
    assert.deepEqual(splitCsvCategories("Food/Chinese|Transport"), [
      "Food/Chinese",
      "Transport",
    ]);
  });

  it("trims and drops empty segments", () => {
    assert.deepEqual(splitCsvCategories(" Food/Chinese | | Transport "), [
      "Food/Chinese",
      "Transport",
    ]);
  });

  it("keeps flat titles for backward-compatible imports", () => {
    assert.deepEqual(splitCsvCategories("Food|Transport"), [
      "Food",
      "Transport",
    ]);
  });
});
