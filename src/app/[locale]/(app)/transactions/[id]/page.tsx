import { setRequestLocale } from "next-intl/server";

import { TransactionDetailPage } from "@/features/transactions/transaction-detail-page";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function TransactionDetailRoute({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TransactionDetailPage transactionId={id} />;
}
