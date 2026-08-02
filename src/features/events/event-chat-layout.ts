/** Fixed desktop chat rail width (`w-12`). */
export const EVENT_CHAT_RAIL_WIDTH_PX = 48;

/** Desktop chat drawer width. */
export const EVENT_CHAT_DRAWER_WIDTH_PX = 360;

/** Right gutter content must keep clear of fixed chat chrome. */
export function eventChatGutterPx(chatOpen: boolean): number {
  return (
    EVENT_CHAT_RAIL_WIDTH_PX + (chatOpen ? EVENT_CHAT_DRAWER_WIDTH_PX : 0)
  );
}
