"use client";

import { formatChartMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { CategorySlice } from "@/server/services/stats-service.types";

export function CategoryChildrenDetails({
  slice,
  currency,
  className,
}: {
  readonly slice: CategorySlice;
  readonly currency: string;
  readonly className?: string;
}) {
  if (slice.children.length === 0) {
    return null;
  }

  return (
    <ul className={cn("space-y-1.5", className)}>
      {slice.children.map((child) => (
        <li
          key={child.categoryId ?? child.title}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <span className="min-w-0 truncate text-muted-foreground">
            {child.title}
          </span>
          <span className="shrink-0 tabular-nums text-foreground/80">
            {formatChartMoney(child.amount, currency)}
            <span className="ml-1 text-muted-foreground">
              {child.percent.toFixed(0)}%
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
