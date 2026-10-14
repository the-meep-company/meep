import WidgetKit
import SwiftUI

// MARK: - Shared data

/// Must match the App Group in app.json and lib/widgetData.ts.
private let appGroupId = "group.com.themeepcompany.meep"
private let payloadKey = "meep_widget_payload"

// Payload shape mirrors WidgetPayload in lib/widgetData.ts.
struct WidgetPayload: Codable {
    let date: String
    let calendarView: String
    let selectedCategory: String?
    let events: [WidgetEvent]
    let weekEvents: [WidgetEvent]
    let monthDots: [String]
    let tasks: [WidgetTask]
    let greeting: String
}

struct WidgetEvent: Codable, Identifiable {
    let id: String
    let title: String
    let startTime: String
    let color: String
}

struct WidgetTask: Codable, Identifiable {
    let id: String
    let title: String
    let priority: Int
    let category: String?
}

/// Reads the JSON string the app wrote into the shared App Group.
func loadPayload() -> WidgetPayload? {
    guard
        let defaults = UserDefaults(suiteName: appGroupId),
        let raw = defaults.string(forKey: payloadKey),
        let data = raw.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(WidgetPayload.self, from: data)
}

// MARK: - Helpers

private let isoParser: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

private func parseDate(_ iso: String) -> Date? {
    isoParser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
}

private func timeLabel(_ iso: String) -> String {
    guard let d = parseDate(iso) else { return "" }
    let f = DateFormatter()
    f.dateFormat = "h:mm a"
    return f.string(from: d)
}

/// "#RRGGBB" (or "#AARRGGBB") -> Color, falling back to the brand purple.
private func hexColor(_ hex: String) -> Color {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    var value: UInt64 = 0
    guard Scanner(string: s).scanHexInt64(&value) else { return Palette.accent }
    let r, g, b, a: Double
    switch s.count {
    case 8: // AARRGGBB
        a = Double((value & 0xFF00_0000) >> 24) / 255
        r = Double((value & 0x00FF_0000) >> 16) / 255
        g = Double((value & 0x0000_FF00) >> 8) / 255
        b = Double(value & 0x0000_00FF) / 255
    default: // RRGGBB
        a = 1
        r = Double((value & 0xFF0000) >> 16) / 255
        g = Double((value & 0x00FF00) >> 8) / 255
        b = Double(value & 0x0000FF) / 255
    }
    return Color(.sRGB, red: r, green: g, blue: b, opacity: a)
}

// Sleek (default) theme palette.
enum Palette {
    static let background = Color(hex6: 0x0F0F14)
    static let surface = Color(hex6: 0x1A1A24)
    static let text = Color(hex6: 0xF0F0F5)
    static let textSecondary = Color(hex6: 0x9898A8)
    static let accent = Color(hex6: 0x6C5CE7)
    static let cyan = Color(hex6: 0x00D2FF)
}

extension Color {
    init(hex6: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex6 & 0xFF0000) >> 16) / 255,
            green: Double((hex6 & 0x00FF00) >> 8) / 255,
            blue: Double(hex6 & 0x0000FF) / 255,
            opacity: 1
        )
    }
}

// MARK: - Timeline

struct MeepEntry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload?

    static let sample = MeepEntry(
        date: Date(),
        payload: WidgetPayload(
            date: ISO8601DateFormatter().string(from: Date()),
            calendarView: "daily",
            selectedCategory: nil,
            events: [
                WidgetEvent(id: "1", title: "Design review", startTime: iso(9, 30), color: "#6C5CE7"),
                WidgetEvent(id: "2", title: "Lunch w/ Rahul", startTime: iso(12, 30), color: "#00D2FF"),
                WidgetEvent(id: "3", title: "Gym", startTime: iso(18, 0), color: "#00E676"),
            ],
            weekEvents: [],
            monthDots: [],
            tasks: [
                WidgetTask(id: "t1", title: "Ship widget", priority: 1, category: "work"),
                WidgetTask(id: "t2", title: "Reply to emails", priority: 2, category: nil),
                WidgetTask(id: "t3", title: "Book flights", priority: 3, category: nil),
            ],
            greeting: "Meep: you're on track for today."
        )
    )

    private static func iso(_ h: Int, _ m: Int) -> String {
        let cal = Calendar.current
        let d = cal.date(bySettingHour: h, minute: m, second: 0, of: Date()) ?? Date()
        return ISO8601DateFormatter().string(from: d)
    }
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> MeepEntry { .sample }

    func getSnapshot(in context: Context, completion: @escaping (MeepEntry) -> Void) {
        let payload = loadPayload()
        completion(MeepEntry(date: Date(), payload: payload ?? MeepEntry.sample.payload))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MeepEntry>) -> Void) {
        // Real data once the app has written it; sample layout until then.
        let entry = MeepEntry(date: Date(), payload: loadPayload() ?? MeepEntry.sample.payload)
        // Ask iOS to refresh in ~30 min; the app also refreshes on every change.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - Views

private struct DateBadge: View {
    let date: Date
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(date, format: .dateTime.weekday(.abbreviated))
                .font(.system(size: 12, weight: .semibold))
                .textCase(.uppercase)
                .foregroundStyle(Palette.accent)
            Text(date, format: .dateTime.day())
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .foregroundStyle(Palette.text)
        }
    }
}

private struct EventRow: View {
    let event: WidgetEvent
    var body: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 2)
                .fill(hexColor(event.color))
                .frame(width: 3, height: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(event.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Palette.text)
                    .lineLimit(1)
                Text(timeLabel(event.startTime))
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.textSecondary)
            }
            Spacer(minLength: 0)
        }
    }
}

// Small: date + greeting + next event + task count.
struct SmallWidgetView: View {
    let entry: MeepEntry
    var body: some View {
        let p = entry.payload
        VStack(alignment: .leading, spacing: 8) {
            DateBadge(date: entry.date)
            Spacer(minLength: 0)
            if let next = p?.events.first {
                Text("NEXT")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(Palette.textSecondary)
                EventRow(event: next)
            } else {
                Text("No more events today")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.textSecondary)
            }
            Spacer(minLength: 0)
            HStack(spacing: 6) {
                Circle().fill(Palette.cyan).frame(width: 6, height: 6)
                Text("\(p?.tasks.count ?? 0) tasks")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.textSecondary)
            }
        }
    }
}

// Medium: events column + tasks column.
struct MediumWidgetView: View {
    let entry: MeepEntry
    var body: some View {
        let p = entry.payload
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 8) {
                DateBadge(date: entry.date)
                if let events = p?.events, !events.isEmpty {
                    ForEach(events.prefix(3)) { EventRow(event: $0) }
                } else {
                    Text("No events today")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.textSecondary)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 8) {
                Text("TASKS")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Palette.accent)
                if let tasks = p?.tasks, !tasks.isEmpty {
                    ForEach(tasks.prefix(3)) { task in
                        HStack(spacing: 6) {
                            Circle().stroke(Palette.textSecondary, lineWidth: 1.4).frame(width: 12, height: 12)
                            Text(task.title)
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Palette.text)
                                .lineLimit(1)
                        }
                    }
                } else {
                    Text("All clear ✨")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.textSecondary)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct MeepWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: MeepEntry

    var body: some View {
        Group {
            switch family {
            case .systemSmall: SmallWidgetView(entry: entry)
            default: MediumWidgetView(entry: entry)
            }
        }
        .containerBackground(for: .widget) { Palette.background }
    }
}

// MARK: - Widget

struct MeepWidget: Widget {
    let kind = "MeepWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MeepWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Meep")
        .description("Today's events, tasks, and your companion's greeting.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct MeepWidgetBundle: WidgetBundle {
    var body: some Widget {
        MeepWidget()
    }
}
