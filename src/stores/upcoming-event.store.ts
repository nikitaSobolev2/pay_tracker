import { create } from "zustand";

import { fetchUpcomingEvent } from "@/lib/api/events";
import type { UpcomingEventChipDto } from "@/server/services/event-service.types";

type UpcomingEventStore = {
  event: UpcomingEventChipDto | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

export const useUpcomingEventStore = create<UpcomingEventStore>((set) => ({
  event: null,
  loaded: false,
  refresh: async () => {
    try {
      const result = await fetchUpcomingEvent();
      set({ event: result.event, loaded: true });
    } catch {
      set({ event: null, loaded: true });
    }
  },
  clear: () => set({ event: null, loaded: false }),
}));
