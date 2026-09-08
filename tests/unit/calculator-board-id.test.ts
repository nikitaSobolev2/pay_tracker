import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculatorBoardIdStorageKey,
  clearLinkedCalculatorBoardId,
  linkedCalculatorBoardSave,
  loadLinkedCalculatorBoardId,
  saveLinkedCalculatorBoardId,
} from "../../src/features/transaction-calculator/calculator-board-id";

describe("calculatorBoardIdStorageKey", () => {
  it("scopes the key to the user", () => {
    assert.equal(
      calculatorBoardIdStorageKey("user-1"),
      "paytracker:calculator-board-id:user-1",
    );
  });
});

describe("linkedCalculatorBoardSave", () => {
  it("creates when no board is linked and updates the same id later", () => {
    assert.equal(linkedCalculatorBoardSave(null), "create");
    assert.equal(linkedCalculatorBoardSave("board-1"), "update");
  });
});

describe("loadLinkedCalculatorBoardId", () => {
  it("returns null without a user", () => {
    assert.equal(loadLinkedCalculatorBoardId(null), null);
  });

  it("round-trips a board id in localStorage", () => {
    withMemoryLocalStorage(() => {
      saveLinkedCalculatorBoardId("user-1", "board-1");
      assert.equal(loadLinkedCalculatorBoardId("user-1"), "board-1");
      clearLinkedCalculatorBoardId("user-1");
      assert.equal(loadLinkedCalculatorBoardId("user-1"), null);
    });
  });
});

function withMemoryLocalStorage(run: () => void): void {
  const store = new Map<string, string>();
  const previous = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          return store.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          store.set(key, value);
        },
        removeItem(key: string) {
          store.delete(key);
        },
      },
    },
  });
  try {
    run();
  } finally {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previous,
      });
    }
  }
}
