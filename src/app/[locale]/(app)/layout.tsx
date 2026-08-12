import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { LocalePreferenceSync } from "@/components/locale-preference-sync";

export const dynamic = "force-dynamic";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AuthenticatedLayout({ children }: AppLayoutProps) {
  return (
    <AppShell>
      <LocalePreferenceSync />
      {children}
    </AppShell>
  );
}
