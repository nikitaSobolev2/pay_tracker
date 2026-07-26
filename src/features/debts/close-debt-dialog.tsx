"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DateQuickChips,
  type DateQuickChipId,
} from "@/features/transactions/date-quick-chips";
import { DateTimePicker } from "@/features/transactions/date-time-picker";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { createTransaction } from "@/lib/api/transactions";
import { formatMoney } from "@/lib/money";
import { TransactionKind, TransactionType } from "@/types/enums";
import type { DebtCounterpartyStats } from "@/server/services/stats-service.types";

export type DebtCloseTone = "owe" | "owed";

type CloseDebtTarget = {
  readonly tone: DebtCloseTone;
  readonly person: DebtCounterpartyStats;
};

type CloseDebtDialogProps = {
  readonly target: CloseDebtTarget | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onClosed: () => void;
};

export function CloseDebtDialog({
  target,
  open,
  onOpenChange,
  onClosed,
}: CloseDebtDialogProps) {
  const t = useTranslations("debts");
  const tCommon = useTranslations("common");
  const tTransaction = useTranslations("transaction");
  const formatReadableDate = useReadableDateTime();
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [selectedChipId, setSelectedChipId] = useState<DateQuickChipId | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setOccurredAt(new Date());
    setSelectedChipId(null);
  }, [open, target?.person.counterpartyId]);

  async function handleCloseDebt() {
    if (!target) {
      return;
    }

    const isOwe = target.tone === "owe";
    const type = isOwe ? TransactionType.Spending : TransactionType.Earning;
    const kind = isOwe
      ? TransactionKind.Loan
      : TransactionKind.Debt;

    setSaving(true);
    try {
      await createTransaction({
        type,
        originalAmount: target.person.totalAllTime.amount,
        inputCurrency: target.person.totalAllTime.currency,
        title: t("closeDebtTitle", { name: target.person.name }),
        occurredAt: occurredAt.toISOString(),
        kind,
        counterpartyName: target.person.name,
        categoryIds: [],
        idempotencyKey: uuidv4(),
      });
      toast.success(t("closeDebtSuccess"));
      onOpenChange(false);
      onClosed();
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("closeDebtFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

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
          <DialogTitle>{t("closeDebt")}</DialogTitle>
        </DialogHeader>

        {target ? (
          <div className="space-y-5 py-1">
            <p className="text-sm text-muted-foreground">
              {t("closeDebtHint", {
                name: target.person.name,
                amount: formatMoney(
                  target.person.totalAllTime.amount,
                  target.person.totalAllTime.currency,
                ),
              })}
            </p>

            <div className="space-y-3">
              <Label className="text-sm font-medium">
                {tTransaction("date")}
              </Label>
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
            </div>
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
            onClick={() => void handleCloseDebt()}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t("closeDebt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
