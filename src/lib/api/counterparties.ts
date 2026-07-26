import { apiFetch, buildQuery } from "@/lib/api/client";
import type { TransactionDebtRole } from "@/types/enums";

export type CounterpartyDto = {
  id: string;
  name: string;
};

export function listCounterparties(
  params: {
    debtRole?: TransactionDebtRole;
    q?: string;
    all?: boolean;
  } = {},
) {
  return apiFetch<{ counterparties: CounterpartyDto[] }>(
    `/api/counterparties${buildQuery({
      debtRole: params.debtRole,
      q: params.q,
      all: params.all ? "true" : undefined,
    })}`,
  );
}

export function createCounterparty(name: string) {
  return apiFetch<{ counterparty: CounterpartyDto }>("/api/counterparties", {
    method: "POST",
    body: { name },
  });
}

export function updateCounterparty(id: string, name: string) {
  return apiFetch<{ counterparty: CounterpartyDto }>(
    `/api/counterparties/${id}`,
    {
      method: "PATCH",
      body: { name },
    },
  );
}

export function deleteCounterparty(id: string) {
  return apiFetch<{ ok: true }>(`/api/counterparties/${id}`, {
    method: "DELETE",
  });
}
