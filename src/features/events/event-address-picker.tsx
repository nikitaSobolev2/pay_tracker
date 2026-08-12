"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { reverseAddress, searchAddress } from "@/lib/api/geocode";
import { cn } from "@/lib/utils";
import type { GeocodeResultDto } from "@/server/services/geocode-service";

import { EventMapLazy } from "./event-map-lazy";

export type EventLocationValue = {
  readonly address: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
};

export type EventAddressPickerProps = {
  readonly value: EventLocationValue;
  readonly onChange: (value: EventLocationValue) => void;
  /**
   * When false, the map stays unmounted. Use the dialog `open` flag so the map
   * is created only after the modal is shown (avoids zero-size / transform bugs).
   */
  readonly mapActive?: boolean;
  /** Extra classes for the map pane (e.g. taller map in a large dialog). */
  readonly mapClassName?: string;
  /** Override the field label (defaults to events.address). */
  readonly label?: string;
  /** Map zoom (e.g. country overview vs city). */
  readonly zoom?: number;
  readonly optional?: boolean;
  readonly showLabel?: boolean;
};

const SEARCH_DEBOUNCE_MS = 500;
const REVERSE_DEBOUNCE_MS = 400;
const MIN_QUERY_LENGTH = 3;
/** Wait for dialog layout + fade before creating the map. */
const MAP_MOUNT_DELAY_MS = 160;

export function EventAddressPicker({
  value,
  onChange,
  mapActive = true,
  mapClassName,
  label,
  zoom,
  optional = true,
  showLabel = true,
}: EventAddressPickerProps) {
  const t = useTranslations("events");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<GeocodeResultDto[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!mapActive) {
      setMapMounted(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setMapMounted(true);
    }, MAP_MOUNT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [mapActive]);

  useEffect(
    () => () => {
      if (reverseTimerRef.current) {
        clearTimeout(reverseTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const trimmed = query.trim();
    let cancelled = false;
    const timer = setTimeout(() => {
      if (trimmed.length < MIN_QUERY_LENGTH) {
        setPlaces([]);
        return;
      }
      setSearching(true);
      searchAddress(trimmed, locale)
        .then((result) => {
          if (!cancelled) {
            setPlaces(result.places);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPlaces([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locale, query]);

  function selectPlace(place: GeocodeResultDto) {
    onChange({
      address: place.displayName,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setQuery("");
    setPlaces([]);
  }

  /**
   * Map centre moved (drag/zoom finished). Keep coords immediately; resolve the
   * human-readable address for whatever sits under the fixed centre pin.
   */
  function moveCenter(next: { latitude: number; longitude: number }) {
    onChange({
      address: value.address,
      latitude: next.latitude,
      longitude: next.longitude,
    });
    if (reverseTimerRef.current) {
      clearTimeout(reverseTimerRef.current);
    }
    reverseTimerRef.current = setTimeout(() => {
      reverseAddress(next.latitude, next.longitude, locale)
        .then((result) => {
          if (!result.place) {
            return;
          }
          onChange({
            address: result.place.displayName,
            latitude: next.latitude,
            longitude: next.longitude,
          });
        })
        .catch(() => undefined);
    }, REVERSE_DEBOUNCE_MS);
  }

  const point =
    value.latitude !== null && value.longitude !== null
      ? { latitude: value.latitude, longitude: value.longitude }
      : null;

  const body = (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-12 rounded-xl pl-9 text-base md:h-11"
          placeholder={t("addressSearchPlaceholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {places.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/60 bg-card/60 p-1">
          {places.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                type="button"
                className="min-h-11 w-full rounded-lg px-3 py-2.5 text-left text-base hover:bg-muted/60 md:text-sm"
                onClick={() => selectPlace(place)}
              >
                {place.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 break-words">
          {value.address || t("addressEmpty")}
        </span>
        {value.address ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg"
            onClick={() =>
              onChange({ address: "", latitude: null, longitude: null })
            }
          >
            {t("addressClear")}
          </Button>
        ) : null}
      </div>

      {mapMounted ? (
        <EventMapLazy
          point={point}
          pickable
          zoom={zoom}
          className={cn(
            "h-56 w-full overflow-hidden rounded-xl border border-border/60",
            mapClassName,
          )}
          onCenterChange={moveCenter}
        />
      ) : (
        <div
          aria-hidden
          className={cn(
            "h-56 w-full rounded-xl border border-border/60 bg-muted/30",
            mapClassName,
          )}
        />
      )}
      <p className="text-xs text-muted-foreground">{t("addressMapHint")}</p>
    </div>
  );

  if (!showLabel) {
    return body;
  }

  return (
    <FormField label={label ?? t("address")} optional={optional}>
      {body}
    </FormField>
  );
}
