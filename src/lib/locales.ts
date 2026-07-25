import { AppLocale } from "@/types/enums";

export type LocaleOption = {
  readonly value: AppLocale;
  readonly label: string;
};

export const LOCALE_OPTIONS: readonly LocaleOption[] = [
  { value: AppLocale.En, label: "English" },
  { value: AppLocale.Ru, label: "Русский" },
] as const;

export function localeSelectItems(): Array<{ value: string; label: string }> {
  return LOCALE_OPTIONS.map((item) => ({
    value: item.value,
    label: item.label,
  }));
}

export function isAppLocale(value: string): value is AppLocale {
  return value === AppLocale.En || value === AppLocale.Ru;
}

export function localeOptionLabel(value: string): string {
  return (
    LOCALE_OPTIONS.find((item) => item.value === value)?.label ?? value
  );
}
