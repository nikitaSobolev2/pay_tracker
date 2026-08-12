"use client";

import { Clock3, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppUser } from "@/hooks/use-app-user";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

import { TravelClock } from "./travel-clock";
import { useTravelDestinationTimezone } from "./use-travel-destination-timezone";

export type TravelClocksCardProps = {
  readonly placeCity: string | null;
  readonly placeCountry: string | null;
  readonly placeLabel: string | null;
  readonly housingLatitude: number | null;
  readonly housingLongitude: number | null;
  readonly className?: string;
};

export function TravelClocksCard({
  placeCity,
  placeCountry,
  placeLabel,
  housingLatitude,
  housingLongitude,
  className,
}: TravelClocksCardProps) {
  const t = useTranslations("travels");
  const { user } = useAppUser();
  const nowMs = useNow();
  const destination = useTravelDestinationTimezone({
    placeCity,
    placeCountry,
    placeLabel,
    housingLatitude,
    housingLongitude,
  });

  const userTimezone = user?.timezone?.trim() || "UTC";
  const showDestinationSlot =
    Boolean(placeCity || placeCountry || placeLabel) ||
    (housingLatitude != null && housingLongitude != null);

  return (
    <Card className={cn("w-full overflow-hidden", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="size-4" />
          {t("clocksTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TravelClock
            nowMs={nowMs}
            timezone={userTimezone}
            title={t("clockYou")}
            subtitle={userTimezone}
          />
          {showDestinationSlot ? (
            destination.loading && !destination.timezone ? (
              <div className="flex min-h-[15rem] flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card/40 px-4 py-5 text-sm text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
                {t("clockDestinationLoading")}
              </div>
            ) : destination.timezone ? (
              <TravelClock
                nowMs={nowMs}
                timezone={destination.timezone}
                title={t("clockDestination")}
                subtitle={
                  destination.label
                    ? `${destination.label} · ${destination.timezone}`
                    : destination.timezone
                }
              />
            ) : (
              <div className="flex min-h-[15rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                {t("clockTimezoneUnknown")}
              </div>
            )
          ) : (
            <div className="flex min-h-[15rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
              {t("clockDestinationEmpty")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
