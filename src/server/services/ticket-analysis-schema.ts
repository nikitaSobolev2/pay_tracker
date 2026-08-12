import { z } from "zod";

import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

export type ParsedTicketSegment = {
  readonly title: string;
  readonly origin: string | null;
  readonly destination: string | null;
  readonly departsAt: string | null;
  readonly arrivesAt: string | null;
  readonly ticketNumber: string | null;
  readonly flightNumber: string | null;
  readonly bookingCode: string | null;
  readonly seat: string | null;
};

const optionalText = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  });

const optionalDateTime = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return new Date(parsed).toISOString();
  });

const segmentSchema = z.object({
  title: optionalText,
  origin: optionalText,
  destination: optionalText,
  departs_at: optionalDateTime,
  arrives_at: optionalDateTime,
  ticket_number: optionalText,
  flight_number: optionalText,
  booking_code: optionalText,
  seat: optionalText,
});

const responseSchema = z.object({
  tickets: z.array(segmentSchema).min(1).max(20),
});

export function parseTicketAnalysisResponse(
  content: string,
): ParsedTicketSegment[] {
  const json = parseJsonPayload(content);
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "AI returned unexpected JSON shape",
    );
  }

  return parsed.data.tickets.map(toSegment);
}

function toSegment(
  row: z.infer<typeof segmentSchema>,
): ParsedTicketSegment {
  const origin = row.origin;
  const destination = row.destination;
  const flightNumber = row.flight_number;
  const title =
    row.title ??
    buildFallbackTitle(origin, destination, flightNumber) ??
    "Ticket";
  return {
    title,
    origin,
    destination,
    departsAt: row.departs_at,
    arrivesAt: row.arrives_at,
    ticketNumber: row.ticket_number,
    flightNumber,
    bookingCode: row.booking_code,
    seat: normalizeTicketSeat(row.seat),
  };
}

export function normalizeTicketSeat(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const stripped = value
    .replace(/^(место|seat|place|plaza)\s*[:.]?\s*/i, "")
    .trim();
  if (!stripped) {
    return null;
  }
  return stripped.replace(/[A-Za-z]/g, (letter) => letter.toUpperCase());
}

export function buildFallbackTitle(
  origin: string | null,
  destination: string | null,
  flightNumber: string | null,
): string | null {
  const route =
    origin && destination ? `${origin} → ${destination}` : origin ?? destination;
  if (route && flightNumber) {
    return `${route} · ${flightNumber}`;
  }
  return route ?? flightNumber;
}

function parseJsonPayload(content: string): unknown {
  const candidates = [content.trim(), extractJsonCandidate(content)].filter(
    (value): value is string => Boolean(value),
  );

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "string") {
        return JSON.parse(parsed);
      }
      return parsed;
    } catch {
      // Try the next candidate.
    }
  }

  throw new AppServiceError(ApiErrorCode.Validation, "AI returned invalid JSON");
}

function extractJsonCandidate(content: string): string | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return content.slice(start, end + 1);
  }
  return null;
}
