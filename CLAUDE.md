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
- WidgetKit scaffold added in `ios/widget/` for small + medium widgets.

## Deferred
- Android widget implementation is intentionally deferred to a later phase.

## Build/Test notes
- EAS/native build requires Node 20+ in local environment.
- iOS widget target still needs to be attached in generated Xcode project (see `ios/widget/README.md`).
- Apple Sign-In is feature-flagged off by default via `EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN=false`.
