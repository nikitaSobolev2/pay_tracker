import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type FormatMoneyOptions = {
  readonly fractionDigits?: number;
};

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function formatMoney(
  value: string | number | Decimal,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  const fractionDigits = options.fractionDigits ?? 2;
  const amount = toDecimal(value).toDecimalPlaces(
    fractionDigits,
    Decimal.ROUND_HALF_UP,
  );
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount.toNumber());
  } catch {
    return `${amount.toFixed(fractionDigits)} ${currency}`;
  }
}

/** Chart labels use whole currency units (half-up), never fractional cents. */
export function formatChartMoney(
  value: string | number | Decimal,
  currency: string,
): string {
  return formatMoney(value, currency, { fractionDigits: 0 });
}

export function decimalToString(value: Decimal): string {
  return value.toFixed(4);
}
