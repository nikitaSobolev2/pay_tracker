/**
 * One control height for every event dialog field. The `data-[size=default]`
 * variants are required because SelectTrigger ships its own sized defaults that
 * would otherwise win over a plain `h-*` class.
 */
export const EVENT_CONTROL_CLASS =
  "h-12 w-full rounded-xl text-base data-[size=default]:h-12 md:h-11 md:data-[size=default]:h-11";

export type SelectOption = {
  readonly value: string;
  readonly label: string;
};
