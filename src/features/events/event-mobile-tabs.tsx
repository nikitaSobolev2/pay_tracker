"use client";

import { EventTab } from "@/types/enums";

import { EventAttendanceCard } from "./event-attendance-chart";
import { useEventContext } from "./event-context";
import { EventLocationPollCard } from "./event-location-poll-card";
import { EventMapCard } from "./event-map-card";
import { EventPaidProgressCard } from "./event-paid-progress-chart";
import { EventPeoplePanel } from "./event-people-panel";
import { EventPerPersonCard, EventTotalCard } from "./event-spendings-chart";
import { EventSpendingsList } from "./event-spendings-list";
import { useEventTab } from "./use-event-tab";

/** Panes only; the tab switcher lives in the bottom nav island. */
export function EventMobileTabs({
  mapEnabled = true,
}: {
  readonly mapEnabled?: boolean;
}) {
  const { event } = useEventContext();
  const { activeTab } = useEventTab();
  const hasLocation = Boolean(event.address ?? event.latitude);

  return (
    <div className="space-y-4">
      {activeTab === EventTab.Overview ? (
        <>
          {hasLocation ? <EventMapCard mapEnabled={mapEnabled} /> : null}
          <EventLocationPollCard className="min-h-96 w-full" />
          {event.spendings.length > 0 ? <EventTotalCard /> : null}
          {event.spendings.length > 0 || event.manualPerPersonAmount != null ? (
            <EventPerPersonCard />
          ) : null}
          <EventPaidProgressCard />
          <EventAttendanceCard />
        </>
      ) : null}
      {activeTab === EventTab.Spendings ? <EventSpendingsList /> : null}
      {activeTab === EventTab.People ? <EventPeoplePanel /> : null}
    </div>
  );
}
