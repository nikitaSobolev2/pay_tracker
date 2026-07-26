import { collectAncestorIds } from "@/lib/category-selection";
import type { TransactionCategoryDto } from "@/types/transaction";

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

const LATIN_TO_CYRILLIC: Record<string, string> = {
  a: "а",
  b: "б",
  v: "в",
  g: "г",
  d: "д",
  e: "е",
  z: "з",
  i: "и",
  y: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  f: "ф",
  h: "х",
};

export function matchCategoriesByTitle(
  title: string,
  categories: readonly TransactionCategoryDto[],
): string[] {
  const titleTokens = expandTokenSet(tokenize(title));
  if (titleTokens.size === 0) {
    return [];
  }

  const candidates: Array<{
    category: TransactionCategoryDto;
    matchedTokenCount: number;
    leafLength: number;
  }> = [];

  for (const category of categories) {
    const phrases = [category.title, ...(category.keywords ?? [])];
    let bestMatch: { matchedTokenCount: number; leafLength: number } | null =
      null;

    for (const phrase of phrases) {
      const leafTokens = tokenize(phrase);
      if (leafTokens.length === 0) {
        continue;
      }
      if (!everyTokenCovered(leafTokens, titleTokens)) {
        continue;
      }
      const score = {
        matchedTokenCount: leafTokens.length,
        leafLength: phrase.trim().length,
      };
      if (
        !bestMatch ||
        score.matchedTokenCount > bestMatch.matchedTokenCount ||
        (score.matchedTokenCount === bestMatch.matchedTokenCount &&
          score.leafLength > bestMatch.leafLength)
      ) {
        bestMatch = score;
      }
    }

    if (bestMatch) {
      candidates.push({ category, ...bestMatch });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  candidates.sort((left, right) => {
    if (right.matchedTokenCount !== left.matchedTokenCount) {
      return right.matchedTokenCount - left.matchedTokenCount;
    }
    return right.leafLength - left.leafLength;
  });

  const winner = candidates[0]!;
  const withAncestors = new Set<string>([
    winner.category.id,
    ...collectAncestorIds(winner.category.id, categories),
  ]);
  return [...withAncestors];
}

function everyTokenCovered(
  leafTokens: string[],
  titleTokens: Set<string>,
): boolean {
  return leafTokens.every((token) => {
    const variants = expandToken(token);
    return [...variants].some((variant) => titleTokens.has(variant));
  });
}

function tokenize(value: string): string[] {
  return value
    .toLocaleLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function expandTokenSet(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    for (const variant of expandToken(token)) {
      expanded.add(variant);
    }
  }
  return expanded;
}

function expandToken(token: string): Set<string> {
  const variants = new Set<string>([token]);
  variants.add(toLatin(token));
  variants.add(toCyrillic(token));
  // Common brand alias
  if (token === "ozon" || token === "озон") {
    variants.add("ozon");
    variants.add("озон");
  }
  return variants;
}

function toLatin(value: string): string {
  return [...value]
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");
}

function toCyrillic(value: string): string {
  return [...value]
    .map((char) => LATIN_TO_CYRILLIC[char] ?? char)
    .join("");
}
