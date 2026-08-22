"use client";

import { format } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import type { DateRange } from "react-day-picker";

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
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IosCalendar } from "@/features/transactions/ios-calendar";
import {
  DEFAULT_TRANSACTION_FILTERS,
  filtersAreDefault,
  isCustomDatePreset,
  type DateFilterPreset,
  type RollingRangeUnit,
  type TransactionFilterState,
} from "@/features/transactions/transaction-filter.types";
import {
  TransactionTypeSelect,
  type TransactionTypeFilter,
} from "@/features/transactions/transaction-type-switcher";
import {
  CALENDAR_OPTIONS,
  formatCustomPeriodLabel,
  parseDateKey,
  parseRollingCount,
  toDateKey,
  toggleValue,
  useFilterCategories,
  useFilterCounterparties,
} from "@/features/transactions/use-transaction-filter-data";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  categoryBarClass,
  categoryTypeTextClass,
} from "@/lib/category-chart-style";
import { cn } from "@/lib/utils";
import { DateRangeType, TransactionKind, TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

export type { TransactionFilterState } from "@/features/transactions/transaction-filter.types";
export { DEFAULT_TRANSACTION_FILTERS } from "@/features/transactions/transaction-filter.types";

const KIND_FILTER_ALL = "all";

const KIND_FILTER_OPTIONS = [
  TransactionKind.Default,
  TransactionKind.Loan,
  TransactionKind.Debt,
  TransactionKind.Refund,
  TransactionKind.Transfer,
  TransactionKind.Forgive,
] as const;

type TransactionFiltersProps = {
  readonly pageType?: TransactionType;
  readonly value: TransactionFilterState;
  readonly onChange: (value: TransactionFilterState) => void;
  readonly typeFilter?: TransactionTypeFilter;
  readonly onTypeFilterChange?: (value: TransactionTypeFilter) => void;
};

type CustomDraftMode = "rolling" | "absolute";

type RollingDraft = {
  readonly unit: RollingRangeUnit;
  readonly n: number;
};

export function TransactionFiltersSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <Skeleton className="hidden h-11 w-36 shrink-0 rounded-xl md:block" />
        <Skeleton className="h-11 w-full min-w-0 flex-1 rounded-xl" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-24 rounded-full sm:h-9" />
        <Skeleton className="h-10 w-28 rounded-full sm:h-9" />
        <Skeleton className="h-10 w-32 rounded-full sm:h-9" />
        <Skeleton className="ml-auto hidden h-9 w-20 rounded-full md:block" />
      </div>
    </div>
  );
}

export function TransactionFilters({
  pageType,
  value,
  onChange,
  typeFilter,
  onTypeFilterChange,
}: TransactionFiltersProps) {
  const t = useTranslations("transaction");
  const tDate = useTranslations("dateRange");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const dateLocale = locale.startsWith("ru") ? ru : enUS;
  const isMobile = useIsMobile();

  const [days, setDays] = useState("7");
  const [months, setMonths] = useState("3");
  const [years, setYears] = useState("2");
  const [customOpen, setCustomOpen] = useState(false);
  const [draftMode, setDraftMode] = useState<CustomDraftMode>("rolling");
  const [draftRolling, setDraftRolling] = useState<RollingDraft | null>(null);
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();

  const isDefault = filtersAreDefault(value);
  const isCustom = isCustomDatePreset(value.datePreset);

  const { categories, loading: categoriesLoading } =
    useFilterCategories(pageType);
  const counterparties = useFilterCounterparties();

  useEffect(() => {
    if (value.datePreset.kind !== "rolling") {
      return;
    }
    const next = String(value.datePreset.n);
    if (value.datePreset.unit === "days") {
      setDays(next);
    } else if (value.datePreset.unit === "months") {
      setMonths(next);
    } else {
      setYears(next);
    }
  }, [value.datePreset]);

  useEffect(() => {
    if (!customOpen) {
      return;
    }
    if (value.datePreset.kind === "absolute") {
      setDraftMode("absolute");
      setDraftRolling(null);
      setDraftRange({
        from: parseDateKey(value.datePreset.startDate),
        to: parseDateKey(value.datePreset.endDate),
      });
      return;
    }
    if (value.datePreset.kind === "rolling") {
      setDraftMode("rolling");
      setDraftRolling({
        unit: value.datePreset.unit,
        n: value.datePreset.n,
      });
      setDraftRange(undefined);
      return;
    }
    setDraftMode("rolling");
    setDraftRolling({ unit: "days", n: 7 });
    setDraftRange(undefined);
  }, [customOpen, value.datePreset]);

  function setDatePreset(datePreset: DateFilterPreset) {
    onChange({ ...value, datePreset });
  }

  function selectRollingDraft(unit: RollingRangeUnit, raw: string) {
    const parsed = parseRollingCount(raw);
    if (parsed === null) {
      return;
    }
    setDraftMode("rolling");
    setDraftRolling({ unit, n: parsed });
    setDraftRange(undefined);
  }

  function updateRollingDraft(
    unit: RollingRangeUnit,
    raw: string,
    setDraft: (next: string) => void,
  ) {
    const digits = raw.replace(/\D/g, "").slice(0, 3);
    setDraft(digits);
    selectRollingDraft(unit, digits);
  }

  function selectAbsoluteDraft(range: DateRange | undefined) {
    setDraftMode("absolute");
    setDraftRolling(null);
    setDraftRange(range);
  }

  function applyCustomDraft() {
    if (draftMode === "rolling" && draftRolling) {
      setDatePreset({
        kind: "rolling",
        unit: draftRolling.unit,
        n: draftRolling.n,
      });
      setCustomOpen(false);
      return;
    }
    if (draftMode === "absolute" && draftRange?.from && draftRange.to) {
      setDatePreset({
        kind: "absolute",
        startDate: toDateKey(draftRange.from),
        endDate: toDateKey(draftRange.to),
      });
      setCustomOpen(false);
    }
  }

  const canApplyCustom =
    (draftMode === "rolling" && draftRolling != null) ||
    (draftMode === "absolute" &&
      Boolean(draftRange?.from && draftRange.to));

  const customLabel = formatCustomPeriodLabel(value.datePreset, t, dateLocale);

  const kindLabel =
    value.kinds.length === 0
      ? tNav("all")
      : kindOptionLabel(value.kinds[0]!, t);

  const selectedCategoryTitles = categories
    .filter((category) => value.categoryIds.includes(category.id))
    .map((category) => category.title);
  const categoriesLabel = categoriesChipLabel(selectedCategoryTitles, t);

  const rangeFromLabel = draftRange?.from
    ? format(draftRange.from, "d MMM yyyy", { locale: dateLocale })
    : "—";
  const rangeToLabel = draftRange?.to
    ? format(draftRange.to, "d MMM yyyy", { locale: dateLocale })
    : "—";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {typeFilter != null && onTypeFilterChange ? (
          <TransactionTypeSelect
            className="h-11 shrink-0 max-md:hidden"
            value={typeFilter}
            onChange={onTypeFilterChange}
          />
        ) : null}
        <div
          role="tablist"
          aria-label={t("filterPeriod")}
          className="grid h-11 w-full min-w-0 flex-1 grid-cols-5 rounded-xl bg-muted p-0.5"
        >
          {CALENDAR_OPTIONS.map((option) => {
            const active =
              !isCustom &&
              ((value.datePreset.kind === "calendar" &&
                value.datePreset.range === option) ||
                (value.datePreset.kind === "all_time" &&
                  option === DateRangeType.AllTime));
            return (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  if (option === DateRangeType.AllTime) {
                    setDatePreset({ kind: "all_time" });
                    return;
                  }
                  setDatePreset({ kind: "calendar", range: option });
                }}
                className={periodSegmentClassName(active)}
              >
                <span className="truncate">{tDate(option)}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="tab"
            aria-selected={isCustom}
            onClick={() => setCustomOpen(true)}
            className={periodSegmentClassName(isCustom)}
          >
            <span className="truncate">{customLabel}</span>
          </button>
        </div>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent
          showCloseButton={!isMobile}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            "max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:w-screen max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0",
            "sm:max-w-2xl sm:gap-4 sm:p-4",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border/50 px-4 py-3 sm:border-0 sm:p-0">
            <DialogTitle>{t("customPeriodTitle")}</DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-0 sm:py-0">
            <div className="space-y-2">
              <RollingRow
                active={
                  draftMode === "rolling" && draftRolling?.unit === "days"
                }
                value={days}
                suffix={t("daysSuffix")}
                ariaLabel={t("lastNDays", { n: days || "…" })}
                onChange={(next) => updateRollingDraft("days", next, setDays)}
                onSelect={() => selectRollingDraft("days", days)}
              />
              <RollingRow
                active={
                  draftMode === "rolling" && draftRolling?.unit === "months"
                }
                value={months}
                suffix={t("monthsSuffix")}
                ariaLabel={t("lastNMonths", { n: months || "…" })}
                onChange={(next) =>
                  updateRollingDraft("months", next, setMonths)
                }
                onSelect={() => selectRollingDraft("months", months)}
              />
              <RollingRow
                active={
                  draftMode === "rolling" && draftRolling?.unit === "years"
                }
                value={years}
                suffix={t("yearsSuffix")}
                ariaLabel={t("lastNYears", { n: years || "…" })}
                onChange={(next) => updateRollingDraft("years", next, setYears)}
                onSelect={() => selectRollingDraft("years", years)}
              />
            </div>

            <div className="space-y-3 border-t border-border/50 pt-3">
              <p className="text-sm font-medium">{t("pickDates")}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div
                  className={cn(
                    "rounded-xl bg-muted/40 px-3 py-2",
                    draftMode === "absolute" && "ring-1 ring-foreground/20",
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {t("rangeFrom")}
                  </div>
                  <div className="mt-0.5 font-medium tabular-nums">
                    {rangeFromLabel}
                  </div>
                </div>
                <div
                  className={cn(
                    "rounded-xl bg-muted/40 px-3 py-2",
                    draftMode === "absolute" && "ring-1 ring-foreground/20",
                  )}
                >
                  <div className="text-xs text-muted-foreground">
                    {t("rangeTo")}
                  </div>
                  <div className="mt-0.5 font-medium tabular-nums">
                    {rangeToLabel}
                  </div>
                </div>
              </div>
              <IosCalendar
                mode="range"
                selected={draftMode === "absolute" ? draftRange : undefined}
                onSelect={selectAbsoluteDraft}
                defaultMonth={draftRange?.from}
                className="mx-auto max-w-md rounded-2xl border border-border/60 p-3"
              />
            </div>
          </div>

          <DialogFooter className="mt-auto shrink-0 rounded-none border-t max-sm:mx-0 max-sm:mb-0 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="max-sm:h-11"
              onClick={() => setCustomOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="max-sm:h-11"
              disabled={!canApplyCustom}
              onClick={applyCustomDraft}
            >
              {tCommon("apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2">
        {categoriesLoading ? (
          <>
            <Skeleton className="h-10 w-24 rounded-full sm:h-9" />
            <Skeleton className="h-10 w-28 rounded-full sm:h-9" />
            <Skeleton className="h-10 w-32 rounded-full sm:h-9" />
          </>
        ) : (
          <>
            <Select
              value={value.kinds[0] ?? KIND_FILTER_ALL}
              onValueChange={(next) => {
                if (next == null || String(next) === KIND_FILTER_ALL) {
                  onChange({ ...value, kinds: [] });
                  return;
                }
                onChange({
                  ...value,
                  kinds: [next as TransactionKind],
                });
              }}
            >
              <SelectTrigger
                className={cn(
                  "h-11 w-auto min-w-36 rounded-xl border-border/70 bg-card/60 px-3.5 text-sm",
                  value.kinds.length > 0 && "border-foreground/40",
                )}
                aria-label={t("filterKind")}
              >
                <SelectValue>
                  {() => (
                    <span className="truncate">
                      {t("filterKind")}: {kindLabel}
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="start" className="min-w-48">
                <SelectItem value={KIND_FILTER_ALL} className="text-base sm:text-base">
                  {tNav("all")}
                </SelectItem>
                {KIND_FILTER_OPTIONS.map((kind) => (
                  <SelectItem
                    key={kind}
                    value={kind}
                    className="text-base sm:text-base"
                  >
                    {kindOptionLabel(kind, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {counterparties.length > 0 ? (
              <FilterMenuChip
                active={value.counterpartyIds.length > 0}
                label={counterpartiesChipLabel(
                  counterparties
                    .filter((item) => value.counterpartyIds.includes(item.id))
                    .map((item) => item.name),
                  t,
                )}
                title={t("counterparties")}
                contentClassName="w-64"
              >
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {counterparties.map((item) => (
                    <ToggleRow
                      key={item.id}
                      checked={value.counterpartyIds.includes(item.id)}
                      label={item.name}
                      onCheckedChange={() =>
                        onChange({
                          ...value,
                          counterpartyIds: toggleValue(
                            value.counterpartyIds,
                            item.id,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              </FilterMenuChip>
            ) : null}

            {categories.length > 0 ? (
              <FilterMenuChip
                active={value.categoryIds.length > 0}
                label={categoriesLabel}
                title={t("categories")}
                contentClassName="w-64"
              >
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {treeCategories(categories).map((category) => (
                    <ToggleRow
                      key={category.id}
                      checked={value.categoryIds.includes(category.id)}
                      label={category.title}
                      indent={category.depth}
                      indicatorClassName={categoryBarClass(category.type)}
                      labelClassName={categoryTypeTextClass(category.type)}
                      onCheckedChange={() =>
                        onChange({
                          ...value,
                          categoryIds: toggleValue(
                            value.categoryIds,
                            category.id,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
              </FilterMenuChip>
            ) : null}
          </>
        )}

        <FilterToggleChip
          pressed={value.hideUncategorized}
          label={t("hideUncategorized")}
          onPressedChange={(pressed) =>
            onChange({ ...value, hideUncategorized: pressed })
          }
        />

        {!isDefault ? (
          <Button
            type="button"
            variant="ghost"
            className="h-10 rounded-full px-3 text-sm text-muted-foreground"
            onClick={() => onChange(DEFAULT_TRANSACTION_FILTERS)}
          >
            {t("clearFilters")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function periodSegmentClassName(active: boolean): string {
  return cn(
    "inline-flex h-full min-w-0 cursor-pointer items-center justify-center rounded-lg px-1.5 text-xs font-medium transition-all sm:text-sm",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-foreground/60 hover:text-foreground",
  );
}

function FilterMenuChip({
  active,
  label,
  title,
  children,
  contentClassName,
}: {
  readonly active: boolean;
  readonly label: string;
  readonly title: string;
  readonly children: ReactNode;
  readonly contentClassName?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex h-10 max-w-56 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
              active
                ? "border-foreground/25 bg-foreground text-background"
                : "border-border/70 bg-card/60 text-foreground hover:bg-muted/40",
            )}
          />
        }
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn("rounded-2xl p-3", contentClassName)}
      >
        <PopoverHeader className="mb-1 px-1">
          <PopoverTitle>{title}</PopoverTitle>
        </PopoverHeader>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function FilterToggleChip({
  pressed,
  label,
  onPressedChange,
}: {
  readonly pressed: boolean;
  readonly label: string;
  readonly onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex h-10 max-w-72 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
        pressed
          ? "border-foreground/25 bg-foreground text-background"
          : "border-border/70 bg-card/60 text-foreground hover:bg-muted/40",
      )}
      onClick={() => onPressedChange(!pressed)}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

function categoriesChipLabel(
  titles: string[],
  t: ReturnType<typeof useTranslations<"transaction">>,
): string {
  if (titles.length === 0) {
    return t("categories");
  }
  if (titles.length === 1) {
    return titles[0] ?? t("categories");
  }
  return t("categoriesSelected", { count: titles.length });
}

function counterpartiesChipLabel(
  names: string[],
  t: ReturnType<typeof useTranslations<"transaction">>,
): string {
  if (names.length === 0) {
    return t("counterparties");
  }
  if (names.length === 1) {
    return names[0] ?? t("counterparties");
  }
  return t("categoriesSelected", { count: names.length });
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

function kindOptionLabel(
  kind: TransactionKind,
  t: (key: string) => string,
): string {
  if (kind === TransactionKind.Default) {
    return t("kindDefault");
  }
  if (kind === TransactionKind.Loan) {
    return t("kindLoan");
  }
  if (kind === TransactionKind.Debt) {
    return t("kindDebt");
  }
  if (kind === TransactionKind.Transfer) {
    return t("kindTransfer");
  }
  if (kind === TransactionKind.Forgive) {
    return t("kindForgive");
  }
  return t("kindRefund");
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
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/40"
      style={{ paddingLeft: `${0.5 + indent * 1}rem` }}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => onCheckedChange()}
      />
      {indicatorClassName ? (
        <span
          className={cn("size-2 shrink-0 rounded-full", indicatorClassName)}
          aria-hidden
        />
      ) : null}
      <span
        className={cn("min-w-0 flex-1 truncate text-sm", labelClassName)}
      >
        {label}
      </span>
    </label>
  );
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
        "flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
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
        className="h-6 w-10 border-0 border-b border-current/50 bg-transparent p-0 text-center text-sm font-semibold tabular-nums outline-none"
      />
      <span className="text-muted-foreground">{suffix}</span>
    </button>
  );
}
