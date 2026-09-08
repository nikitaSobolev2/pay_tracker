"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import {
  ME_PARTY_ID,
  type CalculatorSession,
} from "@/features/transaction-calculator/calculator-session";
import {
  buildCalculatorSettlement,
  type CalculatorLedgerRow,
  type SettlementPayment,
  type SettlementPosition,
} from "@/features/transaction-calculator/calculator-settlement";
import { formatCeiledMoney, toDecimal } from "@/lib/money";

type CalculatorTotalsModalProps = {
  readonly open: boolean;
  readonly session: CalculatorSession;
  readonly ledgerRows: readonly CalculatorLedgerRow[];
  readonly partyName: (partyId: string) => string;
  readonly onClose: () => void;
};

export function CalculatorTotalsModal({
  open,
  session,
  ledgerRows,
  partyName,
  onClose,
}: CalculatorTotalsModalProps) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const [includeLedgerDebts, setIncludeLedgerDebts] = useState(false);
  const settlement = useMemo(
    () =>
      buildCalculatorSettlement(session, ledgerRows, { includeLedgerDebts }),
    [includeLedgerDebts, ledgerRows, session],
  );
  const settled =
    settlement.payments.length === 0 && settlement.positions.length === 0;

  function closeTotals() {
    setIncludeLedgerDebts(false);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          closeTotals();
        }
      }}
    >
      <ResponsiveDialogContent
        size="md"
        showCloseButton
        container={typeof document === "undefined" ? undefined : document.body}
        overlayClassName="bg-black/70"
        style={{ zIndex: 1250 }}
        overlayStyle={{ zIndex: 1250 }}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>{t("getTotals")}</DialogTitle>
            <DialogDescription>{t("totalsDescription")}</DialogDescription>
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          <label className="mb-4 flex cursor-pointer items-center gap-2.5">
            <Checkbox
              checked={includeLedgerDebts}
              onCheckedChange={(checked) =>
                setIncludeLedgerDebts(checked === true)
              }
            />
            <span className="text-sm">{t("includeExistingDebts")}</span>
          </label>
          {settled ? (
            <p className="text-sm text-muted-foreground">
              {t("settlementEmpty")}
            </p>
          ) : (
            <SettlementLists
              payments={settlement.payments}
              positions={settlement.positions}
              partyName={partyName}
            />
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            className="h-11 rounded-xl"
            onClick={closeTotals}
          >
            {tCommon("close")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function SettlementLists({
  payments,
  positions,
  partyName,
}: {
  readonly payments: readonly SettlementPayment[];
  readonly positions: readonly SettlementPosition[];
  readonly partyName: (partyId: string) => string;
}) {
  const t = useTranslations("calculator");
  return (
    <div className="space-y-6">
      {payments.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("payments")}</h3>
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li
                key={`${payment.fromId}:${payment.toId}:${payment.currency}`}
                className="text-sm"
              >
                {t("owes", {
                  from: partyName(payment.fromId),
                  to: partyName(payment.toId),
                  amount: formatCeiledMoney(payment.amount, payment.currency),
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {positions.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("positions")}</h3>
          <ul className="space-y-2">
            {positions.map((position) => (
              <PositionRow
                key={`${position.partyId}:${position.currency}`}
                position={position}
                name={partyName(position.partyId)}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PositionRow({
  position,
  name,
}: {
  readonly position: SettlementPosition;
  readonly name: string;
}) {
  const t = useTranslations("calculator");
  const value = toDecimal(position.amount);
  const amount = formatCeiledMoney(value.abs(), position.currency);
  const label = value.gt(0)
    ? t("isOwed", { name, amount })
    : t("owesAmount", { name, amount });
  return <li className="text-sm">{label}</li>;
}

export function calculatorPartyLabel(
  partyId: string,
  meLabel: string,
  resolveName: (id: string) => string,
): string {
  if (partyId === ME_PARTY_ID) {
    return meLabel;
  }
  return resolveName(partyId);
}
