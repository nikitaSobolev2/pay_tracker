import { setRequestLocale } from "next-intl/server";

import { SettingsPage } from "@/features/settings/settings-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <SettingsPage />;
}
