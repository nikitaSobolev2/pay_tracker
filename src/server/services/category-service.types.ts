import type { TransactionType } from "@/types/enums";
import type { TransactionCategoryDto } from "@/types/transaction";

export type ListCategoriesInput = {
  userId: string;
  type?: TransactionType;
};

export type CreateCategoryInput = {
  userId: string;
  title: string;
  type: TransactionType;
  parentCategoryId?: string | null;
};

export type FindOrCreateCategoryByPathInput = {
  userId: string;
  type: TransactionType;
  path: string;
};

export type UpdateCategoryInput = {
  userId: string;
  categoryId: string;
  title?: string;
  parentCategoryId?: string | null;
};

export type DeleteCategoryInput = {
  userId: string;
  categoryId: string;
};

export type CategoryDto = TransactionCategoryDto;
