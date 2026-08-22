-- Multiple guests may claim the same attendance-list person (shared names).
DROP INDEX IF EXISTS "EventGuestPresence_eventId_attendeeId_key";

CREATE INDEX "EventGuestPresence_eventId_attendeeId_idx" ON "EventGuestPresence"("eventId", "attendeeId");
