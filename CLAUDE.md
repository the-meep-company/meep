# Phase 6A Notes (Widgets + Apple Sign-In)

## What was implemented
- Apple Sign-In added in auth store and login screen (iOS-only button).
- Widget payload pipeline added in `lib/widgetData.ts` with:
  - App Group shared storage key (`meep_widget_payload`)
  - payload shape `{ date, events, tasks, greeting }`
  - hybrid greeting generation (template fallback always available)
- Automatic widget payload sync added in `lib/widgetSync.ts`:
  - store subscription-triggered writes
  - app background write flush
- iOS config updated in `app.json`:
  - Apple Sign-In enabled
  - App Group entitlement added
  - bundle identifier scaffolded
- WidgetKit extension implemented in `targets/widget/` via the `@bacons/apple-targets`
  config plugin (small + medium "Today" widget). See `docs/WIDGETS.md` for the
  architecture and the AI widget-building guide.

## Deferred
- Android widget implementation is intentionally deferred to a later phase.

## Build/Test notes
- EAS/native build requires Node 20+ in local environment.
- The widget target is attached automatically during `npx expo prebuild -p ios --clean`
  by `@bacons/apple-targets`; never add widget code under `ios/` (generated, gitignored).
- If `pod install` crashes with a Unicode/ASCII-8BIT encoding error, run with `LANG=en_US.UTF-8`.
- Device builds need a paid Apple team: `APPLE_TEAM_ID=XXXXXXXXXX npm run ios:device` (read by `app.config.js`),
  or `ios.appleTeamId` in `app.json`; Simulator builds don't. Free Personal Teams can't use App Groups.
- Xcode 27 rejects iOS deployment targets below 15; `plugins/withMinPodsDeploymentTarget.js` bumps pods on prebuild.
- Apple Sign-In is feature-flagged off by default via `EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN=false`.
