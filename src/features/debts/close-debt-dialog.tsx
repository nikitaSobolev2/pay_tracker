"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import {
  DateQuickChips,
  type DateQuickChipId,
} from "@/features/transactions/date-quick-chips";
import { DateTimePicker } from "@/features/transactions/date-time-picker";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { normalizeAmountRaw } from "@/lib/amount-input";
import { uniqueRecentAmounts } from "@/lib/unique-recent-amounts";
import { cn } from "@/lib/utils";
import { createTransaction } from "@/lib/api/transactions";
import { formatMoney, decimalToString, toDecimal } from "@/lib/money";
import { TransactionKind, TransactionType } from "@/types/enums";
import type { DebtCounterpartyStats } from "@/server/services/stats-service.types";

export type DebtCloseTone = "owe" | "owed";
export type SettleDebtMode = "close" | "forgive";

export type SettleDebtTarget = {
  readonly mode: SettleDebtMode;
  readonly tone: DebtCloseTone;
  readonly person: DebtCounterpartyStats;
};

type SettleDebtDialogProps = {
  readonly target: SettleDebtTarget | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSettled: () => void;
};

export function SettleDebtDialog({
  target,
  open,
  onOpenChange,
  onSettled,
}: SettleDebtDialogProps) {
  const t = useTranslations("debts");
  const tCommon = useTranslations("common");
  const tTransaction = useTranslations("transaction");
  const formatReadableDate = useReadableDateTime();
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [selectedChipId, setSelectedChipId] = useState<DateQuickChipId | null>(
    null,
  );
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !target) {
      return;
    }
    setOccurredAt(new Date());
    setSelectedChipId(null);
    setAmount(normalizeAmountRaw(target.person.totalAllTime.amount));
  }, [open, target]);

  async function handleSettle() {
    if (!target) {
      return;
    }

    const openBalance = toDecimal(target.person.totalAllTime.amount);
    let settleAmount;
    try {
      settleAmount = toDecimal(amount);
    } catch {
      toast.error(
        t("settleAmountInvalid", {
          amount: formatMoney(
            target.person.totalAllTime.amount,
            target.person.totalAllTime.currency,
          ),
        }),
      );
      return;
    }
    if (
      !settleAmount.isFinite() ||
      settleAmount.lte(0) ||
      settleAmount.gt(openBalance)
    ) {
      toast.error(
        t("settleAmountInvalid", {
          amount: formatMoney(
            target.person.totalAllTime.amount,
            target.person.totalAllTime.currency,
          ),
        }),
      );
      return;
    }

    const kind = settleTransactionKind(target.mode, target.tone);
    const type = settleTransactionType(target.tone);

    setSaving(true);
    try {
      await createTransaction({
        type,
        originalAmount: decimalToString(settleAmount),
        inputCurrency: target.person.totalAllTime.currency,
        title:
          target.mode === "forgive"
            ? t("forgiveDebtTitle", { name: target.person.name })
            : t("closeDebtTitle", { name: target.person.name }),
        occurredAt: occurredAt.toISOString(),
        kind,
        counterpartyName: target.person.name,
        categoryIds: [],
        idempotencyKey: uuidv4(),
      });
      toast.success(
        target.mode === "forgive" ? t("forgiveDebtSuccess") : t("closeDebtSuccess"),
      );
      onOpenChange(false);
      onSettled();
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : target.mode === "forgive"
            ? t("forgiveDebtFailed")
            : t("closeDebtFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  const formattedOpen = target
    ? formatMoney(
        target.person.totalAllTime.amount,
        target.person.totalAllTime.currency,
      )
    : "";
  const recentAmountChips = target
    ? uniqueRecentAmounts(target.person.recentAmounts ?? [])
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {target?.mode === "forgive" ? t("forgiveDebt") : t("closeDebt")}
          </DialogTitle>
        </DialogHeader>

        {target ? (
          <div className="space-y-5 py-1">
            <p className="text-sm text-muted-foreground">
              {target.mode === "forgive"
                ? t("forgiveDebtHint", {
                    name: target.person.name,
                    amount: formattedOpen,
                  })
                : t("closeDebtHint", {
                    name: target.person.name,
                    amount: formattedOpen,
                  })}
            </p>

            <FormField label={tTransaction("amount")} required>
              <AmountInput
                className="h-11 rounded-xl"
                value={amount}
                onValueChange={setAmount}
              />
              {recentAmountChips.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                    {t("recentAmounts")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentAmountChips.map((recent) => {
                      const selected = normalizeAmountRaw(amount) === recent;
                      return (
                        <button
                          key={recent}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAmount(recent)}
                          className={cn(
                            "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-medium tabular-nums transition-colors",
                            selected
                              ? "border-amber-400 bg-amber-500/45 text-amber-50"
                              : "border-amber-400/35 bg-amber-500/12 text-amber-100/80 hover:bg-amber-500/25",
                          )}
                        >
                          {formatMoney(
                            recent,
                            target.person.totalAllTime.currency,
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </FormField>

            <FormField label={tTransaction("date")} required>
              <DateTimePicker
                value={occurredAt}
                coverLabel={
                  selectedChipId ? formatReadableDate(occurredAt) : null
                }
                onChange={(next) => {
                  setSelectedChipId(null);
                  setOccurredAt(next);
                }}
              />
              <DateQuickChips
                selectedId={selectedChipId}
                onSelect={(date, chipId) => {
                  setSelectedChipId(chipId);
                  setOccurredAt(date);
                }}
              />
            </FormField>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={saving || !target}
            onClick={() => void handleSettle()}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {target?.mode === "forgive" ? t("forgiveDebt") : t("closeDebt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function settleTransactionKind(
  mode: SettleDebtMode,
  tone: DebtCloseTone,
): TransactionKind {
  if (mode === "forgive") {
    return TransactionKind.Forgive;
  }
  return tone === "owe" ? TransactionKind.Loan : TransactionKind.Debt;
}

function settleTransactionType(tone: DebtCloseTone): TransactionType {
  return tone === "owe" ? TransactionType.Spending : TransactionType.Earning;
}
