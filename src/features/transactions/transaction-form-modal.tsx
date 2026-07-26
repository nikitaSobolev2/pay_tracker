"use client";

import { Equal, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";

import { AmountInput } from "@/components/ui/amount-input";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryChipPicker } from "@/features/transactions/category-chip-picker";
import { CounterpartyAutocomplete } from "@/features/transactions/counterparty-autocomplete";
import { CurrencySelect } from "@/features/transactions/currency-select";
import {
  DateQuickChips,
  type DateQuickChipId,
} from "@/features/transactions/date-quick-chips";
import { DateTimePicker } from "@/features/transactions/date-time-picker";
import { TitleTransactionSuggestions } from "@/features/transactions/title-transaction-suggestions";
import { useAppUser } from "@/hooks/use-app-user";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  evaluateAmountExpression,
  looksLikeAmountExpression,
} from "@/lib/amount-expression";
import { normalizeAmountRaw } from "@/lib/amount-input";
import { listCategories } from "@/lib/api/categories";
import {
  listCounterparties,
  type CounterpartyDto,
} from "@/lib/api/counterparties";
import {
  createTransaction,
  updateTransaction,
} from "@/lib/api/transactions";
import { matchCategoriesByTitle } from "@/lib/category-title-match";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui.store";
import {
  TransactionFormMode,
  TransactionKind,
  TransactionType,
} from "@/types/enums";
import type { TransactionCategoryDto, TransactionDto } from "@/types/transaction";

type FormState = {
  amount: string;
  currency: string;
  title: string;
  occurredAt: Date;
  categoryIds: string[];
  kind: TransactionKind;
  counterpartyName: string;
};

function emptyForm(currency: string): FormState {
  return {
    amount: "",
    currency,
    title: "",
    occurredAt: new Date(),
    categoryIds: [],
    kind: TransactionKind.Default,
    counterpartyName: "",
  };
}

function spendingKinds(): TransactionKind[] {
  return [TransactionKind.Default, TransactionKind.Loan];
}

function earningKinds(): TransactionKind[] {
  return [
    TransactionKind.Default,
    TransactionKind.Debt,
    TransactionKind.Refund,
  ];
}

function kindNeedsCounterparty(kind: TransactionKind): boolean {
  return kind === TransactionKind.Loan || kind === TransactionKind.Debt;
}

type SuggestionOwnedFields = {
  amount: boolean;
  categoryIds: boolean;
  kind: boolean;
  counterpartyName: boolean;
};

const EMPTY_SUGGESTION_OWNED: SuggestionOwnedFields = {
  amount: false,
  categoryIds: false,
  kind: false,
  counterpartyName: false,
};

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
  const [categoriesManual, setCategoriesManual] = useState(false);
  const [suggestionOwned, setSuggestionOwned] = useState<SuggestionOwnedFields>(
    EMPTY_SUGGESTION_OWNED,
  );
  const [availableCategories, setAvailableCategories] = useState<
    TransactionCategoryDto[]
  >([]);
  const [categoriesReady, setCategoriesReady] = useState(false);
  const [counterparties, setCounterparties] = useState<CounterpartyDto[]>([]);
  const [counterpartiesReady, setCounterpartiesReady] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);
  const debouncedTitle = useDebouncedValue(form.title, 200);

  const transactionType =
    transactionFormMode === TransactionFormMode.Spending
      ? TransactionType.Spending
      : TransactionType.Earning;

  const isEditing = Boolean(editingTransaction);
  const modalTitle = isEditing ? tCommon("edit") : t("addNewTransaction");
  const editNeedsCounterparty =
    isEditing &&
    editingTransaction != null &&
    kindNeedsCounterparty(editingTransaction.kind);
  const formReady =
    !isEditing || (categoriesReady && counterpartiesReady);

  const kindOptions =
    transactionFormMode === TransactionFormMode.Spending
      ? spendingKinds()
      : earningKinds();

  useEffect(() => {
    if (!transactionModalOpen) {
      return;
    }
    setSelectedChipId(null);
    setCategoriesManual(false);
    setSuggestionOwned(EMPTY_SUGGESTION_OWNED);
    if (editingTransaction) {
      setForm({
        amount: normalizeAmountRaw(editingTransaction.originalAmount),
        currency: editingTransaction.inputCurrency,
        title: editingTransaction.title ?? "",
        occurredAt: new Date(editingTransaction.occurredAt),
        categoryIds: editingTransaction.categories.map((item) => item.id),
        kind: editingTransaction.kind,
        counterpartyName: editingTransaction.counterpartyName ?? "",
      });
      setCategoriesManual(true);
      return;
    }
    setForm(emptyForm(defaultCurrency));
  }, [transactionModalOpen, editingTransaction, defaultCurrency]);

  useEffect(() => {
    if (!transactionModalOpen) {
      setAvailableCategories([]);
      setCategoriesReady(false);
      return;
    }
    let cancelled = false;
    setCategoriesReady(false);
    void listCategories(transactionType).then((result) => {
      if (!cancelled) {
        setAvailableCategories(result.categories);
        setCategoriesReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [transactionModalOpen, transactionType]);

  useEffect(() => {
    if (!transactionModalOpen || !editNeedsCounterparty || !editingTransaction) {
      setCounterparties([]);
      setCounterpartiesReady(true);
      return;
    }
    let cancelled = false;
    setCounterpartiesReady(false);
    void listCounterparties({ kind: editingTransaction.kind }).then(
      (result) => {
        if (!cancelled) {
          setCounterparties(result.counterparties);
          setCounterpartiesReady(true);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [editNeedsCounterparty, editingTransaction, transactionModalOpen]);

  useEffect(() => {
    if (!transactionModalOpen || categoriesManual || isEditing) {
      return;
    }
    if (!debouncedTitle.trim() || form.categoryIds.length > 0) {
      return;
    }
    const matched = matchCategoriesByTitle(
      debouncedTitle,
      availableCategories,
    );
    if (matched.length === 0) {
      return;
    }
    setForm((prev) =>
      prev.categoryIds.length > 0
        ? prev
        : { ...prev, categoryIds: matched },
    );
  }, [
    availableCategories,
    categoriesManual,
    debouncedTitle,
    form.categoryIds.length,
    isEditing,
    transactionModalOpen,
  ]);

  const canSave = useMemo(() => {
    if (!form.amount || Number(form.amount) <= 0) {
      return false;
    }
    if (
      kindNeedsCounterparty(form.kind) &&
      !form.counterpartyName.trim()
    ) {
      return false;
    }
    return true;
  }, [form]);

  function resetKeepOpen() {
    const currency = form.currency || defaultCurrency;
    const occurredAt = form.occurredAt;
    setCategoriesManual(false);
    setSuggestionOwned(EMPTY_SUGGESTION_OWNED);
    setForm({
      ...emptyForm(currency),
      occurredAt,
    });
    bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function switchToSpendingPreservingFields() {
    setTransactionFormMode(TransactionFormMode.Spending);
    setCategoriesManual(false);
    setSuggestionOwned((prev) => ({
      ...prev,
      kind: false,
      categoryIds: false,
      counterpartyName: false,
    }));
    setForm((prev) => ({
      ...prev,
      kind: TransactionKind.Default,
      categoryIds: [],
      counterpartyName: "",
    }));
  }

  function applyAmountValue(raw: string) {
    setSuggestionOwned((prev) => ({ ...prev, amount: false }));
    const trimmed = raw.trim();
    if (trimmed.startsWith("-") && trimmed !== "-") {
      const absolute = normalizeAmountRaw(trimmed.replace(/^-/, ""));
      if (
        transactionFormMode === TransactionFormMode.Earning &&
        absolute &&
        Number(absolute) > 0
      ) {
        setForm((prev) => ({ ...prev, amount: absolute }));
        switchToSpendingPreservingFields();
        return;
      }
    }
    setForm((prev) => ({ ...prev, amount: raw }));
  }

  function evaluateAmount() {
    setSuggestionOwned((prev) => ({ ...prev, amount: false }));
    const result = evaluateAmountExpression(form.amount);
    if (result === null) {
      toast.error(t("amountExpressionInvalid"));
      return;
    }
    if (result < 0) {
      const absolute = normalizeAmountRaw(String(Math.abs(result)));
      setForm((prev) => ({ ...prev, amount: absolute }));
      if (transactionFormMode === TransactionFormMode.Earning) {
        switchToSpendingPreservingFields();
      }
      return;
    }
    setForm((prev) => ({
      ...prev,
      amount: normalizeAmountRaw(String(result)),
    }));
  }

  function applySuggestion(transaction: TransactionDto) {
    const takeAmount =
      suggestionOwned.amount || !form.amount.trim();
    const takeCategories =
      suggestionOwned.categoryIds || form.categoryIds.length === 0;
    const takeKind = suggestionOwned.kind || form.kind === TransactionKind.Default;
    const takeCounterparty =
      suggestionOwned.counterpartyName || !form.counterpartyName.trim();

    const nextKind =
      takeKind && kindOptions.includes(transaction.kind)
        ? transaction.kind
        : form.kind;
    const nextCategories = takeCategories
      ? transaction.categories.map((item) => item.id)
      : form.categoryIds;
    const nextCounterparty = takeCounterparty
      ? kindNeedsCounterparty(nextKind)
        ? (transaction.counterpartyName ?? "")
        : ""
      : form.counterpartyName;

    setForm((prev) => ({
      ...prev,
      title: transaction.title ?? prev.title,
      amount: takeAmount
        ? normalizeAmountRaw(transaction.originalAmount)
        : prev.amount,
      categoryIds: nextCategories,
      kind: nextKind,
      counterpartyName: nextCounterparty,
    }));
    setSuggestionOwned({
      amount: takeAmount,
      categoryIds: takeCategories,
      kind: takeKind && kindOptions.includes(transaction.kind),
      counterpartyName:
        takeCounterparty && kindNeedsCounterparty(nextKind),
    });
    if (takeCategories) {
      setCategoriesManual(true);
    }
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
        kind: form.kind,
        counterpartyName: kindNeedsCounterparty(form.kind)
          ? form.counterpartyName.trim()
          : null,
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

  function kindLabel(kind: TransactionKind): string {
    if (kind === TransactionKind.Loan) {
      return t("kindLoan");
    }
    if (kind === TransactionKind.Debt) {
      return t("kindDebt");
    }
    if (kind === TransactionKind.Refund) {
      return t("kindRefund");
    }
    return t("kindDefault");
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
      <ResponsiveDialogContent
        showCloseButton
        data-transaction-form=""
      >
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
                    setCategoriesManual(false);
                    setForm((prev) => ({
                      ...prev,
                      categoryIds: [],
                      kind: TransactionKind.Default,
                      counterpartyName: "",
                    }));
                  }
                }}
              >
                <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl p-1.5 md:h-14 md:w-full md:rounded-xl md:p-1.5">
                  <TabsTrigger
                    value={TransactionFormMode.Spending}
                    className="h-full rounded-lg px-4 text-base font-medium md:rounded-lg md:px-4 md:py-2 md:text-base"
                  >
                    {t("spending")}
                  </TabsTrigger>
                  <TabsTrigger
                    value={TransactionFormMode.Earning}
                    className="h-full rounded-lg px-4 text-base font-medium md:rounded-lg md:px-4 md:py-2 md:text-base"
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
          {!formReady ? (
            <TransactionFormSkeleton
              showCounterparty={editNeedsCounterparty}
            />
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("amount")}</Label>
                <div className="flex items-stretch gap-2">
                  <AmountInput
                    className="h-12 flex-1 rounded-xl text-base md:h-11"
                    value={form.amount}
                    allowExpression
                    onValueChange={applyAmountValue}
                  />
                  {looksLikeAmountExpression(form.amount) ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 shrink-0 rounded-xl md:h-11"
                      onClick={evaluateAmount}
                      aria-label={t("evaluateAmount")}
                    >
                      <Equal className="size-5" />
                    </Button>
                  ) : null}
                  <CurrencySelect
                    value={form.currency}
                    onChange={(currency) => {
                      setForm((prev) => ({ ...prev, currency }));
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("title")}</Label>
                <Input
                  className="h-12 rounded-xl text-base md:h-11"
                  value={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                />
                <TitleTransactionSuggestions
                  query={form.title}
                  type={transactionType}
                  enabled={transactionModalOpen && !isEditing}
                  onApply={applySuggestion}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("filterKind")}</Label>
                <Select
                  value={form.kind}
                  onValueChange={(value) => {
                    const kind = value as TransactionKind;
                    setSuggestionOwned((prev) => ({
                      ...prev,
                      kind: false,
                      counterpartyName: kindNeedsCounterparty(kind)
                        ? prev.counterpartyName
                        : false,
                    }));
                    setForm((prev) => ({
                      ...prev,
                      kind,
                      counterpartyName: kindNeedsCounterparty(kind)
                        ? prev.counterpartyName
                        : "",
                    }));
                  }}
                >
                  <SelectTrigger className="h-12 w-full rounded-xl text-base md:h-11 md:rounded-xl md:text-base md:data-[size=default]:h-11">
                    <SelectValue>{kindLabel(form.kind)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {kindOptions.map((kind) => (
                      <SelectItem
                        key={kind}
                        value={kind}
                        className="text-base sm:text-base"
                      >
                        {kindLabel(kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300",
                  kindNeedsCounterparty(form.kind)
                    ? "grid-rows-[1fr] opacity-100"
                    : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-2 pb-1">
                    <Label className="text-sm font-medium">
                      {form.kind === TransactionKind.Loan
                        ? t("borrower")
                        : t("lender")}
                    </Label>
                    <CounterpartyAutocomplete
                      kind={form.kind}
                      value={form.counterpartyName}
                      inactive={!kindNeedsCounterparty(form.kind)}
                      chips={
                        editNeedsCounterparty ? counterparties : undefined
                      }
                      onChange={(counterpartyName) => {
                        setSuggestionOwned((prev) => ({
                          ...prev,
                          counterpartyName: false,
                        }));
                        setForm((prev) => ({ ...prev, counterpartyName }));
                      }}
                      placeholder={
                        form.kind === TransactionKind.Loan
                          ? t("borrower")
                          : t("lender")
                      }
                      className="w-full"
                    />
                  </div>
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
                  categories={availableCategories}
                  onCategoriesChange={setAvailableCategories}
                  onChange={(categoryIds) => {
                    setCategoriesManual(true);
                    setSuggestionOwned((prev) => ({
                      ...prev,
                      categoryIds: false,
                    }));
                    setForm((prev) => ({ ...prev, categoryIds }));
                  }}
                />
              </div>
            </>
          )}
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
            disabled={!formReady || !canSave || saving}
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

function TransactionFormSkeleton({
  showCounterparty,
}: {
  readonly showCounterparty: boolean;
}) {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-28 shrink-0 rounded-xl" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
      {showCounterparty ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-16 rounded-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  );
}
