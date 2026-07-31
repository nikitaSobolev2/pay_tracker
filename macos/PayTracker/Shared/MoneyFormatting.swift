import Foundation

enum MoneyFormatting {
    static func format(amount: String, currency: String) -> String {
        let value = Decimal(string: amount) ?? 0
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 0
        return formatter.string(from: value as NSDecimalNumber) ?? "\(amount) \(currency)"
    }

    /// Compact labels like `59.3k RUB` (never `RUBk`).
    static func compact(amount: String, currency: String) -> String {
        guard let doubleValue = Double(amount) else {
            return format(amount: amount, currency: currency)
        }
        let magnitude = abs(doubleValue)
        let scaled: Double
        let suffix: String
        if magnitude >= 1_000_000 {
            scaled = doubleValue / 1_000_000
            suffix = "M"
        } else if magnitude >= 10_000 {
            scaled = doubleValue / 1_000
            suffix = "k"
        } else {
            return format(amount: amount, currency: currency)
        }

        let numberFormatter = NumberFormatter()
        numberFormatter.numberStyle = .decimal
        numberFormatter.maximumFractionDigits = 1
        numberFormatter.minimumFractionDigits = 0
        let number = numberFormatter.string(from: NSNumber(value: scaled))
            ?? String(format: "%.1f", scaled)
        return "\(number)\(suffix) \(currency)"
    }
}
