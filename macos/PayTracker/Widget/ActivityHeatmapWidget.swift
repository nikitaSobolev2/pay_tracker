import SwiftUI
import WidgetKit

struct HeatmapEntry: TimelineEntry, Sendable {
    let date: Date
    let heatmap: ActivityHeatmapDTO?
    let message: String?
}

struct HeatmapTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> HeatmapEntry {
        HeatmapEntry(date: Date(), heatmap: WidgetSampleData.heatmap, message: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (HeatmapEntry) -> Void) {
        // Never network here — WidgetKit calls this for every gallery size/preview.
        if context.isPreview {
            completion(HeatmapEntry(date: Date(), heatmap: WidgetSampleData.heatmap, message: nil))
            return
        }
        let loaded = WidgetDataLoader.snapshotHeatmap()
        completion(HeatmapEntry(date: Date(), heatmap: loaded.heatmap, message: loaded.message))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HeatmapEntry>) -> Void) {
        nonisolated(unsafe) let completion = completion
        Task {
            let loaded = await WidgetDataLoader.loadHeatmap()
            let entry = HeatmapEntry(date: Date(), heatmap: loaded.heatmap, message: loaded.message)
            completion(Timeline(entries: [entry], policy: .after(WidgetDataLoader.nextRefreshDate())))
        }
    }
}

struct ActivityHeatmapWidget: Widget {
    let kind = "PayTrackerActivityHeatmapWidget.v7"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HeatmapTimelineProvider()) { entry in
            ActivityHeatmapWidgetView(entry: entry)
        }
        .configurationDisplayName("Spending Activity")
        .description("Daily spending intensity over recent weeks.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct ActivityHeatmapWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: HeatmapEntry

    private let weekdayLabels = ["M", "", "W", "", "F", "", ""]

    var body: some View {
        Group {
            if let heatmap = entry.heatmap {
                content(heatmap)
            } else {
                WidgetEmptyView(message: entry.message ?? "No activity yet")
            }
        }
        .containerBackground(for: .widget) {
            WidgetBackground()
        }
    }

    private func content(_ heatmap: ActivityHeatmapDTO) -> some View {
        let maxSpending = max(Double(heatmap.maxSpending) ?? 1, 0.0001)
        let maxWeeks = family == .systemLarge ? 26 : 17
        let activeDays = heatmap.days.filter { (Double($0.spending) ?? 0) > 0 }.count

        return VStack(alignment: .leading, spacing: 12) {
            WidgetHeader(
                title: "Spending Activity",
                symbol: "flame.fill",
                tint: .teal,
                trailing: "\(activeDays) active days"
            )

            GeometryReader { geo in
                let labelWidth: CGFloat = 10
                let gap: CGFloat = 3
                let footerReserve: CGFloat = 16
                let gridWidth = max(1, geo.size.width - labelWidth - gap)
                let gridHeight = max(1, geo.size.height - footerReserve)
                let weeks = max(8, min(maxWeeks, Int(floor((gridWidth + gap) / (7 + gap)))))
                let cellW = max(3, (gridWidth - gap * CGFloat(weeks - 1)) / CGFloat(weeks))
                let cellH = max(3, (gridHeight - gap * 6) / 7)
                let columns = buildColumns(from: heatmap.days, weeks: weeks)

                VStack(alignment: .leading, spacing: 6) {
                    grid(columns: columns, maxSpending: maxSpending, cellW: cellW, cellH: cellH, gap: gap, labelWidth: labelWidth)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    legend(currency: heatmap.displayCurrency)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func grid(
        columns: [[ActivityHeatmapDayDTO?]],
        maxSpending: Double,
        cellW: CGFloat,
        cellH: CGFloat,
        gap: CGFloat,
        labelWidth: CGFloat
    ) -> some View {
        HStack(alignment: .top, spacing: gap) {
            VStack(spacing: gap) {
                ForEach(0..<7, id: \.self) { index in
                    Text(weekdayLabels[index])
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: labelWidth, height: cellH, alignment: .leading)
                        .widgetAccentable()
                }
            }
            HStack(alignment: .top, spacing: gap) {
                ForEach(Array(columns.enumerated()), id: \.offset) { _, week in
                    VStack(spacing: gap) {
                        ForEach(0..<7, id: \.self) { dayIndex in
                            let cellDay = dayIndex < week.count ? week[dayIndex] : nil
                            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                                .fill(cellColor(cellDay, maxSpending: maxSpending))
                                .frame(width: cellW, height: cellH)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func legend(currency: String) -> some View {
        HStack(spacing: 4) {
            Text(currency)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(.secondary)
                .widgetAccentable()
            Spacer(minLength: 0)
            Text("Less")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
                .widgetAccentable()
            ForEach(0..<5, id: \.self) { step in
                RoundedRectangle(cornerRadius: 1.5, style: .continuous)
                    .fill(levelColor(Double(step) / 4))
                    .frame(width: 8, height: 8)
            }
            Text("More")
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
                .widgetAccentable()
        }
        .frame(height: 12)
    }

    private func cellColor(_ day: ActivityHeatmapDayDTO?, maxSpending: Double) -> Color {
        guard let day else {
            return Color.primary.opacity(0.04)
        }
        let spending = Double(day.spending) ?? 0
        if spending <= 0 {
            return Color.primary.opacity(0.07)
        }
        return levelColor(min(1, spending / maxSpending))
    }

    private func levelColor(_ intensity: Double) -> Color {
        Color.teal.opacity(0.2 + intensity * 0.75)
    }

    private func buildColumns(from days: [ActivityHeatmapDayDTO], weeks: Int) -> [[ActivityHeatmapDayDTO?]] {
        var byDate: [String: ActivityHeatmapDayDTO] = [:]
        for day in days {
            byDate[day.date] = day
        }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"

        let endDate = days.last.flatMap { formatter.date(from: $0.date) } ?? Date()
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2

        let endWeekStart = calendar.date(
            from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: endDate)
        ) ?? endDate
        let startWeek = calendar.date(byAdding: .weekOfYear, value: -(weeks - 1), to: endWeekStart)
            ?? endWeekStart

        var columns: [[ActivityHeatmapDayDTO?]] = []
        var weekCursor = startWeek
        for _ in 0..<weeks {
            var column: [ActivityHeatmapDayDTO?] = []
            for dayOffset in 0..<7 {
                let day = calendar.date(byAdding: .day, value: dayOffset, to: weekCursor) ?? weekCursor
                column.append(byDate[formatter.string(from: day)])
            }
            columns.append(column)
            weekCursor = calendar.date(byAdding: .weekOfYear, value: 1, to: weekCursor) ?? weekCursor
        }
        return columns
    }
}
