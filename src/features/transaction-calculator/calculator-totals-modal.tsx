"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
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
import { ME_PARTY_ID } from "@/features/transaction-calculator/calculator-session";
import type {
  SettlementPayment,
  SettlementPosition,
} from "@/features/transaction-calculator/calculator-settlement";
import { formatMoney, toDecimal } from "@/lib/money";

type CalculatorTotalsModalProps = {
  readonly open: boolean;
  readonly positions: readonly SettlementPosition[];
  readonly payments: readonly SettlementPayment[];
  readonly partyName: (partyId: string) => string;
  readonly onClose: () => void;
};

export function CalculatorTotalsModal({
  open,
  positions,
  payments,
  partyName,
  onClose,
}: CalculatorTotalsModalProps) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const settled = payments.length === 0 && positions.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
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
          {settled ? (
            <p className="text-sm text-muted-foreground">{t("settlementEmpty")}</p>
          ) : (
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
                          amount: formatMoney(
                            payment.amount,
                            payment.currency,
                          ),
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
          )}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            className="h-11 rounded-xl"
            onClick={onClose}
          >
            {tCommon("close")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
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
  const amount = formatMoney(value.abs(), position.currency);
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
