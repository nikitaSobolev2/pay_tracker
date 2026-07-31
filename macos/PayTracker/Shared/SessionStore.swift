import Foundation
import Security

enum SessionStore {
    private static var defaults: UserDefaults {
        UserDefaults(suiteName: AppConstants.appGroupID) ?? .standard
    }

    static var baseURL: URL {
        get {
            if let raw = defaults.string(forKey: AppConstants.baseURLKey),
               let url = URL(string: raw) {
                return url
            }
            return AppConstants.defaultBaseURL
        }
        set {
            defaults.set(newValue.absoluteString, forKey: AppConstants.baseURLKey)
        }
    }

    /// Session token shared with the widget via App Group UserDefaults.
    /// Also mirrored into the app Keychain when available.
    static var sessionToken: String? {
        get {
            if let defaultsToken = defaults.string(forKey: AppConstants.sessionTokenKey),
               !defaultsToken.isEmpty {
                return defaultsToken
            }
            return readKeychainToken()
        }
        set {
            if let newValue, !newValue.isEmpty {
                defaults.set(newValue, forKey: AppConstants.sessionTokenKey)
                saveKeychainToken(newValue)
            } else {
                defaults.removeObject(forKey: AppConstants.sessionTokenKey)
                deleteKeychainToken()
            }
        }
    }

    static var isLinked: Bool {
        guard let token = sessionToken else { return false }
        return !token.isEmpty
    }

    static var pendingQuickAdd: Bool {
        get { defaults.bool(forKey: AppConstants.pendingQuickAddKey) }
        set { defaults.set(newValue, forKey: AppConstants.pendingQuickAddKey) }
    }

    static func cacheOverview(_ data: Data) {
        defaults.set(data, forKey: AppConstants.overviewCacheKey)
        defaults.set(Date().timeIntervalSince1970, forKey: AppConstants.overviewCacheAtKey)
    }

    static func cachedOverviewData() -> Data? {
        defaults.data(forKey: AppConstants.overviewCacheKey)
    }

    static func overviewCacheAge() -> TimeInterval? {
        cacheAge(forKey: AppConstants.overviewCacheAtKey)
    }

    static func cacheHeatmap(_ data: Data) {
        defaults.set(data, forKey: AppConstants.heatmapCacheKey)
        defaults.set(Date().timeIntervalSince1970, forKey: AppConstants.heatmapCacheAtKey)
    }

    static func cachedHeatmapData() -> Data? {
        defaults.data(forKey: AppConstants.heatmapCacheKey)
    }

    static func heatmapCacheAge() -> TimeInterval? {
        cacheAge(forKey: AppConstants.heatmapCacheAtKey)
    }

    private static func cacheAge(forKey key: String) -> TimeInterval? {
        guard defaults.object(forKey: key) != nil else { return nil }
        let savedAt = defaults.double(forKey: key)
        guard savedAt > 0 else { return nil }
        return Date().timeIntervalSince1970 - savedAt
    }

    static var displayCurrency: String {
        get {
            defaults.string(forKey: AppConstants.displayCurrencyKey) ?? "RUB"
        }
        set {
            defaults.set(newValue, forKey: AppConstants.displayCurrencyKey)
        }
    }

    static func clearSession() {
        sessionToken = nil
        defaults.removeObject(forKey: AppConstants.overviewCacheKey)
        defaults.removeObject(forKey: AppConstants.overviewCacheAtKey)
        defaults.removeObject(forKey: AppConstants.heatmapCacheKey)
        defaults.removeObject(forKey: AppConstants.heatmapCacheAtKey)
        defaults.removeObject(forKey: AppConstants.displayCurrencyKey)
    }

    private static func saveKeychainToken(_ token: String) {
        deleteKeychainToken()
        let payload = Data(token.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConstants.keychainService,
            kSecAttrAccount as String: "session",
            kSecValueData as String: payload,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private static func readKeychainToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConstants.keychainService,
            kSecAttrAccount as String: "session",
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    private static func deleteKeychainToken() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: AppConstants.keychainService,
            kSecAttrAccount as String: "session",
        ]
        SecItemDelete(query as CFDictionary)
    }
}
