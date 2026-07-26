"use client";

import { useLocale } from "next-intl";
import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import {
  formatAmountInputDisplay,
  sanitizeAmountRaw,
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
};

function sanitizeExpressionRaw(value: string): string {
  return value.replace(/[^\d.\s+\-*/]/g, "");
}

/** Amount field that shows grouped thousands while storing a raw numeric string. */
export function AmountInput({
  value,
  onValueChange,
  allowExpression = false,
  className,
  ...props
}: AmountInputProps) {
  const locale = useLocale();
  const expressionMode = allowExpression && looksLikeAmountExpression(value);

  return (
    <Input
      {...props}
      inputMode={expressionMode ? "text" : "decimal"}
      autoComplete="off"
      className={cn("tabular-nums", className)}
      value={
        expressionMode ? value : formatAmountInputDisplay(value, locale)
      }
      onChange={(event) => {
        const next = event.target.value;
        if (allowExpression && looksLikeAmountExpression(next)) {
          onValueChange(sanitizeExpressionRaw(next));
          return;
        }
        onValueChange(sanitizeAmountRaw(next, locale));
      }}
    />
  );
}
