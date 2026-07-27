export const AppLocale = {
  En: "en",
  Ru: "ru",
} as const;
export type AppLocale = (typeof AppLocale)[keyof typeof AppLocale];

export const AppTheme = {
  Light: "light",
  Dark: "dark",
  System: "system",
} as const;
export type AppTheme = (typeof AppTheme)[keyof typeof AppTheme];

export const TransactionType = {
  Spending: "SPENDING",
  Earning: "EARNING",
} as const;
export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionKind = {
  Default: "DEFAULT",
  Loan: "LOAN",
  Debt: "DEBT",
  Refund: "REFUND",
  Transfer: "TRANSFER",
} as const;
export type TransactionKind =
  (typeof TransactionKind)[keyof typeof TransactionKind];

/** Own-account moves (e.g. credit-card bill pay) — visible in lists, excluded from cashflow charts. */
export function isCashflowExcludedKind(kind: TransactionKind): boolean {
  return kind === TransactionKind.Transfer;
}

export const DateRangeType = {
  Day: "day",
  Month: "month",
  Year: "year",
  AllTime: "all_time",
} as const;
export type DateRangeType =
  (typeof DateRangeType)[keyof typeof DateRangeType];

export const FastQueueStatus = {
  Pending: "pending",
  Success: "success",
  Error: "error",
} as const;
export type FastQueueStatus =
  (typeof FastQueueStatus)[keyof typeof FastQueueStatus];

export const TransactionFormMode = {
  Spending: "spending",
  Earning: "earning",
} as const;
export type TransactionFormMode =
  (typeof TransactionFormMode)[keyof typeof TransactionFormMode];

export const TransactionSortBy = {
  Title: "title",
  Amount: "amount",
  Date: "date",
  Categories: "categories",
} as const;
export type TransactionSortBy =
  (typeof TransactionSortBy)[keyof typeof TransactionSortBy];

export const SortDirection = {
  Asc: "asc",
  Desc: "desc",
} as const;
export type SortDirection = (typeof SortDirection)[keyof typeof SortDirection];
