import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDecimal } from "../../src/lib/money";
import { TransactionKind, TransactionType } from "../../src/types/enums";
import {
  applyTransfersToCutNet,
  autoBoardColumn,
  canUseInCalculator,
  clampCutAmount,
  existingCutForTarget,
  groupBoardItemsByColumn,
  isCalculatorTargetCollapsed,
  leftoverAmount,
  leftoverForCutEdit,
  removeCutsForTransaction,
  ME_PARTY_ID,
  emptyWorkspace,
  mergeCalculatorBoardItems,
  netDebtKind,
  percentOfAmount,
  personCutTotals,
  evenCutAmounts,
  applyEvenLeftoverCuts,
  applyPeoplePaneDrop,
  peoplePaneDropTargets,
  resolveBoardColumn,
  type CalculatorCut,
  type CalculatorSession,
} from "../../src/features/transaction-calculator/calculator-session";
import {
  applyCutsToPositions,
  applyLedgerToPositions,
  applyTransfersToPositions,
  buildCalculatorSettlement,
  emptyPositions,
  simplifySettlement,
} from "../../src/features/transaction-calculator/calculator-settlement";
import {
  parseCalculatorSession,
  serializeCalculatorSession,
} from "../../src/features/transaction-calculator/calculator-storage";

const CUT: CalculatorCut = {
  id: "c1",
  transactionId: "tx1",
  target: { kind: "person", counterpartyId: "p1", name: "Ada" },
  displayAmount: "30",
  displayCurrency: "RUB",
  sourceType: TransactionType.Spending,
};

describe("leftoverAmount", () => {
  it("subtracts cuts for the transaction", () => {
    assert.equal(leftoverAmount("100", [CUT], "tx1"), "70.0000");
  });

  it("ignores cuts on other transactions", () => {
    assert.equal(leftoverAmount("100", [CUT], "tx2"), "100.0000");
  });

  it("floors leftover at zero", () => {
    assert.equal(leftoverAmount("20", [CUT], "tx1"), "0");
  });

  it("includes Me cuts in leftover", () => {
    const meCut: CalculatorCut = {
      ...CUT,
      id: "me1",
      target: { kind: "me" },
      displayAmount: "15",
    };
    assert.equal(leftoverAmount("100", [CUT, meCut], "tx1"), "55.0000");
  });
});

describe("removeCutsForTransaction", () => {
  it("drops every cut for that transaction", () => {
    const other: CalculatorCut = { ...CUT, id: "c2", transactionId: "tx2" };
    assert.deepEqual(removeCutsForTransaction([CUT, other], "tx1"), [other]);
  });
});

describe("autoBoardColumn", () => {
  it("uses default when there are no cuts", () => {
    assert.equal(autoBoardColumn("100", false), "default");
  });

  it("uses processing when leftover remains", () => {
    assert.equal(autoBoardColumn("40", true), "processing");
  });

  it("uses done when leftover is zero", () => {
    assert.equal(autoBoardColumn("0", true), "done");
  });
});

describe("evenCutAmounts", () => {
  it("splits leftover evenly across two people", () => {
    assert.deepEqual(evenCutAmounts("100", 2), ["50.0000", "50.0000"]);
  });

  it("gives remainder to the last share", () => {
    const shares = evenCutAmounts("100", 3);
    assert.equal(shares.length, 3);
    const sum = shares.reduce(
      (total, share) => total.plus(toDecimal(share)),
      toDecimal(0),
    );
    assert.equal(sum.toFixed(4), "100.0000");
    assert.equal(shares[0], shares[1]);
  });

  it("returns empty when there is nothing to split", () => {
    assert.deepEqual(evenCutAmounts("0", 2), []);
    assert.deepEqual(evenCutAmounts("10", 0), []);
  });
});

describe("applyEvenLeftoverCuts", () => {
  it("creates one cut per person", () => {
    let nextId = 0;
    const cuts = applyEvenLeftoverCuts({
      cuts: [],
      transactionId: "tx1",
      leftover: "90",
      targets: [
        { kind: "person", counterpartyId: "p1", name: "Ada" },
        { kind: "person", counterpartyId: "p2", name: "Bob" },
      ],
      displayCurrency: "RUB",
      sourceType: TransactionType.Spending,
      createCutId: () => `n${(nextId += 1)}`,
    });
    assert.equal(cuts.length, 2);
    assert.equal(cuts[0]?.displayAmount, "45.0000");
    assert.equal(cuts[1]?.displayAmount, "45.0000");
  });

  it("adds leftover onto an existing cut", () => {
    const cuts = applyEvenLeftoverCuts({
      cuts: [CUT],
      transactionId: "tx1",
      leftover: "20",
      targets: [{ kind: "person", counterpartyId: "p1", name: "Ada" }],
      displayCurrency: "RUB",
      sourceType: TransactionType.Spending,
      createCutId: () => "new",
    });
    assert.equal(cuts.length, 1);
    assert.equal(cuts[0]?.displayAmount, "50.0000");
  });
});

describe("peoplePaneDropTargets", () => {
  const people = [
    { id: "p1", name: "Ada" },
    { id: "p2", name: "Bob" },
  ];

  it("splits spending across Me and every selected person", () => {
    assert.deepEqual(
      peoplePaneDropTargets({
        sourceType: TransactionType.Spending,
        selectedPeople: people,
        activeWorkspaceId: "p1",
        activePersonName: "Ada",
      }),
      [
        { kind: "me" },
        { kind: "person", counterpartyId: "p1", name: "Ada" },
        { kind: "person", counterpartyId: "p2", name: "Bob" },
      ],
    );
  });

  it("assigns earning fully to the active person", () => {
    assert.deepEqual(
      peoplePaneDropTargets({
        sourceType: TransactionType.Earning,
        selectedPeople: people,
        activeWorkspaceId: "p2",
        activePersonName: "Bob",
      }),
      [{ kind: "person", counterpartyId: "p2", name: "Bob" }],
    );
  });

  it("assigns earning to Me when Me is the active workspace", () => {
    assert.deepEqual(
      peoplePaneDropTargets({
        sourceType: TransactionType.Earning,
        selectedPeople: people,
        activeWorkspaceId: ME_PARTY_ID,
        activePersonName: "Me",
      }),
      [{ kind: "me" }],
    );
  });
});

describe("applyPeoplePaneDrop", () => {
  const spendingItem = {
    id: "tx1",
    displayAmount: "90",
    displayCurrency: "RUB",
    type: TransactionType.Spending,
  };

  it("splits leftover among Me and selected people", () => {
    let nextId = 0;
    const result = applyPeoplePaneDrop({
      workspace: emptyWorkspace(ME_PARTY_ID),
      item: spendingItem,
      selectedPeople: [
        { id: "p1", name: "Ada" },
        { id: "p2", name: "Bob" },
      ],
      activeWorkspaceId: ME_PARTY_ID,
      activePersonName: "Me",
      createCutId: () => `n${(nextId += 1)}`,
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(
      result.workspace.cuts.map((cut) => [
        cut.target.kind === "me" ? "me" : cut.target.counterpartyId,
        cut.displayAmount,
      ]),
      [
        ["me", "30.0000"],
        ["p1", "30.0000"],
        ["p2", "30.0000"],
      ],
    );
  });

  it("assigns earning leftover to the active person", () => {
    const result = applyPeoplePaneDrop({
      workspace: emptyWorkspace("p1"),
      item: { ...spendingItem, type: TransactionType.Earning },
      selectedPeople: [
        { id: "p1", name: "Ada" },
        { id: "p2", name: "Bob" },
      ],
      activeWorkspaceId: "p1",
      activePersonName: "Ada",
      createCutId: () => "n1",
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.workspace.cuts.length, 1);
    assert.equal(result.workspace.cuts[0]?.displayAmount, "90.0000");
    assert.equal(
      result.workspace.cuts[0]?.target.kind === "person"
        ? result.workspace.cuts[0].target.counterpartyId
        : "",
      "p1",
    );
  });

  it("assigns earning leftover to Me on the Me workspace", () => {
    const result = applyPeoplePaneDrop({
      workspace: emptyWorkspace(ME_PARTY_ID),
      item: { ...spendingItem, type: TransactionType.Earning },
      selectedPeople: [{ id: "p1", name: "Ada" }],
      activeWorkspaceId: ME_PARTY_ID,
      activePersonName: "Me",
      createCutId: () => "n1",
    });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.workspace.cuts[0]?.target, { kind: "me" });
    assert.equal(result.workspace.cuts[0]?.displayAmount, "90.0000");
  });
});

describe("resolveBoardColumn", () => {
  it("prefers a manual override", () => {
    assert.equal(
      resolveBoardColumn("tx1", "0", true, { tx1: "processing" }),
      "processing",
    );
  });

  it("falls back to leftover when there is no override", () => {
    assert.equal(resolveBoardColumn("tx1", "10", true, {}), "processing");
  });
});

describe("groupBoardItemsByColumn", () => {
  it("keeps a zero-leftover card in processing when overridden", () => {
    const grouped = groupBoardItemsByColumn(
      [
        {
          id: "tx1",
          title: "Lunch",
          displayAmount: "30",
          displayCurrency: "RUB",
          type: TransactionType.Spending,
          occurredAt: "2026-01-02T00:00:00.000Z",
          isRaw: false,
        },
      ],
      [CUT],
      { tx1: "processing" },
    );
    assert.equal(grouped.processing.length, 1);
    assert.equal(grouped.done.length, 0);
  });
});

describe("leftoverForCutEdit", () => {
  it("adds the editing cut back into leftover", () => {
    assert.equal(leftoverForCutEdit("100", [CUT], "tx1", "c1"), "100.0000");
  });
});

describe("existingCutForTarget", () => {
  it("returns the latest cut of a transaction on that person", () => {
    const second: CalculatorCut = {
      ...CUT,
      id: "c2",
      displayAmount: "5",
    };
    const found = existingCutForTarget(
      [CUT, second],
      "tx1",
      { kind: "person", counterpartyId: "p1", name: "Ada" },
    );
    assert.equal(found?.id, "c2");
  });

  it("returns null when that person has no cut of the transaction", () => {
    assert.equal(
      existingCutForTarget(
        [CUT],
        "tx1",
        { kind: "person", counterpartyId: "p2", name: "Bob" },
      ),
      null,
    );
  });
});

describe("percentOfAmount", () => {
  it("takes a percent of leftover", () => {
    assert.equal(percentOfAmount("80", 25), "20.0000");
  });
});

describe("clampCutAmount", () => {
  it("accepts a cut within leftover", () => {
    assert.equal(clampCutAmount("25", "40"), "25.0000");
  });

  it("rejects a cut above leftover", () => {
    assert.equal(clampCutAmount("50", "40"), null);
  });
});

describe("personCutTotals", () => {
  it("nets spending minus earning", () => {
    const totals = personCutTotals(
      [
        CUT,
        {
          ...CUT,
          id: "c2",
          displayAmount: "10",
          sourceType: TransactionType.Earning,
        },
      ],
      "p1",
    );
    assert.equal(totals.spending, "30.0000");
    assert.equal(totals.earning, "10.0000");
    assert.equal(totals.net, "20.0000");
    assert.equal(netDebtKind(totals.net), "loan");
  });

  it("treats earning-heavy nets as debt", () => {
    assert.equal(netDebtKind("-12"), "debt");
  });

  it("treats near-zero nets as settled", () => {
    assert.equal(netDebtKind("0.001"), "zero");
  });
});

describe("canUseInCalculator", () => {
  it("rejects refund transactions", () => {
    assert.equal(
      canUseInCalculator({
        kind: TransactionKind.Refund,
        sourceTransactionId: null,
        displayAmount: "10",
      }),
      false,
    );
  });

  it("accepts default transactions", () => {
    assert.equal(
      canUseInCalculator({
        kind: TransactionKind.Default,
        sourceTransactionId: null,
        displayAmount: "10",
      }),
      true,
    );
  });
});

describe("mergeCalculatorBoardItems", () => {
  it("keeps raw txs even when they are outside the period", () => {
    const merged = mergeCalculatorBoardItems(
      [
        {
          id: "tx1",
          title: "Lunch",
          displayAmount: "10",
          displayCurrency: "RUB",
          type: TransactionType.Spending,
          occurredAt: "2026-01-02T00:00:00.000Z",
          kind: TransactionKind.Default,
          sourceTransactionId: null,
        },
        {
          id: "refund1",
          title: "Refund",
          displayAmount: "10",
          displayCurrency: "RUB",
          type: TransactionType.Earning,
          occurredAt: "2026-01-02T00:00:00.000Z",
          kind: TransactionKind.Refund,
          sourceTransactionId: null,
        },
      ],
      [
        {
          id: "raw:1",
          title: "Taxi",
          displayAmount: "12",
          displayCurrency: "RUB",
          type: TransactionType.Spending,
          occurredAt: null,
        },
      ],
    );
    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.id, "tx1");
    assert.equal(merged[1]?.id, "raw:1");
    assert.equal(merged[1]?.isRaw, true);
  });
});

describe("calculator storage", () => {
  it("round-trips a session", () => {
    const session: CalculatorSession = {
      selectedCounterpartyIds: ["p1"],
      activeWorkspaceId: ME_PARTY_ID,
      workspaces: {
        [ME_PARTY_ID]: {
          cuts: [CUT],
          rawTransactions: [
            {
              id: "raw:1",
              title: "Taxi",
              displayAmount: "12",
              displayCurrency: "RUB",
              type: TransactionType.Spending,
              occurredAt: null,
            },
          ],
          boardColumn: { tx1: "done" },
          expandedTargetIds: ["me"],
          transfers: [],
        },
      },
    };
    const parsed = parseCalculatorSession(serializeCalculatorSession(session));
    assert.deepEqual(parsed, session);
  });

  it("returns empty on corrupt JSON", () => {
    const parsed = parseCalculatorSession("{nope");
    assert.equal(parsed.workspaces[ME_PARTY_ID]?.cuts.length, 0);
    assert.equal(parsed.workspaces[ME_PARTY_ID]?.rawTransactions.length, 0);
  });

  it("migrates a v1 session into the Me workspace", () => {
    const parsed = parseCalculatorSession(
      JSON.stringify({
        version: 1,
        selectedCounterpartyIds: ["p1"],
        cuts: [CUT],
        rawTransactions: [],
        boardColumn: { tx1: "done" },
      }),
    );
    assert.equal(parsed.activeWorkspaceId, ME_PARTY_ID);
    assert.deepEqual(parsed.selectedCounterpartyIds, ["p1"]);
    assert.deepEqual(parsed.workspaces[ME_PARTY_ID]?.cuts, [CUT]);
    assert.deepEqual(parsed.workspaces[ME_PARTY_ID]?.expandedTargetIds, ["me"]);
    assert.deepEqual(parsed.workspaces[ME_PARTY_ID]?.transfers, []);
  });

  it("keeps Me expanded when expanded ids are missing", () => {
    const parsed = parseCalculatorSession(
      JSON.stringify({
        version: 1,
        selectedCounterpartyIds: ["p1"],
      }),
    );
    assert.deepEqual(parsed.workspaces[ME_PARTY_ID]?.expandedTargetIds, ["me"]);
  });
});

describe("isCalculatorTargetCollapsed", () => {
  const person = {
    kind: "person" as const,
    counterpartyId: "p1",
    name: "Ada",
  };

  it("collapses counterparties that are not expanded", () => {
    assert.equal(isCalculatorTargetCollapsed(["me"], person), true);
  });

  it("keeps Me expanded by default", () => {
    assert.equal(isCalculatorTargetCollapsed(["me"], { kind: "me" }), false);
  });

  it("expands a counterparty once listed", () => {
    assert.equal(isCalculatorTargetCollapsed(["me", "p1"], person), false);
  });
});

describe("applyTransfersToCutNet", () => {
  it("reduces what the payer owes after they pay someone", () => {
    const totals = applyTransfersToCutNet(
      { spending: "1000.0000", earning: "0.0000", net: "1000.0000" },
      [
        {
          id: "t1",
          payerId: "p1",
          payeeId: "p2",
          displayAmount: "400",
          displayCurrency: "RUB",
        },
      ],
      "p1",
    );
    assert.equal(totals.net, "600.0000");
  });
});

describe("calculator settlement", () => {
  const adaSpending: CalculatorCut = {
    id: "ada",
    transactionId: "tx1",
    target: { kind: "person", counterpartyId: "p1", name: "Ada" },
    displayAmount: "1000",
    displayCurrency: "RUB",
    sourceType: TransactionType.Spending,
  };
  const bobSpending: CalculatorCut = {
    ...adaSpending,
    id: "bob",
    target: { kind: "person", counterpartyId: "p2", name: "Bob" },
  };
  const meSpending: CalculatorCut = {
    ...adaSpending,
    id: "me",
    target: { kind: "me" },
  };

  it("skips self cuts and signs spending against the workspace", () => {
    const positions = emptyPositions();
    applyCutsToPositions(positions, ME_PARTY_ID, [
      meSpending,
      adaSpending,
      bobSpending,
    ]);
    const settlement = buildCalculatorSettlement(
      {
        selectedCounterpartyIds: ["p1", "p2"],
        activeWorkspaceId: ME_PARTY_ID,
        workspaces: {
          [ME_PARTY_ID]: {
            cuts: [meSpending, adaSpending, bobSpending],
            rawTransactions: [],
            boardColumn: {},
            expandedTargetIds: [ME_PARTY_ID],
            transfers: [],
          },
        },
      },
      [],
    );
    assert.deepEqual(positionMap(settlement.positions), {
      me: "2000.0000",
      p1: "-1000.0000",
      p2: "-1000.0000",
    });
  });

  it("improves the payer position and worsens the payee", () => {
    const positions = emptyPositions();
    applyTransfersToPositions(positions, [
      {
        id: "t1",
        payerId: "p1",
        payeeId: "p2",
        displayAmount: "400",
        displayCurrency: "RUB",
      },
    ]);
    const remaining = positions.get("RUB");
    assert.equal(remaining?.get("p1")?.toFixed(4), "400.0000");
    assert.equal(remaining?.get("p2")?.toFixed(4), "-400.0000");
  });

  it("applies period loans and debts with ledger signs", () => {
    const positions = emptyPositions();
    applyLedgerToPositions(positions, [
      {
        kind: TransactionKind.Loan,
        type: TransactionType.Spending,
        displayAmount: "50",
        displayCurrency: "RUB",
        counterpartyId: "p1",
      },
      {
        kind: TransactionKind.Debt,
        type: TransactionType.Earning,
        displayAmount: "20",
        displayCurrency: "RUB",
        counterpartyId: "p2",
      },
    ]);
    assert.equal(positions.get("RUB")?.get(ME_PARTY_ID)?.toFixed(4), "30.0000");
    assert.equal(positions.get("RUB")?.get("p1")?.toFixed(4), "-50.0000");
    assert.equal(positions.get("RUB")?.get("p2")?.toFixed(4), "20.0000");
  });

  it("simplifies the dinner example into two payments to Me", () => {
    const settlement = buildCalculatorSettlement(
      {
        selectedCounterpartyIds: ["p1", "p2"],
        activeWorkspaceId: ME_PARTY_ID,
        workspaces: {
          [ME_PARTY_ID]: {
            cuts: [meSpending, adaSpending, bobSpending],
            rawTransactions: [],
            boardColumn: {},
            expandedTargetIds: [ME_PARTY_ID],
            transfers: [
              {
                id: "t1",
                payerId: "p1",
                payeeId: "p2",
                displayAmount: "400",
                displayCurrency: "RUB",
              },
            ],
          },
        },
      },
      [],
    );
    assert.deepEqual(positionMap(settlement.positions), {
      me: "2000.0000",
      p1: "-600.0000",
      p2: "-1400.0000",
    });
    assert.deepEqual(settlement.payments, [
      { fromId: "p2", toId: "me", amount: "1400.0000", currency: "RUB" },
      { fromId: "p1", toId: "me", amount: "600.0000", currency: "RUB" },
    ]);
    assert.equal(positionSum(settlement.positions), "0.0000");
  });

  it("ignores cuts and transfers for people who are not selected", () => {
    const settlement = buildCalculatorSettlement(
      {
        selectedCounterpartyIds: ["p1"],
        activeWorkspaceId: ME_PARTY_ID,
        workspaces: {
          [ME_PARTY_ID]: {
            cuts: [adaSpending, bobSpending],
            rawTransactions: [],
            boardColumn: {},
            expandedTargetIds: [ME_PARTY_ID],
            transfers: [],
          },
        },
      },
      [],
    );
    assert.deepEqual(positionMap(settlement.positions), {
      me: "1000.0000",
      p1: "-1000.0000",
    });
  });

  it("includes period debts only when asked", () => {
    const session: CalculatorSession = {
      selectedCounterpartyIds: ["p1"],
      activeWorkspaceId: ME_PARTY_ID,
      workspaces: {
        [ME_PARTY_ID]: {
          cuts: [],
          rawTransactions: [],
          boardColumn: {},
          expandedTargetIds: [ME_PARTY_ID],
          transfers: [],
        },
      },
    };
    const ledger = [
      {
        kind: TransactionKind.Loan,
        type: TransactionType.Spending,
        displayAmount: "50",
        displayCurrency: "RUB",
        counterpartyId: "p1",
      },
    ];
    assert.equal(
      buildCalculatorSettlement(session, ledger).positions.length,
      0,
    );
    const withDebts = buildCalculatorSettlement(session, ledger, {
      includeLedgerDebts: true,
    });
    assert.deepEqual(positionMap(withDebts.positions), {
      me: "50.0000",
      p1: "-50.0000",
    });
  });

  it("signs earning cuts as the workspace owing the target", () => {
    const earning: CalculatorCut = {
      ...adaSpending,
      id: "earn",
      displayAmount: "50",
      sourceType: TransactionType.Earning,
    };
    const positions = emptyPositions();
    applyCutsToPositions(positions, ME_PARTY_ID, [earning]);
    assert.equal(positions.get("RUB")?.get(ME_PARTY_ID)?.toFixed(4), "-50.0000");
    assert.equal(positions.get("RUB")?.get("p1")?.toFixed(4), "50.0000");
  });

  it("keeps simplified payments zero-sum", () => {
    const payments = simplifySettlement(
      { me: "80", a: "-50", b: "-30" },
      "RUB",
    );
    assert.equal(payments.length, 2);
    const paid = payments.reduce(
      (sum, row) => sum.plus(row.amount),
      toDecimal(0),
    );
    assert.equal(paid.toFixed(4), "80.0000");
  });
});

function positionMap(
  positions: readonly { partyId: string; amount: string }[],
): Record<string, string> {
  return Object.fromEntries(
    positions.map((row) => [row.partyId, row.amount]),
  );
}

function positionSum(
  positions: readonly { partyId: string; amount: string }[],
): string {
  return positions
    .reduce((sum, row) => sum.plus(row.amount), toDecimal(0))
    .toFixed(4);
}
