import SwiftUI
import WidgetKit

// MARK: - Liquid Glass background

/// macOS 26 Liquid Glass container fill: the same quiet adaptive material system
/// widgets (Calendar/Notes) use. Flat and neutral — the content carries the color.
struct WidgetBackground: View {
    var body: some View {
        Rectangle().fill(.background.secondary)
    }
}

// MARK: - Header

/// Restrained title bar in the spirit of Weather/Stocks: a small tinted glyph,
/// a semibold title, and a quiet trailing stat.
struct WidgetHeader: View {
    let title: String
    let symbol: String
    var tint: Color = .accentColor
    var trailing: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 7) {
            Image(systemName: symbol)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(tint)
                .widgetAccentable()
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            if let trailing {
                Text(trailing)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .widgetAccentable()
    }
}

/// Quiet secondary caption (e.g. "Net · July"). Deliberately not alarming.
struct CaptionLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .widgetAccentable()
    }
}

// MARK: - Hero amount

/// Large, elegant headline number in the Weather-temperature spirit:
/// generously sized, semibold (not heavy), monospaced digits.
struct HeroAmount: View {
    let text: String
    var color: Color = .primary
    var size: CGFloat = 34

    var body: some View {
        Text(text)
            .font(.system(size: size, weight: .semibold).monospacedDigit())
            .foregroundStyle(color)
            .minimumScaleFactor(0.4)
            .lineLimit(1)
            .widgetAccentable()
    }
}

// MARK: - Empty state

struct WidgetEmptyView: View {
    let message: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            WidgetHeader(title: "Pay Tracker", symbol: "wallet.bifold.fill")
            Spacer(minLength: 0)
            Image(systemName: "chart.line.downtrend.xyaxis")
                .font(.title2)
                .foregroundStyle(.tertiary)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .widgetAccentable()
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) {
            WidgetBackground()
        }
    }
}

// MARK: - Split proportion bar (income vs spending)

struct SplitBar: View {
    let leadingFraction: Double
    var leadingTint: Color = .green
    var trailingTint: Color = .red
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { geo in
            let clamped = min(1, max(0, leadingFraction))
            let leadWidth = geo.size.width * clamped
            HStack(spacing: 3) {
                Capsule().fill(leadingTint)
                    .frame(width: max(clamped > 0 ? 6 : 0, leadWidth - 1.5))
                Capsule().fill(trailingTint)
                    .frame(maxWidth: .infinity)
            }
        }
        .frame(height: height)
    }
}

// MARK: - Metric chip

struct MetricChip: View {
    let title: String
    let value: String
    var tint: Color = .secondary

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Circle().fill(tint).frame(width: 6, height: 6)
                Text(title)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
            }
            Text(value)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .widgetAccentable()
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Weather-style inline range bar row

/// A fixed-width label, a chunky rounded track+fill bar, and a trailing amount —
/// the same rhythm as Weather's daily forecast rows so bars line up cleanly.
struct InlineBarRow: View {
    let title: String
    let amountLabel: String
    let fraction: Double
    let tint: Color
    var labelWidth: CGFloat = 74
    var barHeight: CGFloat = 9

    var body: some View {
        HStack(spacing: 10) {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(width: labelWidth, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(tint.opacity(0.16))
                    Capsule()
                        .fill(tint)
                        .frame(width: max(barHeight, geo.size.width * min(1, max(0, fraction))))
                }
            }
            .frame(height: barHeight)
            Text(amountLabel)
                .font(.subheadline.weight(.semibold).monospacedDigit())
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .frame(minWidth: 56, alignment: .trailing)
        }
        .widgetAccentable()
    }
}

// MARK: - Ranked category row

struct RankRow: View {
    let rank: Int
    let title: String
    let amountLabel: String
    let fraction: Double
    let tint: Color
    var compact: Bool = false

    var body: some View {
        HStack(spacing: 10) {
            Text("\(rank)")
                .font(.caption.weight(.bold).monospacedDigit())
                .foregroundStyle(.tertiary)
                .frame(width: 14, alignment: .center)
            VStack(alignment: .leading, spacing: compact ? 3 : 5) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(title)
                        .font(compact ? .subheadline : .body)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                    Spacer(minLength: 4)
                    Text(amountLabel)
                        .font(.subheadline.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.primary.opacity(0.08))
                        Capsule()
                            .fill(tint)
                            .frame(width: max(6, geo.size.width * min(1, max(0, fraction))))
                    }
                }
                .frame(height: compact ? 6 : 8)
            }
        }
        .widgetAccentable()
    }
}

// MARK: - Transaction row

struct TransactionRow: View {
    let title: String
    let subtitle: String
    let amountLabel: String
    let isSpending: Bool
    var compact: Bool = false

    private var tint: Color { isSpending ? .red : .green }

    var body: some View {
        HStack(spacing: 11) {
            ZStack {
                Circle().fill(tint.opacity(0.16))
                Image(systemName: isSpending ? "arrow.down" : "arrow.up")
                    .font(.system(size: compact ? 9 : 11, weight: .bold))
                    .foregroundStyle(tint)
            }
            .frame(width: compact ? 22 : 28, height: compact ? 22 : 28)

            VStack(alignment: .leading, spacing: 1) {
                Text(title)
                    .font(compact ? .subheadline : .body)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            Text(amountLabel)
                .font((compact ? Font.subheadline : Font.body).weight(.semibold).monospacedDigit())
                .foregroundStyle(isSpending ? .primary : Color.green)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .widgetAccentable()
    }
}

// MARK: - Dates

enum WidgetTime {
    static func relative(from iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plainParser = ISO8601DateFormatter()
        guard let date = parser.date(from: iso) ?? plainParser.date(from: iso) else {
            return ""
        }
        let seconds = Date().timeIntervalSince(date)
        if seconds < 60 { return "now" }
        if seconds < 3_600 { return "\(Int(seconds / 60))m ago" }
        if seconds < 86_400 { return "\(Int(seconds / 3_600))h ago" }
        let days = Int(seconds / 86_400)
        if days < 7 { return "\(days)d ago" }
        return "\(days / 7)w ago"
    }

    static func currentMonth() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "LLLL"
        return formatter.string(from: Date())
    }
}
