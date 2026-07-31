import Foundation

enum WidgetDataLoader {
    private static let networkTimeoutSeconds: TimeInterval = 5
    /// Skip network when cache is fresher than this (widgets share one overview fetch).
    private static let freshCacheSeconds: TimeInterval = 10 * 60
    private static let refreshIntervalMinutes = 30

    private static let coordinator = WidgetFetchCoordinator()

    /// Gallery / lock-screen snapshot: never hit the network.
    static func snapshotOverview() -> (overview: OverviewStatsDTO?, message: String?) {
        if let cached = cachedOverview() {
            return (cached, nil)
        }
        if !SessionStore.isLinked {
            return (nil, "Open Pay Tracker to link your account")
        }
        return (nil, "Waiting for first refresh")
    }

    /// Gallery / lock-screen snapshot: never hit the network.
    static func snapshotHeatmap() -> (heatmap: ActivityHeatmapDTO?, message: String?) {
        if let cached = cachedHeatmap() {
            return (cached, nil)
        }
        if !SessionStore.isLinked {
            return (nil, "Open Pay Tracker to link your account")
        }
        return (nil, "Waiting for first refresh")
    }

    static func loadOverview() async -> (overview: OverviewStatsDTO?, message: String?) {
        let cached = cachedOverview()
        if !SessionStore.isLinked {
            return (cached, "Open Pay Tracker to link your account")
        }
        if let cached, isFresh(SessionStore.overviewCacheAge()) {
            return (cached, nil)
        }

        do {
            let overview = try await coordinator.overview {
                try await withTimeout(networkTimeoutSeconds) {
                    try await PayTrackerAPI().fetchOverview()
                }
            }
            if let data = try? JSONEncoder().encode(overview) {
                SessionStore.cacheOverview(data)
            }
            SessionStore.displayCurrency = overview.displayCurrency
            return (overview, nil)
        } catch {
            if let cached {
                return (cached, nil)
            }
            return (nil, friendlyMessage(for: error))
        }
    }

    static func loadHeatmap() async -> (heatmap: ActivityHeatmapDTO?, message: String?) {
        let cached = cachedHeatmap()
        if !SessionStore.isLinked {
            return (cached, "Open Pay Tracker to link your account")
        }
        if let cached, isFresh(SessionStore.heatmapCacheAge()) {
            return (cached, nil)
        }

        do {
            let heatmap = try await coordinator.heatmap {
                try await withTimeout(networkTimeoutSeconds) {
                    try await PayTrackerAPI().fetchActivityHeatmap()
                }
            }
            if let data = try? JSONEncoder().encode(heatmap) {
                SessionStore.cacheHeatmap(data)
            }
            SessionStore.displayCurrency = heatmap.displayCurrency
            return (heatmap, nil)
        } catch {
            if let cached {
                return (cached, nil)
            }
            return (nil, friendlyMessage(for: error))
        }
    }

    static func cachedOverview() -> OverviewStatsDTO? {
        guard let data = SessionStore.cachedOverviewData() else { return nil }
        return try? JSONDecoder().decode(OverviewStatsDTO.self, from: data)
    }

    static func cachedHeatmap() -> ActivityHeatmapDTO? {
        guard let data = SessionStore.cachedHeatmapData() else { return nil }
        return try? JSONDecoder().decode(ActivityHeatmapDTO.self, from: data)
    }

    static func nextRefreshDate() -> Date {
        Calendar.current.date(byAdding: .minute, value: refreshIntervalMinutes, to: Date())
            ?? Date().addingTimeInterval(TimeInterval(refreshIntervalMinutes * 60))
    }

    private static func isFresh(_ age: TimeInterval?) -> Bool {
        guard let age else { return false }
        return age < freshCacheSeconds
    }

    private static func friendlyMessage(for error: Error) -> String {
        if let apiError = error as? PayTrackerAPIError {
            switch apiError {
            case .notLinked:
                return "Open Pay Tracker to link your account"
            case let .httpStatus(code, _) where code == 408:
                return "Network timed out"
            case let .transport(underlying):
                return underlying.localizedDescription
            default:
                return apiError.localizedDescription
            }
        }
        return error.localizedDescription
    }

    private static func withTimeout<T: Sendable>(
        _ seconds: TimeInterval,
        operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                try await operation()
            }
            group.addTask {
                try await Task.sleep(for: .seconds(seconds))
                throw PayTrackerAPIError.httpStatus(408, "Request timed out")
            }
            guard let result = try await group.next() else {
                throw PayTrackerAPIError.httpStatus(408, "Request timed out")
            }
            group.cancelAll()
            return result
        }
    }
}

/// Coalesces concurrent widget timeline refreshes into one in-flight request each.
private actor WidgetFetchCoordinator {
    private var overviewTask: Task<OverviewStatsDTO, Error>?
    private var heatmapTask: Task<ActivityHeatmapDTO, Error>?

    func overview(
        _ operation: @escaping @Sendable () async throws -> OverviewStatsDTO
    ) async throws -> OverviewStatsDTO {
        if let overviewTask {
            return try await overviewTask.value
        }
        let task = Task {
            try await operation()
        }
        overviewTask = task
        defer { overviewTask = nil }
        return try await task.value
    }

    func heatmap(
        _ operation: @escaping @Sendable () async throws -> ActivityHeatmapDTO
    ) async throws -> ActivityHeatmapDTO {
        if let heatmapTask {
            return try await heatmapTask.value
        }
        let task = Task {
            try await operation()
        }
        heatmapTask = task
        defer { heatmapTask = nil }
        return try await task.value
    }
}
