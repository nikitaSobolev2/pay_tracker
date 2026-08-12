"use client";

import { MapPin, Pencil, Plane, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createTravel,
  fetchTravel,
  listTravels,
  updateTravel,
} from "@/lib/api/travels";
import { formatChartMoney } from "@/lib/money";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { cn } from "@/lib/utils";
import type { TravelListItemDto } from "@/server/services/travel-service.types";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";

import { TravelPhaseBadge } from "./travel-phase-badge";
import {
  TravelFormDialog,
  emptyTravelFormValues,
  type TravelFormValues,
} from "./travel-form-dialog";
import { useTravelScheduleLabel } from "./use-travel-schedule-label";

export function TravelsPage() {
  const t = useTranslations("travels");
  const router = useRouter();
  const [travels, setTravels] = useState<TravelListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TravelFormValues | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const createValues = useMemo(() => emptyTravelFormValues(), []);

  useEffect(() => {
    let cancelled = false;
    listTravels()
      .then((result) => {
        if (!cancelled) {
          setTravels(result.travels);
        }
      })
      .catch((error: unknown) => {
        if (!isNetworkError(error)) {
          toast.error(error instanceof Error ? error.message : t("loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const setMobilePageChrome = useMobilePageChromeStore(
    (state) => state.setChrome,
  );

  useEffect(() => {
    setMobilePageChrome({
      action: {
        kind: "add",
        onClick: () => setCreateOpen(true),
        label: t("create"),
      },
    });
    return () => setMobilePageChrome(null);
  }, [setMobilePageChrome, t]);

  async function refreshList() {
    const result = await listTravels();
    setTravels(result.travels);
  }

  async function submitCreate(values: TravelFormValues) {
    setCreating(true);
    try {
      const result = await createTravel({
        title: values.title.trim(),
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        imageUrl: values.imageUrl.trim() || null,
        placeCountry: values.placeCountry || null,
        placeCity: values.placeCity || null,
        placeLabel: values.placeLabel || null,
        housingAddress: values.housingAddress || null,
        housingLatitude: values.housingLatitude,
        housingLongitude: values.housingLongitude,
      });
      setCreateOpen(false);
      router.push(`/travels/${result.travelId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function startEdit(travelId: string) {
    setEditLoadingId(travelId);
    try {
      const detail = await fetchTravel(travelId);
      setEditingId(travelId);
      setEditValues({
        title: detail.travel.title,
        startsAt: detail.travel.startsAt,
        endsAt: detail.travel.endsAt,
        imageUrl: detail.travel.imageUrl ?? "",
        placeCountry: detail.travel.placeCountry ?? "",
        placeCity: detail.travel.placeCity ?? "",
        placeLabel: detail.travel.placeLabel ?? "",
        housingAddress: detail.travel.housingAddress ?? "",
        housingLatitude: detail.travel.housingLatitude,
        housingLongitude: detail.travel.housingLongitude,
      });
      setEditOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setEditLoadingId(null);
    }
  }

  async function submitEdit(values: TravelFormValues) {
    if (!editingId) {
      return;
    }
    setEditSaving(true);
    try {
      await updateTravel(editingId, {
        title: values.title.trim(),
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        imageUrl: values.imageUrl.trim() || null,
        placeCountry: values.placeCountry || null,
        placeCity: values.placeCity || null,
        placeLabel: values.placeLabel || null,
        housingAddress: values.housingAddress || null,
        housingLatitude: values.housingLatitude,
        housingLongitude: values.housingLongitude,
      });
      await refreshList();
      setEditOpen(false);
      setEditingId(null);
      setEditValues(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <PageTitleWithBack fallbackHref="/">
          <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {t("subtitle")}
          </p>
        </PageTitleWithBack>
        <Button
          type="button"
          className="h-11 shrink-0 gap-1.5 rounded-xl max-md:hidden"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </header>

      {loading ? (
        <TravelListSkeleton />
      ) : travels.length === 0 ? (
        <p className="rounded-2xl border border-border/60 bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {travels.map((travel) => (
            <li key={travel.id}>
              <TravelCard
                travel={travel}
                editLoading={editLoadingId === travel.id}
                onEdit={() => void startEdit(travel.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <TravelFormDialog
        open={createOpen}
        mode="create"
        initialValues={createValues}
        saving={creating}
        onOpenChange={setCreateOpen}
        onSubmit={submitCreate}
      />

      {editValues ? (
        <TravelFormDialog
          open={editOpen}
          mode="edit"
          initialValues={editValues}
          saving={editSaving}
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditValues(null);
              setEditingId(null);
            }
          }}
          onSubmit={submitEdit}
        />
      ) : null}
    </div>
  );
}

function TravelCard({
  travel,
  editLoading,
  onEdit,
}: {
  readonly travel: TravelListItemDto;
  readonly editLoading: boolean;
  readonly onEdit: () => void;
}) {
  const t = useTranslations("travels");
  const formatSchedule = useTravelScheduleLabel();

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <div className="flex">
        <Link
          href={`/travels/${travel.id}`}
          className="flex min-w-0 flex-1 gap-3 p-3 sm:p-4"
        >
          {travel.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={travel.imageUrl}
              alt=""
              className="size-16 shrink-0 rounded-xl object-cover sm:size-20"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-muted sm:size-20">
              <Plane className="size-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-base font-semibold sm:text-lg">
                {travel.title}
              </h2>
              <TravelPhaseBadge phase={travel.phase} />
            </div>
            <p className="text-sm text-muted-foreground">
              {formatSchedule(travel.startsAt, travel.endsAt)}
            </p>
            {travel.placeLabel ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{travel.placeLabel}</span>
              </p>
            ) : null}
            <p className="text-sm tabular-nums text-muted-foreground">
              {t("plannedTotal")}:{" "}
              {formatChartMoney(travel.plannedTotal, travel.currency)}
              {" · "}
              {t("actualTotal")}:{" "}
              {formatChartMoney(travel.actualTotal, travel.currency)}
            </p>
          </div>
        </Link>
        <div className="flex items-start p-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("size-11 rounded-xl", editLoading && "opacity-60")}
            disabled={editLoading}
            onClick={onEdit}
            aria-label={t("edit")}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TravelListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}
