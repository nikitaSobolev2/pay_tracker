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
                .onReceive(NotificationCenter.default.publisher(for: .payTrackerOpenFastAdd)) { _ in
                    openFastAdd()
                }
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active {
                        consumePendingQuickAdd()
                        isLinked = SessionStore.isLinked
                    }
                }
        }
        .defaultSize(width: 480, height: 560)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Fast Add") {
                    openFastAdd()
                }
                .keyboardShortcut("n", modifiers: [.command])
            }
        }

        Window("Fast Add", id: "quick-add") {
            QuickAddView {
                showQuickAdd = false
            }
            .frame(minWidth: 420, minHeight: 360)
        }
        .windowStyle(.automatic)
        .windowResizability(.contentSize)
        .defaultSize(width: 480, height: 400)
    }

    private func openFastAdd() {
        SessionStore.pendingQuickAdd = false
        showQuickAdd = true
    }

    private func consumePendingQuickAdd() {
        guard SessionStore.pendingQuickAdd else { return }
        openFastAdd()
    }

    private func handleOpenURL(_ url: URL) {
        guard url.scheme == "paytracker" else { return }
        if url.host == AppConstants.urlSchemeHostQuickAdd {
            openFastAdd()
        }
    }
}
