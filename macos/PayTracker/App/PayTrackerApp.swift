import SwiftUI

@main
struct PayTrackerApp: App {
    @State private var showQuickAdd = false
    @State private var isLinked = SessionStore.isLinked
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView(isLinked: $isLinked, showQuickAdd: $showQuickAdd)
                .frame(minWidth: 420, minHeight: 480)
                .onAppear {
                    consumePendingQuickAdd()
                }
                .onOpenURL { url in
                    handleOpenURL(url)
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        consumePendingQuickAdd()
                        isLinked = SessionStore.isLinked
                    }
                }
        }
        .defaultSize(width: 480, height: 560)

        Window("Quick Add", id: "quick-add") {
            QuickAddView {
                showQuickAdd = false
            }
            .frame(minWidth: 360, minHeight: 420)
        }
        .windowStyle(.automatic)
        .defaultSize(width: 400, height: 460)
    }

    private func consumePendingQuickAdd() {
        guard SessionStore.pendingQuickAdd else { return }
        SessionStore.pendingQuickAdd = false
        showQuickAdd = true
    }

    private func handleOpenURL(_ url: URL) {
        guard url.scheme == "paytracker" else { return }
        if url.host == AppConstants.urlSchemeHostQuickAdd {
            showQuickAdd = true
        }
    }
}
