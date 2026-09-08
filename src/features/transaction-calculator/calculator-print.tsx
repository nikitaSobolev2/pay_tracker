"use client";

import { useTranslations } from "next-intl";

import {
  leftoverAmount,
  meCutTotals,
  personCutTotals,
  type CalculatorBoardItem,
  type CalculatorCut,
  type CalculatorRawTransaction,
  type PersonCutTotals,
} from "@/features/transaction-calculator/calculator-session";
import { formatCeiledMoney, formatMoney, toDecimal } from "@/lib/money";
import { TransactionType } from "@/types/enums";

type PrintPerson = {
  readonly id: string;
  readonly name: string;
};

type CalculatorPrintReportProps = {
  readonly periodLabel: string;
  readonly boardItems: readonly CalculatorBoardItem[];
  readonly cuts: readonly CalculatorCut[];
  readonly people: readonly PrintPerson[];
  readonly rawTransactions: readonly CalculatorRawTransaction[];
};

export function CalculatorPrintReport({
  periodLabel,
  boardItems,
  cuts,
  people,
  rawTransactions,
}: CalculatorPrintReportProps) {
  const t = useTranslations("calculator");
  const tTransaction = useTranslations("transaction");
  const leftoverItems = boardItems.filter((item) =>
    toDecimal(leftoverAmount(item.displayAmount, cuts, item.id)).gt(0),
  );
  const doneItems = boardItems.filter((item) =>
    toDecimal(leftoverAmount(item.displayAmount, cuts, item.id)).lte(0),
  );
  const meCuts = cuts.filter((cut) => cut.target.kind === "me");

  return (
    <div id="calculator-print-report" className="calculator-print-report">
      <h1 className="mb-2 text-2xl font-semibold">{t("title")}</h1>
      <p className="mb-6 text-sm">
        {t("printPeriod")}: {periodLabel}
      </p>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{t("printMeShare")}</h2>
        <CutList
          cuts={meCuts}
          boardItems={boardItems}
          spendingLabel={tTransaction("spending")}
          earningLabel={tTransaction("earning")}
        />
        <Totals
          totals={meCutTotals(meCuts)}
          currency={meCuts[0]?.displayCurrency ?? boardItems[0]?.displayCurrency ?? "RUB"}
        />
      </section>

      {people.map((person) => {
        const personCuts = cuts.filter(
          (cut) =>
            cut.target.kind === "person" &&
            cut.target.counterpartyId === person.id,
        );
        const totals = personCutTotals(personCuts, person.id);
        const currency = personCuts[0]?.displayCurrency ?? "RUB";
        return (
          <section key={person.id} className="mb-6">
            <h2 className="mb-2 text-lg font-semibold">{person.name}</h2>
            <CutList
              cuts={personCuts}
              boardItems={boardItems}
              spendingLabel={tTransaction("spending")}
              earningLabel={tTransaction("earning")}
            />
            <Totals totals={totals} currency={currency} />
          </section>
        );
      })}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{t("printLeftoverTxs")}</h2>
        <ItemList
          items={leftoverItems}
          cuts={cuts}
          spendingLabel={tTransaction("spending")}
          earningLabel={tTransaction("earning")}
        />
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">{t("printDoneTxs")}</h2>
        <ItemList
          items={doneItems}
          cuts={cuts}
          spendingLabel={tTransaction("spending")}
          earningLabel={tTransaction("earning")}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("printRaw")}</h2>
        {rawTransactions.length === 0 ? (
          <p>—</p>
        ) : (
          <ul className="space-y-1">
            {rawTransactions.map((raw) => (
              <li key={raw.id}>
                {raw.title} · {formatMoney(raw.displayAmount, raw.displayCurrency)}{" "}
                ({t("reportOnly")})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Totals({
  totals,
  currency,
}: {
  readonly totals: PersonCutTotals;
  readonly currency: string;
}) {
  const t = useTranslations("calculator");
  return (
    <p className="mt-2 text-sm">
      {t("spending")}: {formatCeiledMoney(totals.spending, currency)} ·{" "}
      {t("earning")}: {formatCeiledMoney(totals.earning, currency)} ·{" "}
      {t("net")}: {formatCeiledMoney(totals.net, currency)}
    </p>
  );
}

function CutList({
  cuts,
  boardItems,
  spendingLabel,
  earningLabel,
}: {
  readonly cuts: readonly CalculatorCut[];
  readonly boardItems: readonly CalculatorBoardItem[];
  readonly spendingLabel: string;
  readonly earningLabel: string;
}) {
  const t = useTranslations("calculator");
  if (cuts.length === 0) {
    return <p>—</p>;
  }
  return (
    <ul className="space-y-1">
      {cuts.map((cut) => {
        const item = boardItems.find((row) => row.id === cut.transactionId);
        const isSpending = cut.sourceType === TransactionType.Spending;
        const title =
          item?.title.trim() || (isSpending ? spendingLabel : earningLabel);
        return (
          <li key={cut.id}>
            {title} · {formatMoney(cut.displayAmount, cut.displayCurrency)}
            {item?.isRaw ? ` (${t("reportOnly")})` : ""}
          </li>
        );
      })}
    </ul>
  );
}

function ItemList({
  items,
  cuts,
  spendingLabel,
  earningLabel,
}: {
  readonly items: readonly CalculatorBoardItem[];
  readonly cuts: readonly CalculatorCut[];
  readonly spendingLabel: string;
  readonly earningLabel: string;
}) {
  const t = useTranslations("calculator");
  if (items.length === 0) {
    return <p>—</p>;
  }
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const leftover = leftoverAmount(item.displayAmount, cuts, item.id);
        const isSpending = item.type === TransactionType.Spending;
        const title =
          item.title.trim() || (isSpending ? spendingLabel : earningLabel);
        return (
          <li key={item.id}>
            {title} · {formatMoney(item.displayAmount, item.displayCurrency)}
            {toDecimal(leftover).gt(0)
              ? ` · ${t("leftover", { amount: formatMoney(leftover, item.displayCurrency) })}`
              : ""}
            {item.isRaw ? ` (${t("reportOnly")})` : ""}
          </li>
        );
      })}
    </ul>
  );
}
