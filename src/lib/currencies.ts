const FALLBACK_CLIENT_CURRENCIES = ["RUB", "USD", "EUR"] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

function parseCurrencies(value: string | undefined): string[] {
  const parsed = (value ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...FALLBACK_CLIENT_CURRENCIES];
}

/**
 * Selectable currencies for client forms. Mirrors the server `DEFAULT_CURRENCIES`
 * allowlist via a public env var so custom currencies are selectable in the UI.
 */
export function getClientCurrencies(): string[] {
  return parseCurrencies(process.env.NEXT_PUBLIC_DEFAULT_CURRENCIES);
}

export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? currency;
}
