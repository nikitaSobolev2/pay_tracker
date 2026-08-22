"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EventPhase } from "@/types/enums";

const PHASE_CLASS: Record<EventPhase, string> = {
  [EventPhase.Pending]:
    "border-violet-500/40 bg-violet-500/10 text-violet-800 dark:text-violet-200",
  [EventPhase.InProgress]:
    "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  [EventPhase.Finished]:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  [EventPhase.Canceled]:
    "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
};

const PHASE_LABEL_KEY: Record<EventPhase, string> = {
  [EventPhase.Pending]: "phasePending",
  [EventPhase.InProgress]: "phaseInProgress",
  [EventPhase.Finished]: "phaseFinished",
  [EventPhase.Canceled]: "phaseCanceled",
};

export function EventPhaseBadge({
  phase,
  className,
}: {
  readonly phase: EventPhase;
  readonly className?: string;
}) {
  const t = useTranslations("events");
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-lg px-2 py-0.5 font-medium",
        PHASE_CLASS[phase],
        className,
      )}
    >
      {t(PHASE_LABEL_KEY[phase])}
    </Badge>
  );
}
