import { create } from "zustand";

import { fetchActiveTravel } from "@/lib/api/travels";
import type { TravelListItemDto } from "@/server/services/travel-service.types";

type ActiveTravelStore = {
  travel: TravelListItemDto | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

export const useActiveTravelStore = create<ActiveTravelStore>((set) => ({
  travel: null,
  loaded: false,
  refresh: async () => {
    try {
      const result = await fetchActiveTravel();
      set({ travel: result.travel, loaded: true });
    } catch {
      set({ travel: null, loaded: true });
    }
  },
  clear: () => set({ travel: null, loaded: false }),
}));
