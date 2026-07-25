import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { TransactionDebtRole } from "@/types/enums";

import type {
  CounterpartyDto,
  DeleteCounterpartyInput,
  FindOrCreateCounterpartyInput,
  ListAllCounterpartiesInput,
  SearchCounterpartiesInput,
  UpdateCounterpartyInput,
} from "./counterparty-service.types";

export async function searchCounterparties(
  input: SearchCounterpartiesInput,
): Promise<CounterpartyDto[]> {
  const limit = input.limit ?? 50;
  const query = input.q?.trim();

  const rows = await prisma.userCounterparty.findMany({
    where: {
      userId: input.userId,
      ...(query
        ? { name: { contains: query, mode: "insensitive" } }
        : {}),
      transactions: {
        some: {
          debtRole: input.debtRole
            ? input.debtRole
            : {
                in: [TransactionDebtRole.Lend, TransactionDebtRole.Borrow],
              },
        },
      },
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true },
  });
  return rows;
}

export async function listAllCounterparties(
  input: ListAllCounterpartiesInput,
): Promise<CounterpartyDto[]> {
  return prisma.userCounterparty.findMany({
    where: { userId: input.userId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function findOrCreateCounterparty(
  input: FindOrCreateCounterpartyInput,
): Promise<CounterpartyDto> {
  const name = normalizeCounterpartyName(input.name);
  const existing = await findByNameInsensitive(input.userId, name);
  if (existing) {
    return existing;
  }

  return prisma.userCounterparty.create({
    data: {
      userId: input.userId,
      name,
    },
    select: { id: true, name: true },
  });
}

export async function updateCounterparty(
  input: UpdateCounterpartyInput,
): Promise<CounterpartyDto> {
  const existing = await prisma.userCounterparty.findFirst({
    where: { id: input.counterpartyId, userId: input.userId },
    select: { id: true, name: true },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Counterparty not found");
  }

  const name = normalizeCounterpartyName(input.name);
  if (name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await findByNameInsensitive(input.userId, name);
    if (duplicate && duplicate.id !== existing.id) {
      throw new AppServiceError(
        ApiErrorCode.Conflict,
        "Counterparty already exists",
      );
    }
  }

  try {
    return await prisma.userCounterparty.update({
      where: { id: existing.id },
      data: { name },
      select: { id: true, name: true },
    });
  } catch {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      "Counterparty already exists",
    );
  }
}

export async function deleteCounterparty(
  input: DeleteCounterpartyInput,
): Promise<void> {
  const result = await prisma.userCounterparty.deleteMany({
    where: { id: input.counterpartyId, userId: input.userId },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Counterparty not found");
  }
}

function normalizeCounterpartyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Counterparty name is required",
    );
  }
  return trimmed;
}

async function findByNameInsensitive(
  userId: string,
  name: string,
): Promise<CounterpartyDto | null> {
  const rows = await prisma.userCounterparty.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const normalized = name.toLowerCase();
  return rows.find((row) => row.name.toLowerCase() === normalized) ?? null;
}
