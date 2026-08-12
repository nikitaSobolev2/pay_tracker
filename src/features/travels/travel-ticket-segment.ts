import type { AnalyzedTicketSegment, TravelTicketSegmentBody } from "@/lib/api/travels";
import type { TravelTicketDto } from "@/server/services/travel-service.types";

export function canAnalyzeTicketFile(contentType: string): boolean {
  return (
    contentType === "application/pdf" || contentType.startsWith("image/")
  );
}

export function emptyTicketMeta(): Pick<
  TravelTicketDto,
  | "origin"
  | "destination"
  | "departsAt"
  | "arrivesAt"
  | "ticketNumber"
  | "flightNumber"
  | "bookingCode"
> {
  return {
    origin: null,
    destination: null,
    departsAt: null,
    arrivesAt: null,
    ticketNumber: null,
    flightNumber: null,
    bookingCode: null,
  };
}

export function segmentToTicketBody(
  segment: AnalyzedTicketSegment,
): TravelTicketSegmentBody {
  return {
    origin: segment.origin,
    destination: segment.destination,
    departsAt: segment.departsAt,
    arrivesAt: segment.arrivesAt,
    ticketNumber: segment.ticketNumber,
    flightNumber: segment.flightNumber,
    bookingCode: segment.bookingCode,
  };
}

export function ticketFileTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}
