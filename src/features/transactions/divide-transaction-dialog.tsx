"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
  PeopleMultiPicker,
  type SelectedPerson,
} from "@/features/transactions/people-multi-picker";
import { divideTransaction } from "@/lib/api/transactions";
import { formatMoney, toCeilIntegerAmountString } from "@/lib/money";
import {
  allocateSplitShareAmounts,
  canAcceptSplitShares,
  emptySharePlaceholder,
} from "@/lib/split-share-amounts";
import { useUiStore } from "@/stores/ui.store";
import type { TransactionDto } from "@/types/transaction";

type ShareDraft = {
  readonly id: string;
  readonly name: string;
  readonly amount: string;
};

export function DivideTransactionDialog() {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const dividingTransaction = useUiStore((state) => state.dividingTransaction);
  const closeDivide = useUiStore((state) => state.closeDivideTransactionModal);
  const [draft, setDraft] = useState<{
    readonly id: string;
    readonly shares: ShareDraft[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const shares = resolveShareDrafts(dividingTransaction, draft);
  const confirmReplace = dividingTransaction?.id === confirmId;

  const allocation = useMemo(() => {
    if (!dividingTransaction) {
      return null;
    }
    return allocateSplitShareAmounts(
      dividingTransaction.originalAmount,
      shares.map((share) => share.amount),
    );
  }, [dividingTransaction, shares]);

  const canAccept =
    dividingTransaction != null &&
    canAcceptSplitShares(
      dividingTransaction.originalAmount,
      shares.map((share) => share.amount),
    );

  function replaceShares(next: ShareDraft[]) {
    if (!dividingTransaction) {
      return;
    }
    setDraft({ id: dividingTransaction.id, shares: next });
  }

  function setPeople(people: SelectedPerson[]) {
    const byId = new Map(shares.map((share) => [share.id, share]));
    replaceShares(
      people.map((person) => {
        const existing = byId.get(person.id);
        return {
          id: person.id,
          name: person.name,
          amount: existing?.amount ?? "",
        };
      }),
    );
  }

  function setShareAmount(id: string, amount: string) {
    replaceShares(
      shares.map((share) =>
        share.id === id ? { ...share, amount } : share,
      ),
    );
  }

  async function submit(transaction: TransactionDto) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error(t("divideOffline"));
      return;
    }
    const resolved = allocateSplitShareAmounts(
      transaction.originalAmount,
      shares.map((share) => share.amount),
    );
    setSaving(true);
    try {
      await divideTransaction(
        transaction.id,
        shares.map((share, index) => ({
          counterpartyName: share.name,
          amount: resolved.resolved[index] ?? share.amount,
        })),
      );
      toast.success(t("divideSuccess"));
      setDraft(null);
      setConfirmId(null);
      closeDivide();
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("divideFailed"));
    } finally {
      setSaving(false);
    }
  }

  function handleAccept() {
    if (!dividingTransaction || !canAccept) {
      return;
    }
    const needsConfirm =
      dividingTransaction.splitShares.length > 0 &&
      dividingTransaction.splitHasLaterDebtEvents &&
      !confirmReplace;
    if (needsConfirm) {
      setConfirmId(dividingTransaction.id);
      return;
    }
    void submit(dividingTransaction);
  }

  return (
    <Dialog
      open={dividingTransaction != null}
      onOpenChange={(open) => {
        if (!saving && !open) {
          setDraft(null);
          setConfirmId(null);
          closeDivide();
        }
      }}
    >
      <ResponsiveDialogContent showCloseButton size="md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle>{t("divide")}</DialogTitle>
            {dividingTransaction ? (
              <DialogDescription>
                {formatMoney(
                  dividingTransaction.originalAmount,
                  dividingTransaction.inputCurrency,
                )}
              </DialogDescription>
            ) : null}
          </ResponsiveDialogHeaderInner>
        </ResponsiveDialogHeader>
        <ResponsiveDialogBody>
          {dividingTransaction ? (
            <div className="space-y-5">
              <FormField label={t("people")} required>
                <PeopleMultiPicker
                  selected={shares.map((share) => ({
                    id: share.id,
                    name: share.name,
                  }))}
                  onChange={setPeople}
                />
              </FormField>

              <ShareAmountList
                shares={shares}
                remainingLabel={
                  allocation
                    ? t("remaining", {
                        amount: formatMoney(
                          remainingIntegerLabel(allocation.remaining.toString()),
                          dividingTransaction.inputCurrency,
                          { fractionDigits: 0 },
                        ),
                      })
                    : null
                }
                placeholder={
                  emptySharePlaceholder(
                    dividingTransaction.originalAmount,
                    shares.map((item) => item.amount),
                  ) || undefined
                }
                amountLabel={t("amount")}
                onAmountChange={setShareAmount}
              />

              {confirmReplace ? (
                <p className="text-sm text-amber-400">{t("redivideWarning")}</p>
              ) : null}
            </div>
          ) : null}
        </ResponsiveDialogBody>
        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
            disabled={saving}
            onClick={() => {
              setDraft(null);
              setConfirmId(null);
              closeDivide();
            }}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-11 rounded-xl"
            disabled={saving || !canAccept}
            onClick={handleAccept}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {confirmReplace ? t("redivideConfirm") : tCommon("accept")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function resolveShareDrafts(
  transaction: TransactionDto | null,
  draft: { readonly id: string; readonly shares: ShareDraft[] } | null,
): ShareDraft[] {
  if (!transaction) {
    return [];
  }
  if (draft?.id === transaction.id) {
    return draft.shares;
  }
  return sharesFromTransaction(transaction);
}

function sharesFromTransaction(transaction: TransactionDto): ShareDraft[] {
  return transaction.splitShares.map((share) => ({
    id: share.counterpartyId ?? share.id,
    name: share.counterpartyName ?? "",
    amount: toCeilIntegerAmountString(share.originalAmount),
  }));
}

function remainingIntegerLabel(remaining: string): string {
  if (remaining.startsWith("-")) {
    return "0";
  }
  return toCeilIntegerAmountString(remaining) || "0";
}

function ShareAmountList({
  shares,
  remainingLabel,
  placeholder,
  amountLabel,
  onAmountChange,
}: {
  readonly shares: readonly ShareDraft[];
  readonly remainingLabel: string | null;
  readonly placeholder: string | undefined;
  readonly amountLabel: string;
  readonly onAmountChange: (id: string, amount: string) => void;
}) {
  if (shares.length === 0) {
    return null;
  }
  return (
    <div className="space-y-3">
      {shares.map((share) => (
        <div
          key={share.id}
          className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3"
        >
          <p className="truncate text-base font-medium">{share.name}</p>
          <AmountInput
            className="h-11 rounded-xl"
            integerOnly
            value={share.amount}
            placeholder={placeholder}
            onValueChange={(amount) => onAmountChange(share.id, amount)}
            aria-label={`${share.name} ${amountLabel}`}
          />
        </div>
      ))}
      {remainingLabel ? (
        <p className="text-sm text-muted-foreground">{remainingLabel}</p>
      ) : null}
    </div>
  );
}
