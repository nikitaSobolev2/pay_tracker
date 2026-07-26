import { z } from "zod";

import { zodEnumFromConst } from "@/lib/zod-helpers";
import {
  DateRangeType,
  TransactionKind,
  TransactionType,
} from "@/types/enums";

export const SharedChartType = {
  Timeline: "timeline",
  CategoryPie: "categoryPie",
  TopCategories: "topCategories",
  IncomeVsSpendings: "incomeVsSpendings",
  PeriodTotals: "periodTotals",
  MoneyValue: "moneyValue",
  VsPrevious: "vsPrevious",
  CurrencyBreakdown: "currencyBreakdown",
  DebtSummary: "debtSummary",
  ActivityHeatmap: "activityHeatmap",
} as const;

export type SharedChartType =
  (typeof SharedChartType)[keyof typeof SharedChartType];

const moneyAmountSchema = z.object({
  amount: z.string(),
  currency: z.string(),
});

const periodComparisonSchema = z.object({
  current: moneyAmountSchema,
  previous: moneyAmountSchema.nullable(),
  deltaAmount: z.string().nullable(),
  deltaPercent: z.number().nullable(),
});

const categorySliceBaseSchema = z.object({
  categoryId: z.string().nullable(),
  title: z.string(),
  type: zodEnumFromConst(TransactionType),
  amount: z.string(),
  percent: z.number(),
});

const categorySliceSchema = categorySliceBaseSchema.extend({
  children: z.array(
    categorySliceBaseSchema.extend({
      children: z.array(z.any()),
    }),
  ),
});

const timelinePointSchema = z.object({
  bucket: z.string(),
  spending: z.string(),
  earning: z.string(),
  net: z.string(),
});

const namedAmountSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  amount: z.string(),
});

const heatmapDaySchema = z.object({
  date: z.string(),
  earning: z.string(),
  spending: z.string(),
});

const heatmapFiltersSchema = z
  .object({
    type: zodEnumFromConst(TransactionType).optional(),
    kinds: z.array(zodEnumFromConst(TransactionKind)).optional(),
    categoryIds: z.array(z.string()).optional(),
    counterpartyIds: z.array(z.string()).optional(),
    hideUncategorized: z.boolean().optional(),
  })
  .optional();

export const sharedChartPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(SharedChartType.Timeline),
    title: z.string(),
    description: z.string().optional(),
    points: z.array(timelinePointSchema),
    currency: z.string(),
    mode: z.enum(["dual", "spending", "earning"]).optional(),
    filters: heatmapFiltersSchema,
  }),
  z.object({
    type: z.literal(SharedChartType.CategoryPie),
    title: z.string(),
    description: z.string().optional(),
    slices: z.array(categorySliceSchema),
    currency: z.string(),
    layout: z.enum(["split", "stack"]).optional(),
    showTypeHints: z.boolean().optional(),
  }),
  z.object({
    type: z.literal(SharedChartType.TopCategories),
    title: z.string(),
    description: z.string().optional(),
    items: z.array(categorySliceSchema),
    currency: z.string(),
    showTypeHints: z.boolean().optional(),
  }),
  z.object({
    type: z.literal(SharedChartType.IncomeVsSpendings),
    title: z.string(),
    income: moneyAmountSchema,
    spending: moneyAmountSchema,
    net: moneyAmountSchema,
    comparison: periodComparisonSchema.optional(),
    hideComparison: z.boolean().optional(),
  }),
  z.object({
    type: z.literal(SharedChartType.PeriodTotals),
    title: z.string(),
    stats: z.object({
      count: z.number(),
      spending: moneyAmountSchema,
      earning: moneyAmountSchema,
      net: moneyAmountSchema,
      total: moneyAmountSchema,
    }),
    comparison: periodComparisonSchema.optional(),
    hideComparison: z.boolean().optional(),
  }),
  z.object({
    type: z.literal(SharedChartType.MoneyValue),
    title: z.string(),
    amount: moneyAmountSchema,
    comparison: periodComparisonSchema.optional(),
    comparisonSense: z.enum(["higherIsBetter", "lowerIsBetter"]).optional(),
    hideComparison: z.boolean().optional(),
    details: z
      .array(z.object({ label: z.string(), value: z.string() }))
      .optional(),
  }),
  z.object({
    type: z.literal(SharedChartType.VsPrevious),
    title: z.string(),
    comparison: periodComparisonSchema,
    dateRangeType: zodEnumFromConst(DateRangeType),
  }),
  z.object({
    type: z.literal(SharedChartType.CurrencyBreakdown),
    title: z.string(),
    items: z.array(
      z.object({
        currency: z.string(),
        amount: z.string(),
        count: z.number(),
      }),
    ),
  }),
  z.object({
    type: z.literal(SharedChartType.DebtSummary),
    title: z.string(),
    debtsIOwe: z.object({
      total: moneyAmountSchema,
      breakdown: z.array(namedAmountSchema),
    }),
    debtsOwedToMe: z.object({
      total: moneyAmountSchema,
      breakdown: z.array(namedAmountSchema),
    }),
  }),
  z.object({
    type: z.literal(SharedChartType.ActivityHeatmap),
    title: z.string(),
    currency: z.string(),
    data: z.object({
      displayCurrency: z.string(),
      start: z.string(),
      end: z.string(),
      days: z.array(heatmapDaySchema),
      maxEarning: z.string(),
      maxSpending: z.string(),
    }),
    filters: heatmapFiltersSchema,
  }),
]);

export type SharedChartPayload = z.infer<typeof sharedChartPayloadSchema>;

export function parseSharedChartPayload(value: unknown): SharedChartPayload {
  return sharedChartPayloadSchema.parse(value);
}

export function isSharedChartType(value: string): value is SharedChartType {
  return Object.values(SharedChartType).includes(value as SharedChartType);
}
