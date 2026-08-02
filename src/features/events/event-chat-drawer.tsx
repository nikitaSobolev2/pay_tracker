"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";

import {
  EVENT_CHAT_DRAWER_WIDTH_PX,
  EVENT_CHAT_RAIL_WIDTH_PX,
} from "./event-chat-layout";
import { EventChatPanel } from "./event-chat-panel";

export type EventChatDrawerProps = {
  readonly open: boolean;
  readonly messages: readonly EventChatMessageDto[];
  readonly onClose: () => void;
  readonly onPosted: () => Promise<void>;
  readonly onDeleted: (messageId: string) => void;
};

/** Non-modal overlay: sits left of the chat rail and slides off to the right when closed. */
export function EventChatDrawer({
  open,
  messages,
  onClose,
  onPosted,
  onDeleted,
}: EventChatDrawerProps) {
  const t = useTranslations("events");

  return (
    <aside
      aria-label={t("chat")}
      aria-hidden={!open}
      className={cn(
        "fixed inset-y-0 z-40 flex flex-col border-l border-border/60 bg-card shadow-2xl transition-[right] duration-200 ease-out max-md:hidden",
        !open && "pointer-events-none",
      )}
      style={{
        width: EVENT_CHAT_DRAWER_WIDTH_PX,
        // Park fully off-screen to the right when closed; open flush against the rail.
        right: open ? EVENT_CHAT_RAIL_WIDTH_PX : -EVENT_CHAT_DRAWER_WIDTH_PX,
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <h2 className="text-base font-semibold">{t("chat")}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 rounded-lg"
          aria-label={t("chatClose")}
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>
      <EventChatPanel
        messages={messages}
        onPosted={onPosted}
        onDeleted={onDeleted}
      />
    </aside>
  );
}
