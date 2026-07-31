import SwiftUI
import WidgetKit

struct OverviewEntry: TimelineEntry, Sendable {
    let date: Date
    let overview: OverviewStatsDTO?
    let message: String?
}

struct OverviewTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> OverviewEntry {
        OverviewEntry(date: Date(), overview: WidgetSampleData.overview, message: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (OverviewEntry) -> Void) {
        // Never network here — WidgetKit calls this for every gallery size/preview.
        if context.isPreview {
            completion(OverviewEntry(date: Date(), overview: WidgetSampleData.overview, message: nil))
            return
        }
        let loaded = WidgetDataLoader.snapshotOverview()
        completion(
            OverviewEntry(
                date: Date(),
                overview: loaded.overview,
                message: loaded.message
            )
        )
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OverviewEntry>) -> Void) {
        nonisolated(unsafe) let completion = completion
        Task {
            let loaded = await WidgetDataLoader.loadOverview()
            let entry = OverviewEntry(date: Date(), overview: loaded.overview, message: loaded.message)
            completion(Timeline(entries: [entry], policy: .after(WidgetDataLoader.nextRefreshDate())))
        }
    }
}

// MARK: - Balance (Income vs Spending)

struct IncomeVsSpendingWidget: Widget {
    let kind = "PayTrackerIncomeVsSpendingWidget.v7"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OverviewTimelineProvider()) { entry in
            IncomeVsSpendingWidgetView(entry: entry)
        }
        .configurationDisplayName("Balance")
        .description("This month's net, income and spending at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

struct IncomeVsSpendingWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: OverviewEntry

    var body: some View {
        Group {
            if let overview = entry.overview {
                switch family {
                case .systemSmall:
                    small(overview)
                default:
                    mediumLarge(overview)
                }
            } else {
                WidgetEmptyView(message: entry.message ?? "No data yet")
            }
        }
        .containerBackground(for: .widget) {
            WidgetBackground()
        }
    }

    private func small(_ overview: OverviewStatsDTO) -> some View {
        let currency = overview.displayCurrency
        let net = Double(overview.incomeVsSpending.net.amount) ?? 0
        let income = Double(overview.incomeVsSpending.income.amount) ?? 0
        let spending = Double(overview.incomeVsSpending.spending.amount) ?? 0

        return VStack(alignment: .leading, spacing: 0) {
            CaptionLabel(text: "Net · \(WidgetTime.currentMonth())")
            HeroAmount(
                text: MoneyFormatting.format(amount: overview.incomeVsSpending.net.amount, currency: currency),
                color: net >= 0 ? .green : .red,
                size: 28
            )
            Spacer(minLength: 0)
            SplitBar(leadingFraction: income / max(income + spending, 0.0001))
                .padding(.bottom, 8)
            HStack(spacing: 8) {
                MetricChip(
                    title: "In",
                    value: MoneyFormatting.compact(amount: overview.incomeVsSpending.income.amount, currency: currency),
                    tint: .green
                )
                MetricChip(
                    title: "Out",
                    value: MoneyFormatting.compact(amount: overview.incomeVsSpending.spending.amount, currency: currency),
                    tint: .red
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func mediumLarge(_ overview: OverviewStatsDTO) -> some View {
        let currency = overview.displayCurrency
        let net = Double(overview.incomeVsSpending.net.amount) ?? 0
        let income = Double(overview.incomeVsSpending.income.amount) ?? 0
        let spending = Double(overview.incomeVsSpending.spending.amount) ?? 0
        let peak = max(income, spending, 0.0001)
        let points = overview.incomeExpenseBars.isEmpty ? overview.timeline : overview.incomeExpenseBars

        return VStack(alignment: .leading, spacing: family == .systemLarge ? 16 : 12) {
            WidgetHeader(
                title: "Balance",
                symbol: "arrow.up.arrow.down",
                trailing: "\(MoneyFormatting.compact(amount: overview.avgDailySpend.amount, currency: currency)) / day"
            )

            VStack(alignment: .leading, spacing: 1) {
                CaptionLabel(text: "Net · \(WidgetTime.currentMonth())")
                HeroAmount(
                    text: MoneyFormatting.format(amount: overview.incomeVsSpending.net.amount, currency: currency),
                    color: net >= 0 ? .green : .red,
                    size: family == .systemLarge ? 40 : 32
                )
            }

            VStack(alignment: .leading, spacing: family == .systemLarge ? 12 : 10) {
                InlineBarRow(
                    title: "Income",
                    amountLabel: MoneyFormatting.compact(amount: overview.incomeVsSpending.income.amount, currency: currency),
                    fraction: income / peak,
                    tint: .green
                )
                InlineBarRow(
                    title: "Spending",
                    amountLabel: MoneyFormatting.compact(amount: overview.incomeVsSpending.spending.amount, currency: currency),
                    fraction: spending / peak,
                    tint: .red
                )
            }

            if family == .systemLarge, !points.isEmpty {
                Spacer(minLength: 4)
                weeklyChart(points)
            } else {
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func weeklyChart(_ points: [TimelinePointDTO]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 12) {
                legendDot(.green, "Income")
                legendDot(.red, "Spending")
                Spacer(minLength: 0)
            }
            GeometryReader { geo in
                let slice = Array(points.suffix(12))
                let gap: CGFloat = 4
                let colW = max(6, (geo.size.width - gap * CGFloat(max(slice.count - 1, 1))) / CGFloat(max(slice.count, 1)))
                let peak = slice.flatMap { [Double($0.earning) ?? 0, Double($0.spending) ?? 0] }.max() ?? 1
                HStack(alignment: .bottom, spacing: gap) {
                    ForEach(Array(slice.enumerated()), id: \.offset) { _, point in
                        weekColumn(point, maxBarHeight: geo.size.height, columnWidth: colW, peak: max(peak, 1))
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            }
        }
    }

    private func legendDot(_ color: Color, _ label: String) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .widgetAccentable()
    }

    private func weekColumn(
        _ point: TimelinePointDTO,
        maxBarHeight: CGFloat,
        columnWidth: CGFloat,
        peak: Double
    ) -> some View {
        let spending = Double(point.spending) ?? 0
        let earning = Double(point.earning) ?? 0
        let barWidth = max(3, (columnWidth - 2) / 2)
        return HStack(alignment: .bottom, spacing: 2) {
            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                .fill(Color.green)
                .frame(width: barWidth, height: max(3, maxBarHeight * (earning / peak)))
            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                .fill(Color.red)
                .frame(width: barWidth, height: max(3, maxBarHeight * (spending / peak)))
        }
        .frame(width: columnWidth, height: maxBarHeight, alignment: .bottom)
    }
}

// MARK: - Top Categories

struct TopCategoriesWidget: Widget {
    let kind = "PayTrackerTopCategoriesWidget.v7"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OverviewTimelineProvider()) { entry in
            TopCategoriesWidgetView(entry: entry)
        }
        .configurationDisplayName("Top Categories")
        .description("Where your money goes this month.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct TopCategoriesWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: OverviewEntry

    var body: some View {
        Group {
            if let overview = entry.overview {
                content(overview)
            } else {
                WidgetEmptyView(message: entry.message ?? "No data yet")
            }
        }
        .containerBackground(for: .widget) {
            WidgetBackground()
        }
    }

    private func content(_ overview: OverviewStatsDTO) -> some View {
        let all = overview.spendingByCategory
        let currency = overview.displayCurrency
        let maxCap = family == .systemLarge ? 12 : 5

        return VStack(alignment: .leading, spacing: 12) {
            WidgetHeader(
                title: "Top Categories",
                symbol: "chart.pie.fill",
                tint: .orange,
                trailing: MoneyFormatting.compact(amount: overview.periodTotal.amount, currency: currency)
            )

            if all.isEmpty {
                emptyRows
            } else {
                GeometryReader { geo in
                    let rowMin: CGFloat = family == .systemLarge ? 34 : 30
                    let fitCount = max(3, Int(floor(geo.size.height / rowMin)))
                    let count = min(all.count, min(maxCap, fitCount))
                    let rows = Array(all.prefix(count))
                    let maxAmount = rows.compactMap { Double($0.amount) }.max() ?? 1
                    let compact = geo.size.height / CGFloat(count) < 38

                    VStack(spacing: compact ? 10 : 14) {
                        ForEach(Array(rows.enumerated()), id: \.element.id) { index, slice in
                            RankRow(
                                rank: index + 1,
                                title: slice.title,
                                amountLabel: MoneyFormatting.compact(amount: slice.amount, currency: currency),
                                fraction: (Double(slice.amount) ?? 0) / max(maxAmount, 0.0001),
                                tint: barTint(index),
                                compact: compact
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var emptyRows: some View {
        VStack(alignment: .leading, spacing: 8) {
            Spacer(minLength: 0)
            Text("No spending categories yet")
                .font(.caption)
                .foregroundStyle(.secondary)
                .widgetAccentable()
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func barTint(_ index: Int) -> Color {
        let palette: [Color] = [.orange, .pink, .purple, .blue, .teal, .mint, .indigo, .cyan]
        return palette[index % palette.count]
    }
}

// MARK: - Recent Transactions

struct RecentTransactionsWidget: Widget {
    let kind = "PayTrackerRecentTransactionsWidget.v7"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OverviewTimelineProvider()) { entry in
            RecentTransactionsWidgetView(entry: entry)
        }
        .configurationDisplayName("Recent Activity")
        .description("Your latest transactions.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct RecentTransactionsWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: OverviewEntry

    var body: some View {
        Group {
            if let overview = entry.overview {
                content(overview)
            } else {
                WidgetEmptyView(message: entry.message ?? "No data yet")
            }
        }
        .containerBackground(for: .widget) {
            WidgetBackground()
        }
    }

    private func content(_ overview: OverviewStatsDTO) -> some View {
        let all = overview.recentTransactions
        let maxCap = family == .systemLarge ? 8 : 4

        return VStack(alignment: .leading, spacing: 12) {
            WidgetHeader(
                title: "Recent Activity",
                symbol: "clock.arrow.circlepath",
                tint: .blue,
                trailing: all.isEmpty ? nil : "\(all.count)"
            )

            if all.isEmpty {
                Spacer(minLength: 0)
                Text("No recent transactions")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .widgetAccentable()
                Spacer(minLength: 0)
            } else {
                GeometryReader { geo in
                    let rowMin: CGFloat = family == .systemLarge ? 40 : 34
                    let fitCount = max(2, Int(floor(geo.size.height / rowMin)))
                    let count = min(all.count, min(maxCap, fitCount))
                    let rows = Array(all.prefix(count))
                    let compact = geo.size.height / CGFloat(count) < 38

                    VStack(spacing: compact ? 10 : 14) {
                        ForEach(rows) { transaction in
                            TransactionRow(
                                title: transaction.title?.isEmpty == false ? transaction.title! : "Untitled",
                                subtitle: WidgetTime.relative(from: transaction.occurredAt),
                                amountLabel: MoneyFormatting.compact(
                                    amount: transaction.displayAmount,
                                    currency: transaction.displayCurrency
                                ),
                                isSpending: transaction.type == .spending,
                                compact: compact
                            )
                        }
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}
