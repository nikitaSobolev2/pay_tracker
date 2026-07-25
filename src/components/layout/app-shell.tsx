"use client";

import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ShareChartModal } from "@/features/share/share-chart-modal";
import { TransactionFormModal } from "@/features/transactions/transaction-form-modal";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <div className="flex flex-1 flex-col gap-4 p-3 md:p-6">{children}</div>
      </SidebarInset>
      <TransactionFormModal />
      <ShareChartModal />
    </SidebarProvider>
  );
}
