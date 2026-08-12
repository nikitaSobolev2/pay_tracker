import { FIELD_SELECT_CLASS } from "@/lib/bento";

/**
 * One control height for every event dialog field. The `data-[size=default]`
 * variants are required because SelectTrigger ships its own sized defaults that
 * would otherwise win over a plain `h-*` class.
 */
export const EVENT_CONTROL_CLASS = FIELD_SELECT_CLASS;

export type SelectOption = {
  readonly value: string;
  readonly label: string;
};
