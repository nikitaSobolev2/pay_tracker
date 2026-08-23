import { v4 as uuidv4 } from "uuid";

import { canDivideTransaction } from "@/lib/can-divide-transaction";
import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import {
  exceedsCeilIntegerSlack,
  parseShareAmount,
} from "@/lib/split-share-amounts";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { TransactionKind, TransactionType } from "@/types/enums";
import type { TransactionDto } from "@/types/transaction";

import { findOrCreateCounterparty } from "./counterparty-service";
import { getTransaction } from "./transaction-service";

export type DivideShareInput = {
  readonly counterpartyName: string;
  readonly amount: string;
};

export type DivideTransactionInput = {
  readonly userId: string;
  readonly displayCurrency: string;
  readonly transactionId: string;
  readonly shares: readonly DivideShareInput[];
};

export async function divideTransaction(
  input: DivideTransactionInput,
): Promise<TransactionDto> {
  const parent = await prisma.transaction.findFirst({
    where: {
      id: input.transactionId,
      userId: input.userId,
      isDeleted: false,
    },
  });
  if (!parent) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Transaction not found");
  }
  if (
    !canDivideTransaction({
      kind: parent.kind,
      sourceTransactionId: parent.sourceTransactionId,
      originalAmount: parent.originalAmount.toString(),
    })
  ) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "This transaction cannot be divided",
    );
  }

  const shares = normalizeDivideShares(input.shares);
  assertShareTotals(parent.originalAmount.toString(), shares);

  const counterparties = await Promise.all(
    shares.map((share) =>
      findOrCreateCounterparty({
        userId: input.userId,
        name: share.counterpartyName,
      }),
    ),
  );
  const childKind = splitChildKind(parent.type);
  const rateToRub = toDecimal(parent.rateToRub.toString());

  await prisma.$transaction(async (tx) => {
    const existingChildren = await tx.transaction.findMany({
      where: {
        userId: input.userId,
        sourceTransactionId: parent.id,
        isDeleted: false,
      },
      select: { id: true },
    });
    for (const child of existingChildren) {
      await tx.transaction.updateMany({
        where: { id: child.id, userId: input.userId, isDeleted: false },
        data: {
          isDeleted: true,
          idempotencyKey: `deleted:${child.id}`,
        },
      });
    }

    for (const [index, share] of shares.entries()) {
      const original = toDecimal(share.amount);
      await tx.transaction.create({
        data: {
          userId: input.userId,
          type: parent.type,
          amount: original.mul(rateToRub).toFixed(4),
          inputCurrency: parent.inputCurrency,
          originalAmount: original.toFixed(4),
          rateToRub: rateToRub.toFixed(8),
          fxRateDate: parent.fxRateDate,
          title: parent.title,
          occurredAt: parent.occurredAt,
          kind: childKind,
          counterpartyId: counterparties[index]!.id,
          travelId: null,
          sourceTransactionId: parent.id,
          idempotencyKey: uuidv4(),
        },
      });
    }
  });

  return getTransaction(input.userId, parent.id, input.displayCurrency);
}

function normalizeDivideShares(
  shares: readonly DivideShareInput[],
): DivideShareInput[] {
  if (shares.length === 0) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Add at least one person",
    );
  }
  const seen = new Set<string>();
  return shares.map((share) => {
    const name = share.counterpartyName.trim();
    if (!name) {
      throw new AppServiceError(
        ApiErrorCode.Validation,
        "Person name is required",
      );
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new AppServiceError(
        ApiErrorCode.Validation,
        "Each person can appear only once",
      );
    }
    seen.add(key);
    const amount = parseShareAmount(share.amount);
    if (!amount) {
      throw new AppServiceError(
        ApiErrorCode.Validation,
        "Each share must be a positive amount",
      );
    }
    return { counterpartyName: name, amount: decimalToString(amount) };
  });
}

function assertShareTotals(
  parentOriginal: string,
  shares: readonly DivideShareInput[],
): void {
  const total = shares.reduce(
    (sum, share) => sum.plus(toDecimal(share.amount)),
    toDecimal(0),
  );
  if (exceedsCeilIntegerSlack(toDecimal(parentOriginal), total, shares.length)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Split amounts exceed the transaction total",
    );
  }
}

function splitChildKind(type: TransactionType): TransactionKind {
  return type === TransactionType.Spending
    ? TransactionKind.Loan
    : TransactionKind.Debt;
}
