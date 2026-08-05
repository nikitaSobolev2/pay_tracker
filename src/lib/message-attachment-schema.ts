import { z } from "zod";

/** Text and/or an uploaded image URL; service rejects when both are empty. */
export const messageAttachmentBodySchema = z.object({
  body: z.string().max(2000).optional().default(""),
  imageUrl: z.string().url().max(2000).nullish(),
});
