"use client";

import { ChevronsUpDownIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listTimezones } from "@/lib/timezones";
import { cn } from "@/lib/utils";

type TimezoneComboboxProps = {
  readonly value: string;
  readonly onChange: (timezone: string) => void;
  readonly className?: string;
};

export function TimezoneCombobox({
  value,
  onChange,
  className,
}: TimezoneComboboxProps) {
  const t = useTranslations("settings");
  const [open, setOpen] = useState(false);

  const timezones = useMemo(() => {
    const zones = listTimezones();
    if (value && !zones.includes(value)) {
      return [value, ...zones];
    }
    return zones;
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "h-12 w-full justify-between rounded-xl px-3 text-base font-normal md:h-11 md:text-sm",
              className,
            )}
          />
        }
      >
        <span className="truncate">{value || t("timezonePlaceholder")}</span>
        <ChevronsUpDownIcon className="size-5 shrink-0 opacity-50 md:size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-(--anchor-width) rounded-xl p-0"
      >
        <Command className="rounded-xl">
          <CommandInput
            placeholder={t("timezoneSearch")}
            wrapperClassName="p-2 pb-1 sm:p-1.5 sm:pb-0"
            inputGroupClassName="h-12! rounded-xl! *:data-[slot=input-group-addon]:pl-3! sm:h-10! [&_svg]:size-5 sm:[&_svg]:size-4"
            className="text-base sm:text-sm"
          />
          <CommandList className="max-h-[min(60dvh,24rem)] sm:max-h-72">
            <CommandEmpty className="py-8 text-base sm:py-6 sm:text-sm">
              {t("timezoneEmpty")}
            </CommandEmpty>
            <CommandGroup className="p-1.5 sm:p-1">
              {timezones.map((timezone) => (
                <CommandItem
                  key={timezone}
                  value={timezone}
                  data-checked={timezone === value ? true : undefined}
                  className="min-h-12 gap-3 rounded-lg px-3 py-3 text-base sm:min-h-0 sm:gap-2 sm:rounded-sm sm:px-2 sm:py-1.5 sm:text-sm"
                  onSelect={() => {
                    onChange(timezone);
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{timezone}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
