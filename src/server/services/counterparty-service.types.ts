import type { TransactionKind } from "@/types/enums";

export type CounterpartyDto = {
  id: string;
  name: string;
};

export type SearchCounterpartiesInput = {
  userId: string;
  kind?: TransactionKind;
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

export type CreateCounterpartyInput = {
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
