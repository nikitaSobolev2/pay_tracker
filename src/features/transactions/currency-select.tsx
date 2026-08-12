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
        className={cn("min-w-28 w-auto", className)}
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
