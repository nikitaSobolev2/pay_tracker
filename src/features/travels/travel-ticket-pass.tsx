"use client";

import { File, FileText, Pencil, Plane, Ticket, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";
import { BENTO_LABEL_CLASS } from "@/lib/bento";
import { cn } from "@/lib/utils";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

import {
  formatTicketDate,
  formatTicketTime,
  hasTicketItinerary,
  parseTicketPlace,
  ticketPassQrValue,
  type TicketPlaceLabel,
} from "./ticket-pass-format";
import {
  ticketPreviewKind,
  type TicketPreviewKind,
} from "./travel-ticket-preview-kind";

type TravelTicketPassProps = {
  readonly ticket: TravelTicketDto;
  readonly onOpen: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
};

export function TravelTicketPass({
  ticket,
  onOpen,
  onEdit,
  onDelete,
}: TravelTicketPassProps) {
  const t = useTranslations("travels");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const kind = ticketPreviewKind(ticket.contentType);
  const itinerary = hasTicketItinerary(ticket);
  const qrValue = ticketPassQrValue(ticket);

  return (
    <div className="relative flex w-full overflow-visible rounded-2xl shadow-[0_6px_20px_oklch(0_0_0/0.07)]">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-w-0 flex-1 cursor-pointer rounded-l-2xl border border-r-0 border-border/70 bg-card text-left",
          "transition-colors duration-200 hover:bg-muted/30",
          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40",
        )}
      >
        {itinerary ? (
          <ItineraryBody ticket={ticket} locale={locale} />
        ) : (
          <FileBody ticket={ticket} kind={kind} />
        )}
      </button>
      <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 border-y border-border/70 bg-card py-2 pr-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-xl"
          aria-label={tCommon("edit")}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 rounded-xl text-destructive"
          aria-label={t("ticketDelete")}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <button
        type="button"
        onClick={onOpen}
        aria-label={t("ticketOpen")}
        className={cn(
          "relative flex w-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 self-stretch rounded-r-2xl bg-sky-600 px-1 text-white sm:w-24 md:w-32",
          "transition-colors duration-200 hover:bg-sky-500",
          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-card sm:size-3.5"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 size-2.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-card sm:size-3.5"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 bottom-1.5 left-0 w-0 -translate-x-1/2 border-l-2 border-dashed border-card sm:top-2 sm:bottom-2"
        />
        {qrValue ? (
          <>
            <span className="hidden rounded-sm bg-white p-0.5 sm:block">
              <QRCodeSVG value={qrValue} size={44} level="M" />
            </span>
            <Ticket className="size-3.5 sm:hidden" />
          </>
        ) : (
          <Ticket className="size-3.5 sm:size-5" />
        )}
        <span className="text-[10px] leading-none font-semibold sm:text-xs">
          {t("ticketOpen")}
        </span>
        {ticket.flightNumber ? (
          <span className="hidden font-mono text-[10px] leading-none tracking-wide md:block">
            {ticket.flightNumber}
          </span>
        ) : null}
        {ticket.seat ? (
          <span className="hidden font-mono text-sm leading-none font-semibold tracking-wide sm:block">
            {ticket.seat}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function ItineraryBody({
  ticket,
  locale,
}: {
  readonly ticket: TravelTicketDto;
  readonly locale: string;
}) {
  const t = useTranslations("travels");
  const origin = parseTicketPlace(ticket.origin);
  const destination = parseTicketPlace(ticket.destination);
  const departDate = formatTicketDate(ticket.departsAt, locale);
  const departTime = formatTicketTime(ticket.departsAt, locale);
  const arriveTime = formatTicketTime(ticket.arrivesAt, locale);
  const fields = [
    { key: "date", label: t("ticketDate"), value: departDate },
    { key: "time", label: t("ticketTime"), value: departTime },
    { key: "seat", label: t("ticketSeat"), value: ticket.seat },
    { key: "arrive", label: t("ticketArrivesAt"), value: arriveTime },
    { key: "pnr", label: t("ticketBookingCode"), value: ticket.bookingCode },
    { key: "number", label: t("ticketNumber"), value: ticket.ticketNumber },
  ].filter((field) => Boolean(field.value));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className={BENTO_LABEL_CLASS}>{t("ticketBoardingPass")}</p>
        {ticket.flightNumber ? (
          <p className="font-mono text-xs font-semibold tracking-wide sm:text-sm">
            {ticket.flightNumber}
          </p>
        ) : null}
      </div>
      {origin.code || origin.name || destination.code || destination.name ? (
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <PlaceBlock place={origin} caption={t("ticketOrigin")} align="start" />
          <Plane
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground sm:size-5"
          />
          <PlaceBlock
            place={destination}
            caption={t("ticketDestination")}
            align="end"
          />
        </div>
      ) : null}
      {fields.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-6">
          {fields.map((field) => (
            <PassField
              key={field.key}
              label={field.label}
              value={field.value ?? ""}
              emphasize={field.key === "seat"}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PlaceBlock({
  place,
  caption,
  align,
}: {
  readonly place: TicketPlaceLabel;
  readonly caption: string;
  readonly align: "start" | "end";
}) {
  const headline = place.code ?? place.name;
  const sub = place.code ? place.name : null;
  return (
    <div
      className={cn(
        "min-w-0 flex-1",
        align === "end" && "text-right",
      )}
    >
      <p className={BENTO_LABEL_CLASS}>{caption}</p>
      <p
        className={cn(
          "mt-0.5 truncate leading-none",
          place.code
            ? "font-mono text-2xl font-semibold tracking-wider sm:text-3xl"
            : "text-base font-semibold tracking-wide uppercase sm:text-xl",
        )}
      >
        {headline ?? "—"}
      </p>
      {sub ? (
        <p className="mt-1 truncate text-xs text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  );
}

function PassField({
  label,
  value,
  emphasize = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className={BENTO_LABEL_CLASS}>{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-mono",
          emphasize
            ? "text-base font-semibold sm:text-lg"
            : "text-xs font-medium sm:text-sm",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FileBody({
  ticket,
  kind,
}: {
  readonly ticket: TravelTicketDto;
  readonly kind: TicketPreviewKind;
}) {
  const t = useTranslations("travels");
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 sm:px-4">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
        <TicketThumbnail fileUrl={ticket.fileUrl} kind={kind} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={BENTO_LABEL_CLASS}>{t("ticketBoardingPass")}</p>
        <p className="mt-0.5 truncate text-sm font-semibold">{ticket.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {ticketTypeLabel(kind, t)} · {ticket.fileName}
        </p>
      </div>
    </div>
  );
}

function TicketThumbnail({
  fileUrl,
  kind,
}: {
  readonly fileUrl: string;
  readonly kind: TicketPreviewKind;
}) {
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fileUrl} alt="" className="size-full object-cover" />;
  }
  if (kind === "pdf") {
    return <FileText className="size-5" />;
  }
  return <File className="size-5" />;
}

function ticketTypeLabel(
  kind: TicketPreviewKind,
  t: ReturnType<typeof useTranslations<"travels">>,
): string {
  if (kind === "image") {
    return t("ticketTypeImage");
  }
  if (kind === "pdf") {
    return t("ticketTypePdf");
  }
  return t("ticketTypeFile");
}
