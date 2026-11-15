-- Bots: meeples that run on a schedule or when something happens, with the
-- user's calendar as their only hands. See docs/bots.md.

-- ===== Bot fields on meeples =====

alter table public.meeples
  add column kind text not null default 'chat' check (kind in ('chat', 'scheduled', 'triggered')),
  add column schedule text,
  add column trigger text check (
    trigger in ('task.deadline_changed', 'task.created', 'block.skipped', 'block.overran', 'calendar.event_added')
  ),
  add column trust text not null default 'ask' check (trust in ('ask', 'ask_big', 'auto')),
  add column scope text[] not null default '{}',
  add column enabled boolean not null default false,
  add column push_enabled boolean not null default false,
  -- Which starter bot this is ('deadline', 'morning', ...); null for the user's own.
  add column template text,
  -- When a scheduled bot runs next; bot-tick fills it in and advances it.
  add column next_run_at timestamptz,
  add constraint meeples_kind_fields check (
    (kind = 'chat') or (kind = 'scheduled' and schedule is not null) or (kind = 'triggered' and trigger is not null)
  );

-- A changed schedule (or re-enabling) takes effect from the next tick: bot-tick
-- recomputes next_run_at when it's empty.
create or replace function public.meeples_reset_next_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.schedule is distinct from old.schedule or new.kind is distinct from old.kind
     or (new.enabled and not old.enabled) then
    new.next_run_at = null;
  end if;
  return new;
end;
$$;

create trigger meeples_reset_next_run before update on public.meeples
  for each row execute function public.meeples_reset_next_run();

create index meeples_due_idx on public.meeples (next_run_at) where kind = 'scheduled' and enabled;

alter table public.user_settings
  add column bots_paused_until timestamptz,
  -- Starter bots already created for this user, so deleted ones stay deleted.
  add column seeded_bots text[] not null default '{}';

-- ===== Runs, feed, trigger queue =====

create table public.bot_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meeple_id text not null references public.meeples (id) on delete cascade,
  trigger jsonb not null,
  status text not null default 'running' check (status in ('running', 'done', 'error', 'skipped')),
  input_snapshot jsonb,
  output jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index bot_runs_meeple_idx on public.bot_runs (meeple_id, started_at desc);
create index bot_runs_user_day_idx on public.bot_runs (user_id, started_at);

create table public.feed_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meeple_id text not null references public.meeples (id) on delete cascade,
  run_id uuid references public.bot_runs (id) on delete set null,
  type text not null check (type in ('proposal', 'done', 'insight')),
  title text not null,
  body text,
  -- { changes: BlockChange[] } with before/after state per change; see _shared/bots.ts.
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed', 'applied', 'undone')),
  dry_run boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feed_items_user_idx on public.feed_items (user_id, created_at desc);
create trigger feed_items_updated_at before update on public.feed_items
  for each row execute function public.handle_updated_at();

create table public.bot_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index bot_events_pending_idx on public.bot_events (created_at) where processed_at is null;

-- Global switches, e.g. bots_paused. Flip in the dashboard to stop every bot.
create table public.app_config (
  key text primary key,
  value jsonb not null
);
insert into public.app_config (key, value) values ('bots_paused', 'false') on conflict do nothing;

-- One ops alert per user per day per kind (e.g. 'runs_over_50').
create table public.ops_alerts (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day, kind)
);

-- Users read their own runs and feed; every write goes through the bot functions.
alter table public.bot_runs enable row level security;
alter table public.feed_items enable row level security;
alter table public.bot_events enable row level security;
alter table public.app_config enable row level security;
alter table public.ops_alerts enable row level security;
create policy bot_runs_select_own on public.bot_runs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy feed_items_select_own on public.feed_items
  for select to authenticated using ((select auth.uid()) = user_id);

do $$
declare t text;
begin
  foreach t in array array['feed_items', 'bot_runs'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===== Trigger events =====
-- Queued only when the user has an enabled bot listening for that event, so
-- ordinary edits (and big Google syncs) don't fill the queue.

create or replace function public.enqueue_bot_event(p_user_id uuid, p_type text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.meeples
    where user_id = p_user_id and kind = 'triggered' and enabled and trigger = p_type
  ) then
    insert into public.bot_events (user_id, type, payload) values (p_user_id, p_type, p_payload);
  end if;
end;
$$;
revoke all on function public.enqueue_bot_event(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.tasks_bot_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_bot_event(new.user_id, 'task.created', jsonb_build_object('task_id', new.id));
  end if;
  if new.due_date is not null and (tg_op = 'INSERT' or new.due_date is distinct from old.due_date) then
    perform public.enqueue_bot_event(
      new.user_id, 'task.deadline_changed', jsonb_build_object('task_id', new.id, 'due_date', new.due_date)
    );
  end if;
  return new;
end;
$$;

create trigger tasks_bot_events after insert or update of due_date on public.tasks
  for each row execute function public.tasks_bot_events();

create or replace function public.events_bot_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- New events in the next two weeks, unless a bot placed them (no bot loops).
  if tg_op = 'INSERT' and new.bot_id is null
     and new.start_time > now() and new.start_time < now() + interval '14 days' then
    perform public.enqueue_bot_event(new.user_id, 'calendar.event_added', jsonb_build_object('event_id', new.id));
  end if;
  if tg_op = 'UPDATE' and new.status = 'skipped' and old.status is distinct from 'skipped' then
    perform public.enqueue_bot_event(new.user_id, 'block.skipped', jsonb_build_object('event_id', new.id));
  end if;
  return new;
end;
$$;

create trigger events_bot_events after insert or update of status on public.events
  for each row execute function public.events_bot_events();

-- ===== Scheduling =====

grant execute on function public.invoke_edge_function(text, jsonb) to service_role;

select cron.schedule('bot-tick', '*/5 * * * *', $$ select public.invoke_edge_function('bot-tick') $$);
