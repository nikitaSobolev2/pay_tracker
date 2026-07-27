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

/** Glue / function words — never drive category matches on their own. */
const STOP_TOKENS = new Set([
  "за",
  "для",
  "и",
  "в",
  "на",
  "с",
  "по",
  "из",
  "от",
  "к",
  "у",
  "о",
  "об",
  "про",
  "без",
  "до",
  "при",
  "под",
  "над",
  "или",
  "а",
  "но",
  "же",
  "бы",
  "ли",
  "не",
  "ни",
  "то",
  "это",
  "the",
  "a",
  "an",
  "of",
  "for",
  "and",
  "to",
  "in",
  "on",
  "at",
  "from",
  "with",
  "by",
]);

const FUZZY_MIN_TOKEN_LENGTH = 4;
const FUZZY_MAX_DISTANCE = 1;

type MatchCandidate = {
  category: TransactionCategoryDto;
  matchedTokenCount: number;
};

/**
 * Selects categories whose title/keywords share any significant word with the
 * transaction title (stop words like «от», «в», «за» are ignored).
 */
export function matchCategoriesByTitle(
  title: string,
  categories: readonly TransactionCategoryDto[],
): string[] {
  const titleTokens = expandTokenSet(significantTokens(tokenize(title)));
  if (titleTokens.size === 0) {
    return [];
  }

  const candidates: MatchCandidate[] = [];

  for (const category of categories) {
    const phrases = [category.title, ...(category.keywords ?? [])];
    let bestOverlap = 0;

    for (const phrase of phrases) {
      const phraseTokens = significantTokens(tokenize(phrase));
      if (phraseTokens.length === 0) {
        continue;
      }
      const overlap = countCoveredTokens(phraseTokens, titleTokens);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
      }
    }

    if (bestOverlap > 0) {
      candidates.push({
        category,
        matchedTokenCount: bestOverlap,
      });
    }
  }

  if (candidates.length === 0) {
    return [];
  }

  const selected = new Set<string>();
  for (const candidate of candidates) {
    selected.add(candidate.category.id);
    for (const ancestorId of collectAncestorIds(
      candidate.category.id,
      categories,
    )) {
      selected.add(ancestorId);
    }
  }
  return [...selected];
}

function countCoveredTokens(
  phraseTokens: string[],
  titleTokens: Set<string>,
): number {
  let count = 0;
  for (const token of phraseTokens) {
    if (tokenCoveredByTitle(token, titleTokens)) {
      count += 1;
    }
  }
  return count;
}

function tokenCoveredByTitle(token: string, titleTokens: Set<string>): boolean {
  const variants = expandToken(token);
  if ([...variants].some((variant) => titleTokens.has(variant))) {
    return true;
  }
  if (token.length < FUZZY_MIN_TOKEN_LENGTH) {
    return false;
  }
  for (const titleToken of titleTokens) {
    if (titleToken.length < FUZZY_MIN_TOKEN_LENGTH) {
      continue;
    }
    for (const variant of variants) {
      if (fuzzyTokenMatch(variant, titleToken)) {
        return true;
      }
    }
  }
  return false;
}

function significantTokens(tokens: string[]): string[] {
  return tokens.filter(
    (token) => !STOP_TOKENS.has(token) && token.length > 1,
  );
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
  if (token === "ozon" || token === "озон") {
    variants.add("ozon");
    variants.add("озон");
  }
  return variants;
}

function fuzzyTokenMatch(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > FUZZY_MAX_DISTANCE) {
    return false;
  }
  return levenshteinDistance(left, right) <= FUZZY_MAX_DISTANCE;
}

function levenshteinDistance(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (left.length === 0) {
    return right.length;
  }
  if (right.length === 0) {
    return left.length;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j] ?? 0;
    }
  }

  return previous[right.length] ?? 0;
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
