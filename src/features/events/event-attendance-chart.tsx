"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BENTO_CARD_CLASS, BENTO_LABEL_CLASS } from "@/lib/bento";
import { cn } from "@/lib/utils";
import { EventAttendanceStatus } from "@/types/enums";

import { useEventContext } from "./event-context";

export function EventAttendanceCard({
  className,
}: {
  readonly className?: string;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const certainCount = event.attendees.filter(
    (attendee) => attendee.status === EventAttendanceStatus.Certain,
  ).length;
  const uncertainCount = event.attendees.filter(
    (attendee) => attendee.status === EventAttendanceStatus.Uncertain,
  ).length;
  const maxCount = certainCount + uncertainCount;
  const certainPercent = maxCount > 0 ? (certainCount / maxCount) * 100 : 0;
  const uncertainPercent = maxCount > 0 ? (uncertainCount / maxCount) * 100 : 0;

  return (
    <Card className={cn(BENTO_CARD_CLASS, className)}>
      <CardHeader>
        <CardTitle className={BENTO_LABEL_CLASS}>{t("attendanceTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div>
          <p className="text-3xl font-semibold tabular-nums">{certainCount}</p>
          <p className="text-sm text-muted-foreground">
            {t("attendanceConfirmedLabel")}
          </p>
        </div>
        {maxCount > 0 ? (
          <div className="mt-auto space-y-3">
            <div className="space-y-1.5">
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="flex h-full w-full">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${certainPercent}%` }}
                  />
                  <div
                    className="h-full bg-amber-400/70"
                    style={{ width: `${uncertainPercent}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full bg-emerald-500"
                    aria-hidden
                  />
                  {t("attendanceLegendCertain")}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full bg-amber-400/70"
                    aria-hidden
                  />
                  {t("attendanceLegendUncertain")}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("attendanceRange", {
                certain: certainCount,
                total: maxCount,
              })}
            </p>
            {uncertainCount > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("attendanceHint", { uncertain: uncertainCount })}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("attendanceAllCertain")}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-auto text-sm text-muted-foreground">{t("attendeesEmpty")}</p>
        )}
      </CardContent>
    </Card>
  );
}
