import Foundation

enum AppConstants {
    static let appGroupID = "group.site.paytracker.mac"
    static let defaultBaseURL = URL(string: "https://pay-tracker.site")!
    static let sessionTokenKey = "paytracker.sessionToken"
    static let baseURLKey = "paytracker.baseURL"
    static let overviewCacheKey = "paytracker.overviewCache"
    static let pendingQuickAddKey = "paytracker.pendingQuickAdd"
    static let keychainService = "site.paytracker.mac.session"
    static let urlSchemeHostQuickAdd = "quick-add"
}
