import AppIntents

struct PayTrackerAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: QuickAddTransactionIntent(),
            phrases: [
                "Add transaction in \(.applicationName)",
                "Log spending in \(.applicationName)",
            ],
            shortTitle: "Add Transaction",
            systemImageName: "plus.circle"
        )
        AppShortcut(
            intent: OpenQuickAddIntent(),
            phrases: [
                "Fast add in \(.applicationName)",
                "Quick add with category in \(.applicationName)",
            ],
            shortTitle: "Fast Add",
            systemImageName: "plus.circle"
        )
    }
}
