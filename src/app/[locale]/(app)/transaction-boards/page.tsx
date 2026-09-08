import { setRequestLocale } from "next-intl/server";

import { CalculatorBoardsPage } from "@/features/transaction-calculator/calculator-boards-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TransactionBoardsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CalculatorBoardsPage />;
}
