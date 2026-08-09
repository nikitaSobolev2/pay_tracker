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
    `- report_message headings, labels, bullets, and body text MUST all be in ${language}. Do not mix languages.`,
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
    "- Use the JSON context: title, place, tripDays, currency, totals, maxSpendingGoal, and items.",
    "- fixedTotal (HOUSING + TRAVEL_EXPENSES) is stuck cost. Mention only as fixed backdrop. Do NOT suggest changing those items.",
    "- Judge flexible spendings (FOOD_DRINKS, SOUVENIRS, OTHER) vs tripDays, place, and maxSpendingGoal.",
    "- Compare grandTotal and flexibleTotal to maxSpendingGoal when present.",
    '- goal_status: "no_goal" when maxSpendingGoal is null; "under" when grandTotal is comfortably under goal; "tight" when within ~10% of goal; "over" when grandTotal exceeds goal.',
    '- travel_report_type is "ok" when flexible plan looks realistic and goal is not clearly broken; "bad" when flexible spend looks unrealistic or goal is clearly exceeded.',
    "- item_notes: ONLY problem flexible items. Never note housing/travel expense items. Never include OK items.",
    "- suggested_flexible_total: optional better flexible budget total, or null.",
    "- Numbers must be plain JSON numbers, not strings.",
    "- Do not invent item ids. Use only ids from items.",
    "- Cite real numbers from the context (currency amounts, days). Never invent trip facts.",
    "",
    "report_message MUST be rich Markdown (not a single paragraph). Target 120-350 words.",
    "FILL every section with concrete analysis from the context. Do NOT copy placeholder lines.",
    "Do NOT return an empty outline (headings alone, or skeleton bullets like “days / place / goal”).",
    `Use this exact section skeleton in ${language} (keep these headings, replace guidance with real content):`,
    reportSkeleton,
    "",
    "Markdown rules for report_message:",
    "- Prefer `##` / `###`, bullet lists, and a short blockquote for the verdict.",
    "- Separate major sections with a blank line.",
    "- Bold key numbers and item titles; keep tone practical.",
    "- Escape any double quotes inside the JSON string properly.",
    "- Do not wrap the whole report_message in a code fence.",
    `- Final check: if any heading or sentence is not in ${language}, rewrite it before answering.`,
  ].join("\n");
}

function englishReportSkeleton(): string {
  return [
    "## Verdict",
    "> One-line outcome for the flexible plan vs goal (ok / needs fixes).",
    "",
    "## Snapshot",
    "- Trip days, place, currency, grand total, fixed vs flexible totals, and goal if set.",
    "",
    "## Flexible plan",
    "- Only issues among FOOD_DRINKS / SOUVENIRS / OTHER, or a short realism note if fine.",
    "- Mention per-day flexible spend when useful.",
    "",
    "## Goal",
    "- under / tight / over / no goal, with numbers from the context.",
  ].join("\n");
}

function russianReportSkeleton(): string {
  return [
    "## Вердикт",
    "> Одна строка итога по гибкому плану и лимиту (ок / нужны правки).",
    "",
    "## Снимок",
    "- Дни поездки, место, валюта, общий итог, фиксированные vs гибкие суммы и лимит если есть.",
    "",
    "## Гибкий план",
    "- Только проблемы среди FOOD_DRINKS / SOUVENIRS / OTHER, или краткая оценка реалистичности если всё ок.",
    "- При необходимости укажи гибкие траты в день.",
    "",
    "## Лимит",
    "- under / tight / over / no_goal с цифрами из контекста.",
  ].join("\n");
}

function languageName(locale: string): string {
  if (locale.startsWith("ru")) {
    return "Russian";
  }
  return "English";
}
