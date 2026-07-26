"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getClientCurrencies } from "@/lib/currencies";
import { cn } from "@/lib/utils";

type CurrencySelectProps = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly currencies?: string[];
  readonly className?: string;
};

export function CurrencySelect({
  value,
  onChange,
  currencies = getClientCurrencies(),
  className,
}: CurrencySelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") {
          onChange(next);
        }
      }}
    >
      <SelectTrigger
        className={cn(
          "min-w-28 w-auto rounded-xl text-base",
          // SelectTrigger defaults to data-[size=default]:h-8 — override both.
          "h-12 data-[size=default]:h-12 md:h-11 md:data-[size=default]:h-11",
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {currencies.map((currency) => (
          <SelectItem key={currency} value={currency}>
            {currency}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
