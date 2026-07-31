"use client";

import { useEffect } from "react";

/**
 * PWA SW is intentionally disabled: next-pwa is not wired in next.config, but
 * clients still had /sw.js registrations that Safari kept after bad deploys.
 * Unregister + clear caches on every load so stuck Mac Safari sessions recover.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });

    if ("caches" in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          void caches.delete(key);
        }
      });
    }
  }, []);

  return null;
}
