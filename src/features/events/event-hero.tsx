"use client";

import { CalendarDays, Pencil } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import type { EventPresenceViewerDto } from "@/server/services/event-live-service";
import { EventPublicity } from "@/types/enums";

import { EventAiControls } from "./ai/event-ai-analyze-button";
import { useEventContext } from "./event-context";
import { EventLinksButton } from "./event-links";
import { EventPresenceBar } from "./event-presence-bar";
import { useEventScheduleLabel } from "./use-event-schedule-label";

export type EventHeroProps = {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onEdit: () => void;
  readonly onRenamed: () => Promise<void>;
};

export function EventHero({ viewers, onEdit, onRenamed }: EventHeroProps) {
  const t = useTranslations("events");
  const locale = useLocale();
  const { event, viewer } = useEventContext();
  const formatSchedule = useEventScheduleLabel();

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40">
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

      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {event.title}
            </h1>
            <Badge variant="outline" className="rounded-full text-xs">
              {event.publicity === EventPublicity.Public
                ? t("publicityPublic")
                : t("publicityPrivate")}
            </Badge>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="size-4" />
            {formatSchedule(event.occursAt, event.endsAt)}
          </p>
        </div>

        <div
          className={cn(
            "flex w-full flex-col gap-2",
            "sm:w-auto sm:flex-row sm:flex-wrap sm:items-center",
            // Action buttons (links / AI / edit) — full-width rows on mobile.
            "[&>button]:w-full sm:[&>button]:w-auto",
            "[&>button>span]:justify-center",
          )}
        >
          <EventPresenceBar viewers={viewers} onRenamed={onRenamed} />
          <EventLinksButton links={event.links} />
          <EventAiControls />
          {viewer.canEdit ? (
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

      {event.description ? (
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
      ) : null}
    </section>
  );
}
