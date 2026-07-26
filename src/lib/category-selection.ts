import type { TransactionCategoryDto } from "@/types/transaction";

/** Stable dark group tints for category chip clusters in the form modal. */
export const CATEGORY_GROUP_TONES = [
  {
    shell: "border-teal-800/50 bg-teal-950/70",
    chipActive: "border-teal-600/80 bg-teal-800 text-teal-50",
    chipIdle: "border-teal-800/40 bg-teal-950/40 text-teal-100/90",
  },
  {
    shell: "border-amber-800/50 bg-amber-950/70",
    chipActive: "border-amber-600/80 bg-amber-800 text-amber-50",
    chipIdle: "border-amber-800/40 bg-amber-950/40 text-amber-100/90",
  },
  {
    shell: "border-rose-800/50 bg-rose-950/70",
    chipActive: "border-rose-600/80 bg-rose-800 text-rose-50",
    chipIdle: "border-rose-800/40 bg-rose-950/40 text-rose-100/90",
  },
  {
    shell: "border-sky-800/50 bg-sky-950/70",
    chipActive: "border-sky-600/80 bg-sky-800 text-sky-50",
    chipIdle: "border-sky-800/40 bg-sky-950/40 text-sky-100/90",
  },
  {
    shell: "border-lime-800/50 bg-lime-950/70",
    chipActive: "border-lime-600/80 bg-lime-800 text-lime-50",
    chipIdle: "border-lime-800/40 bg-lime-950/40 text-lime-100/90",
  },
  {
    shell: "border-orange-800/50 bg-orange-950/70",
    chipActive: "border-orange-600/80 bg-orange-800 text-orange-50",
    chipIdle: "border-orange-800/40 bg-orange-950/40 text-orange-100/90",
  },
  {
    shell: "border-cyan-800/50 bg-cyan-950/70",
    chipActive: "border-cyan-600/80 bg-cyan-800 text-cyan-50",
    chipIdle: "border-cyan-800/40 bg-cyan-950/40 text-cyan-100/90",
  },
  {
    shell: "border-stone-700/50 bg-stone-900/80",
    chipActive: "border-stone-500/80 bg-stone-700 text-stone-50",
    chipIdle: "border-stone-700/40 bg-stone-900/50 text-stone-200/90",
  },
] as const;

export type CategoryChipGroup = {
  readonly rootId: string;
  readonly rootTitle: string;
  readonly members: TransactionCategoryDto[];
  readonly toneIndex: number;
};

export function collectAncestorIds(
  categoryId: string,
  categories: readonly TransactionCategoryDto[],
): string[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const ancestors: string[] = [];
  let current = byId.get(categoryId);
  while (current?.parentCategoryId) {
    ancestors.push(current.parentCategoryId);
    current = byId.get(current.parentCategoryId);
  }
  return ancestors;
}

export function collectDescendantIds(
  categoryId: string,
  categories: readonly TransactionCategoryDto[],
): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentCategoryId) {
      continue;
    }
    const siblings = childrenByParent.get(category.parentCategoryId) ?? [];
    siblings.push(category.id);
    childrenByParent.set(category.parentCategoryId, siblings);
  }

  const descendants: string[] = [];
  const stack = [...(childrenByParent.get(categoryId) ?? [])];
  while (stack.length > 0) {
    const nextId = stack.pop()!;
    descendants.push(nextId);
    const children = childrenByParent.get(nextId);
    if (children) {
      stack.push(...children);
    }
  }
  return descendants;
}

/** Selecting a category also selects every ancestor. */
export function withAncestorSelection(
  selectedIds: readonly string[],
  categoryId: string,
  categories: readonly TransactionCategoryDto[],
): string[] {
  const ancestors = collectAncestorIds(categoryId, categories);
  return [...new Set([...selectedIds, categoryId, ...ancestors])];
}

/**
 * Categories that are parents of another category in the same list are hidden
 * so only leaf (most specific) labels show in transaction displays.
 */
export function leafCategoriesOnly(
  categories: readonly TransactionCategoryDto[],
): TransactionCategoryDto[] {
  const ids = new Set(categories.map((category) => category.id));
  const byId = new Map(categories.map((category) => [category.id, category]));
  const hiddenParentIds = new Set<string>();

  for (const category of categories) {
    let parentId = category.parentCategoryId;
    while (parentId && ids.has(parentId)) {
      hiddenParentIds.add(parentId);
      parentId = byId.get(parentId)?.parentCategoryId ?? null;
    }
  }

  return categories.filter((category) => !hiddenParentIds.has(category.id));
}

export function formatLeafCategoryLabel(
  category: TransactionCategoryDto,
): string {
  return category.title || category.path;
}

/** Group each root with its descendants; orphans get their own group. */
export function groupCategoriesByParent(
  categories: readonly TransactionCategoryDto[],
): CategoryChipGroup[] {
  const roots = categories
    .filter((category) => category.parentCategoryId == null)
    .sort((left, right) => left.path.localeCompare(right.path));

  const assigned = new Set<string>();
  const groups: CategoryChipGroup[] = [];

  for (const root of roots) {
    const descendants = collectDescendantIds(root.id, categories)
      .map((id) => categories.find((category) => category.id === id))
      .filter((category): category is TransactionCategoryDto => category != null)
      .sort((left, right) => left.path.localeCompare(right.path));
    const members = [root, ...descendants];
    for (const member of members) {
      assigned.add(member.id);
    }
    groups.push({
      rootId: root.id,
      rootTitle: root.title,
      members,
      toneIndex: groups.length % CATEGORY_GROUP_TONES.length,
    });
  }

  const orphans = categories
    .filter((category) => !assigned.has(category.id))
    .sort((left, right) => left.path.localeCompare(right.path));

  for (const orphan of orphans) {
    groups.push({
      rootId: orphan.id,
      rootTitle: orphan.title,
      members: [orphan],
      toneIndex: groups.length % CATEGORY_GROUP_TONES.length,
    });
  }

  return groups;
}
