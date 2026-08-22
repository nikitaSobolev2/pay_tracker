"use client";

import { Pencil } from "lucide-react";
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

import { PageTitleWithBack } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ensureGuest,
  fetchEvent,
  updateEvent,
  type UpdateEventBody,
} from "@/lib/api/events";
import { cn } from "@/lib/utils";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";
import type { EventPresenceViewerDto } from "@/server/services/event-live-service";
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
import { EventGuestClaimDialog } from "./event-guest-claim-dialog";
import {
  EventAppHeroCover,
  EventAppHeroDetails,
  EventHero,
} from "./event-hero";
import { EventMobileChatSheet } from "./event-mobile-chat-sheet";
import { EventMobileHeaderIsland } from "./event-mobile-header-island";
import { EventMobileNavIsland } from "./event-mobile-nav-island";
import { EventMobileTabs } from "./event-mobile-tabs";
import { EventTopBar } from "./event-top-bar";
import { useEventAppMobileChrome } from "./use-event-app-mobile-chrome";
import { useEventLive } from "./use-event-live";

const CHAT_OPEN_STORAGE_KEY = "pt_event_chat_open";
const APP_CHAT_INSET_CLASS = "top-14";

export type EventPageChrome = "app" | "public";

export function EventPage({
  eventId,
  chrome = "public",
}: {
  readonly eventId: string;
  readonly chrome?: EventPageChrome;
}) {
  const t = useTranslations("events");
  const isAppChrome = chrome === "app";
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

  const unreadCount = chatOpen
    ? 0
    : Math.max(live.messages.length - seenMessageCount, 0);

  const setChatVisible = useCallback(
    (next: boolean) => {
      setChatOpen(next);
      window.localStorage.setItem(CHAT_OPEN_STORAGE_KEY, String(next));
      if (next) {
        setSeenMessageCount(live.messages.length);
      }
    },
    [live.messages.length],
  );

  const openChat = useCallback(() => {
    setChatVisible(true);
  }, [setChatVisible]);

  useEventAppMobileChrome({
    enabled: isAppChrome && !loadFailed,
    unreadCount,
    onOpenChat: openChat,
  });

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
      <p
        className={cn(
          "mx-auto max-w-2xl text-center text-sm text-muted-foreground",
          isAppChrome ? "pb-10" : "px-4 py-16",
        )}
      >
        {t("unavailable")}
      </p>
    );
  }

  if (!detail || !editValues) {
    return (
      <div
        className={cn(
          "mx-auto w-full max-w-6xl space-y-4",
          isAppChrome ? "pb-10" : "p-4",
        )}
      >
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
      <EventGuestClaimDialog />
      <EventLoadedView
        isAppChrome={isAppChrome}
        isMobile={isMobile}
        canEdit={detail.viewer.canEdit}
        isOwner={detail.viewer.role === EventAuthorRole.Owner}
        chatOpen={chatOpen}
        unreadCount={unreadCount}
        viewers={live.viewers}
        messages={live.messages}
        editOpen={editOpen}
        editValues={editValues}
        saving={saving}
        eventId={eventId}
        onEdit={() => setEditOpen(true)}
        onEditOpenChange={setEditOpen}
        onSubmitEdit={submitEdit}
        onChatOpenChange={setChatVisible}
        onPoll={live.poll}
        onDeleted={live.removeMessage}
      />
    </EventProvider>
  );
}

function EventLoadedView({
  isAppChrome,
  isMobile,
  canEdit,
  isOwner,
  chatOpen,
  unreadCount,
  viewers,
  messages,
  editOpen,
  editValues,
  saving,
  eventId,
  onEdit,
  onEditOpenChange,
  onSubmitEdit,
  onChatOpenChange,
  onPoll,
  onDeleted,
}: {
  readonly isAppChrome: boolean;
  readonly isMobile: boolean;
  readonly canEdit: boolean;
  readonly isOwner: boolean;
  readonly chatOpen: boolean;
  readonly unreadCount: number;
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly messages: readonly EventChatMessageDto[];
  readonly editOpen: boolean;
  readonly editValues: EventFormValues;
  readonly saving: boolean;
  readonly eventId: string;
  readonly onEdit: () => void;
  readonly onEditOpenChange: (open: boolean) => void;
  readonly onSubmitEdit: (values: EventFormValues) => Promise<void>;
  readonly onChatOpenChange: (open: boolean) => void;
  readonly onPoll: () => Promise<void>;
  readonly onDeleted: (messageId: string) => void;
}) {
  return (
    <>
      <div
        data-event-chat-gutter
        className="min-w-0 overflow-x-clip transition-[margin-right] duration-200 ease-out"
        style={
          {
            "--event-chat-gutter": `${eventChatGutterPx(chatOpen)}px`,
          } as CSSProperties
        }
      >
        <div
          className={cn(
            "mx-auto w-full max-w-6xl",
            isAppChrome
              ? "space-y-5 pb-10"
              : "space-y-4 p-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] md:pb-16",
          )}
        >
          {isAppChrome ? (
            <EventAppPageHeader canEdit={canEdit} onEdit={onEdit} />
          ) : (
            <EventPublicPageHeader
              isMobile={isMobile}
              viewers={viewers}
              onRenamed={onPoll}
            />
          )}

          {isAppChrome ? (
            <EventAppHeroDetails viewers={viewers} onRenamed={onPoll} />
          ) : (
            <EventHero
              viewers={viewers}
              onEdit={onEdit}
              onRenamed={onPoll}
            />
          )}

          {isMobile ? (
            <EventMobileTabs mapEnabled={!editOpen} />
          ) : (
            <EventBentoGrid mapEnabled={!editOpen} />
          )}
        </div>
      </div>

      <EventPageChatChrome
        isAppChrome={isAppChrome}
        isMobile={isMobile}
        chatOpen={chatOpen}
        unreadCount={unreadCount}
        messages={messages}
        onChatOpenChange={onChatOpenChange}
        onPosted={onPoll}
        onDeleted={onDeleted}
      />

      <EventFormDialog
        open={editOpen}
        mode="edit"
        initialValues={editValues}
        saving={saving}
        eventId={eventId}
        canManageSharing={isOwner}
        canManageScheduleAndLocation={isOwner}
        onOpenChange={onEditOpenChange}
        onSubmit={onSubmitEdit}
      />
    </>
  );
}

function EventAppPageHeader({
  canEdit,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly onEdit: () => void;
}) {
  const t = useTranslations("events");

  return (
    <header className="space-y-4">
      <div className="space-y-3">
        <PageTitleWithBack fallbackHref="/events">
          <div className="flex min-w-0 items-stretch gap-1.5 sm:gap-2">
            <div className="min-w-0 flex-1">
              <EventAppHeroCover />
            </div>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                className="hidden h-auto min-h-11 w-11 shrink-0 self-stretch items-center justify-center rounded-xl p-0 md:inline-flex"
                onClick={onEdit}
                aria-label={t("edit")}
                title={t("edit")}
              >
                <Pencil className="size-5" />
              </Button>
            ) : null}
          </div>
        </PageTitleWithBack>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full gap-1.5 rounded-xl md:hidden"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        ) : null}
      </div>
    </header>
  );
}

function EventPublicPageHeader({
  isMobile,
  viewers,
  onRenamed,
}: {
  readonly isMobile: boolean;
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onRenamed: () => Promise<void>;
}) {
  return (
    <>
      {isMobile ? (
        <EventMobileHeaderIsland viewers={viewers} onRenamed={onRenamed} />
      ) : null}
      <EventTopBar />
    </>
  );
}

function EventPageChatChrome({
  isAppChrome,
  isMobile,
  chatOpen,
  unreadCount,
  messages,
  onChatOpenChange,
  onPosted,
  onDeleted,
}: {
  readonly isAppChrome: boolean;
  readonly isMobile: boolean;
  readonly chatOpen: boolean;
  readonly unreadCount: number;
  readonly messages: readonly EventChatMessageDto[];
  readonly onChatOpenChange: (open: boolean) => void;
  readonly onPosted: () => Promise<void>;
  readonly onDeleted: (messageId: string) => void;
}) {
  if (isMobile && isAppChrome) {
    return (
      <EventMobileChatSheet
        open={chatOpen}
        onOpenChange={onChatOpenChange}
        messages={messages}
        onPosted={onPosted}
        onDeleted={onDeleted}
      />
    );
  }
  if (isMobile) {
    return (
      <EventMobileNavIsland
        messages={messages}
        unreadCount={unreadCount}
        onChatOpenChange={onChatOpenChange}
        onPosted={onPosted}
        onDeleted={onDeleted}
      />
    );
  }
  const insetClass = isAppChrome ? APP_CHAT_INSET_CLASS : undefined;
  return (
    <>
      <EventChatRail
        open={chatOpen}
        unreadCount={unreadCount}
        onToggle={() => onChatOpenChange(!chatOpen)}
        className={insetClass}
      />
      <EventChatDrawer
        open={chatOpen}
        messages={messages}
        onClose={() => onChatOpenChange(false)}
        onPosted={onPosted}
        onDeleted={onDeleted}
        className={insetClass}
      />
    </>
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
  if (!isOwner) {
    return {
      title: values.title.trim(),
      description: values.description.trim() || null,
      imageUrl: values.imageUrl.trim() || null,
    };
  }
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
