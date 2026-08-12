"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { geocodeCenterWithYmaps } from "@/lib/yandex-geocode-client";
import { timezoneFromCoordinates } from "@/lib/timezone-from-coordinates";
import { localizedCountryName } from "@/lib/place-names";
import { readYandexMapsApiKey } from "@/lib/yandex-maps";

export type TravelDestinationClockInput = {
  readonly placeCity: string | null;
  readonly placeCountry: string | null;
  readonly placeLabel: string | null;
  readonly housingLatitude: number | null;
  readonly housingLongitude: number | null;
};

export type TravelDestinationClockResult = {
  readonly timezone: string | null;
  readonly loading: boolean;
  readonly label: string | null;
};

/**
 * Resolves the travel destination IANA timezone from housing coordinates, or by
 * geocoding city/country when coords are missing.
 */
export function useTravelDestinationTimezone(
  input: TravelDestinationClockInput,
): TravelDestinationClockResult {
  const locale = useLocale();
  const [timezone, setTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const label =
    input.placeLabel?.trim() ||
    [input.placeCity, input.placeCountry]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(", ") ||
    null;

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const fromHousing = timezoneFromCoordinates(
        input.housingLatitude ?? Number.NaN,
        input.housingLongitude ?? Number.NaN,
      );
      if (fromHousing) {
        if (!cancelled) {
          setTimezone(fromHousing);
          setLoading(false);
        }
        return;
      }

      const city = input.placeCity?.trim() ?? "";
      const countryCode = input.placeCountry?.trim() ?? "";
      if (!city && !countryCode) {
        if (!cancelled) {
          setTimezone(null);
          setLoading(false);
        }
        return;
      }

      if (!readYandexMapsApiKey()) {
        if (!cancelled) {
          setTimezone(null);
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }

      try {
        const countryName = countryCode
          ? localizedCountryName(countryCode, locale)
          : "";
        const query = city
          ? countryName
            ? `${city}, ${countryName}`
            : city
          : countryName;
        const place = await geocodeCenterWithYmaps(
          query,
          locale,
          city ? "locality" : "country",
        );
        if (cancelled) {
          return;
        }
        if (!place) {
          setTimezone(null);
          return;
        }
        setTimezone(
          timezoneFromCoordinates(place.latitude, place.longitude),
        );
      } catch {
        if (!cancelled) {
          setTimezone(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [
    input.housingLatitude,
    input.housingLongitude,
    input.placeCity,
    input.placeCountry,
    locale,
  ]);

  return { timezone, loading, label };
}
