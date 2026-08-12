"use client";

import { useLocale } from "next-intl";
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
const MIN_MAP_EDGE_PX = 2;

type YMapsMap = {
  destroy: () => void;
  getCenter: () => [number, number];
  setCenter: (
    center: [number, number],
    zoom?: number,
    options?: { duration?: number },
  ) => void;
  getZoom: () => number;
  geoObjects: {
    add: (object: unknown) => void;
    removeAll: () => void;
  };
  events: {
    add: (type: string, handler: () => void) => void;
  };
  container: {
    fitToViewport: () => void;
  };
};

type YMapsApi = {
  ready: (callback: () => void) => void;
  Map: new (
    element: HTMLElement | string,
    state: {
      center: [number, number];
      zoom: number;
      controls?: string[];
    },
    options?: { suppressMapOpenBlock?: boolean },
  ) => YMapsMap;
  Placemark: new (
    coords: [number, number],
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => unknown;
};

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

/** Yandex Maps is DOM-only, so this component must never be server rendered. */
export function EventMap({
  point,
  pickable = false,
  zoom = DEFAULT_ZOOM,
  className,
  onCenterChange,
}: EventMapProps) {
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YMapsMap | null>(null);
  const placemarkRef = useRef<unknown>(null);
  const onCenterChangeRef = useRef(onCenterChange);
  const pointRef = useRef(point);
  const pickableRef = useRef(pickable);
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
    const container: HTMLDivElement = root;
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
    if (!apiKey) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    const fitTimers: number[] = [];

    function hasLaidOutSize(): boolean {
      if (cancelled || !container.isConnected) {
        return false;
      }
      const rect = container.getBoundingClientRect();
      return rect.width >= MIN_MAP_EDGE_PX && rect.height >= MIN_MAP_EDGE_PX;
    }

    function emitCenter(map: YMapsMap) {
      if (!pickableRef.current || cancelled || mapRef.current !== map) {
        return;
      }
      try {
        const [latitude, longitude] = map.getCenter();
        const emitted: MapPoint = { latitude, longitude };
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
        // Map may already be destroyed.
      }
    }

    function scheduleFit(map: YMapsMap) {
      const run = () => {
        if (cancelled || mapRef.current !== map || !hasLaidOutSize()) {
          return;
        }
        try {
          map.container.fitToViewport();
        } catch {
          // Ignore fit races during teardown.
        }
      };
      run();
      for (const delay of [50, 150, 300]) {
        fitTimers.push(window.setTimeout(run, delay));
      }
    }

    async function createMap(ymaps: YMapsApi) {
      if (cancelled || mapRef.current || !hasLaidOutSize()) {
        return;
      }
      const center = pointRef.current ?? FALLBACK_CENTER;
      syncedCenterRef.current = center;
      const map = new ymaps.Map(
        container,
        {
          center: [center.latitude, center.longitude],
          zoom,
          controls: ["zoomControl"],
        },
        { suppressMapOpenBlock: true },
      );
      if (cancelled) {
        try {
          map.destroy();
        } catch {
          // Ignore create/cancel race.
        }
        return;
      }
      mapRef.current = map;

      if (pickableRef.current) {
        map.events.add("actionend", () => emitCenter(map));
        if (!pointRef.current) {
          emitCenter(map);
        }
      } else {
        const placemark = new ymaps.Placemark(
          [center.latitude, center.longitude],
          {},
          {
            preset: "islands#redCircleDotIcon",
            interactiveZIndex: false,
          },
        );
        placemarkRef.current = placemark;
        map.geoObjects.add(placemark);
      }

      scheduleFit(map);
    }

    void loadYmaps(apiKey, toYmapsLang(locale))
      .then((ymaps) => {
        if (cancelled) {
          return;
        }
        resizeObserver = new ResizeObserver(() => {
          if (cancelled) {
            return;
          }
          if (!mapRef.current) {
            void createMap(ymaps);
            return;
          }
          if (hasLaidOutSize()) {
            try {
              mapRef.current.container.fitToViewport();
            } catch {
              // Ignore resize races.
            }
          }
        });
        resizeObserver.observe(container);
        void createMap(ymaps);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      for (const timer of fitTimers) {
        window.clearTimeout(timer);
      }
      resizeObserver?.disconnect();
      const map = mapRef.current;
      mapRef.current = null;
      placemarkRef.current = null;
      if (map) {
        try {
          map.destroy();
        } catch {
          // Ignore destroy races.
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!point || !map) {
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
    syncedCenterRef.current = point;
    try {
      map.setCenter([point.latitude, point.longitude], map.getZoom(), {
        duration: 0,
      });
      if (!pickableRef.current && placemarkRef.current) {
        map.geoObjects.removeAll();
        const ymaps = window.ymaps;
        if (ymaps) {
          const placemark = new ymaps.Placemark(
            [point.latitude, point.longitude],
            {},
            { preset: "islands#redCircleDotIcon" },
          );
          placemarkRef.current = placemark;
          map.geoObjects.add(placemark);
        }
      }
    } catch {
      // Map may already be destroyed.
    }
  }, [point]);

  const apiKeyMissing = !process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();

  return (
    <div className={cn("relative isolate min-h-0 overflow-hidden", className)}>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 touch-none bg-muted/20"
      />
      {apiKeyMissing ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/40 p-4 text-center text-sm text-muted-foreground">
          Map is not configured
        </div>
      ) : null}
      {pickable && !apiKeyMissing ? <CenterPin /> : null}
    </div>
  );
}

function CenterPin() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
    >
      <span className="event-map-center-pin relative flex -translate-y-[calc(100%-4px)] flex-col items-center">
        <span className="event-map-center-pin__head" />
        <span className="event-map-center-pin__stem" />
        <span className="event-map-center-pin__tip" />
      </span>
    </div>
  );
}

function isSameCoordinate(left: number, right: number): boolean {
  return Math.abs(left - right) < 1e-6;
}

function toYmapsLang(locale: string): string {
  return locale.startsWith("en") ? "en_US" : "ru_RU";
}

let ymapsLoadPromise: Promise<YMapsApi> | null = null;

function loadYmaps(apiKey: string, lang: string): Promise<YMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps requires a browser"));
  }
  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }
  if (ymapsLoadPromise) {
    return ymapsLoadPromise;
  }
  ymapsLoadPromise = new Promise<YMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=${encodeURIComponent(lang)}`;
    script.async = true;
    script.onload = () => {
      if (!window.ymaps) {
        reject(new Error("Yandex Maps failed to load"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };
    script.onerror = () => {
      ymapsLoadPromise = null;
      reject(new Error("Yandex Maps script failed to load"));
    };
    document.head.appendChild(script);
  });
  return ymapsLoadPromise;
}
