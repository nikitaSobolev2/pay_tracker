import type Decimal from "decimal.js";

export type ResolvedExchangeRate = {
  currency: string;
  rateToRub: Decimal;
  rateDate: Date;
};

export type DisplayMoney = {
  amount: string;
  currency: string;
};
