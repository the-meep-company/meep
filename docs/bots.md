# Bots

Bots are meeples that run on their own: on a schedule or when something happens,
with the user's calendar as their only hands. They read the calendar, tasks and
their own past runs, and they propose or make changes to blocks. They never
message anyone, touch other apps, or browse in the background. That constraint
is the product; don't widen it.

## The model

A bot is a row in `meeples` whose `kind` is `scheduled` or `triggered` (plain chat
meeples are `chat`). The bot fields are:

| Column | Meaning |
|---|---|
| `instructions` | The bot's brief, in the user's words. It is the prompt. |
| `schedule` | Cron with 5 fields on the user's local clock (`user_settings.timezone`), for scheduled bots |
| `trigger` | `task.deadline_changed`, `task.created`, `block.skipped`, `block.overran`, `calendar.event_added` |
| `trust` | `ask`: only proposes. `ask_big`: applies moves under 2h on the same day, proposes the rest. `auto`: applies everything and reports. Default `ask`. |
| `scope` | `read_calendar`, `read_tasks`, `propose_blocks`, `write_blocks`. With neither of the last two, a bot is read-only and can only report. |
| `enabled`, `push_enabled`, `template` | Whether it runs on its own, whether it may push (not yet used), and which starter it came from, if any |
| `next_run_at` | Set by bot-tick. It is reset to null whenever the schedule changes, so the next tick picks up the new time. |

Tables:
- `bot_runs`: one row per run, with the trigger, status, model, tokens and output.
- `feed_items`: what the user sees.
  - `proposal`: approve, tweak, dismiss.
  - `done`: undo.
  - `insight`: read-only.
  - `payload.changes` holds the before and after of every change, plus the full prior row. That is what undo uses.
- `bot_events`: the trigger queue. Postgres triggers on `tasks` and `events` fill it, but only when the user has an enabled bot listening.
- `app_config`: holds the `bots_paused` kill switch.
- `ops_alerts`: one alert per user per day.

### A run (`supabase/functions/_shared/bots.ts`)
1. **Start.** `bot-tick` runs every 5 minutes via pg_cron. It starts scheduled bots that are due and triggered bots with queued events, sending each run through `pg_net` to `run-bot`. The app calls `run-bot` directly for chat turns, "Run now", and the dry run after creating or editing a bot.
2. **Context.** `run-bot` loads it:
   - events from yesterday to three weeks out, with ids and whether the bot may write them
   - open tasks
   - the bot's recent feed items
3. **Model call.** Claude only gets tools that match the bot's scope:
   - `find_free_time` and `suggest_focus_blocks`, which wrap `_shared/freeTime.ts`
   - `submit_changes`
   - `report`
4. **Validation.** `submit_changes` checks for writable events, no overlaps, nothing in the past, and blocks between 10 minutes and 8 hours. If anything fails, the problems go back to the model so it can resubmit.
5. **Trust.** Trust decides what happens to each change. Applied changes go through `writeEvent(..., 'bot')` and become a `done` item; everything else becomes a `proposal`. New blocks go into the primary calendar the bots can write to (tagged `extendedProperties.private.meepBot`), or stay Meep-only if there isn't one.
6. **Feed and thread.** The bot leaves a line in its thread only when it actually did something. Chat turns always reply.

`feed-action` handles approve (all or some changes, optionally with new times
from tweaking), dismiss and undo. Approving re-checks the changes against the
current calendar first. Undo is all or nothing.
It is refused once any affected block's `updated_at` has moved since the bot
touched it.

### Spend guard
There is no hard cap. After 50 runs in a UTC day, bot-tick posts once to Discord
(`DISCORD_OPS_WEBHOOK_URL`, channel #overly-productive-meeple) with a signed link
(`bots-pause`, secret `BOTS_PAUSE_SECRET`). The link pauses that user's bots for
24h by setting `user_settings.bots_paused_until`. To stop every bot, set
`app_config.bots_paused` to `true`.

### In the app
- `lib/bots.ts`: starter bots, the schedule, trigger and trust vocabulary, and calls to the bot functions.
- `stores/feedStore.ts`: the feed, kept current by sync and Realtime.
- The Meep tab body is the feed (`components/feed/`).
- The composer sends to a bot after a card's Reply or an `@name`. Otherwise it goes to Meep, which can hand the message off to the bot whose proposal it's about.
- Starter bots are created once per user (`user_settings.seeded_bots`) with stable ids, so a deleted starter stays deleted.

### Starter bots
- **Deadline bot** (triggered on `task.deadline_changed`) works back from the due
  date into focus blocks, at most one per day and 90 minutes each, finishing two
  hours before the deadline. It uses `suggest_focus_blocks`.
- **Morning bot** (scheduled, 07:30 local daily) drafts today from today's events
  and open tasks and sends one card for the whole day. It is a *day-plan* bot
  (`DAY_PLAN_TEMPLATES`):
  - Validation rejects changes that aren't on today.
  - A new plan dismisses its earlier one if that one is still waiting.
  - Tweak opens the plan on the calendar's day view. Drag a block to move it
    (15-minute steps), or × to leave it out, then approve from the bar above the
    calendar (`components/calendar/DraftBlocks.tsx`, `DraftBar.tsx`).
  - Proposals that span several days are tweaked on the card instead, by
    choosing which changes to keep.
  - "Reply" on any card is tweak-by-talking.

## Adding a fifth bot
1. Add it to `STARTER_BOTS` in `lib/bots.ts`:
   - a `StarterKey`
   - name, role and instructions
   - kind with its schedule or trigger
   - `trust: 'ask'` and a scope
   It is created for every user on their next sync.
2. If it plans a lot (whole days, weeks), add its key to `DEEP_TEMPLATES` in `_shared/bots.ts` so it gets the deeper model. If its output is a plan for a single day, add it to `DAY_PLAN_TEMPLATES` too.
3. If it needs a computation the model shouldn't guess (free time, totals), add a pure helper next to `_shared/freeTime.ts` and expose it as a tool in `toolsFor`.

## Adding a trigger type
1. Add it to the `trigger` check in a new migration, and to `BotTrigger` in `types/index.ts`.
2. Emit it with `public.enqueue_bot_event(user_id, '<type>', payload)`, either from a Postgres trigger or from bot-tick for time-based ones.
3. Describe its payload in `describeTrigger` (`_shared/bots.ts`), and offer it in `TRIGGER_OPTIONS` (`lib/bots.ts`).

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
   npx supabase functions deploy gcal-sync google-connect event-write meeple chat run-bot bot-tick feed-action bots-pause
   ```
5. Bot secrets:
   - `DISCORD_OPS_WEBHOOK_URL`: a webhook for #overly-productive-meeple
   - `BOTS_PAUSE_SECRET`: any long random string
   - optional: `BOT_MODEL_DEEP` (default `claude-opus-5-5`) and `BOT_MODEL_FAST` (default `claude-sonnet-5-5`)
6. Existing Google users need to sign in with Google once more so the server gets
   a refresh token. Until they do, Settings → Google Calendar shows "Connect".
