import { setRequestLocale } from "next-intl/server";

import { DebtDetailPage } from "@/features/debts/debt-detail-page";

type PageProps = {
  params: Promise<{ locale: string; counterpartyId: string }>;
};

export default async function DebtDetailRoute({ params }: PageProps) {
  const { locale, counterpartyId } = await params;
  setRequestLocale(locale);
  return <DebtDetailPage counterpartyId={counterpartyId} />;
}
