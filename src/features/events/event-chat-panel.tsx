"use client";

import { Send, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteEventChatMessage, postEventChatMessage } from "@/lib/api/events";
import { cn } from "@/lib/utils";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";

import { useEventContext } from "./event-context";

export type EventChatPanelProps = {
  readonly messages: readonly EventChatMessageDto[];
  readonly onPosted: () => Promise<void>;
  readonly onDeleted: (messageId: string) => void;
  readonly className?: string;
};

const SCROLL_PIN_THRESHOLD_PX = 80;

export function EventChatPanel({
  messages,
  onPosted,
  onDeleted,
  className,
}: EventChatPanelProps) {
  const t = useTranslations("events");
  const { event } = useEventContext();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (list && pinnedRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  function trackPinned() {
    const list = listRef.current;
    if (!list) {
      return;
    }
    const distanceFromBottom =
      list.scrollHeight - list.scrollTop - list.clientHeight;
    pinnedRef.current = distanceFromBottom < SCROLL_PIN_THRESHOLD_PX;
  }

  async function send() {
    const body = draft.trim();
    if (!body) {
      return;
    }
    setSending(true);
    try {
      await postEventChatMessage(event.id, body);
      setDraft("");
      pinnedRef.current = true;
      await onPosted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chatFailed"));
    } finally {
      setSending(false);
    }
  }

  async function remove(messageId: string) {
    try {
      await deleteEventChatMessage(event.id, messageId);
      onDeleted(messageId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chatFailed"));
    }
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div
        ref={listRef}
        onScroll={trackPinned}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("chatEmpty")}
          </p>
        ) : (
          messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              onDelete={() => void remove(message.id)}
            />
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 p-3">
        <Input
          className="h-10 rounded-xl"
          placeholder={t("chatPlaceholder")}
          value={draft}
          onChange={(changeEvent) => setDraft(changeEvent.target.value)}
          onKeyDown={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              keyEvent.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          className="size-10 shrink-0 rounded-xl"
          aria-label={t("chatSend")}
          disabled={sending || !draft.trim()}
          onClick={() => void send()}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  onDelete,
}: {
  readonly message: EventChatMessageDto;
  readonly onDelete: () => void;
}) {
  const t = useTranslations("events");

  return (
    <div
      className={cn(
        "group/message flex flex-col gap-0.5",
        message.isMine ? "items-end" : "items-start",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/80">
          {message.author.name}
        </span>
        <span>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        {message.canDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 rounded-md opacity-0 group-hover/message:opacity-100"
            aria-label={t("chatDelete")}
            onClick={onDelete}
          >
            <Trash2 className="size-3" />
          </Button>
        ) : null}
      </div>
      <p
        className={cn(
          "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm",
          message.isMine
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        {message.body}
      </p>
    </div>
  );
}
