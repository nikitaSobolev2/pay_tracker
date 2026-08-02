import { setRequestLocale } from "next-intl/server";

import { EventPage } from "@/features/events/event-page";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function PublicEventRoute({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <div className="relative min-h-svh bg-background">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.04_250_/_0.35),transparent_55%)]" />
      <div className="event-page-stack">
        <EventPage eventId={id} />
      </div>
    </div>
  );
}
