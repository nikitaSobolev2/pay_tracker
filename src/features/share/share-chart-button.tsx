"use client";

import { Share2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { SharedChartPayload } from "@/features/share/shared-chart-payload";
import { useShareChartStore } from "@/stores/share-chart.store";

type ShareChartButtonProps = {
  readonly payload: SharedChartPayload | null | undefined;
  readonly title?: string;
  readonly className?: string;
  readonly disabled?: boolean;
};

export function ShareChartButton({
  payload,
  title,
  className,
  disabled,
}: ShareChartButtonProps) {
  const t = useTranslations("share");
  const openShare = useShareChartStore((state) => state.openShare);

  if (!payload) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className ?? "size-8 shrink-0 rounded-lg text-muted-foreground"}
      aria-label={t("share")}
      disabled={disabled}
      onClick={() => openShare(payload, title ?? payloadTitle(payload))}
    >
      <Share2 className="size-4" />
    </Button>
  );
}

function payloadTitle(payload: SharedChartPayload): string {
  if ("title" in payload && typeof payload.title === "string") {
    return payload.title;
  }
  return "";
}
