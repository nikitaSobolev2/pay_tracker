"use client";

import { ActivityHeatmapCard } from "@/features/charts/activity-heatmap";
import { CategoryPieChart } from "@/features/charts/category-pie-chart";
import { DebtSummaryCards } from "@/features/charts/debt-summary-cards";
import {
  CurrencyBreakdownCard,
  IncomeVsSpendingsCard,
  MoneyValueCard,
  PeriodTotalsCard,
  TopCategoriesCard,
  VsPreviousPeriodCard,
} from "@/features/charts/money-summary-cards";
import { TimelineChart } from "@/features/charts/timeline-chart";
import {
  SharedChartType,
  type SharedChartPayload,
} from "@/features/share/shared-chart-payload";

type SharedChartViewProps = {
  readonly payload: SharedChartPayload;
  readonly shareId: string;
};

export function SharedChartView({ payload, shareId }: SharedChartViewProps) {
  switch (payload.type) {
    case SharedChartType.Timeline:
      return (
        <TimelineChart
          title={payload.title}
          description={payload.description}
          points={payload.points}
          currency={payload.currency}
          mode={payload.mode}
          disableShare
        />
      );
    case SharedChartType.CategoryPie:
      return (
        <CategoryPieChart
          title={payload.title}
          description={payload.description}
          slices={payload.slices}
          currency={payload.currency}
          layout={payload.layout}
          showTypeHints={payload.showTypeHints}
          disableShare
        />
      );
    case SharedChartType.TopCategories:
      return (
        <TopCategoriesCard
          title={payload.title}
          description={payload.description}
          items={payload.items}
          currency={payload.currency}
          showTypeHints={payload.showTypeHints}
          disableShare
        />
      );
    case SharedChartType.IncomeVsSpendings:
      return (
        <IncomeVsSpendingsCard
          title={payload.title}
          income={payload.income}
          spending={payload.spending}
          net={payload.net}
          comparison={payload.comparison}
          hideComparison={payload.hideComparison}
          disableShare
        />
      );
    case SharedChartType.PeriodTotals:
      return (
        <PeriodTotalsCard
          stats={payload.stats}
          comparison={payload.comparison}
          hideComparison={payload.hideComparison}
          disableShare
        />
      );
    case SharedChartType.MoneyValue:
      return (
        <MoneyValueCard
          title={payload.title}
          amount={payload.amount}
          comparison={payload.comparison}
          comparisonSense={payload.comparisonSense}
          hideComparison={payload.hideComparison}
          details={payload.details}
          disableShare
        />
      );
    case SharedChartType.VsPrevious:
      return (
        <VsPreviousPeriodCard
          title={payload.title}
          comparison={payload.comparison}
          dateRangeType={payload.dateRangeType}
          disableShare
        />
      );
    case SharedChartType.CurrencyBreakdown:
      return (
        <CurrencyBreakdownCard
          title={payload.title}
          items={payload.items}
          disableShare
        />
      );
    case SharedChartType.DebtSummary:
      return (
        <DebtSummaryCards
          displayCurrency={payload.debtsIOwe.total.currency}
          debtsIOwe={payload.debtsIOwe}
          debtsOwedToMe={payload.debtsOwedToMe}
          disableShare
        />
      );
    case SharedChartType.ActivityHeatmap:
      return (
        <ActivityHeatmapCard
          title={payload.title}
          currency={payload.currency}
          sharedData={payload.data}
          shareId={shareId}
          disableShare
          drilldownLayout="below"
        />
      );
    default:
      return null;
  }
}
