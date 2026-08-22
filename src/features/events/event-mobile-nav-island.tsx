"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";
import { EventTab } from "@/types/enums";

import { EventMobileChatSheet } from "./event-mobile-chat-sheet";
import { useEventTab } from "./use-event-tab";

export type EventMobileNavIslandProps = {
  readonly messages: readonly EventChatMessageDto[];
  readonly unreadCount: number;
  readonly onChatOpenChange: (open: boolean) => void;
  readonly onPosted: () => Promise<void>;
  readonly onDeleted: (messageId: string) => void;
};

/** Above page/Leaflet (0), below sheets (50) and dialogs (1200). */
const ISLAND_Z_INDEX = 40;

/**
 * Floating liquid-glass island for the public event page — same chrome pattern
 * as the transactions MobileNavIsland segment row, plus chat.
 */
export function EventMobileNavIsland({
  messages,
  unreadCount,
  onChatOpenChange,
  onPosted,
  onDeleted,
}: EventMobileNavIslandProps) {
  const t = useTranslations("events");
  const { activeTab, selectTab } = useEventTab();
  const [chatOpen, setChatOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function setChatVisible(next: boolean) {
    setChatOpen(next);
    onChatOpenChange(next);
  }

  const island = (
    <div
      data-event-mobile-nav-island
      className={cn(
        "event-mobile-nav-island pointer-events-none fixed inset-x-0 flex justify-center px-3 md:hidden",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
      style={{ zIndex: ISLAND_Z_INDEX }}
    >
      <div
        className={cn(
          "pointer-events-auto grid w-full max-w-md grid-cols-1 gap-1 p-1.5",
          "rounded-[1.75rem] border border-white/15 bg-background/60",
          "shadow-[0_8px_32px_oklch(0_0_0/0.28)]",
          "backdrop-blur-2xl backdrop-saturate-150",
          "supports-backdrop-filter:bg-background/45",
        )}
      >
        <Tabs
          value={activeTab}
          onValueChange={selectTab}
          className="h-12 w-full min-w-0"
        >
          <TabsList className="h-12 w-full rounded-full p-1">
            <TabsTrigger
              value={EventTab.Overview}
              className="rounded-full px-1.5 text-xs sm:px-2 sm:text-sm"
            >
              {t("tabOverview")}
            </TabsTrigger>
            <TabsTrigger
              value={EventTab.Spendings}
              className="rounded-full px-1.5 text-xs sm:px-2 sm:text-sm"
            >
              {t("tabSpendings")}
            </TabsTrigger>
            <TabsTrigger
              value={EventTab.People}
              className="rounded-full px-1.5 text-xs sm:px-2 sm:text-sm"
            >
              {t("tabPeople")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          type="button"
          variant="ghost"
          className={cn(
            "relative h-12 w-full gap-2 rounded-full px-3 text-foreground",
            "hover:bg-foreground/10 active:bg-foreground/15",
          )}
          onClick={() => setChatVisible(true)}
        >
          <MessageSquare className="size-4" />
          <span className="text-sm font-medium">{t("chat")}</span>
          {unreadCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/*
        Portal to body: the event route wraps the page in `relative z-[1]`, which
        creates a stacking context that traps nested fixed layers.
      */}
      {mounted ? createPortal(island, document.body) : null}

      <EventMobileChatSheet
        open={chatOpen}
        onOpenChange={setChatVisible}
        messages={messages}
        onPosted={onPosted}
        onDeleted={onDeleted}
      />
    </>
  );
}
