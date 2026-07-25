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
 * next-themes injects an inline script for FOUC prevention. React 19 warns
 * about that as a false positive in development — suppress only that noise.
 */
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
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
