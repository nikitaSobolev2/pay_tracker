import type {
  TransactionDebtRole,
  TransactionType,
} from "@/types/enums";

export type TransactionCategoryDto = {
  id: string;
  title: string;
  type: TransactionType;
  parentCategoryId: string | null;
  path: string;
};

export type TransactionDto = {
  id: string;
  type: TransactionType;
  amount: string;
  inputCurrency: string;
  originalAmount: string;
  rateToRub: string;
  fxRateDate: string;
  displayAmount: string;
  displayCurrency: string;
  title: string | null;
  occurredAt: string;
  debtRole: TransactionDebtRole | null;
  counterpartyId: string | null;
  counterpartyName: string | null;
  categories: TransactionCategoryDto[];
  createdAt: string;
  updatedAt: string;
};
