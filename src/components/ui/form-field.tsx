"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  readonly label: ReactNode;
  readonly htmlFor?: string;
  readonly labelId?: string;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly hint?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function FormField({
  label,
  htmlFor,
  labelId,
  required = false,
  optional = false,
  hint,
  children,
  className,
}: FormFieldProps) {
  const t = useTranslations("common");
  let meta: string | null = null;
  if (required) {
    meta = t("required");
  } else if (optional) {
    meta = t("optional");
  }

  return (
    <div className={cn("grid grid-cols-1 gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={htmlFor} id={labelId}>
          {label}
        </Label>
        {meta ? (
          <span
            className={cn(
              "shrink-0 text-[11px] font-medium uppercase tracking-[0.14em]",
              required ? "text-foreground/45" : "text-muted-foreground/70",
            )}
          >
            {meta}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
      {children}
    </div>
  );
}
