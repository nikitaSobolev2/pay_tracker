import { TransactionType } from "@/types/enums";

/** Distinct rose/coral steps for spending slices (light → deep). */
const SPENDING_FILLS = [
  "oklch(0.78 0.14 25)",
  "oklch(0.70 0.17 18)",
  "oklch(0.63 0.18 32)",
  "oklch(0.56 0.16 12)",
  "oklch(0.50 0.14 40)",
  "oklch(0.44 0.12 22)",
  "oklch(0.38 0.10 35)",
  "oklch(0.32 0.08 15)",
];

/** Distinct emerald/teal steps for earning slices (light → deep). */
const EARNING_FILLS = [
  "oklch(0.82 0.14 155)",
  "oklch(0.74 0.16 145)",
  "oklch(0.67 0.15 165)",
  "oklch(0.60 0.14 140)",
  "oklch(0.54 0.13 170)",
  "oklch(0.47 0.11 150)",
  "oklch(0.40 0.09 160)",
  "oklch(0.34 0.07 145)",
];

export function categorySliceFill(
  type: TransactionType,
  indexWithinType: number,
): string {
  const palette =
    type === TransactionType.Earning ? EARNING_FILLS : SPENDING_FILLS;
  return palette[indexWithinType % palette.length]!;
}

export function categoryBarClass(type: TransactionType): string {
  return type === TransactionType.Earning ? "bg-emerald-400" : "bg-rose-400";
}

export function categoryTypeBadgeClass(type: TransactionType): string {
  return type === TransactionType.Earning
    ? "border-emerald-500/30 text-emerald-400"
    : "border-rose-500/30 text-rose-400";
}

export function categoryTypeTextClass(type: TransactionType): string {
  return type === TransactionType.Earning
    ? "text-emerald-400"
    : "text-rose-400";
}

export function sliceIdentityKey(
  categoryId: string | null,
  type: TransactionType,
  title: string,
  index: number,
): string {
  return `${type}:${categoryId ?? title}:${index}`;
}
