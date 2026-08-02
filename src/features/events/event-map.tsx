"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export type MapPoint = {
  readonly latitude: number;
  readonly longitude: number;
};

export type EventMapProps = {
  readonly point: MapPoint | null;
  /**
   * Picker mode: a fixed pin sits in the viewport centre while the map pans
   * underneath. `onCenterChange` fires when the user finishes a pan/zoom.
   */
  readonly pickable?: boolean;
  readonly zoom?: number;
  readonly className?: string;
  readonly onCenterChange?: (point: MapPoint) => void;
};

const FALLBACK_CENTER: MapPoint = { latitude: 55.751244, longitude: 37.618423 };
const DEFAULT_ZOOM = 15;
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const MIN_MAP_EDGE_PX = 2;

guardLeafletDomUtil();

/** Leaflet is DOM-only, so this component must never be server rendered. */
export function EventMap({
  point,
  pickable = false,
  zoom = DEFAULT_ZOOM,
  className,
  onCenterChange,
}: EventMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  const pointRef = useRef(point);
  const pickableRef = useRef(pickable);
  /** Last centre we either emitted or applied from props — skips echo setView. */
  const syncedCenterRef = useRef<MapPoint | null>(point);

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    pointRef.current = point;
  }, [point]);

  useEffect(() => {
    pickableRef.current = pickable;
  }, [pickable]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) {
      return;
    }
    // Definite binding — nested closures must not see RefObject's `| null`.
    const container: HTMLDivElement = root;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const invalidateTimers: number[] = [];
    let createRetryTimer: number | null = null;

    function hasLaidOutSize(): boolean {
      if (cancelled || !container.isConnected) {
        return false;
      }
      const rect = container.getBoundingClientRect();
      return rect.width >= MIN_MAP_EDGE_PX && rect.height >= MIN_MAP_EDGE_PX;
    }

    function isMapAlive(map: L.Map): boolean {
      if (cancelled || mapRef.current !== map) {
        return false;
      }
      try {
        const mapContainer = map.getContainer();
        return (
          Boolean(map.getPane("mapPane")) &&
          mapContainer.isConnected &&
          mapContainer === container
        );
      } catch {
        return false;
      }
    }

    function safeInvalidate(map: L.Map) {
      if (!isMapAlive(map) || !hasLaidOutSize()) {
        return;
      }
      try {
        map.invalidateSize({ animate: false, pan: false });
      } catch {
        // Leaflet throws "_leaflet_pos" when the map was torn down mid-frame.
      }
    }

    function scheduleInvalidate(map: L.Map) {
      safeInvalidate(map);
      for (const delay of [50, 150, 300]) {
        invalidateTimers.push(
          window.setTimeout(() => {
            safeInvalidate(map);
          }, delay),
        );
      }
    }

    function emitCenter(map: L.Map) {
      if (!pickableRef.current || !isMapAlive(map)) {
        return;
      }
      try {
        const center = map.getCenter();
        const emitted: MapPoint = {
          latitude: center.lat,
          longitude: center.lng,
        };
        const synced = syncedCenterRef.current;
        if (
          synced &&
          isSameCoordinate(synced.latitude, emitted.latitude) &&
          isSameCoordinate(synced.longitude, emitted.longitude)
        ) {
          return;
        }
        syncedCenterRef.current = emitted;
        onCenterChangeRef.current?.(emitted);
      } catch {
        // Map may already be removed.
      }
    }

    function createMap() {
      if (cancelled || mapRef.current || !hasLaidOutSize()) {
        return false;
      }

      const center = pointRef.current ?? FALLBACK_CENTER;
      syncedCenterRef.current = center;
      let map: L.Map;
      try {
        map = L.map(container, {
          attributionControl: true,
          zoomControl: true,
          dragging: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: false,
          keyboard: true,
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false,
        }).setView([center.latitude, center.longitude], zoom, {
          animate: false,
        });
      } catch {
        return false;
      }

      if (cancelled) {
        try {
          map.remove();
        } catch {
          // Ignore create/cancel race.
        }
        return false;
      }

      L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION }).addTo(map);
      // Keep touch pans on the map instead of the scrollable dialog body.
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.disableClickPropagation(container);
      mapRef.current = map;

      if (pickableRef.current) {
        map.on("dragend", () => emitCenter(map));
        map.on("zoomend", () => emitCenter(map));
        // Seed coords/address when the picker opens with no selected point yet.
        if (!pointRef.current) {
          emitCenter(map);
        }
      } else {
        markerRef.current = L.marker([center.latitude, center.longitude], {
          icon: buildMarkerIcon(),
          interactive: false,
          keyboard: false,
        }).addTo(map);
      }

      scheduleInvalidate(map);
      return true;
    }

    resizeObserver = new ResizeObserver(() => {
      if (cancelled) {
        return;
      }
      if (!mapRef.current) {
        createMap();
        return;
      }
      safeInvalidate(mapRef.current);
    });
    resizeObserver.observe(container);

    if (!createMap()) {
      createRetryTimer = window.setTimeout(() => {
        createRetryTimer = null;
        createMap();
      }, 0);
    }

    return () => {
      cancelled = true;
      if (createRetryTimer !== null) {
        window.clearTimeout(createRetryTimer);
      }
      for (const timer of invalidateTimers) {
        window.clearTimeout(timer);
      }
      resizeObserver?.disconnect();
      resizeObserver = null;
      const map = mapRef.current;
      const marker = markerRef.current;
      mapRef.current = null;
      markerRef.current = null;
      if (map) {
        destroyLeafletMap(map, marker);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!point || !map) {
      return;
    }
    try {
      if (!map.getPane("mapPane")) {
        return;
      }
    } catch {
      return;
    }
    const synced = syncedCenterRef.current;
    if (
      synced &&
      isSameCoordinate(synced.latitude, point.latitude) &&
      isSameCoordinate(synced.longitude, point.longitude)
    ) {
      return;
    }
    // External change (search selection) — recentre so the fixed pin sits on it.
    syncedCenterRef.current = point;
    try {
      map.setView([point.latitude, point.longitude], map.getZoom(), {
        animate: false,
      });
      if (!pickableRef.current) {
        markerRef.current?.setLatLng([point.latitude, point.longitude]);
      }
    } catch {
      // Map may already be removed.
    }
  }, [point]);

  return (
    <div className={cn("relative isolate min-h-0 overflow-hidden", className)}>
      {/*
        Height/width come from className on this wrapper so the centre pin
        overlay shares the same box as the Leaflet root (not a collapsed parent).
      */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 touch-none [&_.leaflet-control-container]:z-[5]"
      />
      {pickable ? <CenterPin /> : null}
    </div>
  );
}

/**
 * Fixed to the viewport — the tip sits on the map centre. Not a Leaflet marker,
 * so panning moves the map underneath and the pin never leaves the middle.
 */
function CenterPin() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      {/* Tip of the pin is at the flex centre = map.getCenter() */}
      <span className="event-map-center-pin relative flex -translate-y-[calc(100%-4px)] flex-col items-center">
        <span className="event-map-center-pin__head" />
        <span className="event-map-center-pin__stem" />
        <span className="event-map-center-pin__tip" />
      </span>
    </div>
  );
}

/** Leaflet's default icon resolves image URLs relative to the CSS, which breaks under Next. */
function buildMarkerIcon(): L.DivIcon {
  return L.divIcon({
    className: "event-map-leaflet-marker",
    html: `<span class="event-map-leaflet-marker__dot"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function isSameCoordinate(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-6;
}

/**
 * Leaflet reads `_leaflet_pos` during async pan/zoom/invalidate. After unmount
 * (tab switch, dialog) those callbacks can still fire on detached nodes.
 */
function guardLeafletDomUtil() {
  const domUtil = L.DomUtil as typeof L.DomUtil & {
    __payTrackerGuarded?: boolean;
  };
  if (domUtil.__payTrackerGuarded) {
    return;
  }
  domUtil.__payTrackerGuarded = true;
  const originalGetPosition = domUtil.getPosition.bind(domUtil);
  domUtil.getPosition = (element: HTMLElement) => {
    if (!element?.isConnected) {
      return L.point(0, 0);
    }
    try {
      return originalGetPosition(element);
    } catch {
      return L.point(0, 0);
    }
  };
}

function destroyLeafletMap(map: L.Map, marker: L.Marker | null) {
  try {
    map.stop();
  } catch {
    // Already tearing down.
  }
  try {
    map.off();
  } catch {
    // Already tearing down.
  }
  try {
    marker?.remove();
  } catch {
    // Marker may already be gone.
  }
  try {
    map.eachLayer((layer) => {
      try {
        map.removeLayer(layer);
      } catch {
        // Ignore per-layer races.
      }
    });
  } catch {
    // Ignore layer sweep races.
  }
  try {
    map.remove();
  } catch {
    // Ignore final remove races.
  }
}
