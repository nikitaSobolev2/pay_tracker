"use client";

import { useEffect } from "react";

/**
 * Registers the PayTracker service worker for offline travel shell + API GETs.
 * Soft-reloads once when an updated worker takes control (avoids Safari loops).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let refreshing = false;

    function onControllerChange() {
      if (refreshing) {
        return;
      }
      refreshing = true;
      window.location.reload();
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    if (hadController) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        void registration.update();
      })
      .catch(() => {
        // Registration can fail on insecure origins; ignore.
      });

    return () => {
      if (hadController) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
    };
  }, []);

  return null;
}
