"use client";

import { useTranslations } from "next-intl";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";

import { EventChatPanel } from "./event-chat-panel";

export type EventMobileChatSheetProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly messages: readonly EventChatMessageDto[];
  readonly onPosted: () => Promise<void>;
  readonly onDeleted: (messageId: string) => void;
};

export function EventMobileChatSheet({
  open,
  onOpenChange,
  messages,
  onPosted,
  onDeleted,
}: EventMobileChatSheetProps) {
  const t = useTranslations("events");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "flex flex-col gap-0 rounded-none border-0 p-0 shadow-none",
          "data-[side=bottom]:inset-0 data-[side=bottom]:h-[100vh] data-[side=bottom]:w-[100vw]",
          "data-[side=bottom]:max-h-[100vh] data-[side=bottom]:max-w-[100vw]",
        )}
      >
        <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12">
          <SheetTitle>{t("chat")}</SheetTitle>
        </SheetHeader>
        <EventChatPanel
          className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]"
          messages={messages}
          onPosted={onPosted}
          onDeleted={onDeleted}
        />
      </SheetContent>
    </Sheet>
  );
}
