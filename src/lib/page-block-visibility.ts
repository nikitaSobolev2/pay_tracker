export const PAGE_BLOCKS_STORAGE_KEY = "paytracker-page-blocks";

export const PAGE_BLOCKS_CHANGED_EVENT = "paytracker:page-blocks-changed";

export type PageBlocksState = Record<string, Record<string, boolean>>;

export function travelPageBlockScope(travelId: string): string {
  return `travel:${travelId}`;
}

export function eventPageBlockScope(eventId: string): string {
  return `event:${eventId}`;
}

export function parsePageBlocksState(raw: string | null): PageBlocksState {
  if (!raw) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPageBlocksState(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function isPageBlockHidden(
  state: PageBlocksState,
  scope: string,
  blockId: string,
): boolean {
  return state[scope]?.[blockId] === true;
}

export function withPageBlockHidden(
  state: PageBlocksState,
  scope: string,
  blockId: string,
  hidden: boolean,
): PageBlocksState {
  const scopeBlocks = { ...state[scope] };
  if (hidden) {
    scopeBlocks[blockId] = true;
  } else {
    delete scopeBlocks[blockId];
  }
  const next: PageBlocksState = { ...state };
  if (Object.keys(scopeBlocks).length === 0) {
    delete next[scope];
  } else {
    next[scope] = scopeBlocks;
  }
  return next;
}

function isPageBlocksState(value: unknown): value is PageBlocksState {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(isBlockFlagMap);
}

function isBlockFlagMap(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((flag) => typeof flag === "boolean");
}
