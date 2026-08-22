import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { EventPage } from "@/features/events/event-page";
import { prisma } from "@/lib/prisma";

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { title: true, imageUrl: true },
  });

  const title = event?.title?.trim() || "Event";
  const imageUrl = event?.imageUrl?.trim() || null;

  return {
    title,
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title,
      ...(imageUrl
        ? {
            images: [{ url: imageUrl }],
          }
        : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function PublicEventRoute({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <div className="relative min-h-svh bg-background">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,oklch(0.35_0.04_250_/_0.35),transparent_55%)]" />
      <div className="event-page-stack">
        <EventPage eventId={id} chrome="public" />
      </div>
    </div>
  );
}
