-- Virtual vending machine, phase 3b: presence ("who is lurking").
--
-- The holder seeing a queue build behind them is the whole point of the
-- exclusive-session design: it turns "clear it out or leave some" from a
-- private decision into a social one. That needs to know who is *watching*,
-- not just who is holding.
--
-- Deliberately a heartbeat table rather than realtime presence: the client
-- already polls while on the page, so this rides along on that, and a stale
-- row simply ages out instead of needing connection lifecycle handling.

create table if not exists public.vending_watchers (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  last_seen timestamptz not null default now()
);

create index if not exists vending_watchers_seen_idx on public.vending_watchers (last_seen);

-- Records that the caller is looking at the machine and returns everyone
-- else currently doing the same. Watchers go stale after 20 seconds, which
-- is comfortably longer than the client's 5 second poll.
create or replace function public.vending_ping()
returns table (watcher_id uuid, name text, is_holder boolean)
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    return;
  end if;

  insert into public.vending_watchers (user_id, last_seen)
  values (me, now())
  on conflict (user_id) do update set last_seen = now();

  -- Opportunistic cleanup; cheap at this table size and keeps it from
  -- accumulating rows for members who never come back.
  delete from public.vending_watchers where last_seen < now() - interval '5 minutes';

  return query
    select w.user_id as watcher_id,
           coalesce(p.display_name, p.username),
           coalesce(s.holder_id = w.user_id, false)
      from public.vending_watchers w
      join public.profiles p on p.id = w.user_id
      cross join public.vending_session s
     where w.last_seen > now() - interval '20 seconds'
     order by (coalesce(s.holder_id = w.user_id, false)) desc, w.last_seen;
end $$;

create or replace function public.vending_unwatch()
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.vending_watchers where user_id = auth.uid();
end $$;

-- Reads go through the SECURITY DEFINER function above, so the table itself
-- stays closed.
alter table public.vending_watchers enable row level security;
