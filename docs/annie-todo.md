# Annie's to-do: running the bots build on your iPhone

Bots run against the `meep-bots-test` Supabase project (`hklqdieqppcwwresrrxo`).
The server side is live there. This list gets the app onto your phone with push
notifications, using your own paid Apple account. Tick things off as you go.

## Already done (nothing for you to do)
- Migrations, edge functions, secrets and cron jobs on `meep-bots-test`.
- The Anthropic key there was replaced on 15 Nov: the first one wasn't scoped to
  a workspace, so every bot run failed. Rahul has the current
  `.env.secrets.local` if you need it.
- `meep://**` added to the test project's redirect URLs, so Google sign-in
  works in the native app.
- Google sign-in on the test project now uses the same OAuth client as the
  function secrets (`616015615079-…`). Before, sign-in used a different client,
  so the server couldn't refresh anyone's calendar token. Calendar sync is
  confirmed working on Rahul's account.
- Shared Expo project `@themeepcompany/meep`; its id is in `app.json`.

## Your steps
- [ ] **Join the Expo organisation.** Accept Rahul's invite to `themeepcompany`
      on expo.dev, then run `npx eas-cli login`.
- [ ] **Pull `feature/bots` and run `npm install`** (`expo-notifications` is new).
- [ ] **Create `.env.local`** in the repo root (gitignored), so the app talks to
      the test project instead of the main one:
      ```
      EXPO_PUBLIC_SUPABASE_URL=https://hklqdieqppcwwresrrxo.supabase.co
      EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
      ```
      Get the anon key with
      `npx supabase projects api-keys --project-ref hklqdieqppcwwresrrxo`.
      Delete the file to go back to the main project.
- [ ] **Build and install on your iPhone** with your own team and bundle id
      (`com.themeepcompany.meep` isn't registered to either of our teams):
      ```
      APPLE_TEAM_ID=<your team id> APPLE_BUNDLE_ID=com.<yourname>.meep LANG=en_US.UTF-8 npx expo prebuild -p ios --clean
      xcodebuild -workspace ios/meep.xcworkspace -scheme meep -configuration Release \
        -destination 'id=<your device id>' -derivedDataPath ios/build -allowProvisioningUpdates build
      xcrun devicectl device install app --device <your device id> ios/build/Build/Products/Release-iphoneos/meep.app
      git checkout targets/widget/generated.entitlements
      ```
      `xcrun devicectl list devices` shows your device id. The last line undoes
      a change prebuild makes that shouldn't be committed.
- [ ] **Add your push key**, so Expo can deliver to your build:
      ```
      APPLE_BUNDLE_ID=com.<yourname>.meep npx eas-cli credentials -p ios
      ```
      Pick the `development` profile, log in with your Apple ID, then
      "Push Notifications: Manage your Apple Push Notifications Key" and let it
      create a key.
- [ ] **In the app:** sign in with Google (if you were signed in before
      15 Nov, sign out first: your old calendar token came from the other
      client), turn on "Bots can edit" for a
      calendar in Settings, and switch on "Notify me" for a bot.

## Things to know
- The test project has its own users, so accounts and data there are separate
  from the main `meep` project.
- The main project has none of the bots setup yet. Moving it over is the
  one-time setup in `docs/bots.md`, for when #17 and #18 are ready to merge.
