-- Foundation for bots: Supabase becomes the source of truth for calendar data,
-- Google Calendar sync moves server-side, and meeples move off the device.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ===== Meeples and their threads =====

create table public.meeples (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  role text not null default '',
  instructions text not null default '',
  icon text not null default 'lightbulb-o',
  glow text not null default 'apricot',
  web_search boolean not null default false,
  schedule_access boolean not null default false,
  unread boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeples_user_idx on public.meeples (user_id);

create table public.meeple_messages (
  id text primary key,
  meeple_id text not null references public.meeples (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  actions jsonb,
  sources jsonb,
  action_statuses jsonb,
  created_at timestamptz not null default now()
);
create index meeple_messages_thread_idx on public.meeple_messages (meeple_id, created_at);

create trigger meeples_updated_at before update on public.meeples
  for each row execute function public.handle_updated_at();

-- ===== Events: Google identity, completion status, category, links =====

alter table public.events
  add column google_event_id text,
  add column google_calendar_id text,
  add column google_etag text,
  add column has_guests boolean not null default false,
  add column status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  add column category text,
  add column task_id text references public.tasks (id) on delete set null,
  add column bot_id text references public.meeples (id) on delete set null;

create index events_user_start_idx on public.events (user_id, start_time);
create index events_google_idx on public.events (user_id, google_calendar_id, google_event_id)
  where google_event_id is not null;

-- ===== Google credentials (server only) =====
-- The refresh token itself lives in Vault; this row only points at the secret.
-- RLS is on with no policies, so only the service role can read or write it.

create table public.google_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  secret_id uuid not null,
  updated_at timestamptz not null default now()
);
alter table public.google_credentials enable row level security;

create or replace function public.store_google_refresh_token(p_user_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  select secret_id into existing from public.google_credentials where user_id = p_user_id;
  if existing is null then
    insert into public.google_credentials (user_id, secret_id)
    values (p_user_id, vault.create_secret(p_token, 'google_refresh_' || p_user_id::text));
  else
    perform vault.update_secret(existing, p_token);
    update public.google_credentials set updated_at = now() where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.get_google_refresh_token(p_user_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.google_credentials c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.user_id = p_user_id;
$$;

create or replace function public.delete_google_credentials(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing uuid;
begin
  delete from public.google_credentials where user_id = p_user_id returning secret_id into existing;
  if existing is not null then
    delete from vault.secrets where id = existing;
  end if;
end;
$$;

revoke all on function public.store_google_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function public.get_google_refresh_token(uuid) from public, anon, authenticated;
revoke all on function public.delete_google_credentials(uuid) from public, anon, authenticated;
grant execute on function public.store_google_refresh_token(uuid, text) to service_role;
grant execute on function public.get_google_refresh_token(uuid) to service_role;
grant execute on function public.delete_google_credentials(uuid) to service_role;

-- ===== Google calendars per user =====

create table public.google_calendars (
  user_id uuid not null references auth.users (id) on delete cascade,
  calendar_id text not null,
  summary text not null,
  background_color text not null default '#4285F4',
  is_primary boolean not null default false,
  access_role text,
  selected boolean not null default false,
  bots_can_write boolean not null default false,
  sync_token text,
  last_synced_at timestamptz,
  primary key (user_id, calendar_id)
);
alter table public.google_calendars enable row level security;

create policy google_calendars_select_own on public.google_calendars
  for select to authenticated using ((select auth.uid()) = user_id);
-- Users flip selected / bots_can_write; the server owns the rest (sync tokens etc.).
create policy google_calendars_update_own on public.google_calendars
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.google_calendars from authenticated;
grant update (selected, bots_can_write) on public.google_calendars to authenticated;

-- ===== RLS for the meeple tables =====

do $$
declare
  t text;
begin
  foreach t in array array['meeples', 'meeple_messages'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- A message can only be attached to one of the user's own meeples.
create policy meeple_messages_own_meeple on public.meeple_messages
  as restrictive for insert to authenticated
  with check (exists (select 1 from public.meeples m where m.id = meeple_id and m.user_id = (select auth.uid())));

-- ===== Realtime =====

do $$
declare
  t text;
begin
  foreach t in array array['events', 'tasks', 'meeples', 'meeple_messages', 'google_calendars'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===== Scheduled Google sync =====
-- Calls gcal-sync for every connected user every 10 minutes. Needs two Vault
-- secrets set once per project (see docs/bots.md): project_url, service_role_key.

create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := p_body,
    timeout_milliseconds := 60000
  );
$$;
revoke all on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

select cron.schedule('gcal-sync', '*/10 * * * *', $$ select public.invoke_edge_function('gcal-sync', '{"all": true}') $$);
