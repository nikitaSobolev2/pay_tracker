"use client";

import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from "react";

const DEFAULT_DELAY_MS = 450;
const MOVE_TOLERANCE_PX = 10;

type LongPressHandlers = {
  onPointerDown: (event: ReactPointerEvent) => void;
  onPointerMove: (event: ReactPointerEvent) => void;
  onPointerUp: (event: ReactPointerEvent) => void;
  onPointerCancel: (event: ReactPointerEvent) => void;
  /** Call on click handlers to skip navigation when a long-press just fired. */
  consumeLongPress: () => boolean;
};

type UseLongPressOptions = {
  readonly delayMs?: number;
  readonly disabled?: boolean;
  readonly onLongPress: () => void;
};

export function useLongPress({
  delayMs = DEFAULT_DELAY_MS,
  disabled = false,
  onLongPress,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const consumeLongPress = useCallback(() => {
    if (!didLongPressRef.current) {
      return false;
    }
    didLongPressRef.current = false;
    return true;
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      if (disabled || event.button !== 0) {
        return;
      }
      didLongPressRef.current = false;
      startRef.current = { x: event.clientX, y: event.clientY };
      clearTimer();
      timerRef.current = setTimeout(() => {
        didLongPressRef.current = true;
        onLongPress();
        timerRef.current = null;
      }, delayMs);
    },
    [clearTimer, delayMs, disabled, onLongPress],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const start = startRef.current;
      if (!start || timerRef.current === null) {
        return;
      }
      const deltaX = Math.abs(event.clientX - start.x);
      const deltaY = Math.abs(event.clientY - start.y);
      if (deltaX > MOVE_TOLERANCE_PX || deltaY > MOVE_TOLERANCE_PX) {
        clearTimer();
      }
    },
    [clearTimer],
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
    startRef.current = null;
  }, [clearTimer]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
    startRef.current = null;
    didLongPressRef.current = false;
  }, [clearTimer]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeLongPress,
  };
}
