"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangeType } from "@/types/enums";

type DateRangeTypeSwitcherProps = {
  value: DateRangeType;
  onChange: (value: DateRangeType) => void;
};

const OPTIONS = [
  DateRangeType.Day,
  DateRangeType.Month,
  DateRangeType.Year,
  DateRangeType.AllTime,
] as const;

export function DateRangeTypeSwitcher({
  value,
  onChange,
}: DateRangeTypeSwitcherProps) {
  const t = useTranslations("dateRange");

  return (
    <div className="flex w-full justify-center">
      <Tabs
        value={value}
        onValueChange={(next) => {
          if (
            next === DateRangeType.Day ||
            next === DateRangeType.Month ||
            next === DateRangeType.Year ||
            next === DateRangeType.AllTime
          ) {
            onChange(next);
          }
        }}
      >
        <TabsList className="h-9 rounded-lg p-0.5 md:h-14 md:rounded-xl md:p-1">
          {OPTIONS.map((option) => (
            <TabsTrigger
              key={option}
              value={option}
              className="px-2.5 text-sm md:min-w-24 md:px-5 md:text-base md:font-medium"
            >
              {t(option)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
