import AppIntents
import Foundation

struct OpenQuickAddIntent: AppIntent {
    static let title: LocalizedStringResource = "Quick Add Transaction"
    static let description = IntentDescription("Open Pay Tracker to add a transaction quickly.")
    static let openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        SessionStore.pendingQuickAdd = true
        return .result()
    }
}
