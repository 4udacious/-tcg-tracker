-- The battle game's daily caps (battle_packs_per_day, battle_tokens_per_day)
-- reset at local midnight.
--
-- battle_award_pack and battle_award_tokens (v58) counted "today" from
-- midnight UTC, which is 4-5pm in Seattle: a member's allowance came back in
-- the late afternoon, and a session that ran across 4-5pm got a second day's
-- worth. Everything else here keeps Seattle time: token periods
-- (current_token_period, v9) and the game's free daily heal (the device's
-- local day). battle_day_start() is the start of today in America/Los_Angeles,
-- and both awards now count from it. Nothing else about them changes.
--
-- Safe to re-run.

create or replace function public.battle_day_start()
returns timestamptz
language sql stable as $$
  select date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
$$;

create or replace function public.battle_award_pack(p_source text default null)
returns table(ok boolean, reason text, user_pack_id bigint, set_code text, set_name text, pack_name text, image_url text, left_today integer)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v_cap   int;
  v_used  int;
  v_set   text;
  v_pack  record;
  v_cycle bigint;
  v_id    bigint;
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', null::bigint, null::text, null::text, null::text, null::text, 0; return;
  end if;

  -- One award at a time per member, so two tabs can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  select battle_packs_per_day into v_cap from public.vending_settings where id;
  select count(*)::int into v_used from public.battle_awards a
   where a.user_id = me and a.kind = 'pack' and a.created_at >= public.battle_day_start();
  if v_used >= coalesce(v_cap, 0) then
    return query select false, 'daily_cap', null::bigint, null::text, null::text, null::text, null::text, 0; return;
  end if;

  -- A set with active art and inventory left (null total = unlimited), locked.
  select s.set_code into v_set
    from (select distinct vp.set_code from public.vending_packs vp where vp.is_active and vp.set_code is not null) s
    left join public.vending_set_info i on i.set_code = s.set_code
   where i.total_quantity is null or i.total_quantity - i.claimed_quantity > 0
   order by random() limit 1;
  if v_set is null then
    return query select false, 'no_inventory', null::bigint, null::text, null::text, null::text, null::text, v_cap - v_used; return;
  end if;
  update public.vending_set_info i
     set claimed_quantity = i.claimed_quantity + 1
   where i.set_code = v_set and i.total_quantity is not null
     and i.total_quantity - i.claimed_quantity > 0;

  select vp.id, vp.set_name, vp.pack_name, vp.image_url into v_pack
    from public.vending_packs vp where vp.set_code = v_set and vp.is_active order by random() limit 1;
  select st.cycle_no into v_cycle from public.vending_state st where st.id;

  insert into public.user_packs (user_id, pack_id, cycle_no)
  values (me, v_pack.id, coalesce(v_cycle, 0)) returning id into v_id;
  insert into public.battle_awards (user_id, kind, amount, user_pack_id, source)
  values (me, 'pack', 1, v_id, left(p_source, 40));

  return query select true, 'ok', v_id, v_set, v_pack.set_name, v_pack.pack_name, v_pack.image_url, v_cap - v_used - 1;
end $$;

create or replace function public.battle_award_tokens(p_amount numeric, p_source text default null)
returns table(ok boolean, reason text, awarded numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v_cap   numeric(12,2);
  v_used  numeric(12,2);
  v_pay   numeric(12,2);
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', 0::numeric, coalesce(public.token_balance(me), 0); return;
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 5 then
    return query select false, 'bad_amount', 0::numeric, public.token_balance(me); return;
  end if;

  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  select battle_tokens_per_day into v_cap from public.vending_settings where id;
  select coalesce(sum(a.amount), 0) into v_used from public.battle_awards a
   where a.user_id = me and a.kind = 'tokens' and a.created_at >= public.battle_day_start();
  v_pay := least(round(p_amount, 2), greatest(0, coalesce(v_cap, 0) - v_used));
  if v_pay <= 0 then
    return query select false, 'daily_cap', 0::numeric, public.token_balance(me); return;
  end if;

  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_pay, 'battle_reward', public.current_token_period(), left('Battle' || coalesce(' — ' || p_source, ''), 200), 'earned');
  insert into public.battle_awards (user_id, kind, amount, source) values (me, 'tokens', v_pay, left(p_source, 40));

  return query select true, 'ok', v_pay, public.token_balance(me);
end $$;

-- Only the award functions (security definer) call it.
revoke all on function public.battle_day_start() from public, anon, authenticated;
