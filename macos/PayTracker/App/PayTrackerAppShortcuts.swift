import AppIntents

struct PayTrackerAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenQuickAddIntent(),
            phrases: [
                "Add transaction in \(.applicationName)",
                "Quick add in \(.applicationName)",
            ],
            shortTitle: "Quick Add",
            systemImageName: "plus.circle"
        )
    }
}
