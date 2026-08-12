export type YMapsMap = {
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

export type YMapsGeoObject = {
  getAddressLine: () => string;
  getLocalities?: () => string[];
  getCountry?: () => string;
  geometry?: {
    getCoordinates: () => [number, number] | null;
  };
};

export type YMapsGeocodeResult = {
  geoObjects: {
    get: (index: number) => YMapsGeoObject | undefined;
    getLength: () => number;
  };
};

export type YMapsApi = {
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
  geocode: (
    query: string | [number, number],
    options?: { results?: number; lang?: string; kind?: string },
  ) => Promise<YMapsGeocodeResult>;
};

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

export function toYmapsLang(locale: string): string {
  return locale.startsWith("en") ? "en_US" : "ru_RU";
}

export function readYandexMapsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim();
  return key || null;
}

let ymapsLoadPromise: Promise<YMapsApi> | null = null;
let loadedLang: string | null = null;

function clearLoadedYmaps(): void {
  if (typeof document !== "undefined") {
    document
      .querySelectorAll('script[src*="api-maps.yandex.ru"]')
      .forEach((script) => script.remove());
  }
  if (typeof window !== "undefined") {
    delete window.ymaps;
  }
  ymapsLoadPromise = null;
  loadedLang = null;
}

/** Loads Yandex Maps JS API once per language; geocode uses the same key. */
export function loadYmaps(apiKey: string, lang: string): Promise<YMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps requires a browser"));
  }
  if (window.ymaps && loadedLang === lang) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }
  if (window.ymaps && loadedLang !== lang) {
    clearLoadedYmaps();
  }
  if (ymapsLoadPromise) {
    return ymapsLoadPromise;
  }
  loadedLang = lang;
  ymapsLoadPromise = new Promise<YMapsApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=${encodeURIComponent(lang)}`;
    script.async = true;
    script.onload = () => {
      if (!window.ymaps) {
        clearLoadedYmaps();
        reject(new Error("Yandex Maps failed to load"));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps!));
    };
    script.onerror = () => {
      clearLoadedYmaps();
      reject(new Error("Yandex Maps script failed to load"));
    };
    document.head.appendChild(script);
  });
  return ymapsLoadPromise;
}
