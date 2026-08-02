"use client";

import { createContext, useContext, type ReactNode } from "react";

import type {
  EventDetailDto,
  EventSettlementResponse,
  EventViewerDto,
} from "@/server/services/event-service.types";

export type EventContextValue = {
  readonly event: EventDetailDto;
  readonly viewer: EventViewerDto;
  readonly threadCounts: Record<string, number>;
  readonly refreshEvent: () => Promise<void>;
  readonly applySettlement: (settlement: EventSettlementResponse) => void;
};

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({
  value,
  children,
}: {
  readonly value: EventContextValue;
  readonly children: ReactNode;
}) {
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEventContext(): EventContextValue {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error("useEventContext must be used inside an EventProvider");
  }
  return context;
}
