import WidgetKit
import SwiftUI

struct OverviewEntry: TimelineEntry, Sendable {
    let date: Date
    let overview: OverviewStatsDTO?
    let message: String?
}

struct OverviewTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> OverviewEntry {
        OverviewEntry(date: Date(), overview: nil, message: "Pay Tracker")
    }

    func getSnapshot(in context: Context, completion: @escaping (OverviewEntry) -> Void) {
        nonisolated(unsafe) let completion = completion
        Task {
            let entry = await loadEntry()
            completion(entry)
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<OverviewEntry>) -> Void) {
        nonisolated(unsafe) let completion = completion
        Task {
            let entry = await loadEntry()
            let next =
                Calendar.current.date(byAdding: .minute, value: 20, to: Date())
                ?? Date().addingTimeInterval(1200)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func loadEntry() async -> OverviewEntry {
        if !SessionStore.isLinked {
            return OverviewEntry(
                date: Date(),
                overview: cachedOverview(),
                message: "Open Pay Tracker to link your account"
            )
        }
        do {
            let overview = try await PayTrackerAPI().fetchOverview()
            if let data = try? JSONEncoder().encode(overview) {
                SessionStore.cacheOverview(data)
            }
            return OverviewEntry(date: Date(), overview: overview, message: nil)
        } catch {
            return OverviewEntry(
                date: Date(),
                overview: cachedOverview(),
                message: error.localizedDescription
            )
        }
    }

    private func cachedOverview() -> OverviewStatsDTO? {
        guard let data = SessionStore.cachedOverviewData() else { return nil }
        return try? JSONDecoder().decode(OverviewStatsDTO.self, from: data)
    }
}

struct PayTrackerOverviewWidget: Widget {
    let kind = "PayTrackerOverviewWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: OverviewTimelineProvider()) { entry in
            OverviewWidgetView(entry: entry)
        }
        .configurationDisplayName("Pay Tracker")
        .description("Month spending, income, and charts from pay-tracker.site.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
