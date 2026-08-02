"use client";

import type { EventPresenceViewerDto } from "@/server/services/event-live-service";

import { useEventContext } from "./event-context";
import { EventPresenceBar } from "./event-presence-bar";

export type EventMobileHeaderIslandProps = {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly onRenamed: () => Promise<void>;
};

/** Sticky condensed title + presence; tabs live in the bottom nav island. */
export function EventMobileHeaderIsland({
  viewers,
  onRenamed,
}: EventMobileHeaderIslandProps) {
  const { event } = useEventContext();

  return (
    <div
      className="event-mobile-header-island sticky top-0 -mx-4 -mt-4 mb-4 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur md:hidden"
      style={{ zIndex: 1100 }}
    >
      <div className="flex items-center gap-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
          {event.title}
        </h2>
        <EventPresenceBar viewers={viewers} onRenamed={onRenamed} />
      </div>
    </div>
  );
}
