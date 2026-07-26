import {
  joinCategoryPath,
  splitCategoryPath,
} from "@/lib/category-path";
import { AppServiceError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import type { TransactionType } from "@/types/enums";

import type {
  CategoryDto,
  CreateCategoryInput,
  DeleteCategoryInput,
  FindOrCreateCategoryByPathInput,
  ListCategoriesInput,
  UpdateCategoryInput,
} from "./category-service.types";

type CategoryRow = {
  id: string;
  title: string;
  type: TransactionType;
  parentCategoryId: string | null;
  keywords?: string[];
};

export async function listCategories(
  input: ListCategoriesInput,
): Promise<CategoryDto[]> {
  const rows = await prisma.userCategory.findMany({
    where: {
      userId: input.userId,
      ...(input.type ? { type: input.type } : {}),
    },
    orderBy: [{ type: "asc" }, { title: "asc" }],
  });
  return toCategoryDtos(rows);
}

export async function findOrCreateCategoryByPath(
  input: FindOrCreateCategoryByPathInput,
): Promise<CategoryDto> {
  const segments = splitCategoryPath(input.path);
  if (segments.length === 0) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category title is required",
    );
  }
  return createCategoryPath(input.userId, input.type, segments);
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryDto> {
  const segments = splitCategoryPath(input.title);
  if (segments.length === 0) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category title is required",
    );
  }

  if (segments.length > 1) {
    if (input.parentCategoryId) {
      throw new AppServiceError(
        ApiErrorCode.Validation,
        "Parent cannot be set when creating a category path",
      );
    }
    return createCategoryPath(input.userId, input.type, segments);
  }

  const title = segments[0]!;
  const parentCategoryId = input.parentCategoryId ?? null;
  if (parentCategoryId) {
    await assertValidParent(
      input.userId,
      input.type,
      parentCategoryId,
      null,
    );
  }
  await assertSiblingTitleAvailable(
    input.userId,
    input.type,
    parentCategoryId,
    title,
  );

  try {
    const row = await prisma.userCategory.create({
      data: {
        userId: input.userId,
        title,
        type: input.type,
        parentCategoryId,
        keywords: normalizeKeywords(input.keywords),
      },
    });
    const [dto] = await toCategoryDtos([row]);
    return dto!;
  } catch {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      "Category already exists for this type",
    );
  }
}

export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<CategoryDto> {
  const existing = await prisma.userCategory.findFirst({
    where: { id: input.categoryId, userId: input.userId },
  });
  if (!existing) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Category not found");
  }

  const nextTitle =
    input.title !== undefined
      ? normalizeCategoryTitle(input.title)
      : existing.title;
  const nextParentId =
    input.parentCategoryId !== undefined
      ? input.parentCategoryId
      : existing.parentCategoryId;
  const nextKeywords =
    input.keywords !== undefined
      ? normalizeKeywords(input.keywords)
      : existing.keywords ?? [];

  if (nextParentId) {
    await assertValidParent(
      input.userId,
      existing.type,
      nextParentId,
      existing.id,
    );
  }

  if (
    nextTitle.toLowerCase() !== existing.title.toLowerCase() ||
    nextParentId !== existing.parentCategoryId
  ) {
    await assertSiblingTitleAvailable(
      input.userId,
      existing.type,
      nextParentId,
      nextTitle,
      existing.id,
    );
  }

  try {
    const row = await prisma.userCategory.update({
      where: { id: existing.id },
      data: {
        title: nextTitle,
        parentCategoryId: nextParentId,
        keywords: nextKeywords,
      },
    });
    const [dto] = await toCategoryDtos([row]);
    return dto!;
  } catch {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      "Category already exists for this type",
    );
  }
}

function normalizeKeywords(keywords: string[] | undefined): string[] {
  return [
    ...new Set(
      (keywords ?? [])
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  ];
}

export async function deleteCategory(input: DeleteCategoryInput): Promise<void> {
  const result = await prisma.userCategory.deleteMany({
    where: { id: input.categoryId, userId: input.userId },
  });
  if (result.count === 0) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Category not found");
  }
}

export async function assertCategoriesMatchType(
  userId: string,
  categoryIds: string[],
  type: TransactionType,
): Promise<void> {
  if (categoryIds.length === 0) {
    return;
  }
  const uniqueIds = [...new Set(categoryIds)];
  const rows = await prisma.userCategory.findMany({
    where: {
      userId,
      id: { in: uniqueIds },
    },
  });
  if (rows.length !== uniqueIds.length) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "One or more categories were not found",
    );
  }
  const mismatched = rows.some((row) => row.type !== type);
  if (mismatched) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Categories must match transaction type",
    );
  }
}

export async function toCategoryDtos(
  rows: CategoryRow[],
): Promise<CategoryDto[]> {
  if (rows.length === 0) {
    return [];
  }
  const byId = await loadCategoryMapForRows(rows);
  return rows.map((row) => {
    const titles = collectPathTitles(row.id, byId);
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      parentCategoryId: row.parentCategoryId,
      path: joinCategoryPath(titles),
      keywords: row.keywords ?? [],
    };
  });
}

export async function loadCategoryAncestorMap(
  userId: string,
  categoryIds: string[],
): Promise<Map<string, CategoryRow>> {
  const map = new Map<string, CategoryRow>();
  let pending = [...new Set(categoryIds)];
  while (pending.length > 0) {
    const rows = await prisma.userCategory.findMany({
      where: { userId, id: { in: pending } },
      select: {
        id: true,
        title: true,
        type: true,
        parentCategoryId: true,
      },
    });
    const nextPending: string[] = [];
    for (const row of rows) {
      map.set(row.id, row);
      if (row.parentCategoryId && !map.has(row.parentCategoryId)) {
        nextPending.push(row.parentCategoryId);
      }
    }
    pending = nextPending;
  }
  return map;
}

export function resolveRootCategoryId(
  categoryId: string,
  byId: Map<string, CategoryRow>,
): string {
  let current = categoryId;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(current)) {
      return current;
    }
    seen.add(current);
    const row = byId.get(current);
    if (!row?.parentCategoryId) {
      return current;
    }
    current = row.parentCategoryId;
  }
}

export function resolveDirectChildUnderRoot(
  categoryId: string,
  rootId: string,
  byId: Map<string, CategoryRow>,
): string | null {
  if (categoryId === rootId) {
    return null;
  }
  let current = categoryId;
  const seen = new Set<string>();
  while (true) {
    if (seen.has(current)) {
      return null;
    }
    seen.add(current);
    const row = byId.get(current);
    if (!row?.parentCategoryId) {
      return null;
    }
    if (row.parentCategoryId === rootId) {
      return current;
    }
    current = row.parentCategoryId;
  }
}

async function createCategoryPath(
  userId: string,
  type: TransactionType,
  segments: string[],
): Promise<CategoryDto> {
  let parentCategoryId: string | null = null;
  let leaf: CategoryRow | null = null;

  for (const segment of segments) {
    const existing = await findSiblingCategory(
      userId,
      type,
      parentCategoryId,
      segment,
    );
    if (existing) {
      leaf = existing;
      parentCategoryId = existing.id;
      continue;
    }
    const created: CategoryRow = await prisma.userCategory.create({
      data: {
        userId,
        title: segment,
        type,
        parentCategoryId,
      },
      select: {
        id: true,
        title: true,
        type: true,
        parentCategoryId: true,
      },
    });
    leaf = created;
    parentCategoryId = created.id;
  }

  if (!leaf) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category title is required",
    );
  }
  const [dto] = await toCategoryDtos([leaf]);
  return dto!;
}

async function findSiblingCategory(
  userId: string,
  type: TransactionType,
  parentCategoryId: string | null,
  title: string,
): Promise<CategoryRow | null> {
  const rows = await prisma.userCategory.findMany({
    where: {
      userId,
      type,
      parentCategoryId,
    },
    select: {
      id: true,
      title: true,
      type: true,
      parentCategoryId: true,
    },
  });
  const normalized = title.toLowerCase();
  return (
    rows.find((row) => row.title.toLowerCase() === normalized) ?? null
  );
}

function normalizeCategoryTitle(title: string): string {
  const segments = splitCategoryPath(title);
  if (segments.length !== 1) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category title cannot contain path separators",
    );
  }
  return segments[0]!;
}

async function assertSiblingTitleAvailable(
  userId: string,
  type: TransactionType,
  parentCategoryId: string | null,
  title: string,
  excludeId?: string,
): Promise<void> {
  const existing = await findSiblingCategory(
    userId,
    type,
    parentCategoryId,
    title,
  );
  if (existing && existing.id !== excludeId) {
    throw new AppServiceError(
      ApiErrorCode.Conflict,
      "Category already exists for this type",
    );
  }
}

async function assertValidParent(
  userId: string,
  type: TransactionType,
  parentCategoryId: string,
  categoryId: string | null,
): Promise<void> {
  if (categoryId && parentCategoryId === categoryId) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category cannot be its own parent",
    );
  }
  const parent = await prisma.userCategory.findFirst({
    where: { id: parentCategoryId, userId },
  });
  if (!parent) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Parent category not found");
  }
  if (parent.type !== type) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Parent category must match type",
    );
  }
  if (!categoryId) {
    return;
  }
  const descendants = await loadDescendantIds(userId, categoryId);
  if (descendants.has(parentCategoryId)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Category cannot use a descendant as parent",
    );
  }
}

async function loadDescendantIds(
  userId: string,
  categoryId: string,
): Promise<Set<string>> {
  const result = new Set<string>();
  let frontier = [categoryId];
  while (frontier.length > 0) {
    const children = await prisma.userCategory.findMany({
      where: { userId, parentCategoryId: { in: frontier } },
      select: { id: true },
    });
    frontier = [];
    for (const child of children) {
      if (!result.has(child.id)) {
        result.add(child.id);
        frontier.push(child.id);
      }
    }
  }
  return result;
}

async function loadCategoryMapForRows(
  rows: CategoryRow[],
): Promise<Map<string, CategoryRow>> {
  const map = new Map(rows.map((row) => [row.id, row]));
  const missingParents = rows
    .map((row) => row.parentCategoryId)
    .filter((id): id is string => id != null && !map.has(id));
  if (missingParents.length === 0) {
    return map;
  }
  let pending = [...new Set(missingParents)];
  while (pending.length > 0) {
    const parents = await prisma.userCategory.findMany({
      where: { id: { in: pending } },
      select: {
        id: true,
        title: true,
        type: true,
        parentCategoryId: true,
      },
    });
    const nextPending: string[] = [];
    for (const parent of parents) {
      map.set(parent.id, parent);
      if (parent.parentCategoryId && !map.has(parent.parentCategoryId)) {
        nextPending.push(parent.parentCategoryId);
      }
    }
    pending = nextPending;
  }
  return map;
}

function collectPathTitles(
  categoryId: string,
  byId: Map<string, CategoryRow>,
): string[] {
  const titles: string[] = [];
  let current: string | null = categoryId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const row = byId.get(current);
    if (!row) {
      break;
    }
    titles.unshift(row.title);
    current = row.parentCategoryId;
  }
  return titles;
}
