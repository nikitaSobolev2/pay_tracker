function splitCurrencies(value: string | undefined): string[] {
  return (value ?? "RUB,USD,EUR")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function getDefaultCurrencies(): string[] {
  return splitCurrencies(process.env.DEFAULT_CURRENCIES);
}

export function getDefaultCurrency(): string {
  return (process.env.DEFAULT_CURRENCY ?? getDefaultCurrencies()[0] ?? "RUB").toUpperCase();
}

export function getAppName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME ?? "PayTracker";
}
