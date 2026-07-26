import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  createTransaction,
  listTransactions,
} from "@/server/services/transaction-service";
import {
  DateRangeType,
  SortDirection,
  TransactionKind,
  TransactionSortBy,
  TransactionType,
} from "@/types/enums";

const listQuerySchema = z
  .object({
    dateRangeType: zodEnumFromConst(DateRangeType).optional(),
    rollingUnit: z.enum(["days", "months", "years"]).optional(),
    rollingN: z.coerce.number().int().positive().max(3650).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    type: zodEnumFromConst(TransactionType).optional(),
    kinds: z.array(zodEnumFromConst(TransactionKind)).optional(),
    categoryIds: z.array(z.string().min(1)).optional(),
    counterpartyIds: z.array(z.string().min(1)).optional(),
    hideUncategorized: z.boolean().optional(),
    sortBy: zodEnumFromConst(TransactionSortBy).optional(),
    sortDir: zodEnumFromConst(SortDirection).optional(),
    page: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().max(100).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.dateRangeType) ||
      Boolean(value.rollingUnit && value.rollingN) ||
      Boolean(value.startDate && value.endDate),
    { message: "dateRangeType, rolling range, or absolute range is required" },
  );

const createBodySchema = z.object({
  type: zodEnumFromConst(TransactionType),
  originalAmount: z.string().min(1),
  inputCurrency: z.string().min(3).max(3),
  title: z.string().max(200).nullable().optional(),
  occurredAt: z.string().datetime(),
  kind: zodEnumFromConst(TransactionKind).default(TransactionKind.Default),
  counterpartyName: z.string().max(200).nullable().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  idempotencyKey: z.string().min(1).max(100),
});

function parseCsvParam(value: string | null): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      dateRangeType: searchParams.get("dateRangeType") ?? undefined,
      rollingUnit: searchParams.get("rollingUnit") ?? undefined,
      rollingN: searchParams.get("rollingN") ?? undefined,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
      type: searchParams.get("type") ?? undefined,
      kinds: parseCsvParam(searchParams.get("kinds")),
      categoryIds: parseCsvParam(searchParams.get("categoryIds")),
      counterpartyIds: parseCsvParam(searchParams.get("counterpartyIds")),
      hideUncategorized:
        searchParams.get("hideUncategorized") === "true" ? true : undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortDir: searchParams.get("sortDir") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    const result = await listTransactions({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      timezone: user.timezone,
      ...query,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const json = await request.json();
    const headerKey = request.headers.get("idempotency-key");
    const body = createBodySchema.parse({
      ...json,
      idempotencyKey: json.idempotencyKey ?? headerKey,
    });

    const transaction = await createTransaction({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      type: body.type,
      originalAmount: body.originalAmount,
      inputCurrency: body.inputCurrency,
      title: body.title,
      occurredAt: new Date(body.occurredAt),
      kind: body.kind,
      counterpartyName: body.counterpartyName,
      categoryIds: body.categoryIds,
      idempotencyKey: body.idempotencyKey,
    });
    return jsonOk({ transaction }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
