import { apiFetch } from "@/lib/api/client";

export type ExchangeRateQuote = {
  currency: string;
  rateToRub: string;
  rateDate: string;
  changePercent: number | null;
};

export type ExchangeRatesResponse = {
  rates: ExchangeRateQuote[];
};

export function fetchExchangeRates() {
  return apiFetch<ExchangeRatesResponse>("/api/exchange-rates");
}
