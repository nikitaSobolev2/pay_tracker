"use client";

import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type GoToDayButtonProps = {
  readonly date: string;
  readonly onGoToDay: (date: string) => void;
};

export function GoToDayButton({ date, onGoToDay }: GoToDayButtonProps) {
  const t = useTranslations("charts");
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2 text-xs"
      onClick={() => onGoToDay(date)}
    >
      <CalendarDays className="size-3.5" />
      {t("goToDay")}
    </Button>
  );
}
