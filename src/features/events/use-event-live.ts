"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { pollEventLive } from "@/lib/api/events";
import type { EventChatMessageDto } from "@/server/services/event-chat-service";
import type { EventPresenceViewerDto } from "@/server/services/event-live-service";

export type EventLiveState = {
  readonly viewers: readonly EventPresenceViewerDto[];
  readonly messages: readonly EventChatMessageDto[];
  readonly threadCounts: Record<string, number>;
  readonly contentRevision: string | null;
  readonly poll: () => Promise<void>;
  readonly removeMessage: (messageId: string) => void;
};

const IDLE_INTERVAL_MS = 4_000;
const ACTIVE_INTERVAL_MS = 2_500;

/** Appends only messages newer than the last one seen, so history is never refetched. */
export function mergeMessages(
  current: readonly EventChatMessageDto[],
  incoming: readonly EventChatMessageDto[],
): EventChatMessageDto[] {
  if (incoming.length === 0) {
    return current as EventChatMessageDto[];
  }
  const knownIds = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !knownIds.has(message.id));
  if (fresh.length === 0) {
    return current as EventChatMessageDto[];
  }
  return [...current, ...fresh];
}

export function useEventLive(
  eventId: string,
  chatOpen: boolean,
): EventLiveState {
  const [viewers, setViewers] = useState<EventPresenceViewerDto[]>([]);
  const [messages, setMessages] = useState<EventChatMessageDto[]>([]);
  const [threadCounts, setThreadCounts] = useState<Record<string, number>>({});
  const [contentRevision, setContentRevision] = useState<string | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    const live = await pollEventLive(eventId, lastMessageIdRef.current);
    setViewers(live.viewers as EventPresenceViewerDto[]);
    setThreadCounts(live.threadCounts);
    setContentRevision(live.contentRevision);
    setMessages((current) => {
      const merged = mergeMessages(current, live.messages);
      lastMessageIdRef.current = merged.at(-1)?.id ?? lastMessageIdRef.current;
      return merged;
    });
  }, [eventId]);

  useEffect(() => {
    let stopped = false;
    const intervalMs = chatOpen ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS;

    async function tick() {
      if (stopped || document.hidden) {
        return;
      }
      try {
        await poll();
      } catch {
        // A failed heartbeat is not worth interrupting the page for.
      }
    }

    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [chatOpen, poll]);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((current) =>
      current.filter((message) => message.id !== messageId),
    );
  }, []);

  return {
    viewers,
    messages,
    threadCounts,
    contentRevision,
    poll,
    removeMessage,
  };
}
