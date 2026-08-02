/** Units offered in the spending form. The stored field stays free text. */
export const EVENT_AMOUNT_UNITS = [
  "шт",
  "кг",
  "г",
  "литр",
  "мл",
  "уп",
  "порц",
] as const;

export const DEFAULT_EVENT_AMOUNT_UNIT = EVENT_AMOUNT_UNITS[0];
