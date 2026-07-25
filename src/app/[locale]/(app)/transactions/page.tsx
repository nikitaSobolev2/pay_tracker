import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { TransactionsPage } from "@/features/transactions/transactions-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TransactionsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={null}>
      <TransactionsPage />
    </Suspense>
  );
}
