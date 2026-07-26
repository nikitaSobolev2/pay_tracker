"use client";

import { useState, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNavIsland } from "@/components/layout/mobile-nav-island";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ShareChartModal } from "@/features/share/share-chart-modal";
import { SearchSpotlight } from "@/features/search/search-spotlight";
import { TransactionFormModal } from "@/features/transactions/transaction-form-modal";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useMobilePageChromeStore } from "@/stores/mobile-page-chrome.store";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const hasPageChrome = useMobilePageChromeStore(
    (state) => state.chromeExpanded,
  );
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-clip">
        <AppHeader onOpenSearch={() => setSearchOpen(true)} />
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-4 p-3 md:p-6 md:pb-6",
            // Extra top inset on mobile when there is no sticky app header
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
      <MobileNavIsland onOpenSearch={() => setSearchOpen(true)} />
      <SearchSpotlight
        hideTrigger
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
      <TransactionFormModal />
      <ShareChartModal />
    </SidebarProvider>
  );
}
