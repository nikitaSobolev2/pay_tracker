"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  List,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";

export type TransactionTypeFilter =
  | "all"
  | typeof TransactionType.Spending
  | typeof TransactionType.Earning;

type TransactionTypeSwitcherProps = {
  readonly value: TransactionTypeFilter;
  readonly onChange: (value: TransactionTypeFilter) => void;
  readonly className?: string;
  readonly compact?: boolean;
};

type TransactionTypeSelectProps = {
  readonly value: TransactionTypeFilter;
  readonly onChange: (value: TransactionTypeFilter) => void;
  readonly className?: string;
};

const OPTIONS = [
  { value: "all" as const, key: "all", icon: List },
  { value: TransactionType.Earning, key: "earnings", icon: ArrowUpCircle },
  { value: TransactionType.Spending, key: "spendings", icon: ArrowDownCircle },
] as const;

const SELECT_OPTIONS = [
  {
    value: "all" as const,
    labelKey: "allTransactions",
    icon: List,
  },
  {
    value: TransactionType.Earning,
    labelKey: "earnings",
    icon: ArrowUpCircle,
  },
  {
    value: TransactionType.Spending,
    labelKey: "spendings",
    icon: ArrowDownCircle,
  },
] as const;

export function TransactionTypeSwitcher({
  value,
  onChange,
  className,
  compact = false,
}: TransactionTypeSwitcherProps) {
  const t = useTranslations("nav");

  return (
    <Tabs
      className={className}
      value={value}
      onValueChange={(next) => {
        if (
          next === "all" ||
          next === TransactionType.Earning ||
          next === TransactionType.Spending
        ) {
          onChange(next);
        }
      }}
    >
      <TabsList
        className={cn(
          "h-12 w-full rounded-xl p-1 md:w-full",
          compact
            ? "rounded-full md:h-12"
            : "md:h-12 md:rounded-xl",
        )}
      >
        {OPTIONS.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className={cn(
              compact
                ? "rounded-full px-2.5 text-sm"
                : "rounded-lg px-3 text-sm md:px-4 md:text-base",
            )}
          >
            {t(option.key)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function TransactionTypeSelect({
  value,
  onChange,
  className,
}: TransactionTypeSelectProps) {
  const t = useTranslations("nav");
  const selected =
    SELECT_OPTIONS.find((option) => option.value === value) ??
    SELECT_OPTIONS[0];
  const SelectedIcon = selected.icon;
  const items = SELECT_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey),
  }));

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (
          next === "all" ||
          next === TransactionType.Earning ||
          next === TransactionType.Spending
        ) {
          onChange(next);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "h-11 w-full min-w-44 rounded-xl border-border/70 bg-card/60 data-[size=default]:h-11 sm:w-auto",
          className,
        )}
      >
        <SelectValue>
          {() => (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <SelectedIcon className="size-4 shrink-0 opacity-80" />
              <span className="truncate">{t(selected.labelKey)}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="min-w-52">
        {SELECT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <TypeOptionLabel icon={option.icon} label={t(option.labelKey)} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TypeOptionLabel({
  icon: Icon,
  label,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 opacity-80" />
      <span>{label}</span>
    </span>
  );
}

export function transactionTypeFromSearchParam(
  value: string | null,
): TransactionTypeFilter {
  if (value === "spending") {
    return TransactionType.Spending;
  }
  if (value === "earning") {
    return TransactionType.Earning;
  }
  return "all";
}

export function transactionTypeToSearchParam(
  value: TransactionTypeFilter,
): string | null {
  if (value === TransactionType.Spending) {
    return "spending";
  }
  if (value === TransactionType.Earning) {
    return "earning";
  }
  return null;
}
