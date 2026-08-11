"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { ActivityHeatmapCard } from "@/features/charts/activity-heatmap";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { TransactionType } from "@/types/enums";

export function TravelActivityHeatmap({
  travel,
}: {
  readonly travel: TravelDetailDto;
}) {
  const t = useTranslations("travels");
  const tCharts = useTranslations("charts");

  const filters = useMemo(
    () => ({
      travelId: travel.id,
      type: TransactionType.Spending,
    }),
    [travel.id],
  );

  return (
    <ActivityHeatmapCard
      title={tCharts("activity")}
      description={t("activityHeatmapHint")}
      currency={travel.currency}
      filters={filters}
      disableShare
      weekFlow="row"
      drilldownLayout="below"
    />
  );
}
