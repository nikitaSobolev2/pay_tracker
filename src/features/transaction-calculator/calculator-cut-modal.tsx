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
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import {
  clampCutAmount,
  leftoverForCutEdit,
  percentOfAmount,
  type CalculatorBoardItem,
  type CalculatorCut,
  type CutTarget,
} from "@/features/transaction-calculator/calculator-session";
import {
  evaluateAmountExpression,
  looksLikeAmountExpression,
} from "@/lib/amount-expression";
import { formatMoney, toDecimal } from "@/lib/money";

export type CalculatorCutDraft = {
  readonly transactionId: string;
  readonly target: CutTarget;
  readonly editingCut: CalculatorCut | null;
};

type CalculatorCutModalProps = {
  readonly draft: CalculatorCutDraft | null;
  readonly cuts: readonly CalculatorCut[];
  readonly boardItems: readonly CalculatorBoardItem[];
  readonly onClose: () => void;
  readonly onSave: (cut: CalculatorCut) => void;
};

export function CalculatorCutModal({
  draft,
  cuts,
  boardItems,
  onClose,
  onSave,
}: CalculatorCutModalProps) {
  const item = boardItems.find((row) => row.id === draft?.transactionId) ?? null;
  const open = draft != null && item != null;
  const formKey = draft
    ? `${draft.transactionId}:${draft.editingCut?.id ?? "new"}`
    : "closed";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      {draft && item ? (
        <CutForm
          key={formKey}
          draft={draft}
          item={item}
          cuts={cuts}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Dialog>
  );
}

function CutForm({
  draft,
  item,
  cuts,
  onClose,
  onSave,
}: {
  readonly draft: CalculatorCutDraft;
  readonly item: CalculatorBoardItem;
  readonly cuts: readonly CalculatorCut[];
  readonly onClose: () => void;
  readonly onSave: (cut: CalculatorCut) => void;
}) {
  const t = useTranslations("calculator");
  const tCommon = useTranslations("common");
  const maxLeftover = leftoverForCutEdit(
    item.displayAmount,
    cuts,
    draft.transactionId,
    draft.editingCut?.id ?? null,
  );
  const [amount, setAmount] = useState(
    stripTrailingZeros(draft.editingCut?.displayAmount ?? maxLeftover),
  );
  const [percent, setPercent] = useState("");
  const targetLabel = draft.target.kind === "me" ? t("me") : draft.target.name;

  function applyPercent(raw: string) {
    setPercent(raw);
    const parsed = Number(raw.replace(",", "."));
    const next = percentOfAmount(maxLeftover, parsed);
    if (next) {
      setAmount(stripTrailingZeros(next));
    }
  }

  function handleSave() {
    const resolved = resolveSubmittedAmount(amount);
    if (!resolved) {
      toast.error(t("invalidAmount"));
      return;
    }
    const clamped = clampCutAmount(resolved, maxLeftover);
    if (!clamped) {
      toast.error(t("cutTooLarge"));
      return;
    }
    onSave({
      id: draft.editingCut?.id ?? crypto.randomUUID(),
      transactionId: draft.transactionId,
      target: draft.target,
      displayAmount: clamped,
      displayCurrency: item.displayCurrency,
      sourceType: item.type,
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
          <DialogTitle>{t("cut")}</DialogTitle>
          <DialogDescription>
            {`${targetLabel} · ${formatMoney(item.displayAmount, item.displayCurrency)}`}
          </DialogDescription>
        </ResponsiveDialogHeaderInner>
      </ResponsiveDialogHeader>
      <ResponsiveDialogBody>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("leftover", {
              amount: formatMoney(maxLeftover, item.displayCurrency),
            })}
          </p>
          <FormField label={t("cutAmount")} required>
            <AmountInput
              allowExpression
              className="h-11 rounded-xl"
              value={amount}
              onValueChange={setAmount}
            />
          </FormField>
          <FormField label={t("cutPercent")} optional>
            <Input
              className="h-11 rounded-xl"
              inputMode="decimal"
              value={percent}
              onChange={(event) => applyPercent(event.target.value)}
              aria-label={t("cutPercent")}
            />
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
