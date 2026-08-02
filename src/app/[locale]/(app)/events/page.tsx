import { setRequestLocale } from "next-intl/server";

import { EventsPage } from "@/features/events/events-page";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function EventsRoute({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <EventsPage />;
}
