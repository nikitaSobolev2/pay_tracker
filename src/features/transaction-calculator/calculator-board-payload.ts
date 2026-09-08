import { z } from "zod";

import type { CalculatorSession } from "@/features/transaction-calculator/calculator-session";
import { calculatorSessionFromUnknown } from "@/features/transaction-calculator/calculator-storage";
import { calculatorPeriodQuery } from "@/features/transaction-calculator/fetch-calculator-period";
import type { TransactionListParams } from "@/lib/api/transactions";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  DateRangeType,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

export type CalculatorBoardQuery = {
  readonly periodLabel: string;
  readonly dateRangeType?: TransactionListParams["dateRangeType"];
  readonly rollingUnit?: TransactionListParams["rollingUnit"];
  readonly rollingN?: number;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly type?: TransactionListParams["type"];
  readonly kinds?: TransactionListParams["kinds"];
  readonly categoryIds?: string[];
  readonly counterpartyIds?: string[];
  readonly travelId?: string;
  readonly hideUncategorized?: boolean;
};

const boardQuerySchema = z.object({
  periodLabel: z.string().max(200).optional(),
  dateRangeType: zodEnumFromConst(DateRangeType).optional(),
  rollingUnit: z.enum(["days", "months", "years"]).optional(),
  rollingN: z.number().int().positive().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  type: zodEnumFromConst(TransactionType).optional(),
  kinds: z.array(zodEnumFromConst(TransactionKind)).optional(),
  categoryIds: z.array(z.string()).optional(),
  counterpartyIds: z.array(z.string()).optional(),
  travelId: z.string().optional(),
  hideUncategorized: z.boolean().optional(),
});

export function parseCalculatorBoardQuery(
  value: unknown,
): CalculatorBoardQuery {
  const parsed = boardQuerySchema.safeParse(value);
  if (!parsed.success) {
    return { periodLabel: "" };
  }
  return {
    periodLabel: parsed.data.periodLabel?.trim() ?? "",
    dateRangeType: parsed.data.dateRangeType,
    rollingUnit: parsed.data.rollingUnit,
    rollingN: parsed.data.rollingN,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    type: parsed.data.type,
    kinds: parsed.data.kinds,
    categoryIds: parsed.data.categoryIds,
    counterpartyIds: parsed.data.counterpartyIds,
    travelId: parsed.data.travelId,
    hideUncategorized: parsed.data.hideUncategorized,
  };
}

export function calculatorBoardQueryFromPage(
  queryBase: TransactionListParams,
  periodLabel: string,
): CalculatorBoardQuery {
  return {
    periodLabel: periodLabel.trim().slice(0, 200),
    ...calculatorPeriodQuery(queryBase),
  };
}

export function transactionListParamsFromBoardQuery(
  query: CalculatorBoardQuery,
): TransactionListParams {
  return {
    dateRangeType: query.dateRangeType,
    rollingUnit: query.rollingUnit,
    rollingN: query.rollingN,
    startDate: query.startDate,
    endDate: query.endDate,
    type: query.type,
    kinds: query.kinds,
    categoryIds: query.categoryIds,
    counterpartyIds: query.counterpartyIds,
    travelId: query.travelId,
    hideUncategorized: query.hideUncategorized,
  };
}

export function normalizeBoardTitle(title: string): string {
  const trimmed = title.trim().slice(0, 120);
  return trimmed.length > 0 ? trimmed : "Board";
}

export function sanitizeCalculatorBoardWrite(input: {
  readonly title: string;
  readonly query: unknown;
  readonly session: unknown;
}): {
  readonly title: string;
  readonly query: CalculatorBoardQuery;
  readonly session: CalculatorSession;
} {
  return {
    title: normalizeBoardTitle(input.title),
    query: parseCalculatorBoardQuery(input.query),
    session: calculatorSessionFromUnknown(input.session),
  };
}
