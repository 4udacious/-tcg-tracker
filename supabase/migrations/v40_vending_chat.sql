-- A chat box in the vending machine lobby.
--
-- Polled on the same five-second beat as presence rather than subscribed to:
-- the rest of this app advances lazily on reads, and a realtime channel for
-- a handful of people standing at a machine is not worth the moving parts.
-- Reads are incremental - the client passes the newest id it holds and gets
-- only what is newer, so the usual answer is an empty list.

create table if not exists public.vending_chat (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 240),
  created_at timestamptz not null default now()
);

create index if not exists vending_chat_recent_idx on public.vending_chat (id desc);
create index if not exists vending_chat_author_idx on public.vending_chat (user_id, created_at desc);

alter table public.vending_chat enable row level security;

create policy vending_chat_read on public.vending_chat
  for select using (auth.uid() is not null);
-- No insert policy: posting goes through send_vending_chat, so the rate
-- limit cannot be stepped around by writing to the table directly.
create policy vending_chat_delete on public.vending_chat
  for delete using (user_id = auth.uid() or public.is_mod());

/**
 * Recent messages, newest id last. `p_since` of 0 returns the tail of the
 * room; anything higher returns only what the caller has not seen.
 */
create or replace function public.get_vending_chat(p_since bigint default 0)
returns table (
  id bigint, user_id uuid, username text, display_name text,
  name_color text, avatar_url text, body text, created_at timestamptz, mine boolean
)
language sql stable security definer set search_path to 'public' as $$
  select c.id, c.user_id, p.username, p.display_name, p.name_color, p.avatar_url,
         c.body, c.created_at, (c.user_id = auth.uid())
    from (
      select * from public.vending_chat
       where id > coalesce(p_since, 0)
       order by id desc
       limit 60
    ) c
    join public.profiles p on p.id = c.user_id
   where auth.uid() is not null
   order by c.id;
$$;

-- The `id` OUT parameter shadows vending_chat.id inside the body, so the
-- prune aliases the table; without that every post failed as ambiguous.
create or replace function public.send_vending_chat(p_body text)
returns table (ok boolean, reason text, id bigint)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v_body  text := btrim(coalesce(p_body, ''));
  v_last  timestamptz;
  v_burst int;
  v_id    bigint;
begin
  if me is null then
    return query select false, 'not_signed_in', null::bigint; return;
  end if;
  if char_length(v_body) = 0 then
    return query select false, 'empty', null::bigint; return;
  end if;
  if char_length(v_body) > 240 then
    return query select false, 'too_long', null::bigint; return;
  end if;

  -- Two seconds between messages, and ten in any minute. Enough to hold a
  -- conversation, not enough to scroll the room away.
  select max(c.created_at) into v_last
    from public.vending_chat c where c.user_id = me;
  if v_last is not null and v_last > now() - interval '2 seconds' then
    return query select false, 'too_fast', null::bigint; return;
  end if;

  select count(*) into v_burst
    from public.vending_chat c
   where c.user_id = me and c.created_at > now() - interval '1 minute';
  if v_burst >= 10 then
    return query select false, 'slow_down', null::bigint; return;
  end if;

  insert into public.vending_chat (user_id, body)
  values (me, v_body)
  returning vending_chat.id into v_id;

  -- Keep the room from growing without bound. Cheap because it only ever
  -- looks past the newest 500 rows.
  delete from public.vending_chat c
   where c.id < (select min(k.id) from (
     select v.id from public.vending_chat v order by v.id desc limit 500
   ) k);

  return query select true, 'ok', v_id;
end $$;
