import AppIntents
import Foundation
import WidgetKit

enum TransactionTypeAppEnum: String, AppEnum {
    case spending
    case earning

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Type")
    static let caseDisplayRepresentations: [TransactionTypeAppEnum: DisplayRepresentation] = [
        .spending: "Spending",
        .earning: "Earning",
    ]

    var dto: TransactionTypeDTO {
        switch self {
        case .spending: return .spending
        case .earning: return .earning
        }
    }
}

struct QuickAddTransactionIntent: AppIntent {
    static let title: LocalizedStringResource = "Add Transaction"
    static let description = IntentDescription("Create a spending or earning entry from the widget.")
    static let openAppWhenRun: Bool = false

    @Parameter(title: "Amount")
    var amount: String

    @Parameter(title: "Type", default: .spending)
    var type: TransactionTypeAppEnum

    @Parameter(title: "Title")
    var title: String?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let trimmedAmount = amount.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedAmount.isEmpty, Decimal(string: trimmedAmount) != nil else {
            throw PayTrackerAPIError.httpStatus(400, "Enter a valid amount")
        }
        guard SessionStore.isLinked else {
            throw PayTrackerAPIError.notLinked
        }

        let currency = SessionStore.displayCurrency
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var occurredAt = isoFormatter.string(from: Date())
        if occurredAt.isEmpty {
            isoFormatter.formatOptions = [.withInternetDateTime]
            occurredAt = isoFormatter.string(from: Date())
        }

        let trimmedTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let body = CreateTransactionRequestDTO(
            type: type.dto,
            originalAmount: trimmedAmount,
            inputCurrency: currency,
            title: (trimmedTitle?.isEmpty == false) ? trimmedTitle : nil,
            occurredAt: occurredAt,
            kind: "DEFAULT",
            categoryIds: nil,
            idempotencyKey: UUID().uuidString
        )
        try await PayTrackerAPI().createTransaction(body)
        WidgetCenter.shared.reloadAllTimelines()
        let label = MoneyFormatting.format(amount: trimmedAmount, currency: currency)
        return .result(dialog: "Saved \(label)")
    }
}
