import Foundation

enum TransactionTypeDTO: String, Codable, CaseIterable, Sendable {
    case spending = "SPENDING"
    case earning = "EARNING"
}

struct MoneyAmountDTO: Codable, Sendable {
    let amount: String
    let currency: String
}

struct TimelinePointDTO: Codable, Identifiable, Sendable {
    var id: String { bucket }
    let bucket: String
    let spending: String
    let earning: String
    let net: String
}

struct CategorySliceDTO: Codable, Identifiable, Sendable {
    var id: String { categoryId ?? title }
    let categoryId: String?
    let title: String
    let type: TransactionTypeDTO
    let amount: String
    let percent: Double
}

struct RecentTransactionDTO: Codable, Identifiable, Sendable {
    let id: String
    let type: TransactionTypeDTO
    let title: String?
    let occurredAt: String
    let displayAmount: String
    let displayCurrency: String
}

struct OverviewStatsDTO: Codable, Sendable {
    let displayCurrency: String
    let dateRangeType: String
    let timeline: [TimelinePointDTO]
    let incomeVsSpending: IncomeVsSpendingDTO
    let incomeExpenseBars: [TimelinePointDTO]
    let periodTotal: MoneyAmountDTO
    let avgDailySpend: MoneyAmountDTO
    let spendingByCategory: [CategorySliceDTO]
    let earningByCategory: [CategorySliceDTO]
    let recentTransactions: [RecentTransactionDTO]
}

struct IncomeVsSpendingDTO: Codable, Sendable {
    let income: MoneyAmountDTO
    let spending: MoneyAmountDTO
    let net: MoneyAmountDTO
}

struct AppUserDTO: Codable, Sendable {
    let id: String
    let username: String
    let name: String
    let email: String
    let defaultCurrency: String
    let timezone: String
}

struct MeResponseDTO: Codable, Sendable {
    let user: AppUserDTO
}

struct CategoryDTO: Codable, Identifiable, Sendable {
    let id: String
    let title: String
    let type: TransactionTypeDTO
    let parentCategoryId: String?
    let path: String
}

struct CategoriesResponseDTO: Codable, Sendable {
    let categories: [CategoryDTO]
}

struct CreateTransactionRequestDTO: Codable, Sendable {
    let type: TransactionTypeDTO
    let originalAmount: String
    let inputCurrency: String
    let title: String?
    let occurredAt: String
    let kind: String
    let categoryIds: [String]?
    let idempotencyKey: String
}

struct RedeemLoginTransferResponseDTO: Codable, Sendable {
    let pending: Bool?
    let token: String
}

struct ApprovalStatusResponseDTO: Codable, Sendable {
    let status: String
}

struct RedeemApprovalResponseDTO: Codable, Sendable {
    let ok: Bool?
    let token: String?
}

struct SignInEmailRequestDTO: Codable, Sendable {
    let email: String
    let password: String
}

struct SignInUsernameRequestDTO: Codable, Sendable {
    let username: String
    let password: String
}

struct QrApprovalRequestDTO: Codable, Sendable {
    let token: String
    let approvalUrl: String
    let status: String
    let expiresAt: String
}

struct APIErrorBodyDTO: Codable, Sendable {
    struct ErrorPayload: Codable, Sendable {
        let code: String?
        let message: String?
    }

    let error: ErrorPayload?
    let message: String?
}

enum PayTrackerAPIError: LocalizedError {
    case notLinked
    case httpStatus(Int, String)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .notLinked:
            return "Account is not linked."
        case let .httpStatus(code, message):
            return "HTTP \(code): \(message)"
        case let .decoding(error):
            return "Decode failed: \(error.localizedDescription)"
        case let .transport(error):
            return error.localizedDescription
        }
    }
}
