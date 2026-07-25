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
              "h-11 w-full justify-between rounded-xl px-3 text-base font-normal md:text-sm",
              className,
            )}
          />
        }
      >
        <span className="truncate">{value || t("timezonePlaceholder")}</span>
        <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--anchor-width) min-w-(--anchor-width) p-0"
      >
        <Command>
          <CommandInput placeholder={t("timezoneSearch")} />
          <CommandList className="max-h-72">
            <CommandEmpty>{t("timezoneEmpty")}</CommandEmpty>
            <CommandGroup>
              {timezones.map((timezone) => (
                <CommandItem
                  key={timezone}
                  value={timezone}
                  data-checked={timezone === value ? true : undefined}
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
