import Foundation

struct MeepWidgetPayload: Codable {
    let date: String
    let events: [MeepWidgetEvent]
    let tasks: [MeepWidgetTask]
    let greeting: String
}

struct MeepWidgetEvent: Codable {
    let id: String
    let title: String
    let startTime: String
    let color: String
}

struct MeepWidgetTask: Codable {
    let id: String
    let title: String
    let priority: Int
}

struct MeepWidgetEntryData {
    let dayLabel: String
    let dayNumber: String
    let events: [MeepWidgetEvent]
    let tasks: [MeepWidgetTask]
    let greeting: String
}
