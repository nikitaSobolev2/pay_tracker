"use client";

import { usePageBlockHidden } from "@/hooks/use-page-block-hidden";
import { eventPageBlockScope } from "@/lib/page-block-visibility";

import { useEventContext } from "./event-context";

export function useEventPageBlockHidden(blockId: string): {
  readonly hidden: boolean;
  readonly toggle: () => void;
} {
  const { event } = useEventContext();
  return usePageBlockHidden(eventPageBlockScope(event.id), blockId);
}
