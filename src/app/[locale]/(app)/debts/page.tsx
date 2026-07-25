import { setRequestLocale } from "next-intl/server";

import { DebtsPage } from "@/features/debts/debts-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DebtsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DebtsPage />;
}
