import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AuthenticatedLayout({ children }: AppLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
