"use client";

import type { ReactNode } from "react";

type CalculatorPeopleBentoProps<T> = {
  readonly items: readonly T[];
  readonly itemKey: (item: T) => string;
  readonly children: (item: T) => ReactNode;
};

export function CalculatorPeopleBento<T>({
  items,
  itemKey,
  children,
}: CalculatorPeopleBentoProps<T>) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto lg:flex-row lg:items-start lg:gap-3">
      <BentoColumn>
        {columnItems(items, 0).map((item, columnIndex) => (
          <div
            key={itemKey(item)}
            className="min-w-0"
            style={{ order: columnIndex * 2 }}
          >
            {children(item)}
          </div>
        ))}
      </BentoColumn>
      <BentoColumn>
        {columnItems(items, 1).map((item, columnIndex) => (
          <div
            key={itemKey(item)}
            className="min-w-0"
            style={{ order: columnIndex * 2 + 1 }}
          >
            {children(item)}
          </div>
        ))}
      </BentoColumn>
    </div>
  );
}

function BentoColumn({ children }: { readonly children: ReactNode }) {
  return (
    <div className="contents min-w-0 lg:flex lg:flex-1 lg:flex-col lg:gap-3">
      {children}
    </div>
  );
}

function columnItems<T>(items: readonly T[], column: 0 | 1): T[] {
  return items.filter((_, index) => index % 2 === column);
}
