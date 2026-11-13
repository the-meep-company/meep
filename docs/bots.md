# Bots

Bots are meeples that run on their own: on a schedule or when something happens,
with the user's calendar as their only hands. This doc grows with each bots PR;
this first part covers the foundation they stand on.

## Foundation (feature/bots-foundation)

### Supabase is the source of truth
- The app's zustand stores are a cache. `lib/sync.ts` `syncAll` flushes the
  offline queue, then pulls, and **the server wins**. A row that exists only on the
  device is kept and pushed when it was created after the last successful pull, or
  on the first pull ever (moving existing local data up); otherwise it was deleted
  elsewhere and is dropped.
- `lib/realtime.ts` subscribes to `events`, `tasks`, `meeples`, `meeple_messages`
  and `google_calendars` while signed in. `stores/authStore.ts` pulls again when the
  app returns to the foreground (at most every 30s).
- Meeples and their threads now live in `meeples` / `meeple_messages`.
  `stores/meepleStore.ts` writes through on every change.

### Google Calendar lives on the server
- Google sign-in asks for offline access. The refresh token goes to the
  `google-connect` function, which stores it in Vault (`google_credentials` holds
  only the secret id; only the service role can read it).
- `gcal-sync` pulls each user's selected calendars into `events`. pg_cron runs it
  every 10 minutes for every connected user, and the app runs it for "Sync now".
  Row ids for synced events are `gcal_<user id>_<google event id>`.
- All event writes go through `supabase/functions/_shared/eventWrite.ts`. Changes
  to an event that lives in Google go to Google first, with the event's etag, so
  an edit made in Google in the meantime is never overwritten.
  - The app uses it through the `event-write` function (`lib/sync.ts`
    `writeGoogleEvent` / `deleteGoogleEvent`).
  - Bots will call it directly with `actor: 'bot'`. Bots may only write to
    calendars where `google_calendars.bots_can_write` is on. The user turns that
    on per calendar in Settings → Google Calendar.
- Meep-only columns on `events` (`status`, `category`, `task_id`, `bot_id`) are
  never sent to Google, and sync never overwrites them.

### Edge function helpers (`supabase/functions/_shared/`)
| File | What it does |
|---|---|
| `cors.ts` | CORS headers and `json()` |
| `admin.ts` | service-role client (scope every query by `user_id`) |
| `auth.ts` | `userIdFrom(req)`, `isServiceCall(req)` |
| `anthropic.ts` | `runToolLoop`, Claude's tool-use loop (used by `meeple`) |
| `google.ts` | token refresh, Calendar API calls, and row ↔ Google mapping |
| `gcalSync.ts` | `syncUser`, `userTimezone` |
| `eventWrite.ts` | `writeEvent`, the single write path |
| `time.ts` | IANA timezone helpers (no date library in Deno) |

### One-time project setup
1. Migrations: `npx supabase link --project-ref qvqcfkjmflvkochasfdz`, then
   `npx supabase db push`.
   - The baseline migration matches the live `20260414102408 create_core_tables`
     and is written to be a no-op.
2. Vault secrets used by pg_cron. Run in the SQL editor:
   ```sql
   select vault.create_secret('https://qvqcfkjmflvkochasfdz.supabase.co', 'project_url');
   select vault.create_secret('<service role key>', 'service_role_key');
   ```
3. Function secrets:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, which must be the same OAuth
     client as the Supabase Google auth provider.
   - `ANTHROPIC_API_KEY` is already set.
4. Deploy:
   ```
   npx supabase functions deploy gcal-sync google-connect event-write meeple
   ```
5. Existing Google users need to sign in with Google once more so the server gets
   a refresh token. Until they do, Settings → Google Calendar shows "Connect".
