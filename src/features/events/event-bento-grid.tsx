"use client";

import { EventAttendanceCard } from "./event-attendance-chart";
import { useEventContext } from "./event-context";
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
    <div className="event-bento-grid grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {hasLocation ? (
        <EventMapCard
          mapEnabled={mapEnabled}
          className="md:col-span-1 md:row-span-2 xl:col-span-1"
        />
      ) : null}
      <EventTotalCard />
      <EventPerPersonCard />
      <EventPaidProgressCard />
      <EventAttendanceCard />
      <EventSpendingsList className="md:col-span-2 xl:col-span-3" />
      <EventPeoplePanel className="md:col-span-2 xl:col-span-3" />
    </div>
  );
}
