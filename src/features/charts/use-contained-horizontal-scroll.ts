"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const DRAG_THRESHOLD_PX = 4;
const TOUCH_LOCK_THRESHOLD_PX = 3;

function hasHorizontalOverflow(element: HTMLElement): boolean {
  return element.scrollWidth - element.clientWidth > 1;
}

type ContainedHorizontalScrollOptions = {
  /** Mouse/pointer drag-to-scroll. Disable when children need click/tap. */
  readonly enablePointerDrag?: boolean;
};

/**
 * Horizontal scroll for chart strips: wheel, touch, optional mouse drag,
 * scroll-to-end on reset, and block page scroll while the gesture starts here.
 */
export function useContainedHorizontalScroll(
  resetKey: string | number,
  options: ContainedHorizontalScrollOptions = {},
) {
  const { enablePointerDrag = true } = options;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    x: number;
    scrollLeft: number;
    pointerId: number;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      node.scrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    });
    return () => cancelAnimationFrame(frame);
  }, [resetKey]);

  useEffect(() => {
    const target = scrollRef.current;
    if (!target) {
      return;
    }
    const scrollElement: HTMLElement = target;

    const handleWheel = (event: WheelEvent) => {
      if (!hasHorizontalOverflow(scrollElement)) {
        return;
      }

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (delta === 0) {
        return;
      }

      // Gesture started on the chart — keep scroll local, never chain to the page.
      event.preventDefault();
      scrollElement.scrollLeft += delta;
    };

    let touchStart: {
      x: number;
      y: number;
      scrollLeft: number;
    } | null = null;
    let touchAxis: "horizontal" | "vertical" | null = null;

    const handleTouchStart = (event: TouchEvent) => {
      if (!hasHorizontalOverflow(scrollElement) || event.touches.length !== 1) {
        touchStart = null;
        touchAxis = null;
        return;
      }
      const touch = event.touches[0]!;
      touchStart = {
        x: touch.clientX,
        y: touch.clientY,
        scrollLeft: scrollElement.scrollLeft,
      };
      touchAxis = null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchStart || event.touches.length !== 1) {
        return;
      }
      if (!hasHorizontalOverflow(scrollElement)) {
        return;
      }

      const touch = event.touches[0]!;
      const deltaX = touch.clientX - touchStart.x;
      const deltaY = touch.clientY - touchStart.y;

      if (!touchAxis) {
        if (
          Math.abs(deltaX) < TOUCH_LOCK_THRESHOLD_PX &&
          Math.abs(deltaY) < TOUCH_LOCK_THRESHOLD_PX
        ) {
          return;
        }
        touchAxis =
          Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      // Swallow the gesture so the page behind the chart does not scroll.
      event.preventDefault();
      if (touchAxis === "horizontal") {
        scrollElement.scrollLeft = touchStart.scrollLeft - deltaX;
      }
    };

    const handleTouchEnd = () => {
      touchStart = null;
      touchAxis = null;
    };

    scrollElement.addEventListener("wheel", handleWheel, { passive: false });
    scrollElement.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    scrollElement.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    scrollElement.addEventListener("touchend", handleTouchEnd);
    scrollElement.addEventListener("touchcancel", handleTouchEnd);

    return () => {
      scrollElement.removeEventListener("wheel", handleWheel);
      scrollElement.removeEventListener("touchstart", handleTouchStart);
      scrollElement.removeEventListener("touchmove", handleTouchMove);
      scrollElement.removeEventListener("touchend", handleTouchEnd);
      scrollElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [resetKey]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enablePointerDrag) {
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }
      // Touch is handled by the dedicated touch listeners above.
      if (event.pointerType === "touch") {
        return;
      }
      const node = scrollRef.current;
      if (!node || !hasHorizontalOverflow(node)) {
        return;
      }

      dragStartRef.current = {
        x: event.clientX,
        scrollLeft: node.scrollLeft,
        pointerId: event.pointerId,
        active: false,
      };
    },
    [enablePointerDrag],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = dragStartRef.current;
      const node = scrollRef.current;
      if (!start || !node || start.pointerId !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - start.x;
      if (!start.active) {
        if (Math.abs(deltaX) < DRAG_THRESHOLD_PX) {
          return;
        }
        start.active = true;
        setIsDragging(true);
        node.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
      node.scrollLeft = start.scrollLeft - deltaX;
    },
    [],
  );

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    const node = scrollRef.current;
    const wasDragging = Boolean(start?.active);

    dragStartRef.current = null;
    setIsDragging(false);

    if (node?.hasPointerCapture(event.pointerId)) {
      node.releasePointerCapture(event.pointerId);
    }

    if (wasDragging) {
      const suppressClick = (clickEvent: MouseEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
      };
      node?.addEventListener("click", suppressClick, {
        capture: true,
        once: true,
      });
    }
  }, []);

  return {
    scrollRef,
    isDragging,
    onPointerDown: enablePointerDrag ? onPointerDown : undefined,
    onPointerMove: enablePointerDrag ? onPointerMove : undefined,
    onPointerUp: enablePointerDrag ? onPointerUp : undefined,
  };
}
