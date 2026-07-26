"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { CategoryChildrenDetails } from "@/features/charts/category-children-details";
import { StatCard } from "@/features/charts/stat-card";
import { SharedChartType } from "@/features/share/shared-chart-payload";
import {
  categorySliceFill,
  categoryTypeBadgeClass,
  sliceIdentityKey,
} from "@/lib/category-chart-style";
import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategorySlice } from "@/server/services/stats-service.types";
import { TransactionType } from "@/types/enums";

import { CategoryListSkeleton } from "./primitives";

export function TopCategoriesCard({
  title,
  description,
  loading,
  items,
  currency,
  showTypeHints = false,
  className,
  disableShare = false,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  items: CategorySlice[];
  currency: string;
  showTypeHints?: boolean;
  className?: string;
  disableShare?: boolean;
}) {
  const tCharts = useTranslations("charts");
  const mixedTypes =
    showTypeHints &&
    items.some((item) => item.type === TransactionType.Earning) &&
    items.some((item) => item.type === TransactionType.Spending);

  return (
    <StatCard
      title={title}
      description={description}
      sharePayload={
        disableShare || loading || items.length === 0
          ? null
          : {
              type: SharedChartType.TopCategories,
              title,
              description,
              items,
              currency,
              showTypeHints,
            }
      }
      loading={loading}
      className={className}
      skeleton={<CategoryListSkeleton />}
    >
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {tCharts("noCategoriesYet")}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => (
            <CategoryBarRow
              key={sliceIdentityKey(
                item.categoryId,
                item.type,
                item.title,
                index,
              )}
              item={item}
              index={index}
              currency={currency}
              showTypeBadge={mixedTypes}
            />
          ))}
        </ul>
      )}
    </StatCard>
  );
}

function CategoryBarRow({
  item,
  index,
  currency,
  showTypeBadge,
}: {
  readonly item: CategorySlice;
  readonly index: number;
  readonly currency: string;
  readonly showTypeBadge: boolean;
}) {
  const tTx = useTranslations("transaction");
  const hasChildren = item.children.length > 0;
  const amountLabel = formatChartMoney(item.amount, currency);

  return (
    <li
      className="group/category space-y-1.5"
      tabIndex={hasChildren ? 0 : undefined}
      title={`${item.title}: ${amountLabel} · ${item.percent.toFixed(1)}%`}
    >
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate font-medium">{item.title}</span>
        {showTypeBadge ? (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 rounded-full px-1.5 text-[10px] font-medium",
              categoryTypeBadgeClass(item.type),
            )}
          >
            {item.type === TransactionType.Earning
              ? tTx("earning")
              : tTx("spending")}
          </Badge>
        ) : null}
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {item.percent.toFixed(0)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, Math.max(0, item.percent))}%`,
            backgroundColor: categorySliceFill(item.type, index),
          }}
        />
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">
        {amountLabel}
      </div>
      {hasChildren ? (
        <div
          className={cn(
            "grid transition-[grid-template-rows,opacity] duration-150",
            "grid-rows-[0fr] opacity-0",
            "group-hover/category:grid-rows-[1fr] group-hover/category:opacity-100",
            "group-focus-within/category:grid-rows-[1fr] group-focus-within/category:opacity-100",
          )}
        >
          <div className="overflow-hidden">
            <CategoryChildrenDetails
              slice={item}
              currency={currency}
              className="rounded-xl border border-border/50 bg-muted/25 p-2.5"
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}
