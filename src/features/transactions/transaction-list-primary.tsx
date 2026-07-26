"use client";

import { useTranslations } from "next-intl";

import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import {
  formatLeafCategoryLabel,
  leafCategoriesOnly,
} from "@/lib/category-selection";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TransactionListPrimaryProps = {
  readonly item: TransactionDto;
  readonly className?: string;
  readonly selected?: boolean;
};

export function TransactionListPrimary({
  item,
  className,
  selected = false,
}: TransactionListPrimaryProps) {
  const t = useTranslations("transaction");
  const formatReadableDateTime = useReadableDateTime();
  const isSpending = item.type === TransactionType.Spending;
  const title =
    item.title || (isSpending ? t("spending") : t("earning"));
  const categoriesLabel = leafCategoriesOnly(item.categories)
    .map(formatLeafCategoryLabel)
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "min-w-0 flex-1 py-0.5",
        selected && "rounded-lg bg-muted/50",
        className,
      )}
    >
      <p className="truncate text-[15px] font-medium leading-snug text-foreground">
        {title}
      </p>
      {categoriesLabel ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {categoriesLabel}
        </p>
      ) : null}
      <p className="mt-0.5 text-xs text-muted-foreground/80">
        {formatReadableDateTime(item.occurredAt)}
      </p>
    </div>
  );
}

type TransactionListAmountProps = {
  readonly item: TransactionDto;
  readonly className?: string;
};

export function TransactionListAmount({
  item,
  className,
}: TransactionListAmountProps) {
  const isSpending = item.type === TransactionType.Spending;

  return (
    <p
      className={cn(
        "shrink-0 text-[15px] font-semibold tabular-nums leading-none",
        isSpending ? "text-rose-400" : "text-emerald-400",
        className,
      )}
    >
      {isSpending ? "−" : "+"}
      {formatMoney(item.displayAmount, item.displayCurrency)}
    </p>
  );
}
