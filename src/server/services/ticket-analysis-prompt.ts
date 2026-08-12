export type TicketAnalysisPrompt = {
  readonly systemPrompt: string;
  readonly userPrompt: string;
};

export function buildTicketAnalysisPrompt(input: {
  readonly sourceKind: "pdf_text" | "image";
  readonly fileName: string;
  readonly extractedText?: string;
}): TicketAnalysisPrompt {
  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input),
  };
}

function buildSystemPrompt(): string {
  return [
    "You extract itinerary legs from a travel ticket, booking receipt, or boarding pass.",
    "Return ONLY a JSON object with this exact shape:",
    "{",
    '  "tickets": [',
    "    {",
    '      "title": string,',
    '      "origin": string | null,',
    '      "destination": string | null,',
    '      "departs_at": string | null,',
    '      "arrives_at": string | null,',
    '      "ticket_number": string | null,',
    '      "flight_number": string | null,',
    '      "booking_code": string | null',
    "    }",
    "  ]",
    "}",
    "",
    "Rules:",
    "- One object per travel segment / flight / train / bus leg. A round trip is TWO tickets.",
    "- JSON keys stay exactly as specified in English.",
    "- title: short label like \"IJK → LED · 5N 590\". Prefer IATA codes when present.",
    "- origin / destination: city or airport (IATA code if shown, else city name).",
    "- departs_at / arrives_at: ISO-8601 datetimes. Combine date + local time from the ticket.",
    "  If timezone is unknown, omit Z and use the printed local time (e.g. 2026-08-30T17:40:00).",
    "- ticket_number: passenger ticket / e-ticket number (e.g. Номер билета 3162445299002).",
    "- flight_number: race / flight / train number (e.g. Рейс 5N 590). Keep airline code + number.",
    "- booking_code: PNR / booking reference (e.g. G1VP3R).",
    "- Do not invent legs. If a field is missing, use null.",
    "- Ignore extras, baggage rules, prices, and ads unless they are the only source of a field.",
    "- Russian and English tickets are both valid. Keep proper names and codes as printed.",
  ].join("\n");
}

function buildUserPrompt(input: {
  readonly sourceKind: "pdf_text" | "image";
  readonly fileName: string;
  readonly extractedText?: string;
}): string {
  if (input.sourceKind === "image") {
    return [
      `File name: ${input.fileName}`,
      "The attached image is the ticket. Extract every itinerary leg.",
    ].join("\n");
  }
  return [
    `File name: ${input.fileName}`,
    "Extracted PDF text follows. Extract every itinerary leg.",
    "",
    input.extractedText ?? "",
  ].join("\n");
}
