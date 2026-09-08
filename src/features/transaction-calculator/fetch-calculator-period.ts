import {
  listTransactions,
  type TransactionListParams,
} from "@/lib/api/transactions";
import { TransactionKind } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

const PAGE_SIZE = 100;

export function calculatorPeriodQuery(
  queryBase: TransactionListParams,
): TransactionListParams {
  return {
    ...calculatorDateQuery(queryBase),
    type: queryBase.type,
    kinds: queryBase.kinds,
    categoryIds: queryBase.categoryIds,
    counterpartyIds: queryBase.counterpartyIds,
    travelId: queryBase.travelId,
    hideUncategorized: queryBase.hideUncategorized,
  };
}

export function calculatorLedgerQuery(
  queryBase: TransactionListParams,
): TransactionListParams {
  return {
    ...calculatorDateQuery(queryBase),
    kinds: [TransactionKind.Loan, TransactionKind.Debt],
  };
}

function calculatorDateQuery(
  queryBase: TransactionListParams,
): TransactionListParams {
  return {
    dateRangeType: queryBase.dateRangeType,
    rollingUnit: queryBase.rollingUnit,
    rollingN: queryBase.rollingN,
    startDate: queryBase.startDate,
    endDate: queryBase.endDate,
  };
}

export async function fetchAllCalculatorTransactions(
  queryBase: TransactionListParams,
): Promise<TransactionDto[]> {
  const first = await listTransactions({
    ...queryBase,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const items = [...first.items];
  const totalPages = Math.max(1, Math.ceil(first.total / PAGE_SIZE));
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listTransactions({
      ...queryBase,
      page,
      pageSize: PAGE_SIZE,
    });
    items.push(...next.items);
  }
  return items;
}
