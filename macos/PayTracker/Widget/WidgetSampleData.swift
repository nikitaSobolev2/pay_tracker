import Foundation

enum WidgetSampleData {
    static let overview = OverviewStatsDTO(
        displayCurrency: "RUB",
        dateRangeType: "MONTH",
        timeline: [
            TimelinePointDTO(bucket: "W1", spending: "12000", earning: "40000", net: "28000"),
            TimelinePointDTO(bucket: "W2", spending: "18000", earning: "10000", net: "-8000"),
            TimelinePointDTO(bucket: "W3", spending: "9000", earning: "22000", net: "13000"),
            TimelinePointDTO(bucket: "W4", spending: "15000", earning: "5000", net: "-10000"),
        ],
        incomeVsSpending: IncomeVsSpendingDTO(
            income: MoneyAmountDTO(amount: "77000", currency: "RUB"),
            spending: MoneyAmountDTO(amount: "54000", currency: "RUB"),
            net: MoneyAmountDTO(amount: "23000", currency: "RUB")
        ),
        incomeExpenseBars: [],
        periodTotal: MoneyAmountDTO(amount: "54000", currency: "RUB"),
        avgDailySpend: MoneyAmountDTO(amount: "1800", currency: "RUB"),
        spendingByCategory: [
            CategorySliceDTO(categoryId: "1", title: "Housing", type: .spending, amount: "22000", percent: 40),
            CategorySliceDTO(categoryId: "2", title: "Food", type: .spending, amount: "14000", percent: 26),
            CategorySliceDTO(categoryId: "3", title: "Transport", type: .spending, amount: "8000", percent: 15),
            CategorySliceDTO(categoryId: "4", title: "Subs", type: .spending, amount: "5000", percent: 9),
        ],
        earningByCategory: [
            CategorySliceDTO(categoryId: "5", title: "Salary", type: .earning, amount: "70000", percent: 90),
        ],
        recentTransactions: [
            RecentTransactionDTO(
                id: "a",
                type: .spending,
                title: "Groceries",
                occurredAt: "2026-07-28T10:00:00Z",
                displayAmount: "987",
                displayCurrency: "RUB"
            ),
            RecentTransactionDTO(
                id: "b",
                type: .spending,
                title: "Subscription",
                occurredAt: "2026-07-27T10:00:00Z",
                displayAmount: "2100",
                displayCurrency: "RUB"
            ),
            RecentTransactionDTO(
                id: "c",
                type: .earning,
                title: "Salary",
                occurredAt: "2026-07-25T10:00:00Z",
                displayAmount: "70000",
                displayCurrency: "RUB"
            ),
        ]
    )

    static var heatmap: ActivityHeatmapDTO {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar(identifier: .gregorian)
        let end = Date()
        var days: [ActivityHeatmapDayDTO] = []
        for offset in (0..<120).reversed() {
            guard let day = calendar.date(byAdding: .day, value: -offset, to: end) else { continue }
            let spending = offset % 5 == 0 ? String((offset % 7 + 1) * 400) : "0"
            days.append(
                ActivityHeatmapDayDTO(
                    date: formatter.string(from: day),
                    earning: "0",
                    spending: spending
                )
            )
        }
        return ActivityHeatmapDTO(
            displayCurrency: "RUB",
            start: days.first?.date ?? "",
            end: days.last?.date ?? "",
            days: days,
            maxEarning: "0",
            maxSpending: "2800"
        )
    }
}
