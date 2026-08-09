"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  fetchExchangeRates,
  type ExchangeRateQuote,
} from "@/lib/api/exchange-rates";
import { getCurrencySymbol } from "@/lib/currencies";
import { toDecimal } from "@/lib/money";
import { cn } from "@/lib/utils";

function formatRateToRub(rateToRub: string): string {
  return toDecimal(rateToRub).toDecimalPlaces(2).toFixed(2);
}

function formatChangePercent(changePercent: number): string {
  const sign = changePercent > 0 ? "+" : "";
  return `${sign}${changePercent.toFixed(1)}%`;
}

export function ExchangeRatesDisplay({
  className,
  stacked = false,
}: {
  readonly className?: string;
  /** Stack rates vertically and omit · dividers (sidebar). */
  readonly stacked?: boolean;
}) {
  const t = useTranslations("header");
  const [rates, setRates] = useState<ExchangeRateQuote[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetchExchangeRates()
      .then((response) => {
        if (!cancelled) {
          setRates(response.rates);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRates([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (rates.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 text-xs",
        stacked && "flex-col items-center gap-1",
        className,
      )}
      title={t("exchangeRatesMonth")}
    >
      {rates.map((rate, index) => (
        <span key={rate.currency} className="inline-flex items-center gap-2">
          {!stacked && index > 0 ? (
            <span aria-hidden className="text-border">
              ·
            </span>
          ) : null}
          <RateQuote rate={rate} />
        </span>
      ))}
    </div>
  );
}

function RateQuote({ rate }: { readonly rate: ExchangeRateQuote }) {
  const change = rate.changePercent;
  const wentUp = change !== null && change > 0;
  const wentDown = change !== null && change < 0;
  const TrendIcon = wentUp ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap font-medium tabular-nums",
        wentDown && "text-emerald-400",
        wentUp && "text-rose-400",
        !wentDown && !wentUp && "text-foreground/80",
      )}
    >
      {change !== null && (wentUp || wentDown) ? (
        <TrendIcon className="size-3.5 shrink-0 stroke-[2.5]" aria-hidden />
      ) : null}
      <span>
        {getCurrencySymbol(rate.currency)} = {formatRateToRub(rate.rateToRub)}{" "}
        {getCurrencySymbol("RUB")}
      </span>
      {change !== null ? (
        <span className="ml-1 hidden min-[1800px]:inline">
          {formatChangePercent(change)}
        </span>
      ) : null}
    </span>
  );
}
