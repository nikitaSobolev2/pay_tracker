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

    static func compact(amount: String, currency: String) -> String {
        guard let doubleValue = Double(amount) else {
            return format(amount: amount, currency: currency)
        }
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.maximumFractionDigits = 1
        if abs(doubleValue) >= 1_000_000 {
            formatter.maximumFractionDigits = 1
            let millions = doubleValue / 1_000_000
            return "\(formatter.currencySymbol ?? currency)\(String(format: "%.1f", millions))M"
        }
        if abs(doubleValue) >= 1_000 {
            let thousands = doubleValue / 1_000
            return "\(formatter.currencySymbol ?? currency)\(String(format: "%.1f", thousands))k"
        }
        return format(amount: amount, currency: currency)
    }
}
