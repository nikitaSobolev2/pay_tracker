import { create } from "zustand";

import type { TransactionTypeFilter } from "@/features/transactions/transaction-type-switcher";

export type MobilePageChromeSegmentOption = {
  readonly value: string;
  readonly label: string;
};

export type MobilePageChromeAction =
  | {
      readonly kind: "filters";
      readonly active: boolean;
      readonly onClick: () => void;
      readonly label: string;
    }
  | {
      readonly kind: "add";
      readonly onClick: () => void;
      readonly label: string;
    }
  | {
      readonly kind: "back";
      readonly onClick: () => void;
      readonly label: string;
    };

/** Page-specific tools merged into the mobile bottom island. */
export type MobilePageChrome = {
  readonly typeFilter?: {
    readonly value: TransactionTypeFilter;
    readonly onChange: (value: TransactionTypeFilter) => void;
  };
  /** Generic segmented filter (e.g. counterparties debt tone, home date range). */
  readonly segmentFilter?: {
    readonly value: string;
    readonly options: ReadonlyArray<MobilePageChromeSegmentOption>;
    readonly onChange: (value: string) => void;
  };
  readonly action?: MobilePageChromeAction;
  /** Optional restore control when drilling into a list date filter. */
  readonly backAction?: {
    readonly onClick: () => void;
    readonly label: string;
  };
};

type MobilePageChromeStore = {
  chrome: MobilePageChrome | null;
  /** True while island chrome row is open or animating (drives page bottom padding). */
  chromeExpanded: boolean;
  setChrome: (chrome: MobilePageChrome | null) => void;
  setChromeExpanded: (expanded: boolean) => void;
};

export const useMobilePageChromeStore = create<MobilePageChromeStore>(
  (set) => ({
    chrome: null,
    chromeExpanded: false,
    setChrome: (chrome) =>
      set((state) => ({
        chrome,
        // Expand immediately on show; collapse is driven by island exit animation.
        chromeExpanded: chrome != null ? true : state.chromeExpanded,
      })),
    setChromeExpanded: (chromeExpanded) => set({ chromeExpanded }),
  }),
);
