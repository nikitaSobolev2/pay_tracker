import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchCategoriesByTitle } from "../../src/lib/category-title-match";
import { TransactionType } from "../../src/types/enums";
import type { TransactionCategoryDto } from "../../src/types/transaction";

function category(
  partial: Partial<TransactionCategoryDto> &
    Pick<TransactionCategoryDto, "id" | "title">,
): TransactionCategoryDto {
  return {
    type: TransactionType.Spending,
    parentCategoryId: null,
    path: partial.title,
    keywords: [],
    ...partial,
  };
}

describe("matchCategoriesByTitle", () => {
  const food = category({
    id: "food",
    title: "Пропитание",
    path: "Пропитание",
  });
  const ozonFood = category({
    id: "ozon-food",
    title: "Озон продукты",
    parentCategoryId: "food",
    path: "Пропитание/Озон продукты",
  });
  const markets = category({
    id: "markets",
    title: "Маркетплейсы",
    path: "Маркетплейсы",
  });
  const ozon = category({
    id: "ozon",
    title: "Озон",
    parentCategoryId: "markets",
    path: "Маркетплейсы/Озон",
  });
  const categories = [food, ozonFood, markets, ozon];

  it("prefers more specific Ozon products leaf for russian title", () => {
    assert.deepEqual(matchCategoriesByTitle("озон продукты", categories), [
      "ozon-food",
      "food",
    ]);
  });

  it("matches transliterated ozon products", () => {
    assert.deepEqual(matchCategoriesByTitle("ozon продукты", categories), [
      "ozon-food",
      "food",
    ]);
  });

  it("falls back to bare Ozon when products token missing", () => {
    assert.deepEqual(matchCategoriesByTitle("ozon шмотки", categories), [
      "ozon",
      "markets",
    ]);
  });

  it("works for english leaf titles", () => {
    const english = [
      category({ id: "root", title: "Food", path: "Food" }),
      category({
        id: "leaf",
        title: "Ozon groceries",
        parentCategoryId: "root",
        path: "Food/Ozon groceries",
      }),
      category({ id: "m", title: "Marketplaces", path: "Marketplaces" }),
      category({
        id: "oz",
        title: "Ozon",
        parentCategoryId: "m",
        path: "Marketplaces/Ozon",
      }),
    ];
    assert.deepEqual(matchCategoriesByTitle("ozon groceries", english), [
      "leaf",
      "root",
    ]);
  });
});
