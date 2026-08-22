"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";
import { EventTab } from "@/types/enums";

import { useEventTab } from "./use-event-tab";

export function useEventAppMobileChrome(input: {
  readonly enabled: boolean;
  readonly unreadCount: number;
  readonly onOpenChat: () => void;
}): void {
  const t = useTranslations("events");
  const { activeTab, selectTab } = useEventTab();
  const setChrome = useMobilePageChromeStore((state) => state.setChrome);

  useEffect(() => {
    if (!input.enabled) {
      return;
    }
    setChrome({
      segmentFilter: {
        value: activeTab,
        options: [
          { value: EventTab.Overview, label: t("tabOverview") },
          { value: EventTab.Spendings, label: t("tabSpendings") },
          { value: EventTab.People, label: t("tabPeople") },
        ],
        onChange: selectTab,
      },
      action: {
        kind: "chat",
        onClick: input.onOpenChat,
        label: t("chat"),
        unreadCount: input.unreadCount,
      },
    });
    return () => setChrome(null);
  }, [
    input.enabled,
    input.onOpenChat,
    input.unreadCount,
    activeTab,
    selectTab,
    setChrome,
    t,
  ]);
}
