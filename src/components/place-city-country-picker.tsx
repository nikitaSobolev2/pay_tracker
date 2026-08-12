"use client";

import { Check, ChevronsUpDown, Loader2, MapPin, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { FormField } from "@/components/ui/form-field";
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
import { localizedCountryName } from "@/lib/place-names";
import { cn } from "@/lib/utils";
import {
  geocodeCenterWithYmaps,
  searchLocalitiesWithYmaps,
} from "@/lib/yandex-geocode-client";
import { readYandexMapsApiKey } from "@/lib/yandex-maps";

export type PlaceValue = {
  readonly placeCountry: string;
  readonly placeCity: string;
  readonly placeLabel: string;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
};

export type PlaceCityCountryPickerProps = {
  readonly value: PlaceValue | null;
  readonly onChange: (value: PlaceValue | null) => void;
  readonly className?: string;
};

type CountryOption = {
  readonly isoCode: string;
  readonly name: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
};

type CityOption = {
  readonly name: string;
  readonly id: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
};

const CITY_SEARCH_DEBOUNCE_MS = 350;
const MIN_CITY_QUERY_LENGTH = 2;

export function PlaceCityCountryPicker({
  value,
  onChange,
  className,
}: PlaceCityCountryPickerProps) {
  const t = useTranslations("travels");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const yandexEnabled = Boolean(readYandexMapsApiKey());

  const countries = useMemo(() => {
    const options = Country.getAllCountries().map((country): CountryOption => {
      const latitude = Number(country.latitude);
      const longitude = Number(country.longitude);
      return {
        isoCode: country.isoCode,
        name: localizedCountryName(country.isoCode, locale),
        latitude: Number.isFinite(latitude) ? latitude : null,
        longitude: Number.isFinite(longitude) ? longitude : null,
      };
    });
    options.sort((left, right) =>
      left.name.localeCompare(right.name, locale, { sensitivity: "base" }),
    );
    return options;
  }, [locale]);

  const selectedCountry = countries.find(
    (country) =>
      country.isoCode === value?.placeCountry ||
      country.name === value?.placeCountry,
  );

  const fallbackCities = useMemo(() => {
    if (!selectedCountry || yandexEnabled) {
      return [] as CityOption[];
    }
    return (
      City.getCitiesOfCountry(selectedCountry.isoCode)?.map((city): CityOption => {
        const latitude = Number(city.latitude);
        const longitude = Number(city.longitude);
        return {
          name: city.name,
          id: `${city.stateCode}:${city.name}`,
          latitude: Number.isFinite(latitude) ? latitude : null,
          longitude: Number.isFinite(longitude) ? longitude : null,
        };
      }) ?? []
    );
  }, [selectedCountry, yandexEnabled]);

  function selectCountry(country: CountryOption) {
    onChange({
      placeCountry: country.isoCode,
      placeCity: "",
      placeLabel: country.name,
      latitude: yandexEnabled ? null : country.latitude,
      longitude: yandexEnabled ? null : country.longitude,
    });
    if (!yandexEnabled) {
      return;
    }
    void geocodeCenterWithYmaps(country.name, locale, "country")
      .then((place) => {
        if (!place) {
          onChange({
            placeCountry: country.isoCode,
            placeCity: "",
            placeLabel: country.name,
            latitude: country.latitude,
            longitude: country.longitude,
          });
          return;
        }
        onChange({
          placeCountry: country.isoCode,
          placeCity: "",
          placeLabel: country.name,
          latitude: place.latitude,
          longitude: place.longitude,
        });
      })
      .catch(() => {
        onChange({
          placeCountry: country.isoCode,
          placeCity: "",
          placeLabel: country.name,
          latitude: country.latitude,
          longitude: country.longitude,
        });
      });
  }

  function selectCity(
    cityName: string,
    latitude: number | null,
    longitude: number | null,
  ) {
    if (!selectedCountry) {
      return;
    }
    onChange({
      placeCountry: selectedCountry.isoCode,
      placeCity: cityName,
      placeLabel: `${cityName}, ${selectedCountry.name}`,
      latitude,
      longitude,
    });
  }

  const countryDisplay =
    selectedCountry?.name ??
    (value?.placeCountry
      ? localizedCountryName(value.placeCountry, locale)
      : null);

  return (
    <div className={cn("space-y-3", className)}>
      <FormField label={t("placeCountry")} optional>
        <SearchSelect
          isMobile={isMobile}
          valueLabel={countryDisplay ?? t("placeCountryPlaceholder")}
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
      </FormField>

      <FormField label={t("placeCity")} optional>
        {yandexEnabled && selectedCountry ? (
          <CityRemoteSearchSelect
            isMobile={isMobile}
            locale={locale}
            countryName={selectedCountry.name}
            valueLabel={value?.placeCity || t("placeCityPlaceholder")}
            searchPlaceholder={t("placeSearchCity")}
            emptyLabel={t("placeEmpty")}
            sheetTitle={t("placeCity")}
            selectedCity={value?.placeCity ?? ""}
            onSelect={(city) =>
              selectCity(city.name, city.latitude, city.longitude)
            }
          />
        ) : (
          <SearchSelect
            isMobile={isMobile}
            disabled={!selectedCountry}
            valueLabel={
              value?.placeCity ? value.placeCity : t("placeCityPlaceholder")
            }
            searchPlaceholder={t("placeSearchCity")}
            emptyLabel={t("placeEmpty")}
            sheetTitle={t("placeCity")}
            options={fallbackCities.map((city) => ({
              id: city.id,
              label: city.name,
              selected: city.name === value?.placeCity,
              onSelect: () =>
                selectCity(city.name, city.latitude, city.longitude),
            }))}
          />
        )}
      </FormField>

      {value?.placeLabel || value?.placeCity || countryDisplay ? (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm">
          <MapPin className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            {value?.placeCity && countryDisplay
              ? `${value.placeCity}, ${countryDisplay}`
              : (value?.placeLabel ?? countryDisplay)}
          </span>
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

function CityRemoteSearchSelect({
  isMobile,
  locale,
  countryName,
  valueLabel,
  searchPlaceholder,
  emptyLabel,
  sheetTitle,
  selectedCity,
  onSelect,
}: {
  readonly isMobile: boolean;
  readonly locale: string;
  readonly countryName: string;
  readonly valueLabel: string;
  readonly searchPlaceholder: string;
  readonly emptyLabel: string;
  readonly sheetTitle: string;
  readonly selectedCity: string;
  readonly onSelect: (city: CityOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CityOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    const trimmed = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (trimmed.length < MIN_CITY_QUERY_LENGTH) {
        setOptions([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      searchLocalitiesWithYmaps(trimmed, countryName, locale)
        .then((places) => {
          if (cancelled) {
            return;
          }
          const unique = new Map<string, CityOption>();
          for (const place of places) {
            const name =
              place.displayName.split(",")[0]?.trim() || place.displayName;
            if (!unique.has(name)) {
              unique.set(name, {
                name,
                id: `${place.latitude},${place.longitude}`,
                latitude: place.latitude,
                longitude: place.longitude,
              });
            }
          }
          setOptions([...unique.values()]);
        })
        .catch(() => {
          if (!cancelled) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, CITY_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [countryName, locale, open, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setOptions([]);
      setSearching(false);
    }
  }, [open]);

  const list = (
    <Command shouldFilter={false} className="rounded-xl">
      <CommandInput
        placeholder={searchPlaceholder}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-64">
        {searching ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : (
          <>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((city) => (
                <CommandItem
                  key={city.id}
                  value={city.name}
                  className="min-h-11"
                  onSelect={() => {
                    onSelect(city);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4",
                      city.name === selectedCity ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {city.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </Command>
  );

  return (
    <SearchShell
      isMobile={isMobile}
      open={open}
      onOpenChange={setOpen}
      valueLabel={valueLabel}
      sheetTitle={sheetTitle}
    >
      {list}
    </SearchShell>
  );
}

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

  return (
    <SearchShell
      isMobile={isMobile}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      valueLabel={valueLabel}
      sheetTitle={sheetTitle}
    >
      {list}
    </SearchShell>
  );
}

function SearchShell({
  isMobile,
  disabled,
  open,
  onOpenChange,
  valueLabel,
  sheetTitle,
  children,
}: {
  readonly isMobile: boolean;
  readonly disabled?: boolean;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly valueLabel: string;
  readonly sheetTitle: string;
  readonly children: ReactNode;
}) {
  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-12 w-full justify-between rounded-xl px-3 text-base font-normal md:h-11"
          onClick={() => onOpenChange(true)}
        >
          <span className="truncate text-left">{valueLabel}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-60" />
        </Button>
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="h-[85dvh] gap-0 rounded-t-2xl p-0"
          >
            <SheetHeader className="border-b border-border/50 px-4 py-3">
              <SheetTitle>{sheetTitle}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden p-2">{children}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
        className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
