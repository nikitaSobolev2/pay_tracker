"use client";

import { LocaleFlagIcon } from "@/components/locale-flag-icon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LOCALE_OPTIONS,
  isAppLocale,
  localeOptionLabel,
  localeSelectItems,
} from "@/lib/locales";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/types/enums";

type LocaleSelectProps = {
  readonly value: string;
  readonly onValueChange: (locale: AppLocale) => void;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly triggerClassName?: string;
};

export function LocaleSelect({
  value,
  onValueChange,
  ariaLabel,
  className,
  triggerClassName,
}: LocaleSelectProps) {
  const items = localeSelectItems();
  const selected = isAppLocale(value) ? value : LOCALE_OPTIONS[0]!.value;

  return (
    <Select
      value={value}
      items={items}
      onValueChange={(next) => {
        if (next && isAppLocale(next)) {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn("w-auto rounded-xl", triggerClassName)}
      >
        <SelectValue>
          <span className="inline-flex items-center gap-2">
            <LocaleFlagIcon locale={selected} />
            <span>{localeOptionLabel(selected)}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className={className}>
        {LOCALE_OPTIONS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            <span className="inline-flex items-center gap-2">
              <LocaleFlagIcon locale={item.value} />
              <span>{item.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
