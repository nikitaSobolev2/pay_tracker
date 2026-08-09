"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { EventTiming } from "@/lib/event-timing";
import { cn } from "@/lib/utils";

const TIMING_CLASS: Record<"upcoming" | "inProgress", string> = {
  upcoming:
    "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  inProgress:
    "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
};

const TIMING_LABEL_KEY: Record<"upcoming" | "inProgress", string> = {
  upcoming: "timingUpcoming",
  inProgress: "timingInProgress",
};

export function EventTimingBadge({
  timing,
  className,
}: {
  readonly timing: Exclude<EventTiming, "finished">;
  readonly className?: string;
}) {
  const t = useTranslations("events");
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg px-2 py-0.5 font-medium",
        TIMING_CLASS[timing],
        className,
      )}
    >
      {t(TIMING_LABEL_KEY[timing])}
    </Badge>
  );
}
