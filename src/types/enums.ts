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

export const TransactionDebtRole = {
  Lend: "LEND",
  Borrow: "BORROW",
} as const;
export type TransactionDebtRole =
  (typeof TransactionDebtRole)[keyof typeof TransactionDebtRole];

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
