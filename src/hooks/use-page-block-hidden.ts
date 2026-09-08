"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  PAGE_BLOCKS_CHANGED_EVENT,
  PAGE_BLOCKS_STORAGE_KEY,
  isPageBlockHidden,
  parsePageBlocksState,
  withPageBlockHidden,
  type PageBlocksState,
} from "@/lib/page-block-visibility";

const EMPTY_STATE: PageBlocksState = {};

let cachedRaw: string | null | undefined;
let cachedState: PageBlocksState = EMPTY_STATE;

export function usePageBlockHidden(
  scope: string,
  blockId: string,
): {
  readonly hidden: boolean;
  readonly toggle: () => void;
} {
  const hidden = useSyncExternalStore(
    subscribeToPageBlocks,
    () => isPageBlockHidden(readPageBlocksState(), scope, blockId),
    () => false,
  );

  const toggle = useCallback(() => {
    const next = withPageBlockHidden(
      readPageBlocksState(),
      scope,
      blockId,
      !isPageBlockHidden(readPageBlocksState(), scope, blockId),
    );
    writePageBlocksState(next);
  }, [blockId, scope]);

  return { hidden, toggle };
}

function subscribeToPageBlocks(onStoreChange: () => void): () => void {
  function handleChange() {
    onStoreChange();
  }
  function handleStorage(event: StorageEvent) {
    if (event.key === PAGE_BLOCKS_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  }
  window.addEventListener(PAGE_BLOCKS_CHANGED_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(PAGE_BLOCKS_CHANGED_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function readPageBlocksState(): PageBlocksState {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PAGE_BLOCKS_STORAGE_KEY);
  } catch {
    return EMPTY_STATE;
  }
  if (raw === cachedRaw) {
    return cachedState;
  }
  cachedRaw = raw;
  cachedState = parsePageBlocksState(raw);
  return cachedState;
}

function writePageBlocksState(state: PageBlocksState): void {
  const raw = JSON.stringify(state);
  try {
    window.localStorage.setItem(PAGE_BLOCKS_STORAGE_KEY, raw);
  } catch {
    return;
  }
  cachedRaw = raw;
  cachedState = state;
  window.dispatchEvent(new Event(PAGE_BLOCKS_CHANGED_EVENT));
}
