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

export const EventPublicity = {
  Public: "PUBLIC",
  Private: "PRIVATE",
} as const;
export type EventPublicity =
  (typeof EventPublicity)[keyof typeof EventPublicity];

export const EventGuestPermission = {
  View: "VIEW",
  Edit: "EDIT",
} as const;
export type EventGuestPermission =
  (typeof EventGuestPermission)[keyof typeof EventGuestPermission];

export const EventLinkType = {
  Location: "LOCATION",
  Other: "OTHER",
} as const;
export type EventLinkType = (typeof EventLinkType)[keyof typeof EventLinkType];

export const EventSpendingCategory = {
  Food: "FOOD",
  Drinks: "DRINKS",
  Alcohol: "ALCOHOL",
  Housing: "HOUSING",
  Other: "OTHER",
} as const;
export type EventSpendingCategory =
  (typeof EventSpendingCategory)[keyof typeof EventSpendingCategory];

export const EventAttendanceStatus = {
  Certain: "CERTAIN",
  Uncertain: "UNCERTAIN",
} as const;
export type EventAttendanceStatus =
  (typeof EventAttendanceStatus)[keyof typeof EventAttendanceStatus];

/** Who wrote a spending, comment or chat message. Derived, never stored. */
export const EventAuthorRole = {
  Owner: "OWNER",
  Guest: "GUEST",
  Ai: "AI",
} as const;
export type EventAuthorRole =
  (typeof EventAuthorRole)[keyof typeof EventAuthorRole];

/** Verdict of an AI event analysis run. */
export const EventAiReportType = {
  Ok: "OK",
  Bad: "BAD",
} as const;
export type EventAiReportType =
  (typeof EventAiReportType)[keyof typeof EventAiReportType];

export const EventSpendingField = {
  Amount: "amount",
  Price: "price",
} as const;
export type EventSpendingField =
  (typeof EventSpendingField)[keyof typeof EventSpendingField];

export const EventTab = {
  Overview: "overview",
  Spendings: "spendings",
  People: "people",
} as const;
export type EventTab = (typeof EventTab)[keyof typeof EventTab];

export const EventPollStatus = {
  Open: "OPEN",
  Finished: "FINISHED",
} as const;
export type EventPollStatus =
  (typeof EventPollStatus)[keyof typeof EventPollStatus];

export const EventPollSelectionMode = {
  Single: "SINGLE",
  Multiple: "MULTIPLE",
} as const;
export type EventPollSelectionMode =
  (typeof EventPollSelectionMode)[keyof typeof EventPollSelectionMode];
