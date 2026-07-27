import Charts
import SwiftUI
import WidgetKit

struct OverviewWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.widgetRenderingMode) private var renderingMode
    let entry: OverviewEntry

    var body: some View {
        Group {
            if let overview = entry.overview {
                switch family {
                case .systemSmall:
                    SmallOverviewView(overview: overview, accented: isAccented)
                case .systemMedium:
                    MediumOverviewView(overview: overview, accented: isAccented)
                default:
                    LargeOverviewView(overview: overview, accented: isAccented)
                }
            } else {
                PlaceholderOverviewView(message: entry.message ?? "No data yet")
            }
        }
        .containerBackground(for: .widget) {
            Color.clear
        }
    }

    private var isAccented: Bool {
        renderingMode == .accented
    }
}

struct PlaceholderOverviewView: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Pay Tracker")
                .font(.headline)
                .widgetAccentable()
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Button(intent: OpenQuickAddIntent()) {
                Label("Add", systemImage: "plus")
            }
            .widgetAccentable()
        }
        .padding(4)
    }
}

struct SmallOverviewView: View {
    let overview: OverviewStatsDTO
    let accented: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Net")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(
                MoneyFormatting.compact(
                    amount: overview.incomeVsSpending.net.amount,
                    currency: overview.displayCurrency
                )
            )
            .font(.title.weight(.bold))
            .minimumScaleFactor(0.7)
            .widgetAccentable()

            Spacer(minLength: 0)

            HStack {
                labeled("In", overview.incomeVsSpending.income.amount, color: accented ? .primary : .green)
                Spacer()
                labeled("Out", overview.incomeVsSpending.spending.amount, color: accented ? .primary : .red)
            }
            .font(.caption2)
        }
        .padding(2)
    }

    private func labeled(_ title: String, _ amount: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .foregroundStyle(.secondary)
            Text(MoneyFormatting.compact(amount: amount, currency: overview.displayCurrency))
                .foregroundStyle(color)
                .widgetAccentable()
        }
    }
}

struct MediumOverviewView: View {
    let overview: OverviewStatsDTO
    let accented: Bool

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("This month")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(
                    MoneyFormatting.format(
                        amount: overview.incomeVsSpending.net.amount,
                        currency: overview.displayCurrency
                    )
                )
                .font(.title2.weight(.semibold))
                .widgetAccentable()
                Text(
                    "Spend \(MoneyFormatting.compact(amount: overview.incomeVsSpending.spending.amount, currency: overview.displayCurrency))"
                )
                .font(.caption)
                .foregroundStyle(accented ? Color.secondary : Color.red.opacity(0.9))
                Spacer()
                Button(intent: OpenQuickAddIntent()) {
                    Label("Add", systemImage: "plus.circle.fill")
                }
                .widgetAccentable()
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            timelineChart
                .frame(maxWidth: .infinity)
        }
        .padding(2)
    }

    @ViewBuilder
    private var timelineChart: some View {
        let points = overview.incomeExpenseBars.isEmpty ? overview.timeline : overview.incomeExpenseBars
        if points.isEmpty {
            Text("No chart data")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else if accented {
            Chart(points) { point in
                BarMark(
                    x: .value("Bucket", point.bucket),
                    y: .value("Spending", Double(point.spending) ?? 0)
                )
                .foregroundStyle(.primary)
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
            .widgetAccentable()
        } else {
            Chart(points) { point in
                BarMark(
                    x: .value("Bucket", point.bucket),
                    y: .value("Spending", Double(point.spending) ?? 0)
                )
                .foregroundStyle(.red.opacity(0.85))
                BarMark(
                    x: .value("Bucket", point.bucket),
                    y: .value("Income", Double(point.earning) ?? 0)
                )
                .foregroundStyle(.green.opacity(0.85))
            }
            .chartXAxis(.hidden)
            .chartYAxis(.hidden)
        }
    }
}

struct LargeOverviewView: View {
    let overview: OverviewStatsDTO
    let accented: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Pay Tracker")
                        .font(.headline)
                    Text(
                        MoneyFormatting.format(
                            amount: overview.incomeVsSpending.net.amount,
                            currency: overview.displayCurrency
                        )
                    )
                    .font(.title.weight(.bold))
                    .widgetAccentable()
                }
                Spacer()
                Button(intent: OpenQuickAddIntent()) {
                    Label("Add", systemImage: "plus.circle.fill")
                }
                .widgetAccentable()
            }

            categoryChart
                .frame(maxHeight: 120)

            if !overview.recentTransactions.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(overview.recentTransactions.prefix(3)) { transaction in
                        HStack {
                            Text(transaction.title?.isEmpty == false ? transaction.title! : "Untitled")
                                .lineLimit(1)
                            Spacer()
                            Text(
                                MoneyFormatting.compact(
                                    amount: transaction.displayAmount,
                                    currency: transaction.displayCurrency
                                )
                            )
                            .widgetAccentable()
                        }
                        .font(.caption)
                    }
                }
            }
        }
        .padding(2)
    }

    @ViewBuilder
    private var categoryChart: some View {
        let slices = Array(overview.spendingByCategory.prefix(5))
        if slices.isEmpty {
            Text("No category spending yet")
                .font(.caption)
                .foregroundStyle(.secondary)
        } else if accented {
            Chart(slices) { slice in
                BarMark(
                    x: .value("Amount", Double(slice.amount) ?? 0),
                    y: .value("Category", slice.title)
                )
                .foregroundStyle(.primary)
            }
            .chartXAxis(.hidden)
            .widgetAccentable()
        } else {
            Chart(slices) { slice in
                BarMark(
                    x: .value("Amount", Double(slice.amount) ?? 0),
                    y: .value("Category", slice.title)
                )
                .foregroundStyle(by: .value("Category", slice.title))
            }
            .chartLegend(.hidden)
            .chartXAxis(.hidden)
        }
    }
}
