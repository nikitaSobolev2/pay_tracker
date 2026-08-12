"use client";

import { Home, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventMapLazy } from "@/features/events/event-map-lazy";
import { useSurfaceMapAllowed } from "@/features/events/use-surface-map-allowed";
import { cn } from "@/lib/utils";

export type TravelHousingMapCardProps = {
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly floor?: string | null;
  readonly entrance?: string | null;
  readonly apartment?: string | null;
  readonly className?: string;
  /** When false, the map is unmounted so it cannot cover dialogs. */
  readonly mapEnabled?: boolean;
};

export function TravelHousingMapCard({
  address,
  latitude,
  longitude,
  floor,
  entrance,
  apartment,
  className,
  mapEnabled = true,
}: TravelHousingMapCardProps) {
  const t = useTranslations("travels");
  const allowMap = useSurfaceMapAllowed(mapEnabled);
  const point =
    latitude !== null && longitude !== null
      ? { latitude, longitude }
      : null;
  const detailParts = [
    entrance ? t("housingEntranceValue", { value: entrance }) : null,
    floor ? t("housingFloorValue", { value: floor }) : null,
    apartment ? t("housingApartmentValue", { value: apartment }) : null,
  ].filter((part): part is string => Boolean(part));

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Home className="size-4" />
          {t("housingAddress")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {address ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 break-words">{address}</span>
          </p>
        ) : null}
        {detailParts.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            {detailParts.join(" · ")}
          </p>
        ) : null}
        {point ? (
          allowMap ? (
            <div data-travel-surface-map className="min-h-52 w-full">
              <EventMapLazy
                point={point}
                className="size-full min-h-52 overflow-hidden rounded-xl border border-border/60"
              />
            </div>
          ) : (
            <div
              aria-hidden
              className="min-h-52 w-full rounded-xl border border-border/60 bg-muted/30"
            />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
