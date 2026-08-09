"use client";

import { MapPin, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchTravel,
  updateTravel,
} from "@/lib/api/travels";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { useActiveTravelStore } from "@/stores/active-travel.store";
import { TravelPhase } from "@/types/enums";

import { TravelFinishedSection } from "./travel-finished-section";
import {
  TravelFormDialog,
  type TravelFormValues,
} from "./travel-form-dialog";
import { TravelInProgressSection } from "./travel-in-progress-section";
import { TravelPhaseBadge } from "./travel-phase-badge";
import { TravelPrepareSection } from "./travel-prepare-section";
import { useTravelScheduleLabel } from "./use-travel-schedule-label";

export function TravelPage({ travelId }: { readonly travelId: string }) {
  const t = useTranslations("travels");
  const formatSchedule = useTravelScheduleLabel();
  const refreshActiveTravel = useActiveTravelStore((state) => state.refresh);
  const [travel, setTravel] = useState<TravelDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetchTravel(travelId);
    setTravel(result.travel);
    await refreshActiveTravel();
  }, [refreshActiveTravel, travelId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await fetchTravel(travelId);
        if (!cancelled) {
          setTravel(result.travel);
        }
        await refreshActiveTravel();
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : t("loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshActiveTravel, t, travelId]);

  async function setPhase(next: string) {
    if (!travel) {
      return;
    }
    try {
      if (next === "auto") {
        await updateTravel(travel.id, { clearPhaseOverride: true });
      } else {
        await updateTravel(travel.id, {
          phaseOverride: next as TravelPhase,
        });
      }
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    }
  }

  async function submitEdit(values: TravelFormValues) {
    if (!travel) {
      return;
    }
    setEditSaving(true);
    try {
      await updateTravel(travel.id, {
        title: values.title.trim(),
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        imageUrl: values.imageUrl.trim() || null,
        placeCountry: values.placeCountry || null,
        placeCity: values.placeCity || null,
        placeLabel: values.placeLabel || null,
      });
      await refresh();
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-4 pb-10">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!travel) {
    return (
      <div className="mx-auto w-full max-w-4xl pb-10">
        <p className="rounded-2xl border border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
          {t("unavailable")}
        </p>
      </div>
    );
  }

  const editValues: TravelFormValues = {
    title: travel.title,
    startsAt: travel.startsAt,
    endsAt: travel.endsAt,
    imageUrl: travel.imageUrl ?? "",
    placeCountry: travel.placeCountry ?? "",
    placeCity: travel.placeCity ?? "",
    placeLabel: travel.placeLabel ?? "",
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-10">
      <header className="space-y-4">
        <PageTitleWithBack fallbackHref="/travels">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight">
                  {travel.title}
                </h1>
                <TravelPhaseBadge phase={travel.phase} />
              </div>
              <p className="text-sm text-muted-foreground">
                {formatSchedule(travel.startsAt, travel.endsAt)}
              </p>
              {travel.placeLabel ? (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {travel.placeLabel}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-11 gap-1.5 rounded-xl"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-4" />
              {t("edit")}
            </Button>
          </div>
        </PageTitleWithBack>

        {travel.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={travel.imageUrl}
            alt=""
            className="h-44 w-full rounded-2xl object-cover sm:h-56"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("phaseSet")}</span>
          <Select
            value={travel.phaseOverride ?? "auto"}
            items={[
              { value: "auto", label: t("phaseAuto") },
              { value: TravelPhase.Prepares, label: t("phasePrepares") },
              { value: TravelPhase.InProgress, label: t("phaseInProgress") },
              { value: TravelPhase.Finished, label: t("phaseFinished") },
              { value: TravelPhase.Failed, label: t("phaseFailed") },
            ]}
            onValueChange={(value) => {
              if (typeof value === "string") {
                void setPhase(value);
              }
            }}
          >
            <SelectTrigger className="h-11 w-[12rem] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[80]">
              <SelectItem value="auto">{t("phaseAuto")}</SelectItem>
              <SelectItem value={TravelPhase.Prepares}>
                {t("phasePrepares")}
              </SelectItem>
              <SelectItem value={TravelPhase.InProgress}>
                {t("phaseInProgress")}
              </SelectItem>
              <SelectItem value={TravelPhase.Finished}>
                {t("phaseFinished")}
              </SelectItem>
              <SelectItem value={TravelPhase.Failed}>
                {t("phaseFailed")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      {travel.phase === TravelPhase.Prepares ? (
        <TravelPrepareSection travel={travel} onRefresh={refresh} />
      ) : null}
      {travel.phase === TravelPhase.InProgress ? (
        <TravelInProgressSection travel={travel} />
      ) : null}
      {travel.phase === TravelPhase.Finished ||
      travel.phase === TravelPhase.Failed ? (
        <TravelFinishedSection travel={travel} />
      ) : null}

      <TravelFormDialog
        open={editOpen}
        mode="edit"
        initialValues={editValues}
        saving={editSaving}
        onOpenChange={setEditOpen}
        onSubmit={submitEdit}
      />
    </div>
  );
}
