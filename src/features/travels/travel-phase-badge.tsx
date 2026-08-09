"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TravelPhase } from "@/types/enums";

const PHASE_CLASS: Record<TravelPhase, string> = {
  [TravelPhase.Prepares]: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  [TravelPhase.InProgress]: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200",
  [TravelPhase.Finished]: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  [TravelPhase.Failed]: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-200",
};

const PHASE_LABEL_KEY: Record<TravelPhase, string> = {
  [TravelPhase.Prepares]: "phasePrepares",
  [TravelPhase.InProgress]: "phaseInProgress",
  [TravelPhase.Finished]: "phaseFinished",
  [TravelPhase.Failed]: "phaseFailed",
};

export function TravelPhaseBadge({
  phase,
  className,
}: {
  readonly phase: TravelPhase;
  readonly className?: string;
}) {
  const t = useTranslations("travels");
  return (
    <Badge
      variant="outline"
      className={cn("rounded-lg px-2 py-0.5 font-medium", PHASE_CLASS[phase], className)}
    >
      {t(PHASE_LABEL_KEY[phase])}
    </Badge>
  );
}
