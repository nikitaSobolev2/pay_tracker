"use client";

import { useEffect, useState } from "react";

/**
 * Shared live clock tick (~20fps) so analog second hands stay smooth without
 * re-rendering on every animation frame.
 */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    let lastPaint = 0;

    function tick(timestamp: number) {
      if (cancelled) {
        return;
      }
      if (timestamp - lastPaint >= 50) {
        lastPaint = timestamp;
        setNow(Date.now());
      }
      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return now;
}
