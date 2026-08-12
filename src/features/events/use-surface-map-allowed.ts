"use client";

import { useEffect, useState } from "react";

const OVERLAY_OPEN_SELECTOR = [
  '[data-slot="dialog-content"][data-open]',
  '[data-slot="dialog-overlay"][data-open]',
  '[data-slot="sheet-content"][data-open]',
  '[data-slot="sheet-overlay"][data-open]',
].join(", ");

/**
 * Leaflet crashes with `_leaflet_pos` if its container is `display:none` while
 * still mounted. Unmount surface maps whenever any dialog/sheet is open.
 * (Same guard kept for Yandex Maps — avoid hidden map layout bugs.)
 */
export function useSurfaceMapAllowed(mapEnabled: boolean): boolean {
  const [overlayOpen, setOverlayOpen] = useState(false);

  useEffect(() => {
    const sync = () => {
      setOverlayOpen(Boolean(document.querySelector(OVERLAY_OPEN_SELECTOR)));
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-open", "data-state", "class"],
    });
    return () => {
      observer.disconnect();
    };
  }, []);

  return mapEnabled && !overlayOpen;
}
