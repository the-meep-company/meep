-- Baseline: the core tables as they exist on the live project (applied there as
-- 20260414102408 create_core_tables, which was never checked in). Reconstructed
-- from the live schema and written idempotently so it is a no-op against production.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.events (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean not null default false,
  color text not null default '#6C5CE7',
  location text,
  source text not null default 'local',
  calendar_id text,
  schedule_source text,
  is_habit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  priority smallint not null default 3,
  category text,
  color text,
  status text not null default 'todo',
  parent_task_id text,
  estimated_minutes integer,
  carry_over_from text,
  schedule_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  frequency text not null,
  custom_days integer[],
  start_time text,
  duration_minutes integer not null,
  color text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  target_date timestamptz,
  category text,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ai_persona text,
  timezone text,
  timezone_auto_detect boolean not null default true,
  companion_name text,
  voice_locale text,
  theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at triggers (goals has none on the live project)
do $$
declare t text;
begin
  foreach t in array array['events', 'tasks', 'habits', 'user_settings'] loop
    if not exists (
      select 1 from pg_trigger where tgname = t || '_updated_at' and tgrelid = ('public.' || t)::regclass
    ) then
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.handle_updated_at()',
        t || '_updated_at', t
      );
    end if;
  end loop;
end $$;

-- RLS: every table is owner-only for select/insert/update/delete.
do $$
declare
  t text;
  op text;
begin
  foreach t in array array['events', 'tasks', 'habits', 'goals', 'user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    foreach op in array array['select', 'insert', 'update', 'delete'] loop
      if not exists (
        select 1 from pg_policies where schemaname = 'public' and tablename = t and cmd = upper(op)
      ) then
        if op = 'insert' then
          execute format(
            'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
            t || '_' || op || '_own', t
          );
        elsif op = 'update' then
          execute format(
            'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
            t || '_' || op || '_own', t
          );
        else
          execute format(
            'create policy %I on public.%I for %s to authenticated using ((select auth.uid()) = user_id)',
            t || '_' || op || '_own', t, op
          );
        end if;
      end if;
    end loop;
  end loop;
end $$;
