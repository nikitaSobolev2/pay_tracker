import { setRequestLocale } from "next-intl/server";

import { EventPage } from "@/features/events/event-page";

type PageProps = {
  readonly params: Promise<{ locale: string; id: string }>;
};

export default async function EventDetailRoute({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <EventPage eventId={id} chrome="app" />;
}
