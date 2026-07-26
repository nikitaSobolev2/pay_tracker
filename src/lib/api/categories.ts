import { apiFetch, buildQuery } from "@/lib/api/client";
import type { TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

export function listCategories(type?: TransactionType) {
  return apiFetch<{ categories: TransactionCategoryDto[] }>(
    `/api/categories${buildQuery({ type })}`,
  );
}

export function createCategory(
  title: string,
  type: TransactionType,
  parentCategoryId?: string | null,
  keywords?: string[],
) {
  return apiFetch<{ category: TransactionCategoryDto }>("/api/categories", {
    method: "POST",
    body: { title, type, parentCategoryId, keywords },
  });
}

export function updateCategory(
  id: string,
  input: {
    title?: string;
    parentCategoryId?: string | null;
    keywords?: string[];
  },
) {
  return apiFetch<{ category: TransactionCategoryDto }>(
    `/api/categories/${id}`,
    {
      method: "PATCH",
      body: input,
    },
  );
}

export function deleteCategory(id: string) {
  return apiFetch<{ ok: true }>(`/api/categories/${id}`, {
    method: "DELETE",
  });
}
