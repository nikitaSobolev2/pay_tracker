import { extractText } from "unpdf";

import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";

const MIN_EXTRACTED_CHARS = 40;

export async function extractTicketPdfText(body: Buffer): Promise<string> {
  try {
    const result = await extractText(new Uint8Array(body), {
      mergePages: true,
    });
    const text = result.text.replace(/\s+/g, " ").trim();
    if (text.length < MIN_EXTRACTED_CHARS) {
      throw new AppServiceError(
        ApiErrorCode.Validation,
        "PDF has no extractable text",
      );
    }
    return text;
  } catch (error) {
    if (error instanceof AppServiceError) {
      throw error;
    }
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "Could not read PDF text",
    );
  }
}
