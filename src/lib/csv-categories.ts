/** Separates multiple categories on one transaction. Paths use `/` inside each entry. */
export const CSV_CATEGORY_DELIMITER = "|";

export function joinCsvCategories(paths: string[]): string {
  return paths
    .map((path) => path.trim())
    .filter(Boolean)
    .join(CSV_CATEGORY_DELIMITER);
}

export function splitCsvCategories(raw: string): string[] {
  return raw
    .split(CSV_CATEGORY_DELIMITER)
    .map((item) => item.trim())
    .filter(Boolean);
}
