import type {
  TransactionKind,
  TransactionType,
  TravelPhase,
} from "@/types/enums";

export type SearchResultKind =
  | "category"
  | "counterparty"
  | "debt"
  | "transaction"
  | "dateRange"
  | "event"
  | "travel";

export type SearchTransactionHit = {
  readonly kind: "transaction";
  readonly id: string;
  readonly title: string | null;
  readonly type: TransactionType;
  readonly displayAmount: string;
  readonly displayCurrency: string;
  readonly originalAmount: string;
  readonly inputCurrency: string;
  readonly occurredAt: string;
  readonly transactionKind: TransactionKind;
  readonly counterpartyName: string | null;
  readonly categoryPaths: string[];
  readonly score: number;
};

export type SearchCategoryHit = {
  readonly kind: "category";
  readonly id: string;
  readonly title: string;
  readonly path: string;
  readonly type: TransactionType;
  readonly score: number;
};

export type SearchCounterpartyHit = {
  readonly kind: "counterparty";
  readonly id: string;
  readonly name: string;
  readonly score: number;
};

export type SearchDebtHit = {
  readonly kind: "debt";
  readonly counterpartyId: string;
  readonly name: string;
  readonly tone: "owe" | "owed";
  readonly totalAllTimeAmount: string;
  readonly displayCurrency: string;
  readonly score: number;
};

export type SearchDateRangeHit = {
  readonly kind: "dateRange";
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly score: number;
};

export type SearchEventHit = {
  readonly kind: "event";
  readonly id: string;
  readonly title: string;
  readonly address: string | null;
  readonly occursAt: string;
  readonly score: number;
};

export type SearchTravelHit = {
  readonly kind: "travel";
  readonly id: string;
  readonly title: string;
  readonly placeLabel: string | null;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly phase: TravelPhase;
  readonly score: number;
};

export type SearchHit =
  | SearchTransactionHit
  | SearchCategoryHit
  | SearchCounterpartyHit
  | SearchDebtHit
  | SearchDateRangeHit
  | SearchEventHit
  | SearchTravelHit;

export type SearchResponse = {
  readonly query: string;
  readonly queryKind: "date" | "amount" | "text" | "empty";
  readonly groups: {
    readonly categories: SearchCategoryHit[];
    readonly counterparties: SearchCounterpartyHit[];
    readonly debts: SearchDebtHit[];
    readonly dateRanges: SearchDateRangeHit[];
    readonly transactions: SearchTransactionHit[];
    readonly events: SearchEventHit[];
    readonly travels: SearchTravelHit[];
  };
};

export type SearchInput = {
  readonly userId: string;
  readonly displayCurrency: string;
  readonly timezone: string;
  readonly query: string;
  readonly limitPerGroup?: number;
};
