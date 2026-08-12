"use client";

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EventLinkType } from "@/types/enums";

import { useEventContext } from "./event-context";
import { EventLocationLinks } from "./event-links";
import { EventMapLazy } from "./event-map-lazy";
import { useSurfaceMapAllowed } from "./use-surface-map-allowed";

export type EventMapCardProps = {
  readonly className?: string;
  /** When false, the map is unmounted so it cannot cover dialogs. */
  readonly mapEnabled?: boolean;
};

export function EventMapCard({
  className,
  mapEnabled = true,
}: EventMapCardProps) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const allowMap = useSurfaceMapAllowed(mapEnabled);
  const point =
    event.latitude !== null && event.longitude !== null
      ? { latitude: event.latitude, longitude: event.longitude }
      : null;
  const locationLinks = event.links.filter(
    (link) => link.type === EventLinkType.Location,
  );

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4" />
          {t("location")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex h-full flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {event.address || t("addressEmpty")}
        </p>
        <EventLocationLinks links={locationLinks} />
        {point ? (
          allowMap ? (
            <div
              data-event-surface-map
              className="min-h-52 w-full flex-1"
            >
              <EventMapLazy
                point={point}
                className="size-full min-h-52 overflow-hidden rounded-xl border border-border/60"
              />
            </div>
          ) : (
            <div
              aria-hidden
              className="min-h-52 w-full flex-1 rounded-xl border border-border/60 bg-muted/30"
            />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
