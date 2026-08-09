import { setRequestLocale } from "next-intl/server";

import { TravelsPage } from "@/features/travels/travels-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TravelsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TravelsPage />;
}
