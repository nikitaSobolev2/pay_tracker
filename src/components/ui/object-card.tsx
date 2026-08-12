"use client";

import type { ReactNode } from "react";
import { useLocale } from "next-intl";

import { cn } from "@/lib/utils";

/** Same shadow/radius language as travel tickets. */
export const OBJECT_CARD_SHADOW =
  "shadow-[0_6px_20px_oklch(0_0_0/0.07)]";

export const OBJECT_STACK_CLASS = "flex flex-col gap-2";

const SHELL_CLASS = cn(
  "relative flex min-h-[4.5rem] w-full items-stretch overflow-hidden rounded-2xl",
  "border border-border/70 bg-card",
  OBJECT_CARD_SHADOW,
);

type ObjectCardProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly faded?: boolean;
  readonly dashed?: boolean;
};

export function ObjectCard({
  children,
  className,
  faded = false,
  dashed = false,
}: ObjectCardProps) {
  return (
    <div
      className={cn(
        SHELL_CLASS,
        dashed && "border-dashed",
        faded && "opacity-55",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ObjectCardBody({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-2 pl-2.5 sm:gap-3 sm:pr-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ObjectCardCopy({
  title,
  meta,
  struck = false,
}: {
  readonly title: ReactNode;
  readonly meta?: ReactNode;
  readonly struck?: boolean;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div
        className={cn(
          "truncate text-sm font-semibold leading-snug",
          struck && "text-muted-foreground line-through",
        )}
      >
        {title}
      </div>
      {meta ? (
        <div className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

export function PlaceStampRail({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex w-14 shrink-0 items-center justify-center border-r border-dashed border-border/55 bg-muted/20">
      <div className="flex size-9 items-center justify-center rounded-[2px] border border-dashed border-border/80">
        {children}
      </div>
    </div>
  );
}

export function LuggageQtyRail({ quantity }: { readonly quantity: number }) {
  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-dashed border-border/55 bg-muted/35 px-1">
      <span
        aria-hidden
        className="size-3 rounded-full bg-background ring-2 ring-border/70"
      />
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        ×
      </span>
      <span className="max-w-full truncate text-lg font-semibold leading-none tabular-nums">
        {quantity}
      </span>
    </div>
  );
}

export function ReceiptRail() {
  return (
    <div className="relative w-2.5 shrink-0 bg-muted/25">
      <span className="absolute inset-y-1.5 left-1/2 w-0 -translate-x-1/2 border-l border-dashed border-border/70" />
    </div>
  );
}

export function PassStripeRail({ seed }: { readonly seed: string }) {
  return (
    <div className="flex w-3.5 shrink-0 flex-col py-3 pl-2">
      <div className={cn("w-1.5 min-h-0 flex-1 rounded-full", stripeTone(seed))} />
    </div>
  );
}

export function PassAvatar({ name }: { readonly name: string }) {
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tracking-wide text-muted-foreground">
      {initials(name)}
    </div>
  );
}

export function FolderTabRail({ earning = false }: { readonly earning?: boolean }) {
  const tone = earning ? "bg-emerald-500/70" : "bg-rose-500/65";
  return (
    <div className="relative w-5 shrink-0">
      <span
        aria-hidden
        className={cn("absolute top-3 left-2 size-2.5 rounded-full", tone)}
      />
      <span
        aria-hidden
        className={cn(
          "absolute top-6 bottom-3 left-2.5 w-1 rounded-full",
          tone,
        )}
      />
    </div>
  );
}

export function CalendarDateRail({ iso }: { readonly iso: string }) {
  const locale = useLocale();
  const date = new Date(iso);
  const month = date
    .toLocaleDateString(locale, { month: "short" })
    .replace(".", "")
    .toUpperCase();
  const day = date.toLocaleDateString(locale, { day: "numeric" });

  return (
    <div className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-dashed border-border/55 bg-muted/20 px-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {month}
      </span>
      <span className="text-xl font-semibold leading-none tabular-nums">
        {day}
      </span>
    </div>
  );
}

export function BookmarkRail() {
  return (
    <div className="flex w-11 shrink-0 items-start justify-center bg-muted/20 pt-2.5">
      <span
        aria-hidden
        className="block h-8 w-5 bg-muted-foreground/25 [clip-path:polygon(0_0,100%_0,100%_100%,50%_70%,0_100%)]"
      />
    </div>
  );
}

export function DeviceBezelRail() {
  return (
    <div className="flex w-12 shrink-0 items-center justify-center border-r border-dashed border-border/55 bg-muted/20">
      <span
        aria-hidden
        className="flex h-9 w-6 items-end justify-center rounded border-2 border-border/80 bg-background pb-0.5"
      >
        <span className="mb-0.5 h-0.5 w-2 rounded-full bg-border" />
      </span>
    </div>
  );
}

export function BoardingStub({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 self-stretch bg-muted text-muted-foreground sm:w-16",
        className,
      )}
    >
      <PunchDots side="left" />
      {children}
    </div>
  );
}

function PunchDots({ side }: { readonly side: "left" | "right" }) {
  const offset =
    side === "left"
      ? "left-0 -translate-x-1/2"
      : "right-0 translate-x-1/2";
  return (
    <>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 size-2.5 -translate-y-1/2 rounded-full bg-background sm:size-3",
          offset,
        )}
      />
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 size-2.5 translate-y-1/2 rounded-full bg-background sm:size-3",
          offset,
        )}
      />
    </>
  );
}

const STRIPE_TONES = [
  "bg-sky-800/70",
  "bg-violet-800/70",
  "bg-amber-800/65",
  "bg-rose-900/60",
  "bg-teal-900/65",
  "bg-stone-600",
] as const;

function stripeTone(seed: string): string {
  let hash = 0;
  for (const char of seed) {
    hash = (hash + (char.codePointAt(0) ?? 0)) % STRIPE_TONES.length;
  }
  return STRIPE_TONES[hash] ?? STRIPE_TONES[0];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts.at(-1)?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}
