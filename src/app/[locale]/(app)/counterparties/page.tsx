import { setRequestLocale } from "next-intl/server";

import { CounterpartiesPage } from "@/features/counterparties/counterparties-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CounterpartiesRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CounterpartiesPage />;
}
