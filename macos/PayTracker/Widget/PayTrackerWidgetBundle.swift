import SwiftUI
import WidgetKit

@main
struct PayTrackerWidgetBundle: WidgetBundle {
    var body: some Widget {
        IncomeVsSpendingWidget()
        TopCategoriesWidget()
        RecentTransactionsWidget()
        ActivityHeatmapWidget()
    }
}
