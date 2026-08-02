"use client";

import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { EventTab } from "@/types/enums";

export type EventTabState = {
  readonly activeTab: EventTab;
  readonly selectTab: (tab: string) => void;
};

/** The tab lives in the URL so the header island and the panes stay in sync. */
export function useEventTab(): EventTabState {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = readTab(searchParams.get("tab"));

  const selectTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { activeTab, selectTab };
}

function readTab(value: string | null): EventTab {
  const tabs = Object.values(EventTab);
  return tabs.includes(value as EventTab)
    ? (value as EventTab)
    : EventTab.Overview;
}
