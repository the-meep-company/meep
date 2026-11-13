-- Drift: blocks that get skipped or run over wake bots listening for them.
-- See docs/bots.md.

-- A bot has one trigger, so 'block.drifted' listens for both kinds of drift.
alter table public.meeples drop constraint meeples_trigger_check;
alter table public.meeples add constraint meeples_trigger_check check (
  trigger in (
    'task.deadline_changed', 'task.created', 'block.skipped', 'block.overran', 'block.drifted', 'calendar.event_added'
  )
);

-- Whether the user has an enabled bot listening for an event of this type.
create or replace function public.bot_listens(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meeples
    where user_id = p_user_id and kind = 'triggered' and enabled
      and (trigger = p_type or (trigger = 'block.drifted' and p_type in ('block.skipped', 'block.overran')))
  );
$$;
revoke all on function public.bot_listens(uuid, text) from public, anon, authenticated;

create or replace function public.enqueue_bot_event(p_user_id uuid, p_type text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.bot_listens(p_user_id, p_type) then
    insert into public.bot_events (user_id, type, payload) values (p_user_id, p_type, p_payload);
  end if;
end;
$$;

-- Marking a block skipped, and pushing out the end of a block that's under way
-- ("Running over"), are drift the user tells us about. Bot moves keep the start
-- with the end, so they never look like running over.
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
    perform public.enqueue_bot_event(
      new.user_id, 'block.skipped', jsonb_build_object('event_id', new.id, 'drift', 'skipped')
    );
  end if;
  if tg_op = 'UPDATE' and new.status = 'planned' and not new.all_day
     and new.start_time = old.start_time and new.end_time > old.end_time
     and old.start_time <= now() and old.end_time > now() - interval '1 hour' then
    perform public.enqueue_bot_event(
      new.user_id, 'block.overran', jsonb_build_object('event_id', new.id, 'drift', 'overran')
    );
  end if;
  return new;
end;
$$;

drop trigger events_bot_events on public.events;
create trigger events_bot_events after insert or update of status, end_time on public.events
  for each row execute function public.events_bot_events();

-- Blocks still 'planned' 15 minutes after they ended have drifted. bot-tick calls
-- this every 5 minutes; each block is flagged once, and only within an hour of
-- its end, so turning a bot on doesn't dig up the whole day. Meetings with
-- guests, all-day events and habits aren't blocks the user checks off.
create index bot_events_overran_idx on public.bot_events ((payload ->> 'event_id')) where type = 'block.overran';

create or replace function public.flag_overran_blocks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select e.id, e.user_id
    from public.events e
    where e.status = 'planned' and not e.all_day and not e.is_habit and not e.has_guests
      and e.end_time <= now() - interval '15 minutes'
      and e.end_time > now() - interval '75 minutes'
      and public.bot_listens(e.user_id, 'block.overran')
      and not exists (
        select 1 from public.bot_events b where b.type = 'block.overran' and b.payload ->> 'event_id' = e.id
      )
  loop
    insert into public.bot_events (user_id, type, payload)
    values (r.user_id, 'block.overran', jsonb_build_object('event_id', r.id, 'drift', 'overran'));
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke all on function public.flag_overran_blocks() from public, anon, authenticated;
grant execute on function public.flag_overran_blocks() to service_role;
