-- Notes for a member from the app itself (not the market), shown in the
-- header's bell until they open it. First use: an admin's token bonus.
--
-- Additive: a new table and a new function. The deployed app doesn't touch
-- either until the bell and the Give-a-bonus card that use them ship.

create table public.member_notices (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('bonus')),
  -- For a bonus: how many tokens, recorded on the notice so what they were
  -- told can't drift from the ledger later.
  amount      numeric(12,2),
  -- The admin's reason, if they gave one.
  message     text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);

create index member_notices_unread_idx
  on public.member_notices (user_id, created_at desc) where read_at is null;

alter table public.member_notices enable row level security;

create policy "read own member notices" on public.member_notices
  for select using (user_id = auth.uid());

-- Marking read is the only thing a member may change, and only on their own
-- rows. Notices are written by grant_token_bonus below.
create policy "mark own member notices read" on public.member_notices
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.member_notices from anon, authenticated;
grant select on public.member_notices to authenticated;
grant update (read_at) on public.member_notices to authenticated;

-- An admin's one-off token bonus to any number of members: for each, the
-- tokens (through adjust_tokens, so kept/earned and in the ledger with who gave
-- them and why) and a notice for their bell. All or nothing: one call, one
-- transaction, so a bonus to everyone can't half-happen.
create or replace function public.grant_token_bonus(p_targets uuid[], p_amount numeric, p_reason text default null)
returns int
language plpgsql security definer set search_path to 'public' as $$
declare
  v_user   uuid;
  v_reason text := nullif(btrim(p_reason), '');
  v_note   text;
  v_n      int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can give bonuses';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000 then
    raise exception 'A bonus is more than 0 and at most 1000 tokens';
  end if;
  if coalesce(array_length(p_targets, 1), 0) = 0 then
    raise exception 'Nobody to give the bonus to';
  end if;
  v_note := 'Bonus' || coalesce(' — ' || v_reason, '');

  for v_user in select distinct t from unnest(p_targets) as t loop
    perform public.adjust_tokens(v_user, p_amount, v_note);
    insert into public.member_notices (user_id, kind, amount, message, created_by)
    values (v_user, 'bonus', p_amount, v_reason, auth.uid());
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function public.grant_token_bonus(uuid[], numeric, text) from public, anon;
grant execute on function public.grant_token_bonus(uuid[], numeric, text) to authenticated;
