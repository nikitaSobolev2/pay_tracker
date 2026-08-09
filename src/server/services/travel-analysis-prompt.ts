import type { TravelAnalysisContext } from "./travel-analysis-context";

export type TravelAnalysisPrompt = {
  readonly systemPrompt: string;
  readonly userPrompt: string;
};

export function buildTravelAnalysisPrompt(input: {
  readonly context: TravelAnalysisContext;
  readonly responseLanguage: string;
}): TravelAnalysisPrompt {
  return {
    systemPrompt: buildSystemPrompt(input.responseLanguage),
    userPrompt: JSON.stringify(input.context, null, 2),
  };
}

function buildSystemPrompt(responseLanguage: string): string {
  const language = languageName(responseLanguage);
  const isRussian = responseLanguage.startsWith("ru");
  const reportSkeleton = isRussian
    ? russianReportSkeleton()
    : englishReportSkeleton();

  return [
    "You analyze a personal travel budget plan (planned spendings before the trip).",
    "",
    "LANGUAGE LOCK (highest priority):",
    `- Response language: ${language}.`,
    `- EVERY user-facing string MUST be fully in ${language}: report_message, flexible_total_assessment.message, item_notes.*.message.`,
    "- JSON keys stay exactly as specified in English.",
    "",
    "Return ONLY a JSON object with this exact shape:",
    "{",
    '  "travel_report_type": "ok" | "bad",',
    '  "report_message": string,',
    '  "goal_status": "under" | "over" | "no_goal" | "tight",',
    '  "flexible_total_assessment": {',
    '    "message": string,',
    '    "suggested_flexible_total": number | null',
    "  },",
    '  "item_notes": {',
    '    "<item_id>": { "message": string }',
    "  }",
    "}",
    "",
    "Rules:",
    "- fixedTotal (HOUSING + TRAVEL_EXPENSES) is stuck cost. Mention only as fixed backdrop. Do NOT suggest changing those items.",
    "- Judge flexible spendings (FOOD_DRINKS, SOUVENIRS, OTHER) vs tripDays, place, and maxSpendingGoal.",
    "- Compare grandTotal and flexibleTotal to maxSpendingGoal when present.",
    '- goal_status: "no_goal" when maxSpendingGoal is null; "under" when grandTotal is comfortably under goal; "tight" when within ~10% of goal; "over" when grandTotal exceeds goal.',
    '- travel_report_type is "ok" when flexible plan looks realistic and goal is not clearly broken; "bad" when flexible spend looks unrealistic or goal is clearly exceeded.',
    "- item_notes: ONLY problem flexible items. Never note housing/travel expense items. Never include OK items.",
    "- suggested_flexible_total: optional better flexible budget total, or null.",
    "- Numbers must be plain JSON numbers, not strings.",
    "- Do not invent item ids. Use only ids from items.",
    "",
    "report_message markdown skeleton:",
    reportSkeleton,
  ].join("\n");
}

function englishReportSkeleton(): string {
  return [
    "## Verdict",
    "## Snapshot",
    "- trip days / place / goal",
    "- fixed vs flexible totals",
    "## Flexible plan",
    "- only issues or a short realism note",
    "## Goal",
    "- under / tight / over / no goal",
  ].join("\n");
}

function russianReportSkeleton(): string {
  return [
    "## Вердикт",
    "## Снимок",
    "- дни / место / лимит",
    "- фиксированные vs гибкие",
    "## Гибкий план",
    "- только проблемы или краткая оценка реалистичности",
    "## Лимит",
    "- under / tight / over / no_goal",
  ].join("\n");
}

function languageName(locale: string): string {
  if (locale.startsWith("ru")) {
    return "Russian";
  }
  return "English";
}
