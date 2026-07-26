/** Leaf → root, inclusive. Used to roll activity up nested category trees. */
export function listCategoryAncestorIds(
  categoryId: string,
  byId: Map<string, { parentCategoryId: string | null }>,
): string[] {
  const chain: string[] = [];
  let current: string | null = categoryId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    chain.push(current);
    current = byId.get(current)?.parentCategoryId ?? null;
  }
  return chain;
}
