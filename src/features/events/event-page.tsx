"use client";

import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ensureGuest,
  fetchEvent,
  updateEvent,
  type UpdateEventBody,
} from "@/lib/api/events";
import type {
  EventDetailResponse,
  EventSettlementResponse,
} from "@/server/services/event-service.types";
import { EventAuthorRole } from "@/types/enums";

import { EventBentoGrid } from "./event-bento-grid";
import { EventChatDrawer } from "./event-chat-drawer";
import { eventChatGutterPx } from "./event-chat-layout";
import { EventChatRail } from "./event-chat-rail";
import { EventProvider } from "./event-context";
import { EventFormDialog, type EventFormValues } from "./event-form-dialog";
import { EventHero } from "./event-hero";
import { EventMobileHeaderIsland } from "./event-mobile-header-island";
import { EventMobileNavIsland } from "./event-mobile-nav-island";
import { EventMobileTabs } from "./event-mobile-tabs";
import { EventTopBar } from "./event-top-bar";
import { useEventLive } from "./use-event-live";

const CHAT_OPEN_STORAGE_KEY = "pt_event_chat_open";

export function EventPage({ eventId }: { readonly eventId: string }) {
  const t = useTranslations("events");
  const isMobile = useIsMobile();
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [chatOpen, setChatOpen] = useState(readStoredChatOpen);
  const [seenMessageCount, setSeenMessageCount] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const live = useEventLive(eventId, chatOpen);
  const seenContentRevisionRef = useRef<string | null>(null);

  const refreshEvent = useCallback(async () => {
    const next = await fetchEvent(eventId);
    setDetail(next);
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    seenContentRevisionRef.current = null;
    setLoadFailed(false);
    ensureGuest()
      .catch(() => undefined)
      .then(() => fetchEvent(eventId))
      .then((next) => {
        if (!cancelled) {
          setDetail(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // Guests (and other tabs) pick up spendings, people, charts, hero, etc.
  useEffect(() => {
    const revision = live.contentRevision;
    if (!revision) {
      return;
    }
    if (seenContentRevisionRef.current === null) {
      seenContentRevisionRef.current = revision;
      return;
    }
    if (seenContentRevisionRef.current === revision) {
      return;
    }
    seenContentRevisionRef.current = revision;
    void refreshEvent().catch(() => undefined);
  }, [live.contentRevision, refreshEvent]);

  const applySettlement = useCallback((settlement: EventSettlementResponse) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            event: {
              ...current.event,
              attendees: settlement.attendees,
              payments: settlement.payments,
              summary: settlement.summary,
            },
          }
        : current,
    );
  }, []);

  const editValues = useMemo<EventFormValues | null>(
    () => (detail ? toFormValues(detail) : null),
    [detail],
  );

  function setChatVisible(next: boolean) {
    setChatOpen(next);
    window.localStorage.setItem(CHAT_OPEN_STORAGE_KEY, String(next));
    if (next) {
      setSeenMessageCount(live.messages.length);
    }
  }

  async function submitEdit(values: EventFormValues) {
    setSaving(true);
    try {
      const isOwner = detail?.viewer.role === EventAuthorRole.Owner;
      await updateEvent(eventId, toUpdateBody(values, isOwner));
      await refreshEvent();
      setEditOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  if (loadFailed) {
    return (
      <p className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-muted-foreground">
        {t("unavailable")}
      </p>
    );
  }

  if (!detail || !editValues) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <EventProvider
      value={{
        event: detail.event,
        viewer: detail.viewer,
        threadCounts: live.threadCounts,
        refreshEvent,
        applySettlement,
      }}
    >
      {/* Desktop chat rail gutter: data-event-chat-gutter rule in globals.css */}
      <div
        data-event-chat-gutter
        className="min-w-0 overflow-x-clip transition-[margin-right] duration-200 ease-out"
        style={
          {
            "--event-chat-gutter": `${eventChatGutterPx(chatOpen)}px`,
          } as CSSProperties
        }
      >
        <div className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:pb-16">
          {isMobile ? (
            <EventMobileHeaderIsland
              viewers={live.viewers}
              onRenamed={async () => {
                await live.poll();
              }}
            />
          ) : null}

          <EventTopBar />

          <EventHero
            viewers={live.viewers}
            onEdit={() => setEditOpen(true)}
            onRenamed={async () => {
              await live.poll();
            }}
          />

          {isMobile ? (
            <EventMobileTabs mapEnabled={!editOpen} />
          ) : (
            <EventBentoGrid mapEnabled={!editOpen} />
          )}
        </div>
      </div>

      {isMobile ? (
        <EventMobileNavIsland
          messages={live.messages}
          unreadCount={
            chatOpen ? 0 : Math.max(live.messages.length - seenMessageCount, 0)
          }
          onChatOpenChange={setChatVisible}
          onPosted={live.poll}
          onDeleted={live.removeMessage}
        />
      ) : (
        <>
          <EventChatRail
            open={chatOpen}
            unreadCount={
              chatOpen ? 0 : Math.max(live.messages.length - seenMessageCount, 0)
            }
            onToggle={() => setChatVisible(!chatOpen)}
          />
          <EventChatDrawer
            open={chatOpen}
            messages={live.messages}
            onClose={() => setChatVisible(false)}
            onPosted={live.poll}
            onDeleted={live.removeMessage}
          />
        </>
      )}

      <EventFormDialog
        open={editOpen}
        mode="edit"
        initialValues={editValues}
        saving={saving}
        eventId={eventId}
        canManageSharing={detail.viewer.role === EventAuthorRole.Owner}
        onOpenChange={setEditOpen}
        onSubmit={submitEdit}
      />
    </EventProvider>
  );
}

function readStoredChatOpen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(CHAT_OPEN_STORAGE_KEY) === "true";
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

function toUpdateBody(
  values: EventFormValues,
  isOwner: boolean,
): UpdateEventBody {
  const base: UpdateEventBody = {
    title: values.title.trim(),
    description: values.description.trim() || null,
    occursAt: values.occursAt,
    endsAt: values.endsAt,
    imageUrl: values.imageUrl.trim() || null,
    address: values.location.address || null,
    latitude: values.location.latitude,
    longitude: values.location.longitude,
  };
  if (!isOwner) {
    return base;
  }
  return {
    ...base,
    publicity: values.publicity,
    guestPermission: values.guestPermission,
  };
}
