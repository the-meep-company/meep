import WidgetKit
import SwiftUI

struct MeepWidgetEntry: TimelineEntry {
    let date: Date
    let data: MeepWidgetEntryData
}

struct MeepWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> MeepWidgetEntry {
        MeepWidgetEntry(date: Date(), data: WidgetDataReader.entryData())
    }

    func getSnapshot(in context: Context, completion: @escaping (MeepWidgetEntry) -> Void) {
        let entry = MeepWidgetEntry(date: Date(), data: WidgetDataReader.entryData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<MeepWidgetEntry>) -> Void) {
        let now = Date()
        let entry = MeepWidgetEntry(date: now, data: WidgetDataReader.entryData(now: now))
        let nextRefresh = Calendar.current.date(byAdding: .minute, value: 30, to: now) ?? now.addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
    }
}

struct MeepWidgetSmallView: View {
    let entry: MeepWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(entry.data.dayLabel), \(entry.data.dayNumber)")
                .font(.headline)
            if let nextEvent = entry.data.events.first {
                Text("Next: \(nextEvent.title)")
                    .font(.subheadline)
                    .lineLimit(1)
            } else {
                Text("No upcoming events")
                    .font(.subheadline)
            }
            if let topTask = entry.data.tasks.first {
                Text("Top task: \(topTask.title)")
                    .font(.caption)
                    .lineLimit(1)
            }
        }
        .padding()
    }
}

struct MeepWidgetMediumView: View {
    let entry: MeepWidgetEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("\(entry.data.dayLabel), \(entry.data.dayNumber)")
                .font(.headline)

            ForEach(entry.data.events.prefix(3), id: \.id) { event in
                HStack {
                    Circle()
                        .fill(Color(hex: event.color) ?? .blue)
                        .frame(width: 6, height: 6)
                    Text(event.title)
                        .font(.caption)
                        .lineLimit(1)
                }
            }

            ForEach(entry.data.tasks.prefix(3), id: \.id) { task in
                Text("P\(task.priority) \(task.title)")
                    .font(.caption2)
                    .lineLimit(1)
            }

            Text(entry.data.greeting)
                .font(.caption2)
                .lineLimit(2)
        }
        .padding()
    }
}

@main
struct MeepWidgetsBundle: WidgetBundle {
    var body: some Widget {
        MeepSmallWidget()
        MeepMediumWidget()
    }
}

struct MeepSmallWidget: Widget {
    let kind: String = "MeepSmallWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MeepWidgetProvider()) { entry in
            MeepWidgetSmallView(entry: entry)
        }
        .supportedFamilies([.systemSmall])
        .configurationDisplayName("Meep Today")
        .description("See your date, next event, and top task.")
    }
}

struct MeepMediumWidget: Widget {
    let kind: String = "MeepMediumWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: MeepWidgetProvider()) { entry in
            MeepWidgetMediumView(entry: entry)
        }
        .supportedFamilies([.systemMedium])
        .configurationDisplayName("Meep Agenda")
        .description("See your date, events, tasks, and greeting.")
    }
}

private extension Color {
    init?(hex: String) {
        var value = hex
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }
        self.init(
            red: Double((rgb >> 16) & 0xFF) / 255.0,
            green: Double((rgb >> 8) & 0xFF) / 255.0,
            blue: Double(rgb & 0xFF) / 255.0
        )
    }
}
