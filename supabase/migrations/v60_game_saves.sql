-- The battle game's save, kept on the account instead of only in one
-- browser: the party and Box, the Bag (which holds the supplies collected
-- from user_items, v58), badges, the League ladder and so on. The game
-- still keeps a copy in the browser, as a cache and for when it can't reach
-- the server.
--
-- One save per member. `rev` goes up by one on every write, and a write
-- names the revision it was made from: if the account's save has moved on
-- since (the game was played on another device in between), the write is
-- refused and the newer save comes back instead, so an older device can't
-- overwrite newer progress. The game then loads that newer save.
--
-- The save is the game's own state, written by the game; what's real
-- (packs, tokens, cards) never lives in it. Reads and writes go through the
-- functions below, on your own row only. A save is capped at 1 MB.

create table if not exists public.game_saves (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  data        jsonb not null,
  rev         integer not null default 1 check (rev >= 1),
  updated_at  timestamptz not null default now()
);

alter table public.game_saves enable row level security;
drop policy if exists game_saves_select on public.game_saves;
create policy game_saves_select on public.game_saves
  for select using (user_id = auth.uid() or public.is_mod());
revoke all on public.game_saves from anon;
revoke insert, update, delete, truncate, references, trigger on public.game_saves from authenticated;

create or replace function public.game_save_get()
returns table (data jsonb, rev integer, updated_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select g.data, g.rev, g.updated_at from public.game_saves g
   where g.user_id = auth.uid() and public.is_member()
$$;

create or replace function public.game_save_put(p_data jsonb, p_rev integer)
returns table (ok boolean, reason text, rev integer, data jsonb)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  me  uuid := auth.uid();
  cur public.game_saves;
begin
  if me is null or not public.is_member() then
    return query select false, 'not_allowed', null::integer, null::jsonb; return;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return query select false, 'bad_request', null::integer, null::jsonb; return;
  end if;
  if octet_length(p_data::text) > 1048576 then
    return query select false, 'too_big', null::integer, null::jsonb; return;
  end if;

  select * into cur from public.game_saves g where g.user_id = me for update;
  if found then
    -- Made from an older revision (or from none): the account's save wins.
    if p_rev is null or p_rev <> cur.rev then
      return query select false, 'conflict', cur.rev, cur.data; return;
    end if;
    update public.game_saves g set data = p_data, rev = cur.rev + 1, updated_at = now() where g.user_id = me;
    return query select true, 'ok', cur.rev + 1, null::jsonb; return;
  end if;

  insert into public.game_saves (user_id, data, rev) values (me, p_data, 1)
  on conflict (user_id) do nothing;
  if not found then   -- another write got there first
    return query select false, 'conflict', g.rev, g.data from public.game_saves g where g.user_id = me; return;
  end if;
  return query select true, 'ok', 1, null::jsonb;
end $fn$;

-- New game: the account's save is deleted.
create or replace function public.game_save_delete()
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_member() then return false; end if;
  delete from public.game_saves where user_id = auth.uid();
  return true;
end $$;

revoke execute on function public.game_save_get() from public, anon;
revoke execute on function public.game_save_put(jsonb, integer) from public, anon;
revoke execute on function public.game_save_delete() from public, anon;
grant execute on function public.game_save_get() to authenticated;
grant execute on function public.game_save_put(jsonb, integer) to authenticated;
grant execute on function public.game_save_delete() to authenticated;
