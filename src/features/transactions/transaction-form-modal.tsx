"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogHeaderInner,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryChipPicker } from "@/features/transactions/category-chip-picker";
import { CounterpartyAutocomplete } from "@/features/transactions/counterparty-autocomplete";
import { CurrencySelect } from "@/features/transactions/currency-select";
import {
  DateQuickChips,
  type DateQuickChipId,
} from "@/features/transactions/date-quick-chips";
import { DateTimePicker } from "@/features/transactions/date-time-picker";
import { useAppUser } from "@/hooks/use-app-user";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  createTransaction,
  updateTransaction,
} from "@/lib/api/transactions";
import { normalizeAmountRaw } from "@/lib/amount-input";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui.store";
import {
  TransactionDebtRole,
  TransactionFormMode,
  TransactionType,
} from "@/types/enums";

type FormState = {
  amount: string;
  currency: string;
  title: string;
  occurredAt: Date;
  categoryIds: string[];
  isDebt: boolean;
  counterpartyName: string;
};

function emptyForm(currency: string): FormState {
  return {
    amount: "",
    currency,
    title: "",
    occurredAt: new Date(),
    categoryIds: [],
    isDebt: false,
    counterpartyName: "",
  };
}

export function TransactionFormModal() {
  const t = useTranslations("transaction");
  const tCommon = useTranslations("common");
  const { user } = useAppUser();
  const {
    transactionModalOpen,
    transactionFormMode,
    editingTransaction,
    closeTransactionModal,
    setTransactionFormMode,
  } = useUiStore();

  const defaultCurrency = user?.defaultCurrency ?? "RUB";
  const formatReadableDate = useReadableDateTime();
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultCurrency));
  const [saving, setSaving] = useState(false);
  const [selectedChipId, setSelectedChipId] = useState<DateQuickChipId | null>(
    null,
  );
  const bodyRef = useRef<HTMLDivElement>(null);

  const transactionType =
    transactionFormMode === TransactionFormMode.Spending
      ? TransactionType.Spending
      : TransactionType.Earning;

  const debtRole =
    transactionFormMode === TransactionFormMode.Spending
      ? TransactionDebtRole.Lend
      : TransactionDebtRole.Borrow;

  const isEditing = Boolean(editingTransaction);
  const modalTitle = isEditing
    ? tCommon("edit")
    : transactionFormMode === TransactionFormMode.Spending
      ? t("spending")
      : t("earning");

  useEffect(() => {
    if (!transactionModalOpen) {
      return;
    }
    setSelectedChipId(null);
    if (editingTransaction) {
      setForm({
        amount: normalizeAmountRaw(editingTransaction.originalAmount),
        currency: editingTransaction.inputCurrency,
        title: editingTransaction.title ?? "",
        occurredAt: new Date(editingTransaction.occurredAt),
        categoryIds: editingTransaction.categories.map((item) => item.id),
        isDebt: Boolean(editingTransaction.debtRole),
        counterpartyName: editingTransaction.counterpartyName ?? "",
      });
      return;
    }
    setForm(emptyForm(defaultCurrency));
  }, [transactionModalOpen, editingTransaction, defaultCurrency]);

  const canSave = useMemo(() => {
    if (!form.amount || Number(form.amount) <= 0) {
      return false;
    }
    if (form.isDebt && !form.counterpartyName.trim()) {
      return false;
    }
    return true;
  }, [form]);

  function resetKeepOpen() {
    const currency = form.currency || defaultCurrency;
    const occurredAt = form.occurredAt;
    setForm({
      ...emptyForm(currency),
      occurredAt,
    });
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!canSave) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: transactionType,
        originalAmount: form.amount,
        inputCurrency: form.currency,
        title: form.title.trim() || null,
        occurredAt: form.occurredAt.toISOString(),
        debtRole: form.isDebt ? debtRole : null,
        counterpartyName: form.isDebt ? form.counterpartyName.trim() : null,
        categoryIds: form.categoryIds,
      };

      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, payload);
        toast.success(t("saved"));
        closeTransactionModal();
      } else {
        await createTransaction({
          ...payload,
          idempotencyKey: uuidv4(),
        });
        toast.success(t("saved"));
        resetKeepOpen();
      }
      window.dispatchEvent(new CustomEvent("paytracker:transactions-changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={transactionModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeTransactionModal();
        }
      }}
    >
      <ResponsiveDialogContent showCloseButton>
        <ResponsiveDialogHeader>
          <ResponsiveDialogHeaderInner>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {modalTitle}
            </DialogTitle>
          </ResponsiveDialogHeaderInner>
          {!isEditing ? (
            <div className="px-4 pt-3 pb-3 sm:px-5">
              <Tabs
                className="w-full"
                value={transactionFormMode}
                onValueChange={(value) => {
                  if (
                    value === TransactionFormMode.Spending ||
                    value === TransactionFormMode.Earning
                  ) {
                    setTransactionFormMode(value);
                    setForm((prev) => ({
                      ...prev,
                      categoryIds: [],
                      isDebt: false,
                      counterpartyName: "",
                    }));
                  }
                }}
              >
                <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl p-1.5">
                  <TabsTrigger
                    value={TransactionFormMode.Spending}
                    className="h-full rounded-lg px-4 text-base font-medium"
                  >
                    {t("spending")}
                  </TabsTrigger>
                  <TabsTrigger
                    value={TransactionFormMode.Earning}
                    className="h-full rounded-lg px-4 text-base font-medium"
                  >
                    {t("earning")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          ) : (
            <div className="pb-3" />
          )}
        </ResponsiveDialogHeader>

        <ResponsiveDialogBody ref={bodyRef}>
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("title")}</Label>
            <Input
              className="h-12 rounded-xl text-base md:h-11"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("amount")}</Label>
            <div className="flex items-stretch gap-2">
              <AmountInput
                className="h-12 flex-1 rounded-xl text-base md:h-11"
                value={form.amount}
                onValueChange={(amount) =>
                  setForm((prev) => ({ ...prev, amount }))
                }
              />
              <CurrencySelect
                value={form.currency}
                onChange={(currency) =>
                  setForm((prev) => ({ ...prev, currency }))
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">{t("date")}</Label>
            <DateTimePicker
              value={form.occurredAt}
              coverLabel={
                selectedChipId
                  ? formatReadableDate(form.occurredAt)
                  : null
              }
              onChange={(occurredAt) => {
                setSelectedChipId(null);
                setForm((prev) => ({ ...prev, occurredAt }));
              }}
            />
            <DateQuickChips
              selectedId={selectedChipId}
              onSelect={(date, chipId) => {
                setSelectedChipId(chipId);
                setForm((prev) => ({
                  ...prev,
                  occurredAt: date,
                }));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("categories")}</Label>
            <CategoryChipPicker
              type={transactionType}
              selectedIds={form.categoryIds}
              onChange={(categoryIds) =>
                setForm((prev) => ({ ...prev, categoryIds }))
              }
            />
          </div>

          <div
            className="grid items-start gap-2 transition-[grid-template-columns] duration-300 ease-out"
            style={{
              gridTemplateColumns: form.isDebt
                ? "minmax(0,1fr) minmax(0,3fr)"
                : "minmax(0,1fr) 0fr",
            }}
          >
            <label
              className={cn(
                "flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border border-border/60 px-3 text-base md:min-h-11",
                "transition-colors duration-300",
                form.isDebt && "bg-muted/30",
              )}
            >
              <Checkbox
                className="size-5 shrink-0"
                checked={form.isDebt}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({
                    ...prev,
                    isDebt: checked === true,
                    counterpartyName:
                      checked === true ? prev.counterpartyName : "",
                  }))
                }
              />
              <span className="truncate">
                {transactionFormMode === TransactionFormMode.Spending
                  ? t("toLend")
                  : t("toBorrow")}
              </span>
            </label>
            <div
              className={cn(
                "min-w-0 overflow-hidden transition-[opacity,transform] duration-300 ease-out",
                form.isDebt
                  ? "translate-x-0 opacity-100"
                  : "pointer-events-none translate-x-2 opacity-0",
              )}
              aria-hidden={!form.isDebt}
            >
              <CounterpartyAutocomplete
                debtRole={debtRole}
                value={form.counterpartyName}
                inactive={!form.isDebt}
                onChange={(counterpartyName) =>
                  setForm((prev) => ({ ...prev, counterpartyName }))
                }
                placeholder={
                  transactionFormMode === TransactionFormMode.Spending
                    ? t("borrower")
                    : t("lender")
                }
                className="w-full"
              />
            </div>
          </div>
        </ResponsiveDialogBody>

        <ResponsiveDialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            onClick={closeTransactionModal}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            className="h-12 w-full rounded-xl text-base sm:w-auto md:h-10"
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
