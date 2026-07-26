"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
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
  const tTx = useTranslations("transaction");
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
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={sliceIdentityKey(
                item.categoryId,
                item.type,
                item.title,
                index,
              )}
              className="group/category space-y-1.5"
            >
              <div
                className="flex items-center justify-between gap-3 text-sm"
                title={`${item.title}: ${formatChartMoney(item.amount, currency)} · ${item.percent.toFixed(1)}%`}
              >
                <span className="min-w-0 truncate font-medium">
                  {item.title}
                </span>
                {mixedTypes ? (
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
                  className={cn(
                    "h-full rounded-full",
                  )}
                  style={{
                    width: `${Math.min(100, Math.max(0, item.percent))}%`,
                    backgroundColor: categorySliceFill(item.type, index),
                  }}
                />
              </div>
              <div className="text-xs tabular-nums text-muted-foreground">
                {formatChartMoney(item.amount, currency)}
              </div>
              {item.children.length > 0 ? (
                <ul className="space-y-1 rounded-xl border border-border/50 bg-muted/25 p-2.5">
                  {item.children.map((child, childIndex) => (
                    <li
                      key={sliceIdentityKey(
                        child.categoryId,
                        child.type,
                        child.title,
                        childIndex,
                      )}
                      className="flex items-center justify-between gap-3 text-xs"
                      title={`${child.title}: ${formatChartMoney(child.amount, currency)} · ${child.percent.toFixed(1)}%`}
                    >
                      <span className="min-w-0 truncate text-muted-foreground">
                        {child.title}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatChartMoney(child.amount, currency)}
                        <span className="ml-1 text-muted-foreground">
                          {parentRelativePercent(child.amount, item.amount).toFixed(0)}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </StatCard>
  );
}

function parentRelativePercent(childAmount: string, parentAmount: string): number {
  const parent = Number(parentAmount);
  return parent > 0 ? (Number(childAmount) / parent) * 100 : 0;
}
