import { z } from "zod";

export function zodEnumFromConst<const T extends Record<string, string>>(
  values: T,
) {
  const entries = Object.values(values) as [T[keyof T], ...T[keyof T][]];
  return z.enum(entries);
}
