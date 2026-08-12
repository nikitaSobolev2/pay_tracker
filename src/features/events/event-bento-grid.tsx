"use client";

import { EventAttendanceCard } from "./event-attendance-chart";
import { useEventContext } from "./event-context";
import { EventLocationPollCard } from "./event-location-poll-card";
import { EventMapCard } from "./event-map-card";
import { EventPaidProgressCard } from "./event-paid-progress-chart";
import { EventPeoplePanel } from "./event-people-panel";
import { EventPerPersonCard, EventTotalCard } from "./event-spendings-chart";
import { EventSpendingsList } from "./event-spendings-list";

/** Desktop layout: cards without data simply drop out of the grid. */
export function EventBentoGrid({
  mapEnabled = true,
}: {
  readonly mapEnabled?: boolean;
}) {
  const { event } = useEventContext();
  const hasLocation = Boolean(event.address ?? event.latitude);

  return (
    <div className="event-bento-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {hasLocation ? (
        <EventMapCard mapEnabled={mapEnabled} className="md:col-span-2 xl:col-span-4" />
      ) : null}
      <EventLocationPollCard className="w-full md:col-span-2 xl:col-span-4" />
      {event.spendings.length > 0 ? <EventTotalCard /> : null}
      {event.spendings.length > 0 || event.manualPerPersonAmount != null ? (
        <EventPerPersonCard />
      ) : null}
      <EventPaidProgressCard />
      <EventAttendanceCard />
      <EventSpendingsList className="md:col-span-2 xl:col-span-4" />
      <EventPeoplePanel className="md:col-span-2 xl:col-span-4" />
    </div>
  );
}
