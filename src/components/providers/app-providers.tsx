"use client";

import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import {
  ConnectivityFloatingChip,
  ConnectivityRetryListener,
} from "@/features/offline/connectivity-chip";
import { isNetworkError } from "@/lib/offline/travel-offline-execute";
import { AppTheme } from "@/types/enums";

type AppProvidersProps = {
  readonly locale: string;
  readonly messages: AbstractIntlMessages;
  readonly children: ReactNode;
};

/**
 * Dev-only console noise:
 * - next-themes FOUC script false positive (React 19)
 * - Cursor browser injects `data-cursor-ref` into the DOM, which trips hydration
 * - Base UI `useId` attrs can still mismatch under Next 16.2 overlays/extensions
 */
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (isNetworkError(event.reason)) {
      event.preventDefault();
    }
  });
}

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args
      .map((arg) => {
        if (typeof arg === "string") {
          return arg;
        }
        if (arg instanceof Error) {
          return arg.message;
        }
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(" ");
    if (
      message.includes(
        "Encountered a script tag while rendering React component",
      )
    ) {
      return;
    }
    const isHydrationNoise =
      message.includes("hydrat") ||
      message.includes("server rendered HTML");
    // Cursor browser injects data-cursor-ref into the live DOM before hydrate.
    if (isHydrationNoise && message.includes("data-cursor-ref")) {
      return;
    }
    // Cosmetic Base UI id drift (tooltips/menus/dialogs) — not app state bugs.
    if (isHydrationNoise && message.includes("base-ui-")) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function AppProviders({
  locale,
  messages,
  children,
}: AppProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ThemeProvider
        attribute="class"
        defaultTheme={AppTheme.System}
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider>
          {children}
          {/* Outside AppShell hydrate gate so Offline shows even before chrome mounts. */}
          <ConnectivityRetryListener />
          <ConnectivityFloatingChip />
          <Toaster richColors closeButton />
          <ServiceWorkerRegister />
        </TooltipProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
