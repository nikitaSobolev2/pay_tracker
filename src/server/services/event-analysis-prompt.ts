import type { EventAnalysisContext } from "./event-analysis-context";

export type AnalysisPrompt = {
  readonly systemPrompt: string;
  readonly userPrompt: string;
};

/**
 * Builds the system + user prompts for the OpenAI-compatible analyzer.
 * The model must answer in the chosen response language and return only the JSON contract.
 */
export function buildAnalysisPrompt(input: {
  readonly context: EventAnalysisContext;
  readonly responseLanguage: string;
}): AnalysisPrompt {
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
    "You analyze event shopping lists for realistic quantity/price mistakes AND missing useful items.",
    "",
    "LANGUAGE LOCK (highest priority):",
    `- Response language: ${language}.`,
    `- EVERY user-facing string value MUST be fully in ${language}: report_message, items_report.*.message, suggested_items.*.title, suggested_items.*.reason.`,
    `- report_message headings, labels, bullets, and body text MUST all be in ${language}. Do not mix languages.`,
    "- JSON keys stay exactly as specified in English (event_report_type, report_message, better_amount, …).",
    "- Do not leave English section titles like Verdict / Issues / Event snapshot when the response language is Russian.",
    "- Product titles already on the list may stay as written; your commentary around them must still be in the response language.",
    "",
    "Return ONLY a JSON object with this exact shape:",
    "{",
    '  "event_report_type": "ok" | "bad",',
    '  "report_message": string,',
    '  "items_report": {',
    '    "<item_id>": {',
    '      "message": string,',
    '      "better_amount": number | null,',
    '      "realistic_price": number | null',
    "    }",
    "  },",
    '  "suggested_items": [',
    "    {",
    '      "title": string,',
    '      "category": "FOOD" | "DRINKS" | "ALCOHOL" | "HOUSING" | "OTHER",',
    '      "amount": number,',
    '      "amount_unit": string,',
    '      "realistic_price": number,',
    '      "reason": string',
    "    }",
    "  ]",
    "}",
    "Rules:",
    "- Include an item in items_report ONLY when its amount or price looks wrong and needs a change.",
    "- Leave items_report as {} when every item looks roughly fine.",
    "- NEVER put OK / fine / “close to normal” items in items_report.",
    "- NEVER mention OK items in report_message (no “Cheese looks fine”, no “units and price are close to normal”, no Looks-fine / В порядке lists).",
    "- report_message may discuss only problem items (plus snapshot and missing additions).",
    "- Do not include a Next steps / Дальше section in report_message.",
    "- better_amount: estimate quantity from the item title, attendee counts and event durationHours.",
    "- realistic_price: estimate a typical retail unit price for pricingYear in the event location (address / lat-lon), in the event currency.",
    "- When location is present, ground prices in that city/region market — not a generic global average.",
    "- When location is missing, use broad country/currency norms for pricingYear and say the estimate is approximate.",
    "- Prefer current pricingYear retail reality; do not use outdated historical prices.",
    "- message: short note of what is wrong and why (in the response language). Only for problem items.",
    '- event_report_type is "ok" when the list is roughly fine, "bad" when items are messed up or the overall verdict is bad.',
    "- Do not invent item ids. Use only ids from the provided items list.",
    "- Numbers must be plain JSON numbers, not strings.",
    "",
    "suggested_items rules:",
    "- Propose missing products, drinks, cocktail ingredients, supplies (ice, cups, coal, cigarettes, snacks, etc.) when the full event context implies them.",
    "- Ground every suggestion in title, attendees, durationHours, location, existing items, chat, threads, and contextMessage.",
    "- Skip anything already on the list: same title, translation, or near-duplicate (e.g. Disposable cups ≈ одноразовые стаканы ≈ Cups).",
    "- Before suggesting, scan every items[].title; if the product is already covered, omit it.",
    "- Max 8 suggestions. Prefer high-value complementary items; leave [] when nothing useful is missing.",
    "- amount_unit: match the shopping-list unit language (e.g. шт/кг/литр for Russian lists, pcs/kg/l for English lists).",
    "- reason: one short sentence why this event needs it (in the response language).",
    "- title: write the product name in the response language.",
    "",
    "report_message MUST be rich Markdown (not a single paragraph). Target 180-450 words.",
    `Use this exact section skeleton in ${language} (keep these headings):`,
    reportSkeleton,
    "",
    "Markdown rules for report_message:",
    "- Prefer `##` / `###`, bullet lists, and blockquotes for the verdict.",
    "- Separate major sections with a blank line.",
    "- Bold key numbers and item names; keep tone practical, not fluffy.",
    "- Escape any double quotes inside the JSON string properly.",
    "- Do not wrap the whole report_message in a code fence.",
    `- Final check: if any heading or sentence is not in ${language}, rewrite it before answering.`,
  ].join("\n");
}

function englishReportSkeleton(): string {
  return [
    "## Verdict",
    "> One-line outcome for the whole list (ok / needs fixes).",
    "",
    "## Event snapshot",
    "- Attendees, duration, currency, pricing year, and location cues that drive estimates.",
    "",
    "## Issues",
    "Only problem items. One `### Item title` subsection each.",
    "- What looks wrong (current amount/price).",
    "- Why it is unrealistic for this event size/duration.",
    "- Concrete better amount and/or realistic unit price for this location and year.",
    "- If there are no problem items, write a single line that there are no item issues (do not list OK products).",
    "",
    "## Suggested additions",
    "- Bullet missing items from suggested_items (title, amount/unit, rough price, why).",
    "- Say none when suggested_items is empty.",
    "- Do not add a Next steps / Дальше section.",
  ].join("\n");
}

function russianReportSkeleton(): string {
  return [
    "## Вердикт",
    "> Одна строка итога по всему списку (ок / нужны правки).",
    "",
    "## Снимок события",
    "- Участники, длительность, валюта, год цен и локация, от которых зависят оценки.",
    "",
    "## Проблемы",
    "Только проблемные позиции. По одной секции `### Название позиции` на каждую.",
    "- Что не так (текущее количество/цена).",
    "- Почему это нереалистично для размера/длительности события.",
    "- Конкретное лучшее количество и/или реалистичная цена за единицу для этой локации и года.",
    "- Если проблемных позиций нет — одна строка «проблем с позициями нет» (не перечисляй нормальные товары).",
    "",
    "## Что добавить",
    "- Маркированный список из suggested_items (название, количество/единица, примерная цена, зачем).",
    "- Напиши «нет», если suggested_items пустой.",
    "- Не добавляй секцию «Дальше» / Next steps.",
  ].join("\n");
}

function languageName(locale: string): string {
  if (locale.startsWith("ru")) {
    return "Russian";
  }
  return "English";
}
