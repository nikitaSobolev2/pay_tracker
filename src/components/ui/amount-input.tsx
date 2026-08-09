"use client";

import { useLocale } from "next-intl";
import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import {
  formatAmountInputDisplay,
  sanitizeAmountRaw,
  sanitizeIntegerAmountRaw,
} from "@/lib/amount-input";
import { looksLikeAmountExpression } from "@/lib/amount-expression";
import { cn } from "@/lib/utils";

type AmountInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
> & {
  readonly value: string;
  readonly onValueChange: (rawAmount: string) => void;
  /** When true, keep + - * / so the "=" evaluator can run. */
  readonly allowExpression?: boolean;
  /** Whole currency units only — no decimal entry or display. */
  readonly integerOnly?: boolean;
};

function sanitizeExpressionRaw(value: string): string {
  return value.replace(/[^\d.\s+\-*/]/g, "");
}

/** Amount field that shows grouped thousands while storing a raw numeric string. */
export function AmountInput({
  value,
  onValueChange,
  allowExpression = false,
  integerOnly = false,
  className,
  ...props
}: AmountInputProps) {
  const locale = useLocale();
  const expressionMode =
    !integerOnly && allowExpression && looksLikeAmountExpression(value);
  const displayRaw = integerOnly
    ? sanitizeIntegerAmountRaw(value, locale)
    : value;

  return (
    <Input
      {...props}
      inputMode={expressionMode ? "text" : integerOnly ? "numeric" : "decimal"}
      autoComplete="off"
      className={cn("tabular-nums", className)}
      value={
        expressionMode
          ? value
          : formatAmountInputDisplay(displayRaw, locale)
      }
      onChange={(event) => {
        const next = event.target.value;
        if (
          !integerOnly &&
          allowExpression &&
          looksLikeAmountExpression(next)
        ) {
          onValueChange(sanitizeExpressionRaw(next));
          return;
        }
        onValueChange(
          integerOnly
            ? sanitizeIntegerAmountRaw(next, locale)
            : sanitizeAmountRaw(next, locale),
        );
      }}
    />
  );
}
