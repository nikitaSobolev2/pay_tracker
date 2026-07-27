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
  const products = category({
    id: "products",
    title: "Продукты",
    parentCategoryId: "food",
    path: "Пропитание/Продукты",
  });
  const ozonFood = category({
    id: "ozon-food",
    title: "Озон продукты",
    parentCategoryId: "products",
    path: "Пропитание/Продукты/Озон продукты",
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
  const health = category({
    id: "health",
    title: "Здоровье",
    path: "Здоровье",
  });
  const skinCare = category({
    id: "skin",
    title: "Уход за кожей",
    parentCategoryId: "health",
    path: "Здоровье/Уход за кожей",
  });
  const categories = [food, products, ozonFood, markets, ozon, health, skinCare];

  it("matches every category that shares a significant word", () => {
    assert.deepEqual(
      new Set(matchCategoriesByTitle("Озон уход за кожей", categories)),
      new Set([
        "ozon-food",
        "products",
        "food",
        "ozon",
        "markets",
        "skin",
        "health",
      ]),
    );
  });

  it("ignores stop words like за and от", () => {
    const fromCategory = category({
      id: "from-store",
      title: "Покупка от друга",
      path: "Покупка от друга",
    });
    assert.deepEqual(
      new Set(
        matchCategoriesByTitle("кофе от васи", [...categories, fromCategory]),
      ),
      new Set(),
    );
    assert.deepEqual(
      new Set(
        matchCategoriesByTitle("покупка васи", [...categories, fromCategory]),
      ),
      new Set(["from-store"]),
    );
  });

  it("matches grocery and marketplace Ozon when both words appear", () => {
    assert.deepEqual(
      new Set(matchCategoriesByTitle("озон продукты", categories)),
      new Set(["ozon-food", "products", "food", "ozon", "markets"]),
    );
  });

  it("matches transliterated ozon", () => {
    assert.deepEqual(
      new Set(matchCategoriesByTitle("ozon шмотки", categories)),
      new Set(["ozon-food", "products", "food", "ozon", "markets"]),
    );
  });

  it("matches skincare from face-care wording via shared уход", () => {
    assert.deepEqual(
      new Set(matchCategoriesByTitle("озон уход за лицом", categories)),
      new Set([
        "ozon-food",
        "products",
        "food",
        "ozon",
        "markets",
        "skin",
        "health",
      ]),
    );
  });

  it("tolerates a one-letter typo in a long token", () => {
    assert.deepEqual(
      new Set(matchCategoriesByTitle("Озон уход за кажей", categories)),
      new Set([
        "ozon-food",
        "products",
        "food",
        "ozon",
        "markets",
        "skin",
        "health",
      ]),
    );
  });

  it("matches word forms via shared stem prefix", () => {
    const faceCare = category({
      id: "face",
      title: "Уход за лицом",
      parentCategoryId: "health",
      path: "Здоровье/Уход за лицом",
    });
    assert.deepEqual(
      new Set(
        matchCategoriesByTitle("уход лицу", [...categories, faceCare]),
      ),
      new Set(["face", "health", "skin"]),
    );
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
    assert.deepEqual(
      new Set(matchCategoriesByTitle("ozon groceries", english)),
      new Set(["leaf", "root", "oz", "m"]),
    );
  });
});
