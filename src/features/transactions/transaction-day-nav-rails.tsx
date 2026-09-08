"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type TransactionDayNavRailsProps = {
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly prevLabel: string;
  readonly nextLabel: string;
};

const CHEVRON_BUTTON_CLASS = cn(
  "pointer-events-auto flex size-10 items-center justify-center rounded-full",
  "border-0 bg-transparent text-muted-foreground/40 shadow-none",
  "transition-colors duration-150",
  "hover:bg-background/75 hover:text-foreground hover:shadow-sm hover:backdrop-blur-sm",
  "focus-visible:bg-background/80 focus-visible:text-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
);

export function TransactionDayNavRails({
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: TransactionDayNavRailsProps) {
  const { state } = useSidebar();
  const leftOffset =
    state === "collapsed"
      ? "var(--sidebar-width-icon)"
      : "var(--sidebar-width)";

  return (
    <>
      <div
        className="transaction-day-nav-rails pointer-events-none fixed top-14 bottom-0 hidden w-11 items-center justify-center max-md:hidden md:flex"
        style={{ left: leftOffset }}
      >
        <button
          type="button"
          aria-label={prevLabel}
          onClick={onPrev}
          className={CHEVRON_BUTTON_CLASS}
        >
          <ChevronLeft className="size-6" />
        </button>
      </div>
      <div
        className="transaction-day-nav-rails pointer-events-none fixed top-14 right-0 bottom-0 hidden w-11 items-center justify-center max-md:hidden md:flex"
      >
        <button
          type="button"
          aria-label={nextLabel}
          onClick={onNext}
          className={CHEVRON_BUTTON_CLASS}
        >
          <ChevronRight className="size-6" />
        </button>
      </div>
    </>
  );
}
