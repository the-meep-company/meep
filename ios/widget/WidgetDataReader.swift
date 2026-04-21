import Foundation

enum WidgetDataReader {
    static let appGroupId = "group.com.themeepcompany.meep"
    static let payloadKey = "meep_widget_payload"

    static func loadPayload() -> MeepWidgetPayload? {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let dict = defaults.dictionary(forKey: payloadKey) else {
            return nil
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: dict, options: [])
            return try JSONDecoder().decode(MeepWidgetPayload.self, from: data)
        } catch {
            return nil
        }
    }

    static func entryData(now: Date = Date()) -> MeepWidgetEntryData {
        let formatterDayLabel = DateFormatter()
        formatterDayLabel.dateFormat = "EEEE"

        let formatterDayNumber = DateFormatter()
        formatterDayNumber.dateFormat = "d"

        let payload = loadPayload()
        return MeepWidgetEntryData(
            dayLabel: formatterDayLabel.string(from: now),
            dayNumber: formatterDayNumber.string(from: now),
            events: payload?.events ?? [],
            tasks: payload?.tasks ?? [],
            greeting: payload?.greeting ?? "Meep: your day is ready."
        )
    }
}
