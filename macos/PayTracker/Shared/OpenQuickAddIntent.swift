import AppIntents
import AppKit
import Foundation

extension Notification.Name {
    static let payTrackerOpenFastAdd = Notification.Name("site.paytracker.mac.openFastAdd")
}

struct OpenQuickAddIntent: AppIntent {
    static let title: LocalizedStringResource = "Fast Add Transaction"
    static let description = IntentDescription("Open Pay Tracker amount pad. Type amount, then press Enter or Add.")
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult {
        SessionStore.pendingQuickAdd = true
        NotificationCenter.default.post(name: .payTrackerOpenFastAdd, object: nil)
        if let url = URL(string: "paytracker://quick-add") {
            NSWorkspace.shared.open(url)
        }
        NSApp.activate(ignoringOtherApps: true)
        return .result()
    }
}
