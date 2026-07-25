"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type PlaceholderSlide = {
  amount: string;
  hint: string;
};

type FastEnterPlaceholderProps = {
  readonly slides: readonly PlaceholderSlide[];
  readonly visible: boolean;
};

const SLIDE_MS = 580;
const HOLD_MS = 2600;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type Phase = "idle" | "leaving";

export function FastEnterPlaceholder({
  slides,
  visible,
}: FastEnterPlaceholderProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const busyRef = useRef(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (!visible || slides.length < 2) {
      busyRef.current = false;
      setPhase("idle");
      return;
    }

    const startSlide = () => {
      if (busyRef.current) {
        return;
      }
      busyRef.current = true;
      setPhase("leaving");
    };

    const intervalId = window.setInterval(startSlide, HOLD_MS);
    return () => window.clearInterval(intervalId);
  }, [slides.length, visible]);

  useEffect(() => {
    if (phase !== "leaving") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const nextIndex = (indexRef.current + 1) % slides.length;
      indexRef.current = nextIndex;
      setIndex(nextIndex);
      setPhase("idle");
      busyRef.current = false;
    }, SLIDE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [phase, slides.length]);

  useEffect(() => {
    if (visible) {
      return;
    }
    setIndex(0);
    indexRef.current = 0;
    setPhase("idle");
    busyRef.current = false;
  }, [visible]);

  if (!visible || slides.length === 0) {
    return null;
  }

  const current = slides[index] ?? slides[0];
  const next = slides[(index + 1) % slides.length] ?? current;
  const isLeaving = phase === "leaving";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 bottom-3 overflow-hidden"
    >
      <SlideLayer
        amount={current.amount}
        hint={current.hint}
        shiftPercent={isLeaving ? -110 : 0}
        opacity={isLeaving ? 0 : 1}
        animate={isLeaving}
      />
      <SlideLayer
        amount={next.amount}
        hint={next.hint}
        shiftPercent={isLeaving ? 0 : 110}
        opacity={isLeaving ? 1 : 0}
        animate={isLeaving}
      />
    </div>
  );
}

function SlideLayer({
  amount,
  hint,
  shiftPercent,
  opacity,
  animate,
}: {
  readonly amount: string;
  readonly hint: string;
  readonly shiftPercent: number;
  readonly opacity: number;
  readonly animate: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-[0.14em]",
      )}
      style={{
        transform: `translate3d(0, ${shiftPercent}%, 0)`,
        opacity,
        transition: animate
          ? `transform ${SLIDE_MS}ms ${EASE}, opacity ${SLIDE_MS}ms ${EASE}`
          : "none",
      }}
    >
      <span className="block leading-none font-medium tracking-tight text-foreground/30 tabular-nums">
        {amount}
      </span>
      <span className="block text-[0.18em] leading-none tracking-[0.14em] text-foreground/22 uppercase">
        {hint}
      </span>
    </div>
  );
}
