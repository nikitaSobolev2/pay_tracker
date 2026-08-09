import { AppServiceError } from "@/lib/errors";
import { decimalToString, toDecimal } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { ApiErrorCode } from "@/types/api";
import { AppLocale } from "@/types/enums";

import { requestJsonCompletion } from "./ai/ai-client";
import { buildTravelAnalysisContext } from "./travel-analysis-context";
import { buildTravelAnalysisPrompt } from "./travel-analysis-prompt";
import { parseTravelAnalysisResponse } from "./travel-analysis-schema";
import type { TravelAiReportDto } from "./travel-service.types";

export type AnalyzeTravelInput = {
  readonly userId: string;
  readonly travelId: string;
  readonly contextMessage?: string | null;
  readonly responseLocale?: string | null;
};

export async function analyzeTravel(
  input: AnalyzeTravelInput,
): Promise<TravelAiReportDto> {
  const travel = await prisma.travel.findFirst({
    where: { id: input.travelId, userId: input.userId },
    include: {
      plannedSpendings: { orderBy: { createdAt: "asc" } },
      categoryBudgets: true,
      user: { select: { locale: true } },
    },
  });
  if (!travel) {
    throw new AppServiceError(ApiErrorCode.NotFound, "Travel not found");
  }

  const responseLocale = normalizeResponseLocale(
    input.responseLocale ?? travel.user.locale,
  );
  const lockedCategories = new Set(
    travel.categoryBudgets.map((budget) => budget.category),
  );
  const lineItems = travel.plannedSpendings
    .filter((item) => !lockedCategories.has(item.category))
    .map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      amount: decimalToString(toDecimal(item.amount.toString())),
      note: item.note,
    }));
  const budgetItems = travel.categoryBudgets.map((budget) => ({
    id: `budget:${budget.category}`,
    title: `${budget.category} (category total)`,
    category: budget.category,
    amount: decimalToString(toDecimal(budget.amount.toString())),
    note: "Lump category budget",
  }));
  const items = [...budgetItems, ...lineItems];
  const context = buildTravelAnalysisContext({
    title: travel.title,
    currency: travel.currency,
    placeLabel: travel.placeLabel,
    placeCountry: travel.placeCountry,
    placeCity: travel.placeCity,
    startsAt: travel.startsAt,
    endsAt: travel.endsAt,
    maxSpendingGoal: travel.maxSpendingGoal
      ? decimalToString(toDecimal(travel.maxSpendingGoal.toString()))
      : null,
    contextMessage: input.contextMessage?.trim() || null,
    items,
  });

  const prompt = buildTravelAnalysisPrompt({
    context,
    responseLanguage: responseLocale,
  });
  const completion = await requestJsonCompletion(prompt);
  const analysis = parseTravelAnalysisResponse(
    completion.content,
    new Set(items.map((item) => item.id)),
  );

  const report = await prisma.travelAiReport.upsert({
    where: { travelId: travel.id },
    create: {
      travelId: travel.id,
      type: analysis.type,
      reportMessage: analysis.reportMessage,
      contextMessage: context.contextMessage,
      responseLocale,
      model: completion.model,
      extras: {
        goalStatus: analysis.goalStatus,
        flexibleAssessmentMessage: analysis.flexibleAssessmentMessage,
        suggestedFlexibleTotal: analysis.suggestedFlexibleTotal,
        itemNotes: analysis.itemNotes,
      },
    },
    update: {
      type: analysis.type,
      reportMessage: analysis.reportMessage,
      contextMessage: context.contextMessage,
      responseLocale,
      model: completion.model,
      extras: {
        goalStatus: analysis.goalStatus,
        flexibleAssessmentMessage: analysis.flexibleAssessmentMessage,
        suggestedFlexibleTotal: analysis.suggestedFlexibleTotal,
        itemNotes: analysis.itemNotes,
      },
    },
  });

  return {
    id: report.id,
    type: report.type,
    reportMessage: report.reportMessage,
    contextMessage: report.contextMessage,
    responseLocale: report.responseLocale,
    extras: report.extras,
    model: report.model,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

function normalizeResponseLocale(value: string | null | undefined): string {
  if (value?.startsWith("ru")) {
    return AppLocale.Ru;
  }
  return AppLocale.En;
}
