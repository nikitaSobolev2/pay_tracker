import type { TransactionDebtRole } from "@/types/enums";

export type CounterpartyDto = {
  id: string;
  name: string;
};

export type SearchCounterpartiesInput = {
  userId: string;
  debtRole?: TransactionDebtRole;
  q?: string;
  limit?: number;
};

export type ListAllCounterpartiesInput = {
  userId: string;
};

export type FindOrCreateCounterpartyInput = {
  userId: string;
  name: string;
};

export type UpdateCounterpartyInput = {
  userId: string;
  counterpartyId: string;
  name: string;
};

export type DeleteCounterpartyInput = {
  userId: string;
  counterpartyId: string;
};
