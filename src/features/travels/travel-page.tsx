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
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { enqueueTravelOp } from "@/lib/offline/travel-offline-sync";
import { prefetchTicketFilesForOffline } from "@/lib/offline/travel-ticket-prefetch";
import { fetchTravel } from "@/lib/api/travels";
import type { TravelDetailDto } from "@/server/services/travel-service.types";
import { useActiveTravelStore } from "@/stores/active-travel.store";
import {
  useTravelCacheStore,
} from "@/stores/travel-cache.store";
import { useTravelOfflineQueueStore } from "@/stores/travel-offline-queue.store";
import { TravelPhase } from "@/types/enums";

import { TravelFinishedSection } from "./travel-finished-section";
import {
  TravelFormDialog,
  type TravelFormValues,
} from "./travel-form-dialog";
import { TravelHousingMapCard } from "./travel-housing-map-card";
import { TravelInProgressSection } from "./travel-in-progress-section";
import { TravelActivityHeatmap } from "./travel-activity-heatmap";
import { TravelPhaseBadge } from "./travel-phase-badge";
import { TravelPlacesToVisitList } from "./travel-places-to-visit-list";
import { TravelPrepareSection } from "./travel-prepare-section";
import { TravelThingsToGrabList } from "./travel-things-to-grab-list";
import { TravelTicketsList } from "./travel-tickets-list";
import { useTravelScheduleLabel } from "./use-travel-schedule-label";

const TRAVEL_CACHE_STORAGE_KEY = "paytracker-travel-cache";

/** Sync read so offline cold load can render before zustand persist finishes. */
function readTravelFromStorage(travelId: string): TravelDetailDto | null {
  if (typeof window === "undefined") {
    return null;
  }
  const fromStore = useTravelCacheStore.getState().byId[travelId];
  if (fromStore) {
    return fromStore;
  }
  try {
    const raw = window.localStorage.getItem(TRAVEL_CACHE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      state?: { byId?: Record<string, TravelDetailDto> };
    };
    return parsed.state?.byId?.[travelId] ?? null;
  } catch {
    return null;
  }
}

export function TravelPage({ travelId }: { readonly travelId: string }) {
  const t = useTranslations("travels");
  const formatSchedule = useTravelScheduleLabel();
  const refreshActiveTravel = useActiveTravelStore((state) => state.refresh);
  const putTravel = useTravelCacheStore((state) => state.putTravel);
  const getTravel = useTravelCacheStore((state) => state.getTravel);
  const hasPendingForTravel = useTravelOfflineQueueStore(
    (state) => state.hasPendingForTravel,
  );
  /** Gate persist-store reads until after mount so SSR HTML matches client. */
  const [hasMounted, setHasMounted] = useState(false);
  const cachedTravel = useTravelCacheStore((state) =>
    hasMounted ? state.byId[travelId] : undefined,
  );
  const queueHydrated = useTravelOfflineQueueStore((state) =>
    hasMounted ? state.hydrated : false,
  );
  const [travel, setTravel] = useState<TravelDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const refresh = useCallback(async () => {
    const pending = hasPendingForTravel(travelId);
    if (pending || (typeof navigator !== "undefined" && !navigator.onLine)) {
      const cached = getTravel(travelId) ?? readTravelFromStorage(travelId);
      if (cached) {
        setTravel(cached);
      }
      return;
    }
    try {
      const result = await fetchTravel(travelId);
      putTravel(result.travel);
      setTravel(result.travel);
      prefetchTicketFilesForOffline(result.travel.tickets);
      await refreshActiveTravel();
    } catch (error) {
      const cached = getTravel(travelId) ?? readTravelFromStorage(travelId);
      if (cached) {
        setTravel(cached);
        return;
      }
      if (!isNetworkError(error)) {
        toast.error(error instanceof Error ? error.message : t("loadFailed"));
      }
    }
  }, [
    getTravel,
    hasPendingForTravel,
    putTravel,
    refreshActiveTravel,
    t,
    travelId,
  ]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }
    if (cachedTravel) {
      setTravel(cachedTravel);
      setLoading(false);
    }
  }, [cachedTravel, hasMounted]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }
    let cancelled = false;

    // Client-only seed: useState init is SSR-null and does not re-run on hydrate.
    const seeded = getTravel(travelId) ?? readTravelFromStorage(travelId);
    if (seeded) {
      setTravel(seeded);
      setLoading(false);
    }

    const offline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    if (offline) {
      if (!seeded) {
        toast.error(t("offlineNoCache"));
      }
      setLoading(false);
      return;
    }

    void (async () => {
      // Only trust the offline queue after persist finishes. Never block the
      // network fetch on hydration — if persist never fires, we'd stay on
      // skeletons forever (seen in production).
      if (queueHydrated && hasPendingForTravel(travelId)) {
        const cached = getTravel(travelId) ?? readTravelFromStorage(travelId);
        if (cached) {
          setTravel(cached);
        }
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }
      try {
        const result = await fetchTravel(travelId);
        if (cancelled) {
          return;
        }
        putTravel(result.travel);
        setTravel(result.travel);
        prefetchTicketFilesForOffline(result.travel.tickets);
        await refreshActiveTravel();
      } catch (error) {
        if (cancelled) {
          return;
        }
        const cached = getTravel(travelId) ?? readTravelFromStorage(travelId);
        if (cached) {
          setTravel(cached);
        } else if (!isNetworkError(error)) {
          toast.error(error instanceof Error ? error.message : t("loadFailed"));
        } else {
          toast.error(t("offlineNoCache"));
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
  }, [
    getTravel,
    hasMounted,
    hasPendingForTravel,
    putTravel,
    queueHydrated,
    refreshActiveTravel,
    t,
    travelId,
  ]);

  useEffect(() => {
    function onSynced(event: Event) {
      const detail = (event as CustomEvent<{ travelId?: string }>).detail;
      if (detail?.travelId && detail.travelId !== travelId) {
        return;
      }
      void refresh();
    }
    window.addEventListener("paytracker:travel-offline-synced", onSynced);
    return () => {
      window.removeEventListener("paytracker:travel-offline-synced", onSynced);
    };
  }, [refresh, travelId]);

  function setPhase(next: string) {
    if (!travel) {
      return;
    }
    const body =
      next === "auto"
        ? { clearPhaseOverride: true as const }
        : { phaseOverride: next as TravelPhase };
    useTravelCacheStore.getState().patchTravel(travel.id, (current) => ({
      ...current,
      phaseOverride: next === "auto" ? null : (next as TravelPhase),
      phase: next === "auto" ? current.phase : (next as TravelPhase),
    }));
    enqueueTravelOp({
      travelId: travel.id,
      op: { kind: "updateTravel", body },
    });
    void refresh();
  }

  async function submitEdit(values: TravelFormValues) {
    if (!travel) {
      return;
    }
    setEditSaving(true);
    try {
      const imageUrl = values.imageUrl.trim();
      const body = {
        title: values.title.trim(),
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        imageUrl:
          imageUrl.startsWith("blob:") || imageUrl.startsWith("offline-file:")
            ? undefined
            : imageUrl || null,
        placeCountry: values.placeCountry || null,
        placeCity: values.placeCity || null,
        placeLabel: values.placeLabel || null,
        housingAddress: values.housingAddress || null,
        housingLatitude: values.housingLatitude,
        housingLongitude: values.housingLongitude,
        housingFloor: values.housingFloor || null,
        housingEntrance: values.housingEntrance || null,
        housingApartment: values.housingApartment || null,
      };
      useTravelCacheStore.getState().patchTravel(travel.id, (current) => ({
        ...current,
        title: body.title,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        imageUrl:
          body.imageUrl === undefined
            ? current.imageUrl
            : body.imageUrl,
        placeCountry: body.placeCountry,
        placeCity: body.placeCity,
        placeLabel: body.placeLabel,
        housingAddress: body.housingAddress,
        housingLatitude: body.housingLatitude,
        housingLongitude: body.housingLongitude,
        housingFloor: body.housingFloor,
        housingEntrance: body.housingEntrance,
        housingApartment: body.housingApartment,
      }));
      enqueueTravelOp({
        travelId: travel.id,
        op: { kind: "updateTravel", body },
      });
      await refresh();
      setEditOpen(false);
    } finally {
      setEditSaving(false);
    }
  }

  if (!hasMounted || loading) {
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
    housingAddress: travel.housingAddress ?? "",
    housingLatitude: travel.housingLatitude ?? null,
    housingLongitude: travel.housingLongitude ?? null,
    housingFloor: travel.housingFloor ?? "",
    housingEntrance: travel.housingEntrance ?? "",
    housingApartment: travel.housingApartment ?? "",
  };

  const showHousingMap = Boolean(
    travel.housingAddress ||
      (travel.housingLatitude != null && travel.housingLongitude != null) ||
      travel.housingFloor ||
      travel.housingEntrance ||
      travel.housingApartment,
  );

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
            className="h-44 w-full rounded-2xl object-cover ring-1 ring-border/50 sm:h-56"
          />
        ) : null}

        {showHousingMap ? (
          <TravelHousingMapCard
            address={travel.housingAddress}
            latitude={travel.housingLatitude}
            longitude={travel.housingLongitude}
            floor={travel.housingFloor}
            entrance={travel.housingEntrance}
            apartment={travel.housingApartment}
            mapEnabled={!editOpen}
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
                setPhase(value);
              }
            }}
          >
            <SelectTrigger className="h-11 w-48 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-80">
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

      <TravelTicketsList
        travelId={travel.id}
        items={travel.tickets}
        onChanged={refresh}
      />

      <TravelPlacesToVisitList
        travelId={travel.id}
        items={travel.placesToVisit}
        onChanged={refresh}
      />

      <TravelThingsToGrabList
        travelId={travel.id}
        items={travel.thingsToGrab}
        onChanged={refresh}
      />

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

      <TravelActivityHeatmap travel={travel} />

      <TravelFormDialog
        open={editOpen}
        mode="edit"
        travelId={travel.id}
        initialValues={editValues}
        saving={editSaving}
        onOpenChange={setEditOpen}
        onSubmit={submitEdit}
      />
    </div>
  );
}
