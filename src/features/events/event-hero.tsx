"use client";

import { CalendarDays, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { EventPresenceViewerDto } from "@/server/services/event-live-service";
import { EventAuthorRole, EventPublicity } from "@/types/enums";

import { EventAiControls } from "./ai/event-ai-analyze-button";
import { useEventContext } from "./event-context";
import { EventLinksButton } from "./event-links";
import { EventPhaseSelect } from "./event-phase-select";
import { EventPresenceBar } from "./event-presence-bar";
import { EventPhaseBadge } from "./event-timing-badge";
import { useEventScheduleLabel } from "./use-event-schedule-label";

export type EventHeroProps = {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onEdit: () => void;
  readonly onRenamed: () => Promise<void>;
};

export function EventHero({ viewers, onEdit, onRenamed }: EventHeroProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <EventHeroPublicCover />
      <EventHeroMeta
        viewers={viewers}
        onEdit={onEdit}
        onRenamed={onRenamed}
        showTitle
        showEdit
      />
      <EventHeroDescription />
    </section>
  );
}

/** Compact travel-style cover used inside PageTitleWithBack on the in-app event page. */
export function EventAppHeroCover() {
  const { event } = useEventContext();
  const formatSchedule = useEventScheduleLabel();

  if (!event.imageUrl) {
    return (
      <div className="space-y-2">
        <EventHeroHeading largeWhenPlain />
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          {formatSchedule(event.occursAt, event.endsAt)}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl ring-1 ring-border/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={event.imageUrl}
        alt=""
        className="h-36 w-full object-cover sm:h-44"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 space-y-1 p-3 sm:p-4">
        <EventHeroHeading overlay />
        <p className="flex items-center gap-1.5 text-xs text-white/80 sm:text-sm">
          <CalendarDays className="size-3.5" />
          {formatSchedule(event.occursAt, event.endsAt)}
        </p>
      </div>
    </div>
  );
}

export function EventAppHeroDetails({
  viewers,
  onRenamed,
}: {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onRenamed: () => Promise<void>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <EventHeroMeta
        viewers={viewers}
        onRenamed={onRenamed}
        showTitle={false}
        showEdit={false}
      />
      <EventHeroDescription />
    </section>
  );
}

function EventHeroPublicCover() {
  const { event } = useEventContext();

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        event.imageUrl
          ? "max-h-[650px] md:max-h-[1000px]"
          : "h-40 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent",
      )}
    >
      {event.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.imageUrl}
          alt=""
          className="h-auto w-full max-h-[650px] object-cover object-center md:max-h-[1000px]"
        />
      ) : null}
    </div>
  );
}

function EventHeroHeading({
  overlay = false,
  largeWhenPlain = false,
}: {
  readonly overlay?: boolean;
  readonly largeWhenPlain?: boolean;
}) {
  const t = useTranslations("events");
  const { event } = useEventContext();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <h1
        className={cn(
          "text-2xl font-semibold tracking-tight",
          overlay && "text-white",
          !overlay && largeWhenPlain && "md:text-3xl",
        )}
      >
        {event.title}
      </h1>
      <EventPhaseBadge phase={event.phase} />
      <Badge
        variant="outline"
        className={cn(
          "rounded-full text-xs",
          overlay && "border-white/40 text-white",
        )}
      >
        {event.publicity === EventPublicity.Public
          ? t("publicityPublic")
          : t("publicityPrivate")}
      </Badge>
    </div>
  );
}

function EventHeroMeta({
  viewers,
  onEdit,
  onRenamed,
  showTitle,
  showEdit,
}: {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onEdit?: () => void;
  readonly onRenamed: () => Promise<void>;
  readonly showTitle: boolean;
  readonly showEdit: boolean;
}) {
  const t = useTranslations("events");
  const { event, viewer, refreshEvent } = useEventContext();
  const formatSchedule = useEventScheduleLabel();
  const showHeading = showTitle;
  const showPhase = viewer.role === EventAuthorRole.Owner;

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      {showHeading || showPhase ? (
        <div className="min-w-0 space-y-1.5">
          {showHeading ? (
            <>
              <EventHeroHeading />
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-4" />
                {formatSchedule(event.occursAt, event.endsAt)}
              </p>
            </>
          ) : null}
          {showPhase ? (
            <EventPhaseSelect
              eventId={event.id}
              phaseOverride={event.phaseOverride}
              onChanged={refreshEvent}
            />
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          "flex w-full flex-col gap-2",
          "sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",
          "[&>button]:w-full sm:[&>button]:w-auto",
          "[&>button>span]:justify-center",
        )}
      >
        <EventPresenceBar viewers={viewers} onRenamed={onRenamed} />
        <EventLinksButton links={event.links} />
        <EventAiControls />
        {showEdit && viewer.canEdit && onEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 gap-1.5 rounded-xl"
            onClick={onEdit}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EventHeroDescription() {
  const locale = useLocale();
  const { event } = useEventContext();

  if (!event.description) {
    return null;
  }

  return (
    <div
      className={cn(
        "border-t border-border/60 px-4 py-3 text-sm leading-relaxed text-foreground/90",
        "[&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1",
        "[&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold",
        "[&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold",
        "[&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
      )}
      dangerouslySetInnerHTML={{
        __html: renderMarkdown(event.description, { locale }),
      }}
    />
  );
}
