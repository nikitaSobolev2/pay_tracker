/** Quiet field caption — scan the input, not the label. */
export const FORM_LABEL_CLASS =
  "text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground";

/** Shared bento chrome — clock-widget labels, hairline cards. */
export const BENTO_LABEL_CLASS = FORM_LABEL_CLASS;
/** Fill the grid cell so siblings in a row share one height. */
export const BENTO_CARD_CLASS = "h-full";

/** Plot area — fixed slab. Never stretch with the page. */
export const BENTO_CHART_CLASS = "aspect-auto h-56 max-h-56 w-full shrink-0";

/** One height/radius for inputs, selects, comboboxes. */
export const FIELD_CLASS = "h-11 w-full rounded-xl text-base md:text-sm";

export const FIELD_SELECT_CLASS =
  "h-11 w-full rounded-xl text-base data-[size=default]:h-11 md:text-sm";

/** Dialog primary/cancel actions — same radius as fields. */
export const DIALOG_ACTION_CLASS =
  "h-11 w-full rounded-xl text-base sm:w-auto";

export const ICON_BUTTON_CLASS = "size-9 rounded-xl";
