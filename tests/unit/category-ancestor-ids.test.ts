import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { listCategoryAncestorIds } from "../../src/lib/category-ancestors";

describe("listCategoryAncestorIds", () => {
  it("returns leaf-to-root chain for nested categories", () => {
    const byId = new Map([
      ["yandex-eda", { parentCategoryId: "eda" }],
      ["eda", { parentCategoryId: "food" }],
      ["food", { parentCategoryId: null }],
    ]);

    assert.deepEqual(listCategoryAncestorIds("yandex-eda", byId), [
      "yandex-eda",
      "eda",
      "food",
    ]);
  });

  it("returns only the root when category has no parent", () => {
    const byId = new Map([["food", { parentCategoryId: null }]]);
    assert.deepEqual(listCategoryAncestorIds("food", byId), ["food"]);
  });

  it("stops on cycles without infinite looping", () => {
    const byId = new Map([
      ["a", { parentCategoryId: "b" }],
      ["b", { parentCategoryId: "a" }],
    ]);
    assert.deepEqual(listCategoryAncestorIds("a", byId), ["a", "b"]);
  });
});
