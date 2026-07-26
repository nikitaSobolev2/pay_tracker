"use client";

import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "next-themes";
import type { AbstractIntlMessages } from "next-intl";
import type { ReactNode } from "react";

import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppTheme } from "@/types/enums";

type AppProvidersProps = {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
};

/**
 * Dev-only console noise:
 * - next-themes FOUC script false positive (React 19)
 * - Cursor browser injects `data-cursor-ref` into the DOM, which trips hydration
 */
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
    // Cursor browser injects data-cursor-ref into the live DOM before hydrate.
    if (
      message.includes("data-cursor-ref") &&
      (message.includes("hydrat") ||
        message.includes("server rendered HTML"))
    ) {
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
          <Toaster richColors closeButton />
          <ServiceWorkerRegister />
        </TooltipProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
