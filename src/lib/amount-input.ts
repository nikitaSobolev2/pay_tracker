const MAX_FRACTION_DIGITS = 2;

type NumberSeparators = {
  readonly group: string;
  readonly decimal: string;
};

function getNumberSeparators(locale: string): NumberSeparators {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    group: parts.find((part) => part.type === "group")?.value ?? ",",
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
  };
}

/** Strip grouping and normalize to a raw `1234.56` string. */
export function sanitizeAmountRaw(value: string, locale = "en"): string {
  const { group, decimal } = getNumberSeparators(locale);
  let normalized = value.replaceAll("\u00a0", "").replaceAll("\u202f", "");

  if (group) {
    normalized = normalized.split(group).join("");
  }
  normalized = normalized.replaceAll(/\s/g, "");

  if (decimal && decimal !== ".") {
    normalized = normalized.split(decimal).join(".");
  }

  let cleaned = "";
  let seenDot = false;
  for (const char of normalized) {
    if (char >= "0" && char <= "9") {
      cleaned += char;
      continue;
    }
    if (char === "." && !seenDot) {
      cleaned += ".";
      seenDot = true;
    }
  }

  if (!cleaned) {
    return "";
  }
  if (cleaned === ".") {
    return "0.";
  }

  const dotIndex = cleaned.indexOf(".");
  if (dotIndex === -1) {
    return stripLeadingZeros(cleaned);
  }

  const intPart = stripLeadingZeros(cleaned.slice(0, dotIndex));
  const fracPart = cleaned
    .slice(dotIndex + 1)
    .replaceAll(".", "")
    .slice(0, MAX_FRACTION_DIGITS);
  if (cleaned.endsWith(".") && fracPart.length === 0) {
    return `${intPart}.`;
  }
  return `${intPart}.${fracPart}`;
}

/** Visual grouped amount for controlled inputs (`1,234.56` / `1 234,56`). */
export function formatAmountInputDisplay(raw: string, locale: string): string {
  if (!raw) {
    return "";
  }

  const { decimal } = getNumberSeparators(locale);
  const hasTrailingDot = raw.endsWith(".");
  const [intRaw = "0", fracRaw] = raw.split(".");
  const formattedInt = formatIntegerDigits(intRaw || "0", locale);

  if (fracRaw === undefined && !hasTrailingDot) {
    return formattedInt;
  }
  if (hasTrailingDot && fracRaw === undefined) {
    return `${formattedInt}${decimal}`;
  }
  return `${formattedInt}${decimal}${fracRaw}`;
}

/** Drop trailing fractional zeros for edit hydration (`100.0000` → `100`). */
export function normalizeAmountRaw(value: string, locale = "en"): string {
  const sanitized = sanitizeAmountRaw(value, locale);
  if (!sanitized.includes(".")) {
    return sanitized;
  }
  return sanitized.replace(/\.?0+$/, "");
}

/** Digits only — no decimal part (`100.99` → `100`). */
export function sanitizeIntegerAmountRaw(value: string, locale = "en"): string {
  const sanitized = sanitizeAmountRaw(value, locale);
  if (!sanitized) {
    return "";
  }
  return sanitized.split(".")[0] ?? "";
}

function stripLeadingZeros(digits: string): string {
  if (!digits) {
    return "0";
  }
  return digits.replace(/^0+(?=\d)/, "") || "0";
}

function formatIntegerDigits(digits: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(BigInt(digits));
  } catch {
    return digits;
  }
}
