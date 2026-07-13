# Meep iOS Widgets — Architecture & AI Widget-Building Guide

This doc explains how widgets work in this repo and includes a copy-paste prompt
template for having an AI assistant build a new widget end-to-end.

## How it works (read this before changing anything)

Widgets are native SwiftUI/WidgetKit code. React Native never renders inside a
widget — the app and the widget communicate only through shared data:

```
zustand stores (calendar/tasks/settings)
        │  store subscriptions + app-background flush   lib/widgetSync.ts
        ▼
buildWidgetPayload()                                    lib/widgetData.ts
        │  JSON.stringify → App Group UserDefaults
        │  key: "meep_widget_payload"
        │  group: "group.com.themeepcompany.meep"
        │  then ExtensionStorage.reloadWidget()
        ▼
MeepWidgetStore.loadPayload()                           targets/widget/WidgetData.swift
        │  JSONDecoder over the same shape
        ▼
TimelineProvider → SwiftUI views                        targets/widget/TodayWidget.swift
```

The `targets/widget/` folder is managed by the
[`@bacons/apple-targets`](https://github.com/evanbacon/expo-apple-targets)
config plugin. Every `npx expo prebuild -p ios --clean` regenerates the whole
`ios/` folder (which is gitignored) and re-attaches `targets/widget/` as a real
WidgetKit extension target named **MeepWidgets**. Never add widget code inside
`ios/` — it will be wiped. Everything under `targets/` is source of truth and
checked into git.

### File map

| File | Role |
| --- | --- |
| `targets/widget/expo-target.config.js` | Target definition: name, deployment target (17.0), colors (`$accent`, `$widgetBackground`), App Group entitlement (mirrored from `app.json`) |
| `targets/widget/index.swift` | `@main` `WidgetBundle` — every widget must be registered here |
| `targets/widget/WidgetData.swift` | Swift `Codable` models mirroring `WidgetPayload`, App Group reader, date/hex-color helpers |
| `targets/widget/TodayWidget.swift` | The "Today" widget: provider, small + medium views |
| `lib/widgetData.ts` | Payload shape (`WidgetPayload`), builders, App Group write + widget reload |
| `lib/widgetSync.ts` | Subscribes to stores and debounces payload writes |

### The payload contract

`WidgetPayload` in `lib/widgetData.ts` and the `Codable` structs in
`targets/widget/WidgetData.swift` must stay in sync — the widget silently shows
its empty state if decoding fails. Current shape:

```ts
{
  date: string;              // ISO timestamp of the write
  calendarView: 'daily' | 'weekly' | 'monthly';  // user's widget preference
  selectedCategory: string | null;
  events: WidgetEvent[];     // today's upcoming events, max 5
  weekEvents: WidgetEvent[]; // next 7 days, max 21
  monthDots: string[];       // 'yyyy-MM-dd' dates this month with events
  tasks: WidgetTask[];       // top 3 open tasks (category-filtered)
  greeting: string;          // persona greeting from generateWidgetGreeting()
}
```

When adding fields, make them **optional on the Swift side** (`let foo: Bar?`)
so widgets built against the old payload still decode.

## Adding a new widget — the recipe

1. **Design against the existing payload if possible.** If the data you need is
   already in `WidgetPayload`, you only touch Swift. If not, extend
   `buildWidgetPayload()` + the TS type + the Swift models together.
2. **Create `targets/widget/<Name>Widget.swift`** containing:
   - a `TimelineEntry` struct
   - a `TimelineProvider` (copy `TodayProvider`; keep the 30-minute `.after`
     refresh policy — the app pushes real updates via `reloadWidget()`)
   - SwiftUI views per family, using `Color("$accent")` /
     `Color("$widgetBackground")` and `.containerBackground(..., for: .widget)`
   - a `Widget` struct with a **unique `kind` string**, display name,
     description, and `supportedFamilies`
   - always render a sensible empty state when the payload is `nil`
3. **Register it** in `targets/widget/index.swift`'s `WidgetBundle`.
4. **Rebuild natively**: `npx expo prebuild -p ios --clean && npx expo run:ios`
   (new Swift *files* require prebuild so the target picks them up; edits to
   existing files only need a rebuild). Expo Go can never show widgets.
5. **Verify**: open the app once (writes the payload), then long-press the home
   screen → Edit → Add Widget → search "Meep".

### Gotchas that will bite you

- **Locale bug**: if `pod install` crashes with `Unicode Normalization not
  appropriate for ASCII-8BIT`, run with `LANG=en_US.UTF-8`.
- **Gallery caching**: iOS caches the widget gallery. If a new widget doesn't
  appear, delete the app, reboot the simulator/device, reinstall.
- **Memory limit**: widget processes get ~30 MB. No heavy images, no networking
  in the provider if avoidable — read the App Group payload instead.
- **`ISO8601DateFormatter`**: JS `toISOString()` emits fractional seconds;
  `MeepWidgetStore` already handles both variants — reuse its formatters.
- **Colors**: event colors arrive as `#RRGGBB` strings; use the `meepRGB`
  helper. Theme colors come from `expo-target.config.js` `colors` (rebuild
  after changing them).
- **Interactivity**: buttons/toggles in widgets require App Intents (iOS 17+).
  Deep links are simpler: `.widgetURL(URL(string: "meep://..."))` routes into
  expo-router.
- **Device builds** need `ios.appleTeamId` in `app.json` for signing;
  Simulator builds don't.

## AI prompt template — "vibe-code me a widget"

Paste this into Claude Code (or any AI tool with repo access), filling in the
first line:

```
Build a new iOS home-screen widget for this app: <DESCRIBE THE WIDGET — what it
shows, which sizes (small/medium/large), any interactions or deep links>.

Read docs/WIDGETS.md first and follow its recipe exactly. Key constraints:

- Widget code lives ONLY in targets/widget/ (never in ios/, which is generated
  and gitignored). This project uses @bacons/apple-targets with Expo prebuild.
- Data flows one way: the app writes WidgetPayload as a JSON string into the
  App Group "group.com.themeepcompany.meep" under key "meep_widget_payload";
  the widget decodes it via MeepWidgetStore in targets/widget/WidgetData.swift.
- If the payload already has the data you need, don't touch TypeScript. If you
  must extend it, update lib/widgetData.ts AND the Swift Codable models
  together, and make new Swift fields optional.
- New widgets need: a unique `kind` string, registration in
  targets/widget/index.swift, .containerBackground(Color("$widgetBackground"),
  for: .widget), an empty state for nil payloads, and supportedFamilies.
- Deployment target is iOS 17. Use Color("$accent") for theming and the
  meepRGB helper for #RRGGBB event colors.
- Verify by running: npx expo prebuild -p ios --clean && npx expo run:ios
  (set LANG=en_US.UTF-8 if pod install crashes). Then confirm the widget
  builds and describe how I can add it from the home-screen widget gallery.
```

## Quick verification commands

```sh
# Regenerate native project + build to Simulator
npx expo prebuild -p ios --clean && npx expo run:ios

# Confirm the extension is embedded in the built app (path may vary by config):
find ~/Library/Developer/Xcode/DerivedData -path "*meep.app/PlugIns/*.appex" -maxdepth 6 2>/dev/null

# Inspect the payload the app last wrote (Simulator):
xcrun simctl spawn booted defaults read group.com.themeepcompany.meep meep_widget_payload
```
