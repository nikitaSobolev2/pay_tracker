"use client";

import { CalendarDays, MapPin, Pencil, Plus, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDateRail, ObjectCard } from "@/components/ui/object-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useRouter } from "@/i18n/navigation";
import {
  createEvent,
  fetchEvent,
  listEvents,
  updateEvent,
  type UpdateEventBody,
} from "@/lib/api/events";
import { formatMoney } from "@/lib/money";
import type {
  EventDetailResponse,
  EventListItemDto,
} from "@/server/services/event-service.types";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";
import { EventPublicity } from "@/types/enums";

import {
  EventFormDialog,
  emptyEventFormValues,
  type EventFormValues,
} from "./event-form-dialog";
import { useEventScheduleLabel } from "./use-event-schedule-label";

export function EventsPage() {
  const t = useTranslations("events");
  const router = useRouter();
  const [events, setEvents] = useState<EventListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EventFormValues | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const createValues = useMemo(() => emptyEventFormValues(), []);

  useEffect(() => {
    let cancelled = false;
    listEvents()
      .then((result) => {
        if (!cancelled) {
          setEvents(result.events);
        }
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : t("loadFailed"));
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
    const result = await listEvents();
    setEvents(result.events);
  }

  async function submitCreate(values: EventFormValues) {
    setCreating(true);
    try {
      const result = await createEvent({
        title: values.title.trim(),
        description: values.description.trim() || null,
        occursAt: values.occursAt,
        endsAt: values.endsAt,
        imageUrl: values.imageUrl.trim() || null,
        address: values.location.address || null,
        latitude: values.location.latitude,
        longitude: values.location.longitude,
        publicity: values.publicity,
        guestPermission: values.guestPermission,
        counterpartyIds: [...values.counterpartyIds],
      });
      setCreateOpen(false);
      router.push(`/event/${result.eventId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("createFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function startEdit(eventId: string) {
    setEditLoadingId(eventId);
    try {
      const detail = await fetchEvent(eventId);
      setEditingId(eventId);
      setEditValues(toFormValues(detail));
      setEditOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("loadFailed"));
    } finally {
      setEditLoadingId(null);
    }
  }

  async function submitEdit(values: EventFormValues) {
    if (!editingId) {
      return;
    }
    setEditSaving(true);
    try {
      await updateEvent(editingId, toUpdateBody(values));
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
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <PageTitleWithBack fallbackHref="/">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
        <EventListSkeleton />
      ) : events.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <EventCard
                event={event}
                editLoading={editLoadingId === event.id}
                onEdit={() => void startEdit(event.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <EventFormDialog
        open={createOpen}
        mode="create"
        initialValues={createValues}
        saving={creating}
        onOpenChange={setCreateOpen}
        onSubmit={submitCreate}
      />

      {editValues ? (
        <EventFormDialog
          open={editOpen}
          mode="edit"
          initialValues={editValues}
          saving={editSaving}
          eventId={editingId}
          canManageSharing
          onOpenChange={(open) => {
            setEditOpen(open);
            if (!open) {
              setEditingId(null);
              setEditValues(null);
            }
          }}
          onSubmit={submitEdit}
        />
      ) : null}
    </div>
  );
}

function EventCard({
  event,
  editLoading,
  onEdit,
}: {
  readonly event: EventListItemDto;
  readonly editLoading: boolean;
  readonly onEdit: () => void;
}) {
  const t = useTranslations("events");
  const formatSchedule = useEventScheduleLabel();

  return (
    <ObjectCard className="min-h-0">
      <CalendarDateRail iso={event.occursAt} />
      <Link
        href={`/event/${event.id}`}
        className="flex min-w-0 flex-1 gap-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {event.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.imageUrl}
            alt=""
            className="hidden w-24 shrink-0 object-cover sm:block"
            loading="lazy"
          />
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 text-lg font-semibold tracking-tight">
              {event.title}
            </h2>
            <Badge variant="outline" className="rounded-full text-xs">
              {event.publicity === EventPublicity.Public
                ? t("publicityPublic")
                : t("publicityPrivate")}
            </Badge>
          </div>

          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4 shrink-0" />
            <span className="min-w-0">
              {formatSchedule(event.occursAt, event.endsAt)}
            </span>
          </p>

          {event.address ? (
            <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 line-clamp-2">{event.address}</span>
            </p>
          ) : null}

          <div className="mt-auto flex items-center justify-between gap-3 pt-1 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-4" />
              {event.attendeeCount}
            </span>
            <span className="font-semibold tabular-nums">
              {formatMoney(event.total, event.currency)}
            </span>
          </div>
        </div>
      </Link>

      <div className="flex shrink-0 items-start p-2 sm:p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-xl"
          aria-label={t("edit")}
          title={t("edit")}
          disabled={editLoading}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
      </div>
    </ObjectCard>
  );
}

function EventListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}

function toFormValues(detail: EventDetailResponse): EventFormValues {
  const { event } = detail;
  return {
    title: event.title,
    description: event.description ?? "",
    occursAt: event.occursAt,
    endsAt: event.endsAt,
    imageUrl: event.imageUrl ?? "",
    publicity: event.publicity,
    guestPermission: event.guestPermission,
    location: {
      address: event.address ?? "",
      latitude: event.latitude,
      longitude: event.longitude,
    },
    counterpartyIds: event.attendees.map((attendee) => attendee.counterpartyId),
  };
}

function toUpdateBody(values: EventFormValues): UpdateEventBody {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    occursAt: values.occursAt,
    endsAt: values.endsAt,
    imageUrl: values.imageUrl.trim() || null,
    address: values.location.address || null,
    latitude: values.location.latitude,
    longitude: values.location.longitude,
    publicity: values.publicity,
    guestPermission: values.guestPermission,
  };
}
