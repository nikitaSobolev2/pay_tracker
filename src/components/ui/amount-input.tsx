"use client";

import { useLocale } from "next-intl";
import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import {
  formatAmountInputDisplay,
  sanitizeAmountRaw,
} from "@/lib/amount-input";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
> & {
  readonly value: string;
  readonly onValueChange: (rawAmount: string) => void;
};

/** Amount field that shows grouped thousands while storing a raw numeric string. */
export function AmountInput({
  value,
  onValueChange,
  className,
  ...props
}: AmountInputProps) {
  const locale = useLocale();

  return (
    <Input
      {...props}
      inputMode="decimal"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      value={formatAmountInputDisplay(value, locale)}
      onChange={(event) => {
        onValueChange(sanitizeAmountRaw(event.target.value, locale));
      }}
    />
  );
}
