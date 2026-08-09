import { z } from "zod";

import { AppServiceError } from "@/lib/errors";
import { ApiErrorCode } from "@/types/api";
import { TravelAiReportType } from "@/types/enums";

export type ParsedTravelAnalysis = {
  readonly type: TravelAiReportType;
  readonly reportMessage: string;
  readonly goalStatus: "under" | "over" | "no_goal" | "tight";
  readonly flexibleAssessmentMessage: string;
  readonly suggestedFlexibleTotal: number | null;
  readonly itemNotes: ReadonlyArray<{
    readonly itemId: string;
    readonly message: string;
  }>;
};

const optionalPositiveNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value): number | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === "string" && value.trim() === "") {
      return null;
    }
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return null;
    }
    return numberValue;
  });

const responseSchema = z.object({
  travel_report_type: z.enum(["ok", "bad"]),
  report_message: z.string().min(1).max(20_000),
  goal_status: z.enum(["under", "over", "no_goal", "tight"]),
  flexible_total_assessment: z
    .object({
      message: z.string().min(1).max(2000),
      suggested_flexible_total: optionalPositiveNumber.optional().default(null),
    })
    .optional(),
  item_notes: z
    .union([
      z.record(
        z.string(),
        z.object({ message: z.string().min(1).max(2000) }),
      ),
      z.array(
        z.object({
          item_id: z.string().optional(),
          id: z.string().optional(),
          message: z.string().min(1).max(2000),
        }),
      ),
    ])
    .optional()
    .default({}),
});

export function parseTravelAnalysisResponse(
  content: string,
  knownItemIds: ReadonlySet<string>,
): ParsedTravelAnalysis {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "AI returned invalid JSON",
    );
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "AI returned unexpected JSON shape",
    );
  }

  const itemNotes: Array<{ itemId: string; message: string }> = [];
  const notes = parsed.data.item_notes;
  if (Array.isArray(notes)) {
    for (const note of notes) {
      const itemId = note.item_id ?? note.id;
      if (!itemId || !knownItemIds.has(itemId)) {
        continue;
      }
      itemNotes.push({ itemId, message: note.message });
    }
  } else {
    for (const [itemId, note] of Object.entries(notes)) {
      if (!knownItemIds.has(itemId)) {
        continue;
      }
      itemNotes.push({ itemId, message: note.message });
    }
  }

  const reportMessage = parsed.data.report_message.trim();
  assertReportMessageHasSubstance(reportMessage);

  return {
    type:
      parsed.data.travel_report_type === "ok"
        ? TravelAiReportType.Ok
        : TravelAiReportType.Bad,
    reportMessage,
    goalStatus: parsed.data.goal_status,
    flexibleAssessmentMessage:
      parsed.data.flexible_total_assessment?.message ?? "",
    suggestedFlexibleTotal:
      parsed.data.flexible_total_assessment?.suggested_flexible_total ?? null,
    itemNotes,
  };
}

/** Reject empty outlines the model sometimes copies from the prompt skeleton. */
function assertReportMessageHasSubstance(message: string): void {
  const body = message
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  // Real travel reports cite days/amounts; skeleton-only replies have neither.
  if (body.length < 80 || !/\d/.test(body)) {
    throw new AppServiceError(
      ApiErrorCode.Validation,
      "AI returned an empty report outline",
    );
  }
}
