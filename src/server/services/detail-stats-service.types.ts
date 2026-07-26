import type { TransactionKind, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import type {
  CategorySlice,
  MoneyAmount,
  NamedAmount,
  TimelinePoint,
} from "./stats-service.types";

export type CategoryDetailStats = {
  readonly categoryId: string;
  readonly title: string;
  readonly path: string;
  readonly type: TransactionType;
  readonly parentCategoryId: string | null;
  readonly parentTitle: string | null;
  readonly parentPath: string | null;
  readonly currency: string;
  readonly timeline: TimelinePoint[];
  readonly parentTimeline: TimelinePoint[];
  readonly siblingShares: NamedAmount[];
  readonly childrenBreakdown: NamedAmount[];
  /** Direct children as pie slices; each may nest grandchildren for toggle. */
  readonly childrenPie: CategorySlice[];
  readonly thisMonth: MoneyAmount;
  readonly lastMonth: MoneyAmount;
  readonly momDeltaPercent: number | null;
  readonly topCounterparties: NamedAmount[];
};

export type { NamedAmount };

export type DebtDetailStats = {
  readonly counterpartyId: string;
  readonly name: string;
  readonly currency: string;
  readonly tone: "owe" | "owed" | "settled";
  readonly netAllTime: MoneyAmount;
  readonly netThisMonth: MoneyAmount;
  readonly averageAmount: MoneyAmount;
  readonly frequencyDays: number | null;
  readonly medianSettleDays: number | null;
  readonly eventCount: number;
  readonly runningBalance: Array<{ date: string; balance: string }>;
  readonly monthlyLendBorrow: Array<{
    bucket: string;
    lend: string;
    borrow: string;
  }>;
  readonly eventGapsDays: number[];
  readonly amountSizes: Array<{ id: string; label: string; amount: string }>;
  readonly currencyBreakdown: NamedAmount[];
  readonly settledProgress: Array<{ date: string; remaining: string }>;
  readonly transactions: TransactionDto[];
};

export type DebtEventRow = {
  readonly id: string;
  readonly kind: TransactionKind;
  readonly amountRub: string;
  readonly displayAmount: string;
  readonly inputCurrency: string;
  readonly occurredAt: string;
  readonly title: string | null;
};
