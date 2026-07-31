import SwiftUI
import WidgetKit

/// Home-page Fast Add: big amount, −/+ mode, Enter or Add to submit.
struct QuickAddView: View {
    var onDone: () -> Void

    @State private var amountDigits = ""
    @State private var type: TransactionTypeDTO = .spending
    @State private var currency = "RUB"
    @State private var errorMessage: String?
    @State private var isSaving = false
    @State private var statusMessage: String?
    @FocusState private var amountFocused: Bool
    @Environment(\.dismiss) private var dismiss

    private let currencies = ["RUB", "USD", "EUR", "GBP", "GEL", "KZT", "TRY", "AED"]

    var body: some View {
        VStack(spacing: 0) {
            header
            Spacer(minLength: 12)
            amountPad
            Spacer(minLength: 12)
            footer
        }
        .padding(24)
        .frame(minWidth: 420, minHeight: 360)
        .background(.ultraThinMaterial)
        .task {
            await bootstrap()
            amountFocused = true
        }
    }

    private var header: some View {
        VStack(spacing: 4) {
            Text("Fast Add")
                .font(.title2.weight(.semibold))
            Text("Type amount · Enter or Add to save")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var amountPad: some View {
        HStack(alignment: .firstTextBaseline, spacing: 16) {
            Button {
                type = type == .spending ? .earning : .spending
            } label: {
                Text(type == .earning ? "+" : "−")
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .foregroundStyle(type == .earning ? Color.green : Color.red)
                    .frame(width: 44)
            }
            .buttonStyle(.plain)
            .help(type == .earning ? "Switch to spending" : "Switch to earning")

            TextField(placeholderAmount, text: $amountDigits)
                .textFieldStyle(.plain)
                .font(.system(size: 56, weight: .medium, design: .rounded).monospacedDigit())
                .multilineTextAlignment(.center)
                .focused($amountFocused)
                .onSubmit {
                    Task { await save() }
                }
                .onChange(of: amountDigits) { _, newValue in
                    amountDigits = Self.sanitize(newValue, updatingType: &type)
                    statusMessage = nil
                }

            Picker("Currency", selection: $currency) {
                ForEach(currencies, id: \.self) { code in
                    Text(Self.symbol(for: code)).tag(code)
                }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            .frame(width: 64)
        }
        .padding(.horizontal, 8)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(Color.primary.opacity(0.25))
                .frame(height: 2)
                .padding(.horizontal, 48)
        }
    }

    private var footer: some View {
        VStack(spacing: 12) {
            if let errorMessage {
                Text(errorMessage)
                    .font(.callout)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            } else if let statusMessage {
                Text(statusMessage)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: 12) {
                Button("Cancel") {
                    dismiss()
                    onDone()
                }
                .keyboardShortcut(.cancelAction)

                Button(isSaving ? "Saving…" : "Add") {
                    Task { await save() }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isSaving || !canSave)
                .keyboardShortcut(.defaultAction)
            }
        }
    }

    private var placeholderAmount: String {
        type == .earning ? "+1 250" : "1 250"
    }

    private var canSave: Bool {
        guard let value = Decimal(string: amountDigits), value > 0 else { return false }
        return true
    }

    private func bootstrap() async {
        do {
            let user = try await PayTrackerAPI().fetchMe()
            currency = user.defaultCurrency
            SessionStore.displayCurrency = user.defaultCurrency
        } catch {
            currency = SessionStore.displayCurrency
        }
    }

    private func save() async {
        guard canSave else {
            errorMessage = "Enter a valid amount"
            return
        }
        isSaving = true
        errorMessage = nil
        statusMessage = nil
        defer { isSaving = false }

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var occurredAt = isoFormatter.string(from: Date())
        if occurredAt.isEmpty {
            isoFormatter.formatOptions = [.withInternetDateTime]
            occurredAt = isoFormatter.string(from: Date())
        }

        let body = CreateTransactionRequestDTO(
            type: type,
            originalAmount: amountDigits,
            inputCurrency: currency,
            title: nil,
            occurredAt: occurredAt,
            kind: "DEFAULT",
            categoryIds: nil,
            idempotencyKey: UUID().uuidString
        )

        do {
            try await PayTrackerAPI().createTransaction(body)
            WidgetCenter.shared.reloadAllTimelines()
            let label = MoneyFormatting.format(amount: amountDigits, currency: currency)
            statusMessage = "Saved \(label)"
            amountDigits = ""
            type = .spending
            amountFocused = true
            // Keep window open for rapid entry (home-page style).
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Keep digits/decimal only; leading +/− switches type like the web fast-add.
    private static func sanitize(_ raw: String, updatingType type: inout TransactionTypeDTO) -> String {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.hasPrefix("+") {
            type = .earning
            text = String(text.dropFirst())
        } else if text.hasPrefix("-") || text.hasPrefix("−") {
            type = .spending
            text = String(text.dropFirst())
        }
        let allowed = Set("0123456789.")
        var cleaned = String(text.filter { allowed.contains($0) })
        if let firstDot = cleaned.firstIndex(of: ".") {
            let before = cleaned[..<firstDot]
            let after = cleaned[cleaned.index(after: firstDot)...].filter { $0 != "." }
            cleaned = String(before) + "." + String(after)
        }
        return cleaned
    }

    private static func symbol(for code: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        return formatter.currencySymbol ?? code
    }
}
