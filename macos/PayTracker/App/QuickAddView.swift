import SwiftUI
import WidgetKit

struct QuickAddView: View {
    var onDone: () -> Void

    @State private var amount = ""
    @State private var title = ""
    @State private var type: TransactionTypeDTO = .spending
    @State private var categories: [CategoryDTO] = []
    @State private var selectedCategoryID: String?
    @State private var currency = "RUB"
    @State private var errorMessage: String?
    @State private var isSaving = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Quick Add")
                .font(.title.weight(.semibold))

            Picker("Type", selection: $type) {
                Text("Spending").tag(TransactionTypeDTO.spending)
                Text("Earning").tag(TransactionTypeDTO.earning)
            }
            .pickerStyle(.segmented)
            .onChange(of: type) { _, _ in
                selectedCategoryID = nil
                Task { await loadCategories() }
            }

            TextField("Amount", text: $amount)
                .textFieldStyle(.roundedBorder)
                .font(.title2.monospacedDigit())

            TextField("Title (optional)", text: $title)
                .textFieldStyle(.roundedBorder)

            Picker("Category", selection: $selectedCategoryID) {
                Text("None").tag(Optional<String>.none)
                ForEach(filteredCategories) { category in
                    Text(category.path).tag(Optional(category.id))
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .foregroundStyle(.red)
                    .font(.callout)
            }

            HStack {
                Button("Cancel") {
                    dismiss()
                    onDone()
                }
                Spacer()
                Button(isSaving ? "Saving…" : "Save") {
                    Task { await save() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSaving || !canSave)
            }
        }
        .padding(20)
        .glassEffect(in: .rect(cornerRadius: 20))
        .padding(12)
        .task {
            await bootstrap()
        }
    }

    private var filteredCategories: [CategoryDTO] {
        categories.filter { $0.type == type }
    }

    private var canSave: Bool {
        let trimmed = amount.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && Decimal(string: trimmed) != nil
    }

    private func bootstrap() async {
        do {
            let api = PayTrackerAPI()
            let user = try await api.fetchMe()
            currency = user.defaultCurrency
            await loadCategories()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadCategories() async {
        do {
            categories = try await PayTrackerAPI().fetchCategories(type: type)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        isSaving = true
        errorMessage = nil
        defer { isSaving = false }
        let trimmedAmount = amount.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var occurredAt = isoFormatter.string(from: Date())
        if occurredAt.isEmpty {
            isoFormatter.formatOptions = [.withInternetDateTime]
            occurredAt = isoFormatter.string(from: Date())
        }

        let body = CreateTransactionRequestDTO(
            type: type,
            originalAmount: trimmedAmount,
            inputCurrency: currency,
            title: trimmedTitle.isEmpty ? nil : trimmedTitle,
            occurredAt: occurredAt,
            kind: "DEFAULT",
            categoryIds: selectedCategoryID.map { [$0] },
            idempotencyKey: UUID().uuidString
        )

        do {
            try await PayTrackerAPI().createTransaction(body)
            WidgetCenter.shared.reloadAllTimelines()
            dismiss()
            onDone()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
