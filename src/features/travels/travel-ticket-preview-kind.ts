export type TicketPreviewKind = "image" | "pdf" | "other";

export function ticketPreviewKind(contentType: string): TicketPreviewKind {
  if (contentType.startsWith("image/")) {
    return "image";
  }
  if (contentType === "application/pdf") {
    return "pdf";
  }
  return "other";
}
