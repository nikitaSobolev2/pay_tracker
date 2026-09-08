import { Prisma } from "@prisma/client";

import {
  normalizeBoardTitle,
  parseCalculatorBoardQuery,
  sanitizeCalculatorBoardWrite,
  type CalculatorBoardQuery,
} from "@/features/transaction-calculator/calculator-board-payload";
import type { CalculatorSession } from "@/features/transaction-calculator/calculator-session";
import {
  calculatorSessionFromUnknown,
  calculatorSessionToJson,
} from "@/features/transaction-calculator/calculator-storage";
import { prisma } from "@/lib/prisma";
import { requireOwnedBoard } from "@/server/services/calculator-board-ownership";

export type CalculatorBoardListItem = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

export type CalculatorBoardDto = {
  readonly id: string;
  readonly title: string;
  readonly query: CalculatorBoardQuery;
  readonly session: CalculatorSession;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export async function listCalculatorBoards(
  userId: string,
): Promise<CalculatorBoardListItem[]> {
  const rows = await prisma.calculatorBoard.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function getCalculatorBoard(input: {
  readonly userId: string;
  readonly id: string;
}): Promise<CalculatorBoardDto> {
  const row = await prisma.calculatorBoard.findUnique({
    where: { id: input.id },
  });
  return toDto(requireOwnedBoard(row, input.userId));
}

export async function createCalculatorBoard(input: {
  readonly userId: string;
  readonly title: string;
  readonly query: unknown;
  readonly session: unknown;
}): Promise<CalculatorBoardDto> {
  const fields = sanitizeCalculatorBoardWrite(input);
  const row = await prisma.calculatorBoard.create({
    data: {
      userId: input.userId,
      title: fields.title,
      query: queryJson(fields.query),
      session: calculatorSessionToJson(fields.session) as Prisma.InputJsonValue,
    },
  });
  return toDto(row);
}

export async function updateCalculatorBoard(input: {
  readonly userId: string;
  readonly id: string;
  readonly title?: string;
  readonly query?: unknown;
  readonly session?: unknown;
}): Promise<CalculatorBoardDto> {
  await assertOwned(input.userId, input.id);
  const row = await prisma.calculatorBoard.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined
        ? { title: normalizeBoardTitle(input.title) }
        : {}),
      ...(input.query !== undefined ? { query: queryJson(input.query) } : {}),
      ...(input.session !== undefined
        ? { session: sessionJson(input.session) }
        : {}),
    },
  });
  return toDto(row);
}

export async function deleteCalculatorBoard(input: {
  readonly userId: string;
  readonly id: string;
}): Promise<void> {
  await assertOwned(input.userId, input.id);
  await prisma.calculatorBoard.delete({ where: { id: input.id } });
}

async function assertOwned(userId: string, id: string): Promise<void> {
  const row = await prisma.calculatorBoard.findUnique({
    where: { id },
    select: { userId: true },
  });
  requireOwnedBoard(row, userId);
}

function queryJson(value: unknown): Prisma.InputJsonValue {
  return parseCalculatorBoardQuery(value) as Prisma.InputJsonValue;
}

function sessionJson(value: unknown): Prisma.InputJsonValue {
  return calculatorSessionToJson(
    calculatorSessionFromUnknown(value),
  ) as Prisma.InputJsonValue;
}

function toDto(row: {
  id: string;
  title: string;
  query: Prisma.JsonValue;
  session: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): CalculatorBoardDto {
  return {
    id: row.id,
    title: row.title,
    query: parseCalculatorBoardQuery(row.query),
    session: calculatorSessionFromUnknown(row.session),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
