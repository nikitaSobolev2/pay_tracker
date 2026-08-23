"use client";

import { useTranslations } from "next-intl";

import { useReadableDateTime } from "@/hooks/use-readable-date-time";
import { Link } from "@/i18n/navigation";
import {
  formatLeafCategoryLabel,
  leafCategoriesOnly,
} from "@/lib/category-selection";
import { SplitShareChips } from "@/features/transactions/split-share-chips";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

type TransactionListPrimaryProps = {
  readonly item: TransactionDto;
  readonly className?: string;
  readonly selected?: boolean;
  readonly onDateClick?: (date: string) => void;
};

export function TransactionListPrimary({
  item,
  className,
  selected = false,
  onDateClick,
}: TransactionListPrimaryProps) {
  const t = useTranslations("transaction");
  const formatReadableDateTime = useReadableDateTime();
  const isSpending = item.type === TransactionType.Spending;
  const title =
    item.title || (isSpending ? t("spending") : t("earning"));
  const categories = leafCategoriesOnly(item.categories);

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
      {item.splitShares?.length ? (
        <div className="mt-0.5">
          <SplitShareChips shares={item.splitShares} compact />
        </div>
      ) : null}
      {categories.length ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {categories.map((category, index) => (
            <span key={category.id}>
              {index ? " · " : null}
              <Link
                href={`/categories/${category.id}`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                className="hover:underline"
              >
                {formatLeafCategoryLabel(category)}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
      {onDateClick ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDateClick(item.occurredAt.slice(0, 10));
          }}
          className="mt-0.5 block w-full text-left text-xs text-muted-foreground/80 hover:underline"
        >
          {formatReadableDateTime(item.occurredAt)}
        </button>
      ) : (
        <p className="mt-0.5 block w-full text-left text-xs text-muted-foreground/80">
          {formatReadableDateTime(item.occurredAt)}
        </p>
      )}
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
