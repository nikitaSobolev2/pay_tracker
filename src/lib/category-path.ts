const CATEGORY_PATH_SEPARATORS = /[\\/|\-]+/;

export function splitCategoryPath(raw: string): string[] {
  return raw
    .split(CATEGORY_PATH_SEPARATORS)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function joinCategoryPath(titles: string[]): string {
  return titles.join("/");
}

export function hasCategoryPathSeparators(raw: string): boolean {
  return CATEGORY_PATH_SEPARATORS.test(raw);
}
