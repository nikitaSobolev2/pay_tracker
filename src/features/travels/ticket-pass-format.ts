export type TicketPlaceLabel = {
  readonly code: string | null;
  readonly name: string | null;
};

const IATA_CODE = /^[A-Za-z]{3}$/;
const IATA_IN_PARENS = /\(([A-Za-z]{3})\)/;
const IATA_PREFIX = /^([A-Z]{3})(?:\s*[·•\-–,]\s*|\s+)/;

export function parseTicketPlace(
  value: string | null | undefined,
): TicketPlaceLabel {
  if (value == null) {
    return { code: null, name: null };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { code: null, name: null };
  }
  if (IATA_CODE.test(trimmed)) {
    return { code: trimmed.toUpperCase(), name: null };
  }
  const parens = IATA_IN_PARENS.exec(trimmed);
  if (parens?.[1]) {
    const name = trimmed.replace(IATA_IN_PARENS, "").trim();
    return { code: parens[1].toUpperCase(), name: name || null };
  }
  const prefix = IATA_PREFIX.exec(trimmed);
  if (prefix?.[1]) {
    const name = trimmed.slice(prefix[0].length).trim();
    return { code: prefix[1].toUpperCase(), name: name || null };
  }
  return { code: null, name: trimmed };
}

export function hasTicketItinerary(ticket: {
  readonly origin: string | null;
  readonly destination: string | null;
  readonly departsAt: string | null;
  readonly arrivesAt: string | null;
  readonly ticketNumber: string | null;
  readonly flightNumber: string | null;
  readonly bookingCode: string | null;
  readonly seat: string | null;
}): boolean {
  return Boolean(
    ticket.origin ||
      ticket.destination ||
      ticket.departsAt ||
      ticket.arrivesAt ||
      ticket.ticketNumber ||
      ticket.flightNumber ||
      ticket.bookingCode ||
      ticket.seat,
  );
}

export function formatTicketDate(
  iso: string | null,
  locale: string,
): string | null {
  const date = parseTicketDate(iso);
  if (!date) {
    return null;
  }
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

export function formatTicketTime(
  iso: string | null,
  locale: string,
): string | null {
  const date = parseTicketDate(iso);
  if (!date) {
    return null;
  }
  return date.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ticketPassQrValue(ticket: {
  readonly bookingCode: string | null;
  readonly ticketNumber: string | null;
}): string | null {
  return ticket.bookingCode ?? ticket.ticketNumber;
}

function parseTicketDate(iso: string | null): Date | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}
