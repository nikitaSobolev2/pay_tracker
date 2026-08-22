import { z } from "zod";

export const ticketSegmentBodySchema = z.object({
  origin: z.string().max(200).nullish(),
  destination: z.string().max(200).nullish(),
  departsAt: z.string().datetime({ offset: true }).nullish(),
  arrivesAt: z.string().datetime({ offset: true }).nullish(),
  ticketNumber: z.string().max(100).nullish(),
  flightNumber: z.string().max(50).nullish(),
  bookingCode: z.string().max(50).nullish(),
  seat: z.string().max(20).nullish(),
});

export const createTicketBodySchema = ticketSegmentBodySchema.extend({
  title: z.string().min(1).max(200),
  fileUrl: z.string().url().max(2000),
  fileName: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
});

export const updateTicketBodySchema = ticketSegmentBodySchema.extend({
  title: z.string().min(1).max(200).optional(),
});
