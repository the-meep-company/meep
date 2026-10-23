import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
    let date: Date
    let payload: MeepWidgetPayload?
}

struct TodayProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodayEntry {
        TodayEntry(date: Date(), payload: .preview)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
        let payload = context.isPreview ? (MeepWidgetStore.loadPayload() ?? .preview) : MeepWidgetStore.loadPayload()
        completion(TodayEntry(date: Date(), payload: payload))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
        let now = Date()
        let entry = TodayEntry(date: now, payload: MeepWidgetStore.loadPayload())
        // The app pushes fresh data via WidgetCenter reloads; this schedule is a
        // fallback so times/greeting don't go stale if the app isn't opened.
        let refresh = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

// MARK: - Sleek theme

/// Mirrors the app's "sleek" theme (themes/sleek.ts). The widget renders a fixed
/// dark aesthetic regardless of system light/dark — "sleek" is a dark brand look.
enum MeepColors {
    static let accent = Color(hex: "#6C5CE7")       // brand purple
    static let neon = Color(hex: "#00D2FF")         // neon cyan accent
    static let surface = Color(hex: "#1A1A24")
    static let border = Color(hex: "#2A2A3A")
    static let textPrimary = Color(hex: "#F0F0F5")
    static let textSecondary = Color(hex: "#9898A8")
    static let textTertiary = Color(hex: "#5E5E70")
    static let bgTop = Color(hex: "#16161F")
    static let bgBottom = Color(hex: "#0C0C11")
}

/// Dark gradient base with a soft purple glow in the top-trailing corner.
struct SleekBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [MeepColors.bgTop, MeepColors.bgBottom],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [MeepColors.accent.opacity(0.22), .clear],
                center: .topTrailing,
                startRadius: 0,
                endRadius: 170
            )
        }
    }
}

struct TodayWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TodayEntry

    var body: some View {
        Group {
            if let payload = entry.payload {
                switch family {
                case .systemMedium:
                    MediumTodayView(payload: payload, now: entry.date)
                default:
                    SmallTodayView(payload: payload, now: entry.date)
                }
            } else {
                EmptyStateView()
            }
        }
        .containerBackground(for: .widget) { SleekBackground() }
    }
}

struct SmallTodayView: View {
    let payload: MeepWidgetPayload
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            DayHeader(now: now)
            Text(payload.greeting)
                .font(.caption2)
                .foregroundStyle(MeepColors.textSecondary)
                .lineLimit(2)
            Spacer(minLength: 0)
            if let next = MeepWidgetStore.upcomingEvents(from: payload, now: now).first {
                EventRow(event: next)
            } else if let task = payload.tasks.first {
                TaskRow(task: task)
            } else {
                AllClearLabel()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MediumTodayView: View {
    let payload: MeepWidgetPayload
    let now: Date

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 7) {
                DayHeader(now: now)
                Text(payload.greeting)
                    .font(.caption)
                    .foregroundStyle(MeepColors.textSecondary)
                    .lineLimit(3)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)

            UpNextCard(payload: payload, now: now)
                .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

/// The surface card on the right of the medium widget: a labelled list of the
/// next events, then top tasks to fill up to three rows.
struct UpNextCard: View {
    let payload: MeepWidgetPayload
    let now: Date

    var body: some View {
        let events = Array(MeepWidgetStore.upcomingEvents(from: payload, now: now).prefix(3))
        let taskSlots = max(0, 3 - events.count)
        let tasks = Array(payload.tasks.prefix(taskSlots))

        VStack(alignment: .leading, spacing: 8) {
            Text("UP NEXT")
                .font(.system(size: 9, weight: .bold, design: .rounded))
                .tracking(1.6)
                .foregroundStyle(MeepColors.neon.opacity(0.9))

            if events.isEmpty && tasks.isEmpty {
                AllClearLabel()
            } else {
                ForEach(events) { EventRow(event: $0) }
                ForEach(tasks) { TaskRow(task: $0) }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(MeepColors.surface.opacity(0.85))
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(MeepColors.border, lineWidth: 1)
                )
        )
    }
}

struct DayHeader: View {
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(MeepWidgetStore.weekdayShort(now))
                .font(.system(.caption, design: .rounded))
                .fontWeight(.bold)
                .tracking(1.8)
                .foregroundStyle(MeepColors.accent)
            HStack(alignment: .firstTextBaseline, spacing: 5) {
                Text(now, format: .dateTime.day())
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .foregroundStyle(MeepColors.textPrimary)
                Text(now, format: .dateTime.month(.abbreviated))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(MeepColors.textTertiary)
            }
        }
    }
}

struct EventRow: View {
    let event: MeepWidgetEvent

    var body: some View {
        HStack(spacing: 8) {
            let rgb = event.color.meepRGB
            RoundedRectangle(cornerRadius: 2, style: .continuous)
                .fill(Color(red: rgb.red, green: rgb.green, blue: rgb.blue))
                .frame(width: 3, height: 26)
            VStack(alignment: .leading, spacing: 1) {
                Text(event.title)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundStyle(MeepColors.textPrimary)
                    .lineLimit(1)
                if let start = event.startDate {
                    Text(start, style: .time)
                        .font(.caption2)
                        .foregroundStyle(MeepColors.textSecondary)
                }
            }
        }
    }
}

struct TaskRow: View {
    let task: MeepWidgetTask

    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .stroke(MeepColors.neon.opacity(0.9), lineWidth: 1.5)
                .frame(width: 12, height: 12)
            Text(task.title)
                .font(.caption)
                .foregroundStyle(MeepColors.textPrimary)
                .lineLimit(1)
        }
    }
}

struct AllClearLabel: View {
    var body: some View {
        Text("All clear today")
            .font(.caption2)
            .foregroundStyle(MeepColors.textTertiary)
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("Meep")
                .font(.system(.headline, design: .rounded))
                .fontWeight(.bold)
                .foregroundStyle(MeepColors.accent)
            Text("Open the app once to load your day")
                .font(.caption2)
                .foregroundStyle(MeepColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(for: .widget) { SleekBackground() }
    }
}

extension Color {
    /// #RRGGBB → Color. Falls back to black on malformed input.
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        let v = UInt64(s, radix: 16) ?? 0
        self.init(
            .sRGB,
            red: Double((v >> 16) & 0xFF) / 255.0,
            green: Double((v >> 8) & 0xFF) / 255.0,
            blue: Double(v & 0xFF) / 255.0,
            opacity: 1
        )
    }
}

extension MeepWidgetStore {
    /// Uppercased short weekday (e.g. "THU") for the sleek header.
    static func weekdayShort(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date).uppercased()
    }
}

extension MeepWidgetPayload {
    /// Sample data for the widget gallery and Xcode previews.
    static var preview: MeepWidgetPayload {
        MeepWidgetPayload(
            date: MeepWidgetStore.isoFormatter.string(from: Date()),
            calendarView: "daily",
            selectedCategory: nil,
            events: [
                MeepWidgetEvent(
                    id: "preview-1",
                    title: "Team standup",
                    startTime: MeepWidgetStore.isoFormatter.string(from: Date().addingTimeInterval(3600)),
                    color: "#6C5CE7"
                ),
                MeepWidgetEvent(
                    id: "preview-2",
                    title: "Lunch with Sam",
                    startTime: MeepWidgetStore.isoFormatter.string(from: Date().addingTimeInterval(3600 * 3)),
                    color: "#00D2FF"
                ),
            ],
            weekEvents: [],
            monthDots: [],
            tasks: [MeepWidgetTask(id: "preview-t1", title: "Review PR", priority: 1, category: nil)],
            greeting: "Meep: you're on track for today."
        )
    }
}

struct MeepTodayWidget: Widget {
    let kind = "MeepTodayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodayProvider()) { entry in
            TodayWidgetView(entry: entry)
        }
        .configurationDisplayName("Today")
        .description("Your greeting, next events, and top tasks.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
