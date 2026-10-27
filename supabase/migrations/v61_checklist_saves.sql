-- The Standard checklist's ticks (public/checklist.html), kept on the
-- account instead of only in one browser, so they follow a member to any
-- device. The page still keeps a copy in the browser, as a cache and for
-- when it can't reach the server.
--
-- One save per member: { c: [card ids], n: [card names] }. As with the
-- battle game's save (v60), `rev` goes up by one on every write, and a write
-- names the revision it was made from: if the account's save has moved on
-- since (ticked on another device in between), the write is refused and the
-- newer save comes back, so the page can apply its own changes on top of it
-- and write again instead of overwriting the other device's ticks.
--
-- Reads and writes go through the functions below, on your own row only.
-- A save is capped at 256 KB (every card in the format is about 40 KB).

create table if not exists public.checklist_saves (
  user_id     uuid primary key references public.profiles(id) on delete cascade,
  data        jsonb not null,
  rev         integer not null default 1 check (rev >= 1),
  updated_at  timestamptz not null default now()
);

alter table public.checklist_saves enable row level security;
drop policy if exists checklist_saves_select on public.checklist_saves;
create policy checklist_saves_select on public.checklist_saves
  for select using (user_id = auth.uid() or public.is_mod());
revoke all on public.checklist_saves from anon;
revoke insert, update, delete, truncate, references, trigger on public.checklist_saves from authenticated;

create or replace function public.checklist_get()
returns table (data jsonb, rev integer, updated_at timestamptz)
language sql stable security definer set search_path to 'public' as $$
  select c.data, c.rev, c.updated_at from public.checklist_saves c
   where c.user_id = auth.uid() and public.is_member()
$$;

create or replace function public.checklist_put(p_data jsonb, p_rev integer)
returns table (ok boolean, reason text, rev integer, data jsonb)
language plpgsql security definer set search_path to 'public' as $fn$
declare
  me  uuid := auth.uid();
  cur public.checklist_saves;
begin
  if me is null or not public.is_member() then
    return query select false, 'not_allowed', null::integer, null::jsonb; return;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    return query select false, 'bad_request', null::integer, null::jsonb; return;
  end if;
  if octet_length(p_data::text) > 262144 then
    return query select false, 'too_big', null::integer, null::jsonb; return;
  end if;

  select * into cur from public.checklist_saves c where c.user_id = me for update;
  if found then
    -- Made from an older revision (or from none): the account's save comes back instead.
    if p_rev is null or p_rev <> cur.rev then
      return query select false, 'conflict', cur.rev, cur.data; return;
    end if;
    update public.checklist_saves c set data = p_data, rev = cur.rev + 1, updated_at = now() where c.user_id = me;
    return query select true, 'ok', cur.rev + 1, null::jsonb; return;
  end if;

  insert into public.checklist_saves (user_id, data, rev) values (me, p_data, 1)
  on conflict (user_id) do nothing;
  if not found then   -- another write got there first
    return query select false, 'conflict', c.rev, c.data from public.checklist_saves c where c.user_id = me; return;
  end if;
  return query select true, 'ok', 1, null::jsonb;
end $fn$;

revoke execute on function public.checklist_get() from public, anon;
revoke execute on function public.checklist_put(jsonb, integer) from public, anon;
grant execute on function public.checklist_get() to authenticated;
grant execute on function public.checklist_put(jsonb, integer) to authenticated;
