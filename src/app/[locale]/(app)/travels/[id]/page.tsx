import { setRequestLocale } from "next-intl/server";

import { TravelPage } from "@/features/travels/travel-page";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function TravelDetailRoute({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <TravelPage travelId={id} />;
}
