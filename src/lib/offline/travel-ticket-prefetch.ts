import type { TravelTicketDto } from "@/server/services/travel-service.types";

const TICKET_FILE_PROXY_PREFIX = "/api/files/travel-ticket/";

/**
 * Warms the service worker file cache so ticket files opened online
 * stay viewable when the device goes offline. Also loads the PDF viewer
 * chunk + worker when any ticket is a PDF.
 */
export function prefetchTicketFilesForOffline(
  tickets: readonly TravelTicketDto[],
): void {
  if (typeof window === "undefined" || !("caches" in window)) {
    return;
  }
  for (const ticket of tickets) {
    if (!ticket.fileUrl.startsWith(TICKET_FILE_PROXY_PREFIX)) {
      continue;
    }
    // Warm SW file cache (cache-first handler stores 200 responses).
    void fetch(ticket.fileUrl, { credentials: "include" }).catch(
      () => undefined,
    );
  }

  if (tickets.some((ticket) => ticket.contentType === "application/pdf")) {
    void import("@/features/travels/travel-ticket-pdf-viewer")
      .then((module) => {
        module.warmupPdfViewerForOffline();
      })
      .catch(() => undefined);
  }
}
