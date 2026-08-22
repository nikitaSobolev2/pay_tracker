"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateEvent } from "@/lib/api/events";
import { useUpcomingEventStore } from "@/stores/upcoming-event.store";
import { EventPhase } from "@/types/enums";

type EventPhaseSelectProps = {
  readonly eventId: string;
  readonly phaseOverride: EventPhase | null;
  readonly onChanged: () => Promise<void>;
};

export function EventPhaseSelect({
  eventId,
  phaseOverride,
  onChanged,
}: EventPhaseSelectProps) {
  const t = useTranslations("events");

  async function setPhase(next: string) {
    try {
      const body =
        next === "auto"
          ? { clearPhaseOverride: true as const }
          : { phaseOverride: next as EventPhase };
      await updateEvent(eventId, body);
      await onChanged();
      await useUpcomingEventStore.getState().refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{t("phaseSet")}</span>
      <Select
        value={phaseOverride ?? "auto"}
        items={[
          { value: "auto", label: t("phaseAuto") },
          { value: EventPhase.Pending, label: t("phasePending") },
          { value: EventPhase.InProgress, label: t("phaseInProgress") },
          { value: EventPhase.Finished, label: t("phaseFinished") },
          { value: EventPhase.Canceled, label: t("phaseCanceled") },
        ]}
        onValueChange={(value) => {
          if (typeof value === "string") {
            void setPhase(value);
          }
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-80">
          <SelectItem value="auto">{t("phaseAuto")}</SelectItem>
          <SelectItem value={EventPhase.Pending}>
            {t("phasePending")}
          </SelectItem>
          <SelectItem value={EventPhase.InProgress}>
            {t("phaseInProgress")}
          </SelectItem>
          <SelectItem value={EventPhase.Finished}>
            {t("phaseFinished")}
          </SelectItem>
          <SelectItem value={EventPhase.Canceled}>
            {t("phaseCanceled")}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
