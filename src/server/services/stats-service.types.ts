import type {
  DateRangeType,
  TransactionDebtRole,
  TransactionType,
} from "@/types/enums";

export type MoneyAmount = {
  amount: string;
  currency: string;
};

export type NamedAmount = {
  id: string | null;
  name: string;
  amount: string;
};

export type CategorySlice = {
  categoryId: string | null;
  title: string;
  /** Categories are scoped per transaction type. */
  type: TransactionType;
  amount: string;
  percent: number;
  children: CategorySlice[];
};

export type TimelinePoint = {
  bucket: string;
  spending: string;
  earning: string;
  net: string;
};

export type ActivityHeatmapDay = {
  /** yyyy-MM-dd in the user timezone. */
  date: string;
  earning: string;
  spending: string;
};

export type ActivityHeatmap = {
  displayCurrency: string;
  start: string;
  end: string;
  days: ActivityHeatmapDay[];
  maxEarning: string;
  maxSpending: string;
};

export type ActivityHeatmapInput = {
  userId: string;
  timezone: string;
  displayCurrency: string;
  type?: TransactionType;
  debtRoles?: TransactionDebtRole[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  hideUncategorized?: boolean;
};

export type ActivityDay = {
  /** Local calendar day, yyyy-MM-dd. */
  date: string;
  earning: string;
  spending: string;
  count: number;
};

export type ActivityCalendar = {
  displayCurrency: string;
  /** Week-aligned (starts Sunday), trailing ~53 weeks up to today. */
  days: ActivityDay[];
};

export type ActivityCalendarInput = {
  userId: string;
  timezone: string;
  displayCurrency: string;
};

export type PeriodComparison = {
  current: MoneyAmount;
  previous: MoneyAmount | null;
  deltaAmount: string | null;
  deltaPercent: number | null;
};

export type OverviewStats = {
  displayCurrency: string;
  dateRangeType: DateRangeType;
  debtsIOwe: {
    total: MoneyAmount;
    breakdown: NamedAmount[];
  };
  debtsOwedToMe: {
    total: MoneyAmount;
    breakdown: NamedAmount[];
  };
  spendingByCategory: CategorySlice[];
  earningByCategory: CategorySlice[];
  timeline: TimelinePoint[];
  incomeVsSpending: {
    income: MoneyAmount;
    spending: MoneyAmount;
    net: MoneyAmount;
  };
  incomeExpenseBars: TimelinePoint[];
  avgDailySpend: MoneyAmount;
  avgDailySpendVsPrevious: PeriodComparison;
  periodTotal: MoneyAmount;
  recentTransactions: Array<{
    id: string;
    type: TransactionType;
    title: string | null;
    occurredAt: string;
    displayAmount: string;
    displayCurrency: string;
    inputCurrency: string;
    originalAmount: string;
  }>;
  vsPreviousPeriod: PeriodComparison;
};

export type ListPageStats = {
  displayCurrency: string;
  dateRangeType: DateRangeType;
  hasMultipleCurrencies: boolean;
  periodTotals: {
    count: number;
    spending: MoneyAmount;
    earning: MoneyAmount;
    net: MoneyAmount;
    total: MoneyAmount;
  };
  avgPerTransaction: MoneyAmount;
  avgPerDay: MoneyAmount;
  avgPerTransactionVsPrevious: PeriodComparison;
  avgPerDayVsPrevious: PeriodComparison;
  timeline: TimelinePoint[];
  categoryPie: CategorySlice[];
  topCategories: CategorySlice[];
  currencyBreakdown: Array<{
    currency: string;
    amount: string;
    count: number;
  }> | null;
  vsPreviousPeriod: PeriodComparison;
};

export type DebtCounterpartyStats = {
  counterpartyId: string;
  name: string;
  totalThisMonth: MoneyAmount;
  totalAllTime: MoneyAmount;
  averageAmount: MoneyAmount;
  frequencyDays: number | null;
  /** Median days from open→settle across completed balance episodes. */
  medianSettleDays: number | null;
  eventCount: number;
};

export type DebtsStats = {
  displayCurrency: string;
  /** Median settle days across all completed debt episodes. */
  medianSettleDays: number | null;
  myDebts: {
    totalAllTime: MoneyAmount;
    totalThisMonth: MoneyAmount;
    medianSettleDays: number | null;
    counterparties: DebtCounterpartyStats[];
  };
  debtsToMe: {
    totalAllTime: MoneyAmount;
    totalThisMonth: MoneyAmount;
    medianSettleDays: number | null;
    counterparties: DebtCounterpartyStats[];
  };
};

export type OverviewStatsInput = {
  userId: string;
  timezone: string;
  displayCurrency: string;
  dateRangeType: DateRangeType;
};

export type ListPageStatsInput = {
  userId: string;
  timezone: string;
  displayCurrency: string;
  dateRangeType?: DateRangeType;
  rollingUnit?: "days" | "months" | "years";
  rollingN?: number;
  startDate?: string;
  endDate?: string;
  type?: TransactionType;
  debtRoles?: TransactionDebtRole[];
  categoryIds?: string[];
  counterpartyIds?: string[];
  hideUncategorized?: boolean;
};

export type DebtsStatsInput = {
  userId: string;
  timezone: string;
  displayCurrency: string;
};
