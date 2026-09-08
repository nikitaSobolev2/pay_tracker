"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTimePicker } from "@/features/transactions/date-time-picker";
import {
  RAW_TRANSACTION_ID_PREFIX,
  type CalculatorRawTransaction,
} from "@/features/transaction-calculator/calculator-session";
import {
  evaluateAmountExpression,
  looksLikeAmountExpression,
} from "@/lib/amount-expression";
import { toDecimal } from "@/lib/money";
import { TransactionType } from "@/types/enums";

type CalculatorRawTransactionModalProps = {
  readonly open: boolean;
  readonly editing: CalculatorRawTransaction | null;
  readonly displayCurrency: string;
  readonly onClose: () => void;
  readonly onSave: (raw: CalculatorRawTransaction) => void;
};

export function CalculatorRawTransactionModal({
  open,
  editing,
  displayCurrency,
  onClose,
  onSave,
}: CalculatorRawTransactionModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {open ? (
        <RawForm
          key={editing?.id ?? "new"}
          editing={editing}
          displayCurrency={displayCurrency}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  );
}

function RawForm({
  editing,
  displayCurrency,
  onClose,
  onSave,
}: {
  readonly editing: CalculatorRawTransaction | null;
  readonly displayCurrency: string;
  readonly onClose: () => void;
  readonly onSave: (raw: CalculatorRawTransaction) => void;
}) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const tTransaction = useTranslations("transaction");
  const [amount, setAmount] = useState(
    editing ? stripTrailingZeros(editing.displayAmount) : "",
  );
  const [title, setTitle] = useState(editing?.title ?? "");
  const [type, setType] = useState<TransactionType>(
    editing?.type ?? TransactionType.Spending,
  );
  const [occurredAt, setOccurredAt] = useState<Date | null>(
    editing?.occurredAt ? new Date(editing.occurredAt) : null,
  );

  function handleSave() {
    const resolved = resolveSubmittedAmount(amount);
    if (!resolved) {
      toast.error(t("invalidAmount"));
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(t("rawTitleRequired"));
      return;
    }
    onSave({
      id: editing?.id ?? `${RAW_TRANSACTION_ID_PREFIX}${crypto.randomUUID()}`,
      title: trimmedTitle,
      displayAmount: toDecimal(resolved).toFixed(4),
      displayCurrency,
      type,
      occurredAt: occurredAt ? occurredAt.toISOString() : null,
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
          <DialogTitle>{editing ? t("editRaw") : t("addRaw")}</DialogTitle>
        </ResponsiveDialogHeaderInner>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody>
        <div className="space-y-4">
          <Tabs
            className="w-full"
            value={type}
            onValueChange={(next) => {
              if (
                next === TransactionType.Spending ||
                next === TransactionType.Earning
              ) {
                setType(next);
              }
            }}
          >
            <TabsList className="h-12 w-full rounded-full p-1">
              <TabsTrigger
                value={TransactionType.Spending}
                className="rounded-full px-2.5 text-sm"
              >
                {tTransaction("spending")}
              </TabsTrigger>
              <TabsTrigger
                value={TransactionType.Earning}
                className="rounded-full px-2.5 text-sm"
              >
                {tTransaction("earning")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <FormField label={tTransaction("amount")} required>
            <AmountInput
              allowExpression
              className="h-11 rounded-xl"
              value={amount}
              onValueChange={setAmount}
            />
          </FormField>
          <FormField label={tTransaction("title")} required>
            <Input
              className="h-11 rounded-xl"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>
          <FormField label={tTransaction("date")} optional>
            {occurredAt ? (
              <div className="space-y-2">
                <DateTimePicker value={occurredAt} onChange={setOccurredAt} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOccurredAt(null)}
                >
                  {t("clearDate")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl"
                onClick={() => setOccurredAt(new Date())}
              >
                {t("addDate")}
              </Button>
            )}
          </FormField>
        </div>
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
          {tCommon("save")}
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
