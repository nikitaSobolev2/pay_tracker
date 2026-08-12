import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import { isSupportedImageType } from "@/server/services/storage-service";

import {
  requestJsonCompletion,
  requestJsonCompletionWithImages,
} from "./ai/ai-client";
import { buildTicketAnalysisPrompt } from "./ticket-analysis-prompt";
import {
  parseTicketAnalysisResponse,
  type ParsedTicketSegment,
} from "./ticket-analysis-schema";
import { extractTicketPdfText } from "./ticket-pdf-text";
import { assertTravelOwnedByUser } from "./travel-service";

export type AnalyzeTravelTicketFileInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly body: Buffer;
};

export async function analyzeTravelTicketFile(
  input: AnalyzeTravelTicketFileInput,
): Promise<{ tickets: ParsedTicketSegment[] }> {
  await assertTravelOwnedByUser(input.userId, input.travelId);

  if (input.contentType === "application/pdf") {
    return analyzePdf(input);
  }
  if (isSupportedImageType(input.contentType)) {
    return analyzeImage(input);
  }
  throw new AppServiceError(
    ApiErrorCode.Validation,
    "AI analysis supports PDF and images only",
  );
}

async function analyzePdf(
  input: AnalyzeTravelTicketFileInput,
): Promise<{ tickets: ParsedTicketSegment[] }> {
  const extractedText = await extractTicketPdfText(input.body);
  const prompt = buildTicketAnalysisPrompt({
    sourceKind: "pdf_text",
    fileName: input.fileName,
    extractedText,
  });
  const completion = await requestJsonCompletion(prompt);
  return { tickets: parseTicketAnalysisResponse(completion.content) };
}

async function analyzeImage(
  input: AnalyzeTravelTicketFileInput,
): Promise<{ tickets: ParsedTicketSegment[] }> {
  const prompt = buildTicketAnalysisPrompt({
    sourceKind: "image",
    fileName: input.fileName,
  });
  const completion = await requestJsonCompletionWithImages({
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    images: [
      {
        mediaType: input.contentType,
        base64: input.body.toString("base64"),
      },
    ],
  });
  return { tickets: parseTicketAnalysisResponse(completion.content) };
}
