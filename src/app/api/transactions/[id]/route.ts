import { z } from "zod";

import { jsonOk } from "@/lib/api-response";
import { handleRouteError } from "@/lib/route-handler";
import { requireUser } from "@/lib/session";
import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  deleteTransaction,
  getTransaction,
  updateTransaction,
} from "@/server/services/transaction-service";
import { TransactionKind, TransactionType } from "@/types/enums";

const updateBodySchema = z.object({
  type: zodEnumFromConst(TransactionType).optional(),
  originalAmount: z.string().min(1).optional(),
  inputCurrency: z.string().min(3).max(3).optional(),
  title: z.string().max(200).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  kind: zodEnumFromConst(TransactionKind).optional(),
  counterpartyName: z.string().max(200).nullable().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const transaction = await getTransaction(
      user.id,
      id,
      user.defaultCurrency,
    );
    return jsonOk({ transaction });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = updateBodySchema.parse(await request.json());
    const transaction = await updateTransaction({
      userId: user.id,
      displayCurrency: user.defaultCurrency,
      transactionId: id,
      type: body.type,
      originalAmount: body.originalAmount,
      inputCurrency: body.inputCurrency,
      title: body.title,
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
      kind: body.kind,
      counterpartyName: body.counterpartyName,
      categoryIds: body.categoryIds,
    });
    return jsonOk({ transaction });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteTransaction(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
