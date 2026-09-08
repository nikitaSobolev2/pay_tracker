"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import {
  parsePositiveAmount,
  type CalculatorTransfer,
} from "@/features/transaction-calculator/calculator-session";
import {
  evaluateAmountExpression,
  looksLikeAmountExpression,
} from "@/lib/amount-expression";
import { toDecimal } from "@/lib/money";

export type CalculatorTransferDraft = {
  readonly payerId: string;
  readonly payeeId: string;
  readonly payerName: string;
  readonly payeeName: string;
  readonly displayCurrency: string;
  readonly editing: CalculatorTransfer | null;
};

type CalculatorTransferModalProps = {
  readonly draft: CalculatorTransferDraft | null;
  readonly onClose: () => void;
  readonly onSave: (transfer: CalculatorTransfer) => void;
};

export function CalculatorTransferModal({
  draft,
  onClose,
  onSave,
}: CalculatorTransferModalProps) {
  return (
    <Dialog
      open={draft != null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {draft ? (
        <TransferForm
          key={draft.editing?.id ?? `${draft.payerId}:${draft.payeeId}`}
          draft={draft}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  );
}

function TransferForm({
  draft,
  onClose,
  onSave,
}: {
  readonly draft: CalculatorTransferDraft;
  readonly onClose: () => void;
  readonly onSave: (transfer: CalculatorTransfer) => void;
}) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const [amount, setAmount] = useState(
    draft.editing ? stripTrailingZeros(draft.editing.displayAmount) : "",
  );

  function handleSave() {
    const resolved = resolveSubmittedAmount(amount);
    if (!resolved) {
      toast.error(t("invalidAmount"));
      return;
    }
    const parsed = parsePositiveAmount(resolved);
    if (!parsed) {
      toast.error(t("invalidAmount"));
      return;
    }
    onSave({
      id: draft.editing?.id ?? crypto.randomUUID(),
      payerId: draft.payerId,
      payeeId: draft.payeeId,
      displayAmount: parsed,
      displayCurrency: draft.displayCurrency,
    });
  }

  return (
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
          <DialogTitle>{t("transferTitle")}</DialogTitle>
          <DialogDescription>
            {t("transferDescription", {
              payer: draft.payerName,
              payee: draft.payeeName,
            })}
          </DialogDescription>
        </ResponsiveDialogHeaderInner>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody>
        <FormField label={t("transferAmount")} required>
          <AmountInput
            allowExpression
            className="h-11 rounded-xl"
            value={amount}
            onValueChange={setAmount}
          />
        </FormField>
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-xl"
          onClick={onClose}
        >
          {tCommon("cancel")}
        </Button>
        <Button type="button" className="h-11 rounded-xl" onClick={handleSave}>
          {tCommon("apply")}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialogContent>
  );
}

function resolveSubmittedAmount(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (looksLikeAmountExpression(trimmed)) {
    const result = evaluateAmountExpression(trimmed);
    if (result === null || result <= 0) {
      return null;
    }
    return String(result);
  }
  try {
    const value = toDecimal(trimmed.replace(",", "."));
    if (!value.isFinite() || value.lte(0)) {
      return null;
    }
    return value.toString();
  } catch {
    return null;
  }
}

function stripTrailingZeros(value: string): string {
  if (!value.includes(".")) {
    return value;
  }
  return value.replace(/\.?0+$/, "");
}
