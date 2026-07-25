"use client";

import { create } from "zustand";

import type { SharedChartPayload } from "@/features/share/shared-chart-payload";

type ShareChartState = {
  open: boolean;
  payload: SharedChartPayload | null;
  initialTitle: string;
  openShare: (payload: SharedChartPayload, title?: string) => void;
  closeShare: () => void;
};

export const useShareChartStore = create<ShareChartState>((set) => ({
  open: false,
  payload: null,
  initialTitle: "",
  openShare: (payload, title = "") =>
    set({
      open: true,
      payload,
      initialTitle: title,
    }),
  closeShare: () =>
    set({
      open: false,
      payload: null,
      initialTitle: "",
    }),
}));
