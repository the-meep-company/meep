# Meep - AI Calendar App - Design & Implementation Plan

## Context

Annie and Rahul are building **Meep**, an AI-powered calendar + task management + life organizer app. The concept comes from their brainstorm PDF (FigJam/Miro board). Both are beginner developers. They collaborate via GitHub (org: `the-meep-company`, repo: `drift`) and track progress in Notion. Annie has an existing Expo + Supabase project (visa-tracker) that provides proven patterns to reuse.

**App Name:** Meep (chosen by Annie). The folder/repo is still named `drift` from the placeholder name but all user-facing references are now "Meep".

**Problem it solves:** Life is chaotic - too many tools, too much context switching, tasks get forgotten. They want one app where you can brain-dump everything (voice or text) and AI organizes it into your calendar intelligently.

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Framework** | Expo SDK 55+ with expo-router | Cross-platform, Annie already knows it |
| **State** | Zustand | Simple, Annie has patterns from tripStore.ts |
| **Offline DB** | WatermelonDB (SQLite) | Best offline-first DB for React Native, built-in sync protocol |
| **Backend** | Supabase (Postgres + Auth + Edge Functions + Realtime) | Annie already uses it, real SQL queries, managed |
| **Auth** | Supabase Auth (Google, Apple, email/password) | Built-in providers |
| **AI** | Claude API (Sonnet for real-time, Haiku for bulk) | Best at parsing messy natural language into structured data, better conversational personality, simpler API |
| **Voice In** | Web Speech API (v1), Whisper API (v2) | Free first, upgrade later |
| **Voice Out** | expo-speech (native) + ElevenLabs API (personality voices) | Fun voices are a v1 feature |
| **Calendar Sync** | Google Calendar API + Microsoft Graph API | Direct REST APIs |
| **Animations** | react-native-reanimated + react-native-gesture-handler | Gesture-driven calendar (pinch-to-zoom) |
| **Widgets** | expo-widgets / WidgetKit (iOS) + react-native-android-widget | Native home screen widgets |
| **Theming** | Zustand theme store + 3 theme files | User-selectable: minimal, playful, sleek |

---

## Architecture

```
[Expo App (React Native + Web)]
    |-- UI Layer (expo-router screens + tabs)
    |-- State Layer (Zustand stores)
    |-- Local DB (WatermelonDB / SQLite)
            |
            |-- Sync Engine (push/pull with conflict resolution)
            |
    [Supabase Backend]
        |-- Postgres (source of truth when online)
        |-- Auth (Google/Apple/email)
        |-- Edge Functions:
        |       /ai/parse-braindump
        |       /ai/schedule
        |       /ai/chat
        |       /ai/reschedule
        |       /sync/google-calendar
        |       /sync/outlook
        |-- Realtime (cross-device push)
        |
    [External APIs]
        |-- Anthropic Claude API
        |-- Google Calendar API
        |-- Microsoft Graph API
        |-- ElevenLabs TTS API
```

**Key pattern:** All AI calls route through Supabase Edge Functions (API key stays server-side). All writes go to WatermelonDB first (instant, offline), then sync to Supabase when online.

---

## Data Model (Core Tables)

- **users**: id, email, display_name, ai_companion_name, theme_preference
- **calendars**: id, user_id, name, color, source (local|google|outlook), external_id, sync_token
- **events**: id, user_id, calendar_id, title, description, start_time, end_time, all_day, recurrence_rule, location, color, source, external_id
- **tasks**: id, user_id, title, description, due_date, scheduled_start, scheduled_end, priority (1-4), category, color, status (todo|in_progress|done|deferred), parent_task_id (subtasks), estimated_minutes, carry_over_from
- **goals**: id, user_id, title, description, target_date, category, status
- **ai_conversations**: id, user_id, messages (jsonb), context_summary
- **user_preferences**: wake_time, sleep_time, focus_hours, color_preferences (jsonb), scheduling_preferences (jsonb), companion_personality

---

## Phased Build Plan

### Phase 0: Project Setup (Week 1)
- [ ] Init Expo project with expo-router (tab layout: Calendar, Tasks, Chat, Settings)
- [ ] Set up GitHub repo with branch protection (main + dev branches)
- [ ] Configure new Supabase project + database schema
- [ ] Set up WatermelonDB with model definitions
- [ ] Build theme system (3 themes in Zustand store)
- [ ] Basic navigation skeleton

### Phase 1: Calendar Core (Weeks 2-4)
- [ ] Day view (scrollable time slots, events as blocks)
- [ ] Week view (7-column grid)
- [ ] Month view (traditional calendar grid)
- [ ] Manual event creation (tap slot -> form -> save)
- [ ] Manual task creation (title, due date, priority)
- [ ] Sub-tasks (parent_task_id)
- [ ] Local persistence with WatermelonDB

### Phase 2: AI Brain Dump + Auto-Scheduling (Weeks 5-7)
- [ ] First Supabase Edge Function (`/ai/parse-braindump`)
- [ ] Claude Sonnet integration for text parsing
- [ ] Brain dump UI (full-screen input, parse button)
- [ ] Quick-add mode (single item input)
- [ ] AI parses text -> structured tasks/events/goals (user confirms before saving)
- [ ] Auto-scheduling engine: Claude places tasks into calendar gaps
- [ ] Visual indicator for AI-placed vs manually-placed items

### Phase 3: Voice Input + AI Chat Companion (Weeks 8-10)
- [ ] Web Speech API voice-to-text integration
- [ ] Pipe voice transcription into brain dump parser
- [ ] Chat UI (message bubbles, input field)
- [ ] AI companion with persistent personality + name
- [ ] Chat commands: "What's my day?", "Move X to Thursday", "Cancel Y"
- [ ] Conversation history stored in ai_conversations

### Phase 4: Sync Layer (Weeks 11-13)
- [ ] WatermelonDB <-> Supabase sync adapter
- [ ] Offline create/edit, sync when online
- [ ] Conflict resolution (last-write-wins with timestamps)
- [ ] Google Calendar OAuth2 flow
- [ ] Google Calendar two-way sync (import events + colors, push changes back)
- [ ] Cross-device sync via Supabase Realtime

### Phase 5: Smart Reorganization + TTS (Weeks 14-16)
- [ ] Reschedule engine: new event conflicts -> AI reshuffles tasks
- [ ] "Your day was reorganized" notification with before/after diff
- [ ] User accept/reject AI reorganization
- [ ] TTS for AI companion (expo-speech + ElevenLabs personality voices)
- [ ] Smart color system: AI assigns, learns from user corrections, imports existing colors

### Phase 6: Widgets + Polish (Weeks 17-20)
- [ ] iOS WidgetKit widget (today's date, next 3 events, top 3 tasks, AI greeting)
- [ ] Android widget (react-native-android-widget)
- [ ] Pinch-to-zoom gesture navigation (year <-> month <-> week <-> day)
- [ ] Carry-over of unfinished tasks (AI moves undone to tomorrow)
- [ ] Google + Apple sign-in flows
- [ ] Performance optimization + animation polish

### Phase 7 / v2 (Later)
- Mood tracking + daily check-in from AI companion
- Time insights (category breakdowns, productivity trends)
- Whisper API for better voice recognition
- Goal tracking with progress visualization
- Outlook sync (Microsoft Graph API)
- Notion two-way sync

---

## Folder Structure

```
app/
  (tabs)/
    calendar.tsx
    tasks.tsx
    chat.tsx
    settings.tsx
  (auth)/
    login.tsx
    register.tsx
  _layout.tsx
components/
  calendar/     -- DayView, WeekView, MonthView, EventBlock, TimeSlot
  tasks/        -- TaskList, TaskItem, SubTaskItem
  chat/         -- ChatBubble, ChatInput
  common/       -- Button, Card, Input
stores/
  calendarStore.ts, taskStore.ts, chatStore.ts, themeStore.ts, authStore.ts, syncStore.ts
lib/
  supabase.ts, ai.ts, sync.ts, theme.ts, colors.ts
db/
  schema.ts, sync.ts
  models/       -- Event.ts, Task.ts, Calendar.ts
themes/
  minimal.ts, playful.ts, sleek.ts
types/
  index.ts
```

---

## Key Libraries

```
# Core (Annie already knows)
expo, expo-router, zustand, react-native-reanimated, react-native-gesture-handler

# New for this project
@nozbe/watermelondb           # offline-first database
@nozbe/with-observables        # reactive WatermelonDB bindings for React
@supabase/supabase-js          # (already used in visa-tracker)
date-fns                        # (already used) date math
rrule                           # recurring event parsing (RFC 5545)
expo-speech                     # native TTS
expo-auth-session               # OAuth flows
```

---

## Top Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Offline sync bugs** (data duplicates, lost edits) | HIGH | Use WatermelonDB's built-in sync protocol. Start one-directional before two-way. |
| **Google Calendar API complexity** (rate limits, OAuth2, RRULE) | HIGH | Start with one-way import. Use `rrule` library. Add push-to-Google later. |
| **AI API costs** | MEDIUM | Use Haiku for simple ops, Sonnet for complex. Cache responses. Set daily limits. |
| **Native widgets in Expo** | MEDIUM | Delay to Phase 6. Use EAS Build with custom native modules if needed. |
| **Scope creep** | HIGH | Ship each phase as working increment. Phase 1 must be usable standalone. |
| **Git collaboration friction** | MEDIUM | Clear ownership (Annie: UI, Rahul: backend/AI). Feature branches, small PRs. |

---

## Work Sessions (Based on Annie's Calendar)

Starting TODAY (Apr 9). Using existing recurring "AI app" calendar sessions:
- **Today, Apr 9**: Phase 0 kickoff - project init, GitHub org, Expo scaffold
- **Mon Apr 14**: AI app day - continue Phase 0 setup
- **Thu Apr 16, 18:30-21:30**: AI app session - finish Phase 0, start Phase 1
- **Fri Apr 17, 19:00-23:00**: App Braincelling - name decision + design review with friends
- **Mon Apr 21**: AI app day (Milan Design Week - may be limited)
- **Mon Apr 28**: AI app day (day before Cyprus - may be limited)
- **May 6+**: Back from Cyprus, resume full-speed Phase 1+

## GitHub Setup

- Create a **new shared GitHub organization** for the project
- Add both Annie and Rahul as owners
- Create repo under the org
- Branch strategy: `main` (stable), `dev` (integration), feature branches

## Notion Tracker

- Review the existing Notion page together and set up the board structure
- Progress tracker: https://www.notion.so/anniecartotecture/33d149e2cf25807baf92f16fd5eb37ee
- Approved plans database: https://www.notion.so/anniecartotecture/33d149e2cf2580baa943ebb65f790cb5?v=33d149e2cf2580a1a3c0000c054f5477
- Add approved plans/phases into the Notion database as they are completed

---

## Verification Plan

After each phase, verify:
1. **Phase 0**: App launches on iOS simulator + web, all 4 tabs navigate, theme switching works
2. **Phase 1**: Can create/edit/delete events and tasks, they persist across app restarts, sub-tasks work
3. **Phase 2**: Can type a brain dump, AI returns structured items, items appear in calendar after confirmation
4. **Phase 3**: Voice input transcribes and parses, chat conversation persists, AI answers schedule questions
5. **Phase 4**: Create event offline -> go online -> appears in Supabase. Import from Google Calendar works.
6. **Phase 5**: Add conflicting event -> tasks automatically reshuffle. AI companion speaks responses.
7. **Phase 6**: Widget appears on home screen with today's info. Pinch-to-zoom works smoothly.

Run `expo start` and test on iOS simulator, Android emulator, and web browser for each phase.
