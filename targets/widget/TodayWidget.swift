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
        .containerBackground(Color("$widgetBackground"), for: .widget)
    }
}

struct SmallTodayView: View {
    let payload: MeepWidgetPayload
    let now: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            DayHeader(now: now)
            Text(payload.greeting)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Spacer(minLength: 0)
            if let next = MeepWidgetStore.upcomingEvents(from: payload, now: now).first {
                EventRow(event: next)
            } else if let task = payload.tasks.first {
                TaskRow(task: task)
            } else {
                Text("All clear today")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct MediumTodayView: View {
    let payload: MeepWidgetPayload
    let now: Date

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                DayHeader(now: now)
                Text(payload.greeting)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)

            VStack(alignment: .leading, spacing: 5) {
                let events = Array(MeepWidgetStore.upcomingEvents(from: payload, now: now).prefix(3))
                if events.isEmpty && payload.tasks.isEmpty {
                    Text("All clear today")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
                ForEach(events) { event in
                    EventRow(event: event)
                }
                ForEach(Array(payload.tasks.prefix(max(0, 3 - events.count)))) { task in
                    TaskRow(task: task)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}

struct DayHeader: View {
    let now: Date

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 4) {
            Text(now, format: .dateTime.weekday(.wide))
                .font(.headline)
                .foregroundStyle(Color("$accent"))
            Text(now, format: .dateTime.day())
                .font(.headline)
                .foregroundStyle(.primary)
        }
    }
}

struct EventRow: View {
    let event: MeepWidgetEvent

    var body: some View {
        HStack(spacing: 6) {
            let rgb = event.color.meepRGB
            Circle()
                .fill(Color(red: rgb.red, green: rgb.green, blue: rgb.blue))
                .frame(width: 7, height: 7)
            VStack(alignment: .leading, spacing: 0) {
                Text(event.title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                if let start = event.startDate {
                    Text(start, style: .time)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct TaskRow: View {
    let task: MeepWidgetTask

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "circle")
                .font(.system(size: 9))
                .foregroundStyle(Color("$accent"))
            Text(task.title)
                .font(.caption)
                .lineLimit(1)
        }
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 6) {
            Text("Meep")
                .font(.headline)
                .foregroundStyle(Color("$accent"))
            Text("Open the app once to load your day")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
                    color: "#2563EB"
                ),
                MeepWidgetEvent(
                    id: "preview-2",
                    title: "Lunch with Sam",
                    startTime: MeepWidgetStore.isoFormatter.string(from: Date().addingTimeInterval(3600 * 3)),
                    color: "#7C3AED"
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
