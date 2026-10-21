import Foundation

// Mirrors WidgetPayload in lib/widgetData.ts. The app serializes this shape as a
// JSON string into the shared App Group under WIDGET_STORAGE_KEY.
struct MeepWidgetPayload: Codable {
    let date: String
    let calendarView: String
    let selectedCategory: String?
    let events: [MeepWidgetEvent]
    let weekEvents: [MeepWidgetEvent]
    let monthDots: [String]
    let tasks: [MeepWidgetTask]
    let greeting: String
}

struct MeepWidgetEvent: Codable, Identifiable {
    let id: String
    let title: String
    let startTime: String
    let color: String

    var startDate: Date? {
        MeepWidgetStore.isoFormatter.date(from: startTime)
            ?? MeepWidgetStore.isoFormatterNoFraction.date(from: startTime)
    }
}

struct MeepWidgetTask: Codable, Identifiable {
    let id: String
    let title: String
    let priority: Int
    let category: String?
}

enum MeepWidgetStore {
    static let appGroup = "group.com.themeepcompany.meep"
    static let storageKey = "meep_widget_payload"

    static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let isoFormatterNoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func loadPayload() -> MeepWidgetPayload? {
        guard
            let defaults = UserDefaults(suiteName: appGroup),
            let json = defaults.string(forKey: storageKey),
            let data = json.data(using: .utf8)
        else { return nil }
        return try? JSONDecoder().decode(MeepWidgetPayload.self, from: data)
    }

    /// Events from the payload that have not started yet, soonest first.
    static func upcomingEvents(from payload: MeepWidgetPayload, now: Date = Date()) -> [MeepWidgetEvent] {
        payload.events
            .filter { ($0.startDate ?? .distantFuture) >= now }
            .sorted { ($0.startDate ?? .distantFuture) < ($1.startDate ?? .distantFuture) }
    }
}

extension String {
    /// Parses a #RRGGBB hex string into RGB components (0-1). Falls back to Meep blue.
    var meepRGB: (red: Double, green: Double, blue: Double) {
        var hex = trimmingCharacters(in: .whitespaces)
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 6, let value = UInt64(hex, radix: 16) else {
            return (0x25 / 255.0, 0x63 / 255.0, 0xEB / 255.0)
        }
        return (
            Double((value >> 16) & 0xFF) / 255.0,
            Double((value >> 8) & 0xFF) / 255.0,
            Double(value & 0xFF) / 255.0
        )
    }
}
