import SwiftUI

struct RootView: View {
    @Binding var isLinked: Bool
    @Binding var showQuickAdd: Bool
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Group {
            if isLinked {
                HomeView(
                    onSignOut: {
                        SessionStore.clearSession()
                        isLinked = false
                    },
                    onQuickAdd: { showQuickAdd = true }
                )
            } else {
                LinkAccountView {
                    isLinked = true
                }
            }
        }
        .onChange(of: showQuickAdd) { _, shouldOpen in
            if shouldOpen {
                openWindow(id: "quick-add")
                showQuickAdd = false
            }
        }
    }
}

struct HomeView: View {
    let onSignOut: () -> Void
    let onQuickAdd: () -> Void

    @State private var user: AppUserDTO?
    @State private var overview: OverviewStatsDTO?
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
            }
            if let overview {
                overviewCards(overview)
            } else if isLoading {
                ProgressView("Loading…")
            }
            Spacer()
        }
        .padding(24)
        .background {
            Rectangle()
                .fill(.background.opacity(0.01))
        }
        .task {
            await refresh()
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Pay Tracker")
                    .font(.largeTitle.weight(.semibold))
                Text(user.map { "Linked as \($0.username)" } ?? SessionStore.baseURL.host ?? "")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Quick Add", action: onQuickAdd)
                .buttonStyle(.borderedProminent)
            Button("Sign Out", action: onSignOut)
        }
    }

    @ViewBuilder
    private func overviewCards(_ overview: OverviewStatsDTO) -> some View {
        let currency = overview.displayCurrency
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                metricCard(
                    title: "Net",
                    value: MoneyFormatting.format(
                        amount: overview.incomeVsSpending.net.amount,
                        currency: currency
                    )
                )
                metricCard(
                    title: "Spending",
                    value: MoneyFormatting.format(
                        amount: overview.incomeVsSpending.spending.amount,
                        currency: currency
                    )
                )
                metricCard(
                    title: "Income",
                    value: MoneyFormatting.format(
                        amount: overview.incomeVsSpending.income.amount,
                        currency: currency
                    )
                )
            }
            Text("Desktop widgets read the same month overview from \(SessionStore.baseURL.host ?? "pay-tracker.site").")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
    }

    private func metricCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title2.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .glassEffect(in: .rect(cornerRadius: 16))
    }

    private func refresh() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let api = PayTrackerAPI()
            async let me = api.fetchMe()
            async let stats = api.fetchOverview()
            user = try await me
            let overviewValue = try await stats
            overview = overviewValue
            if let data = try? JSONEncoder().encode(overviewValue) {
                SessionStore.cacheOverview(data)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
