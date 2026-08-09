"use client";

import { Check, ChevronsUpDown, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { City, Country } from "country-state-city";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export type PlaceValue = {
  readonly placeCountry: string;
  readonly placeCity: string;
  readonly placeLabel: string;
};

export type PlaceCityCountryPickerProps = {
  readonly value: PlaceValue | null;
  readonly onChange: (value: PlaceValue | null) => void;
  readonly className?: string;
};

type CountryOption = {
  readonly isoCode: string;
  readonly name: string;
};

type CityOption = {
  readonly name: string;
  readonly stateCode: string;
};

export function PlaceCityCountryPicker({
  value,
  onChange,
  className,
}: PlaceCityCountryPickerProps) {
  const t = useTranslations("travels");
  const isMobile = useIsMobile();
  const countries = useMemo(
    () =>
      Country.getAllCountries().map(
        (country): CountryOption => ({
          isoCode: country.isoCode,
          name: country.name,
        }),
      ),
    [],
  );

  const selectedCountry = countries.find(
    (country) =>
      country.isoCode === value?.placeCountry ||
      country.name === value?.placeCountry,
  );

  const cities = useMemo(() => {
    if (!selectedCountry) {
      return [] as CityOption[];
    }
    return City.getCitiesOfCountry(selectedCountry.isoCode)?.map(
      (city): CityOption => ({
        name: city.name,
        stateCode: city.stateCode,
      }),
    ) ?? [];
  }, [selectedCountry]);

  function selectCountry(country: CountryOption) {
    onChange({
      placeCountry: country.isoCode,
      placeCity: "",
      placeLabel: country.name,
    });
  }

  function selectCity(city: CityOption) {
    if (!selectedCountry) {
      return;
    }
    onChange({
      placeCountry: selectedCountry.isoCode,
      placeCity: city.name,
      placeLabel: `${city.name}, ${selectedCountry.name}`,
    });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label>{t("placeCountry")}</Label>
        <SearchSelect
          isMobile={isMobile}
          valueLabel={selectedCountry?.name ?? t("placeCountryPlaceholder")}
          searchPlaceholder={t("placeSearchCountry")}
          emptyLabel={t("placeEmpty")}
          sheetTitle={t("placeCountry")}
          options={countries.map((country) => ({
            id: country.isoCode,
            label: country.name,
            selected: country.isoCode === selectedCountry?.isoCode,
            onSelect: () => selectCountry(country),
          }))}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("placeCity")}</Label>
        <SearchSelect
          isMobile={isMobile}
          disabled={!selectedCountry}
          valueLabel={
            value?.placeCity
              ? value.placeCity
              : t("placeCityPlaceholder")
          }
          searchPlaceholder={t("placeSearchCity")}
          emptyLabel={t("placeEmpty")}
          sheetTitle={t("placeCity")}
          options={cities.map((city) => ({
            id: `${city.stateCode}:${city.name}`,
            label: city.name,
            selected: city.name === value?.placeCity,
            onSelect: () => selectCity(city),
          }))}
        />
      </div>

      {value?.placeLabel ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{value.placeLabel}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-lg"
            onClick={() => onChange(null)}
            aria-label={t("placeClear")}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type SearchOption = {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
};

function SearchSelect({
  isMobile,
  disabled,
  valueLabel,
  searchPlaceholder,
  emptyLabel,
  sheetTitle,
  options,
}: {
  readonly isMobile: boolean;
  readonly disabled?: boolean;
  readonly valueLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyLabel: string;
  readonly sheetTitle: string;
  readonly options: readonly SearchOption[];
}) {
  const [open, setOpen] = useState(false);

  const list = (
    <Command className="rounded-xl">
      <CommandInput placeholder={searchPlaceholder} />
      <CommandList className="max-h-64">
        <CommandEmpty>{emptyLabel}</CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <CommandItem
              key={option.id}
              value={option.label}
              className="min-h-11"
              onSelect={() => {
                option.onSelect();
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "size-4",
                  option.selected ? "opacity-100" : "opacity-0",
                )}
              />
              {option.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const trigger = (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      className="h-12 w-full justify-between rounded-xl px-3 text-base font-normal md:h-11"
      onClick={() => setOpen(true)}
    >
      <span className="truncate text-left">{valueLabel}</span>
      <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
    </Button>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="z-[80] h-[85dvh] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b border-border/50 px-4 py-3">
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden p-2">{list}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-12 w-full justify-between rounded-xl px-3 text-base font-normal md:h-11"
          />
        }
      >
        <span className="truncate text-left">{valueLabel}</span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="z-[80] w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
      >
        {list}
      </PopoverContent>
    </Popover>
  );
}
