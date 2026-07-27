"use client";

import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";

import { IosCalendar } from "@/features/transactions/ios-calendar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  isCustomDatePreset,
  type DateFilterPreset,
  type RollingRangeUnit,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filter.types";
import {
  CALENDAR_OPTIONS,
  cloneFilterState,
  formatCustomPeriodLabel,
  parseDateKey,
  parseRollingCount,
  toDateKey,
  toggleValue,
  useFilterCategories,
  useFilterCounterparties,
} from "@/features/transactions/use-transaction-filter-data";
import {
  categoryBarClass,
  categoryTypeTextClass,
} from "@/lib/category-chart-style";
import { cn } from "@/lib/utils";
import { DateRangeType, TransactionKind, TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

type MobileTransactionFiltersSheetProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly pageType?: TransactionType;
  readonly value: TransactionFilterState;
  readonly onChange: (value: TransactionFilterState) => void;
};

export function MobileTransactionFiltersSheet({
  open,
  onOpenChange,
  pageType,
  value,
  onChange,
}: MobileTransactionFiltersSheetProps) {
  const t = useTranslations("transaction");
  const tDate = useTranslations("dateRange");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const dateLocale = locale.startsWith("ru") ? ru : enUS;

  const [draft, setDraft] = useState(() => cloneFilterState(value));
  const [days, setDays] = useState("7");
  const [months, setMonths] = useState("3");
  const [years, setYears] = useState("2");
  const [customExpanded, setCustomExpanded] = useState(
    isCustomDatePreset(value.datePreset),
  );
  const [draftRolling, setDraftRolling] = useState<{
    unit: RollingRangeUnit;
    n: number;
  } | null>(
    value.datePreset.kind === "rolling"
      ? { unit: value.datePreset.unit, n: value.datePreset.n }
      : null,
  );
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    value.datePreset.kind === "absolute"
      ? {
          from: parseDateKey(value.datePreset.startDate),
          to: parseDateKey(value.datePreset.endDate),
        }
      : undefined,
  );
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [pickerDraft, setPickerDraft] = useState<DateRange | undefined>();
  const wasOpenRef = useRef(false);

  const isCustom = customExpanded || isCustomDatePreset(draft.datePreset);

  const { categories, loading: categoriesLoading } =
    useFilterCategories(pageType);
  const counterparties = useFilterCounterparties();

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = cloneFilterState(value);
      setDraft(next);
      syncCustomPeriodUi(
        next.datePreset,
        setCustomExpanded,
        setDraftRolling,
        setDraftRange,
        setDays,
        setMonths,
        setYears,
      );
    }
    wasOpenRef.current = open;
  }, [open, value]);

  function setDatePreset(datePreset: DateFilterPreset) {
    setDraft((current) => ({ ...current, datePreset }));
  }

  function selectCalendarOption(
    option: (typeof CALENDAR_OPTIONS)[number],
  ) {
    setCustomExpanded(false);
    setDraftRolling(null);
    setDraftRange(undefined);
    if (option === DateRangeType.AllTime) {
      setDatePreset({ kind: "all_time" });
      return;
    }
    setDatePreset({ kind: "calendar", range: option });
  }

  function openCustom() {
    setCustomExpanded(true);
    if (!draftRolling && !draftRange) {
      const n = Number(days) || 7;
      setDraftRolling({ unit: "days", n });
      setDatePreset({ kind: "rolling", unit: "days", n });
    }
  }

  function selectRolling(unit: RollingRangeUnit, raw: string) {
    const parsed = parseRollingCount(raw);
    if (parsed === null) {
      return;
    }
    setDraftRolling({ unit, n: parsed });
    setDraftRange(undefined);
    setDatePreset({ kind: "rolling", unit, n: parsed });
  }

  function updateRollingDraft(
    unit: RollingRangeUnit,
    raw: string,
    setCount: (next: string) => void,
  ) {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setCount(digits);
    selectRolling(unit, digits);
  }

  function openRangePicker() {
    setPickerDraft(draftRange);
    setRangePickerOpen(true);
  }

  function applyRangePicker() {
    if (!pickerDraft?.from || !pickerDraft.to) {
      return;
    }
    setDraftRange(pickerDraft);
    setDraftRolling(null);
    setDatePreset({
      kind: "absolute",
      startDate: toDateKey(pickerDraft.from),
      endDate: toDateKey(pickerDraft.to),
    });
    setRangePickerOpen(false);
  }

  function cancelAndClose() {
    onOpenChange(false);
  }

  function applyAndClose() {
    onChange(cloneFilterState(draft));
    onOpenChange(false);
  }

  const customLabel = useMemo(
    () => formatCustomPeriodLabel(draft.datePreset, t, dateLocale),
    [draft.datePreset, t, dateLocale],
  );

  const rangeFromLabel = draftRange?.from
    ? format(draftRange.from, "d MMM yyyy", { locale: dateLocale })
    : "—";
  const rangeToLabel = draftRange?.to
    ? format(draftRange.to, "d MMM yyyy", { locale: dateLocale })
    : "—";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="h-dvh w-screen max-w-none gap-0 border-l p-0 data-[side=right]:w-screen data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <SheetTitle className="flex-1 text-xl font-semibold tracking-tight">
                {t("filters")}
              </SheetTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                aria-label={tCommon("cancel")}
                onClick={cancelAndClose}
              >
                <X className="size-5" />
              </Button>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
            <FilterSection title={t("filterPeriod")}>
              <div
                role="tablist"
                className="grid h-12 w-full grid-cols-5 rounded-xl bg-muted p-0.5"
              >
                {CALENDAR_OPTIONS.map((option) => {
                  const active =
                    !isCustom &&
                    ((draft.datePreset.kind === "calendar" &&
                      draft.datePreset.range === option) ||
                      (draft.datePreset.kind === "all_time" &&
                        option === DateRangeType.AllTime));
                  return (
                    <button
                      key={option}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => selectCalendarOption(option)}
                      className={segmentClassName(active)}
                    >
                      <span className="truncate text-xs leading-tight">
                        {tDate(option)}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="tab"
                  aria-selected={isCustom}
                  onClick={openCustom}
                  className={segmentClassName(isCustom)}
                >
                  <span className="truncate text-xs leading-tight">
                    {isCustom ? customLabel : t("customPeriod")}
                  </span>
                </button>
              </div>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  customExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-3 pt-3">
                    <RollingRow
                      active={
                        draftRolling?.unit === "days" && !draftRange
                      }
                      value={days}
                      suffix={t("daysSuffix")}
                      ariaLabel={t("lastNDays", { n: days || "…" })}
                      onChange={(next) =>
                        updateRollingDraft("days", next, setDays)
                      }
                      onSelect={() => selectRolling("days", days)}
                    />
                    <RollingRow
                      active={
                        draftRolling?.unit === "months" && !draftRange
                      }
                      value={months}
                      suffix={t("monthsSuffix")}
                      ariaLabel={t("lastNMonths", { n: months || "…" })}
                      onChange={(next) =>
                        updateRollingDraft("months", next, setMonths)
                      }
                      onSelect={() => selectRolling("months", months)}
                    />
                    <RollingRow
                      active={
                        draftRolling?.unit === "years" && !draftRange
                      }
                      value={years}
                      suffix={t("yearsSuffix")}
                      ariaLabel={t("lastNYears", { n: years || "…" })}
                      onChange={(next) =>
                        updateRollingDraft("years", next, setYears)
                      }
                      onSelect={() => selectRolling("years", years)}
                    />

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={openRangePicker}
                        className={cn(
                          "min-h-12 rounded-xl border px-3 py-3 text-left transition-colors",
                          draftRange
                            ? "border-foreground/25 bg-muted/40"
                            : "border-border/60 hover:bg-muted/30",
                        )}
                      >
                        <div className="text-sm text-muted-foreground">
                          {t("rangeFrom")}
                        </div>
                        <div className="mt-1 text-base font-medium tabular-nums">
                          {rangeFromLabel}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={openRangePicker}
                        className={cn(
                          "min-h-12 rounded-xl border px-3 py-3 text-left transition-colors",
                          draftRange
                            ? "border-foreground/25 bg-muted/40"
                            : "border-border/60 hover:bg-muted/30",
                        )}
                      >
                        <div className="text-sm text-muted-foreground">
                          {t("rangeTo")}
                        </div>
                        <div className="mt-1 text-base font-medium tabular-nums">
                          {rangeToLabel}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </FilterSection>

            <FilterSection title={t("filterKind")}>
              <div className="space-y-2">
                <ToggleRow
                  checked={draft.kinds.includes(TransactionKind.Default)}
                  label={t("kindDefault")}
                  onCheckedChange={() =>
                    setDraft((current) => ({
                      ...current,
                      kinds: toggleValue(
                        current.kinds,
                        TransactionKind.Default,
                      ),
                    }))
                  }
                />
                <ToggleRow
                  checked={draft.kinds.includes(TransactionKind.Loan)}
                  label={t("kindLoan")}
                  onCheckedChange={() =>
                    setDraft((current) => ({
                      ...current,
                      kinds: toggleValue(
                        current.kinds,
                        TransactionKind.Loan,
                      ),
                    }))
                  }
                />
                <ToggleRow
                  checked={draft.kinds.includes(TransactionKind.Debt)}
                  label={t("kindDebt")}
                  onCheckedChange={() =>
                    setDraft((current) => ({
                      ...current,
                      kinds: toggleValue(current.kinds, TransactionKind.Debt),
                    }))
                  }
                />
                <ToggleRow
                  checked={draft.kinds.includes(TransactionKind.Refund)}
                  label={t("kindRefund")}
                  onCheckedChange={() =>
                    setDraft((current) => ({
                      ...current,
                      kinds: toggleValue(current.kinds, TransactionKind.Refund),
                    }))
                  }
                />
                <ToggleRow
                  checked={draft.kinds.includes(TransactionKind.Transfer)}
                  label={t("kindTransfer")}
                  onCheckedChange={() =>
                    setDraft((current) => ({
                      ...current,
                      kinds: toggleValue(
                        current.kinds,
                        TransactionKind.Transfer,
                      ),
                    }))
                  }
                />
              </div>
            </FilterSection>

            {counterparties.length > 0 ? (
              <FilterSection title={t("counterparties")}>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {counterparties.map((item) => (
                    <ToggleRow
                      key={item.id}
                      checked={draft.counterpartyIds.includes(item.id)}
                      label={item.name}
                      onCheckedChange={() =>
                        setDraft((current) => ({
                          ...current,
                          counterpartyIds: toggleValue(
                            current.counterpartyIds,
                            item.id,
                          ),
                        }))
                      }
                    />
                  ))}
                </div>
              </FilterSection>
            ) : null}

            <FilterSection title={t("categories")}>
              <CategoriesBlock
                loading={categoriesLoading}
                categories={categories}
                selectedIds={draft.categoryIds}
                onToggle={(categoryId) =>
                  setDraft((current) => ({
                    ...current,
                    categoryIds: toggleValue(current.categoryIds, categoryId),
                  }))
                }
              />
              <div className="mt-4">
                <ToggleRow
                  checked={draft.hideUncategorized}
                  label={t("hideUncategorized")}
                  onCheckedChange={() =>
                    setDraft((current) => ({
                      ...current,
                      hideUncategorized: !current.hideUncategorized,
                    }))
                  }
                />
              </div>
            </FilterSection>
          </div>

          <SheetFooter className="shrink-0 gap-2 border-t bg-muted/50 p-4">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl text-base"
              onClick={cancelAndClose}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base"
              onClick={applyAndClose}
            >
              {tCommon("apply")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-0 left-0 z-60 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0"
        >
          <DialogHeader className="shrink-0 border-b border-border/60 px-4 pt-4 pb-3">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              {t("pickDates")}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <IosCalendar
              mode="range"
              selected={pickerDraft}
              onSelect={setPickerDraft}
              defaultMonth={pickerDraft?.from ?? draftRange?.from}
              className="mx-auto max-w-sm rounded-2xl border border-border/60 p-3"
            />
          </div>
          <DialogFooter className="mt-auto shrink-0 flex-col gap-2 rounded-none border-t bg-muted/50 p-4 max-sm:mx-0 max-sm:mb-0 sm:flex-col">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl text-base"
              onClick={() => setRangePickerOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="h-12 w-full rounded-xl text-base"
              disabled={!pickerDraft?.from || !pickerDraft.to}
              onClick={applyRangePicker}
            >
              {tCommon("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function syncCustomPeriodUi(
  datePreset: DateFilterPreset,
  setCustomExpanded: (value: boolean) => void,
  setDraftRolling: (
    value: { unit: RollingRangeUnit; n: number } | null,
  ) => void,
  setDraftRange: (value: DateRange | undefined) => void,
  setDays: (value: string) => void,
  setMonths: (value: string) => void,
  setYears: (value: string) => void,
) {
  setCustomExpanded(isCustomDatePreset(datePreset));
  if (datePreset.kind === "rolling") {
    setDraftRolling({ unit: datePreset.unit, n: datePreset.n });
    const next = String(datePreset.n);
    if (datePreset.unit === "days") {
      setDays(next);
    } else if (datePreset.unit === "months") {
      setMonths(next);
    } else {
      setYears(next);
    }
    setDraftRange(undefined);
    return;
  }
  if (datePreset.kind === "absolute") {
    setDraftRolling(null);
    setDraftRange({
      from: parseDateKey(datePreset.startDate),
      to: parseDateKey(datePreset.endDate),
    });
    return;
  }
  setDraftRolling(null);
  setDraftRange(undefined);
}

function FilterSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-medium tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function CategoriesBlock({
  loading,
  categories,
  selectedIds,
  onToggle,
}: {
  readonly loading: boolean;
  readonly categories: TransactionCategoryDto[];
  readonly selectedIds: string[];
  readonly onToggle: (categoryId: string) => void;
}) {
  const tCategories = useTranslations("categories");

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton
            key={`category-skeleton-${index}`}
            className="h-12 w-full rounded-xl"
          />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="px-1 text-base text-muted-foreground">
        {tCategories("empty")}
      </p>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto">
      {treeCategories(categories).map((category) => (
        <ToggleRow
          key={category.id}
          checked={selectedIds.includes(category.id)}
          label={category.title}
          indent={category.depth}
          indicatorClassName={categoryBarClass(category.type)}
          labelClassName={categoryTypeTextClass(category.type)}
          onCheckedChange={() => onToggle(category.id)}
        />
      ))}
    </div>
  );
}

function segmentClassName(active: boolean): string {
  return cn(
    "inline-flex h-full min-w-0 cursor-pointer items-center justify-center rounded-lg px-1 text-sm font-medium transition-all",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-foreground/60 hover:text-foreground",
  );
}

function ToggleRow({
  checked,
  label,
  labelClassName,
  indicatorClassName,
  indent = 0,
  onCheckedChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly labelClassName?: string;
  readonly indicatorClassName?: string;
  readonly indent?: number;
  readonly onCheckedChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 px-3 text-base",
        "transition-colors hover:bg-muted/40",
        checked && "bg-muted/30",
      )}
      style={{ paddingLeft: `${0.75 + indent * 1}rem` }}
    >
      <Checkbox
        className="size-5 shrink-0"
        checked={checked}
        onCheckedChange={() => onCheckedChange()}
      />
      {indicatorClassName ? (
        <span
          className={cn("size-2.5 shrink-0 rounded-full", indicatorClassName)}
          aria-hidden
        />
      ) : null}
      <span className={cn("min-w-0 flex-1 truncate", labelClassName)}>
        {label}
      </span>
    </label>
  );
}

function treeCategories(
  categories: TransactionCategoryDto[],
): Array<TransactionCategoryDto & { depth: number }> {
  const byParent = new Map<string | null, TransactionCategoryDto[]>();
  for (const category of categories) {
    const siblings = byParent.get(category.parentCategoryId) ?? [];
    siblings.push(category);
    byParent.set(category.parentCategoryId, siblings);
  }
  const result: Array<TransactionCategoryDto & { depth: number }> = [];
  function visit(parentId: string | null, depth: number) {
    for (const category of byParent.get(parentId) ?? []) {
      result.push({ ...category, depth });
      visit(category.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}

function RollingRow({
  active,
  value,
  suffix,
  ariaLabel,
  onChange,
  onSelect,
}: {
  readonly active: boolean;
  readonly value: string;
  readonly suffix: string;
  readonly ariaLabel: string;
  readonly onChange: (value: string) => void;
  readonly onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left text-base transition-colors",
        active
          ? "border-foreground/20 bg-muted/50"
          : "border-border/60 hover:bg-muted/30",
      )}
    >
      <input
        inputMode="numeric"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        className="h-8 w-12 border-0 border-b border-current/50 bg-transparent p-0 text-center text-base font-semibold tabular-nums outline-none"
      />
      <span className="text-muted-foreground">{suffix}</span>
    </button>
  );
}
