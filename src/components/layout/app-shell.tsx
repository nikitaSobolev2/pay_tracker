"use client";

import { useState, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNavIsland } from "@/components/layout/mobile-nav-island";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ConnectivityFloatingChip,
  ConnectivityRetryListener,
} from "@/features/offline/connectivity-chip";
import { ShareChartModal } from "@/features/share/share-chart-modal";
import { SearchSpotlight } from "@/features/search/search-spotlight";
import { TransactionFormModal } from "@/features/transactions/transaction-form-modal";
import { useHasHydrated } from "@/hooks/use-has-hydrated";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";
import { TransactionFormLookupWarmup } from "@/stores/transaction-form-lookup.store";

type AppShellProps = {
  readonly children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const hasPageChrome = useMobilePageChromeStore(
    (state) => state.chromeExpanded,
  );
  const pathname = usePathname();
  const isHome = pathname === "/";
  const hydrated = useHasHydrated();

  return (
    <SidebarProvider>
      {/* Base UI chrome deferred until after hydrate — avoids id="base-ui-…" SSR drift. */}
      {hydrated ? (
        <AppSidebar onOpenSearch={() => setSearchOpen(true)} />
      ) : null}
      <SidebarInset className="min-w-0 overflow-x-clip">
        {hydrated ? <AppHeader /> : null}
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4 p-3 md:p-6 md:pb-6",
            !isHome && "pt-6 md:pt-6",
            "transition-[padding-bottom] duration-300 ease-out",
            hasPageChrome
              ? "pb-[calc(9.5rem+env(safe-area-inset-bottom))]"
              : "pb-[calc(6.25rem+env(safe-area-inset-bottom))]",
          )}
        >
          {children}
        </div>
      </SidebarInset>
      {hydrated ? (
        <>
          <MobileNavIsland onOpenSearch={() => setSearchOpen(true)} />
          <SearchSpotlight
            hideTrigger
            open={searchOpen}
            onOpenChange={setSearchOpen}
          />
          <TransactionFormModal />
          <TransactionFormLookupWarmup />
          <ConnectivityRetryListener />
          <ConnectivityFloatingChip />
          <ShareChartModal />
        </>
      ) : null}
    </SidebarProvider>
  );
}
