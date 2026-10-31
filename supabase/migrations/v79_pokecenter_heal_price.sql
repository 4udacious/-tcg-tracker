-- The battle game's Pokémon Center: 3 free heals a day, then each heal costs
-- tokens.
--
-- The free heals are counted in the game's save (as the one free heal a day
-- was). A heal after them is paid here, from the member's tokens, at the
-- admin's price:
--
--   vending_settings.battle_heal_price  what one paid heal costs (default 0.50)
--   battle_modes()                      also returns heal_price, so the game
--                                       shows the price before you pay
--   battle_buy_heal()                   takes the price from your tokens
--                                       (allowance first, then earned, as any
--                                       purchase), or says why not
--   set_battle_heal_price(price)        admins: change the price
--
-- The charge is a 'purchase' in the token ledger, noted "Pokémon Center heal".
--
-- Safe to re-run.

alter table public.vending_settings
  add column if not exists battle_heal_price numeric(12,2) not null default 0.50
    check (battle_heal_price >= 0 and battle_heal_price <= 10);

comment on column public.vending_settings.battle_heal_price is
  'Tokens for a Pokémon Center heal in the battle game, after the 3 free ones a day.';

-- battle_modes gains a column, so it is dropped and made again (same access).
drop function if exists public.battle_modes();
create function public.battle_modes()
returns table (wild boolean, trainers boolean, heal_price numeric)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.is_admin() or s.wild_live, false),
         coalesce(public.is_admin() or s.battle_rewards_open, false),
         s.battle_heal_price
    from public.vending_settings s
   where s.id and auth.uid() is not null and public.is_member()
$$;

create or replace function public.battle_buy_heal()
returns table (ok boolean, reason text, price numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $$
declare
  me      uuid := auth.uid();
  v_price numeric(12,2);
begin
  if me is null or not public.is_member() then
    return query select false, 'not_allowed', 0::numeric, 0::numeric; return;
  end if;
  select s.battle_heal_price into v_price from public.vending_settings s where s.id;
  v_price := coalesce(v_price, 0.50);

  -- One payment at a time per member, so two taps can't both pass the balance check.
  perform pg_advisory_xact_lock(hashtext('battle_heal:' || me::text));
  if public.token_balance(me) < v_price then
    return query select false, 'insufficient_tokens', v_price, public.token_balance(me); return;
  end if;
  perform public.spend_tokens(me, v_price, 'purchase', 'Pokémon Center heal');
  return query select true, 'ok', v_price, public.token_balance(me);
end $$;

create or replace function public.set_battle_heal_price(p_price numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the heal price';
  end if;
  if p_price is null or p_price < 0 or p_price > 10 then
    raise exception 'The heal price must be between 0 and 10 tokens' using errcode = '22023';
  end if;
  update public.vending_settings set battle_heal_price = round(p_price, 2), updated_at = now(), updated_by = auth.uid() where id;
  return round(p_price, 2);
end $$;

revoke execute on function public.battle_modes() from public, anon;
revoke execute on function public.battle_buy_heal() from public, anon;
revoke execute on function public.set_battle_heal_price(numeric) from public, anon;
grant execute on function public.battle_modes() to authenticated;
grant execute on function public.battle_buy_heal() to authenticated;
grant execute on function public.set_battle_heal_price(numeric) to authenticated;
