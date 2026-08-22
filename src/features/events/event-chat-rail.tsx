"use client";

import { MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { EVENT_CHAT_RAIL_WIDTH_PX } from "./event-chat-layout";

export type EventChatRailProps = {
  readonly open: boolean;
  readonly unreadCount: number;
  readonly onToggle: () => void;
  /** e.g. `top-14` so the rail sits below the in-app header. */
  readonly className?: string;
};

/** Full-height edge strip on desktop: the only entry point to the chat drawer. */
export function EventChatRail({
  open,
  unreadCount,
  onToggle,
  className,
}: EventChatRailProps) {
  const t = useTranslations("events");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={t("chat")}
            aria-pressed={open}
            onClick={onToggle}
            style={{ width: EVENT_CHAT_RAIL_WIDTH_PX, zIndex: 1150 }}
            className={cn(
              "event-chat-rail fixed right-0 bottom-0 flex cursor-pointer flex-col items-center justify-center gap-2 border-l border-border/60 bg-background/95 text-muted-foreground shadow-sm backdrop-blur transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset max-md:hidden",
              open && "bg-accent text-foreground",
              className ?? "top-0",
            )}
          />
        }
      >
        <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
          <MessageSquare className="size-5" />
          {unreadCount > 0 ? (
            <span
              className={cn(
                "absolute -top-1.5 -right-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full px-1",
                "bg-primary text-[10px] font-semibold leading-none text-primary-foreground",
                "ring-2 ring-background",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </span>
        <span className="rotate-180 text-xs font-medium tracking-[0.2em] [writing-mode:vertical-rl]">
          {t("chat")}
        </span>
      </TooltipTrigger>
      <TooltipContent side="left">
        {open ? t("chatClose") : t("chat")}
      </TooltipContent>
    </Tooltip>
  );
}
