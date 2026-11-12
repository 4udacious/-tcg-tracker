-- Selling Bag items back to the VVM, for half what the shop charges.
--
-- Anything in the battle game's Bag sells back, bought or won in a battle,
-- except Gym Summons, League tickets, rematch tickets and the EXP. SHARE (a
-- key item). Keys are the game's own Bag keys ('ultra', 'fullheal',
-- 'disc:FLASH'...).
--
-- What you can sell is what's in your Bag as your account's save last had it
-- (game_saves, v60), less anything sold since that save. The game saves just
-- before it sells, and again just after, without what it sold.
--
-- The save is written by the game, so the server can't fully vouch for it.
-- To keep a doctored save from turning into tokens without end, sell-backs
-- pay at most vending_settings.sell_back_per_day (5.00 by default) per member
-- per day (Seattle's day: battle_day_start, v86). Admins change it with:
--   update public.vending_settings set sell_back_per_day = 8 where id;
--
-- Price: half (vvm_sell_rate) the item's shop price today (vvm_supplies),
-- rounded down to the cent; any Move Disc goes by the Move Disc's price. A
-- status cure the machine doesn't stock goes by the game's own price for it
-- (Antidote 0.15, Paralyze/Burn/Ice Heal 0.20). Paid into earned tokens
-- (token_ledger reason 'refund'). Safe to re-run.

alter table public.vending_settings
  add column if not exists sell_back_per_day numeric(12,2) not null default 5 check (sell_back_per_day >= 0);
comment on column public.vending_settings.sell_back_per_day is
  'The most a member is paid per day (Seattle) for selling battle-game Bag items back to the VVM (v103).';

create table if not exists public.vvm_supply_sales (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_key    text not null,   -- the game's Bag key
  qty         integer not null check (qty > 0),
  amount      numeric(12,2) not null check (amount >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists vvm_supply_sales_user_item on public.vvm_supply_sales (user_id, item_key);
create index if not exists vvm_supply_sales_user_at on public.vvm_supply_sales (user_id, created_at);
alter table public.vvm_supply_sales enable row level security;
-- No policies: only the functions below (security definer) touch it.
revoke all on public.vvm_supply_sales from anon, authenticated;

/** The share of the shop price an item sells back for. */
create or replace function public.vvm_sell_rate()
returns numeric language sql immutable as $$ select 0.5::numeric $$;

/**
 * What one of a Bag item sells back for now (null: it doesn't sell back).
 * The catalog supply each Bag key is bought as mirrors BAG_OF in public/rpg/game.js.
 */
create or replace function public.vvm_sell_price(p_bag_key text)
returns numeric language sql stable security definer set search_path to 'public' as $$
  with k as (
    select case
      when p_bag_key like 'disc:%' then 'move_disc'
      else (select e.key from jsonb_each_text(jsonb_build_object(
        'potion', 'potion', 'super_potion', 'super', 'hyper_potion', 'hyper', 'revive', 'revive', 'max_revive', 'maxrevive',
        'poke_ball', 'ball', 'great_ball', 'great', 'ultra_ball', 'ultra', 'rare_candy', 'rarecandy', 'full_heal', 'fullheal',
        'thunder_stone', 'thunderstone', 'water_stone', 'waterstone', 'fire_stone', 'firestone', 'leaf_stone', 'leafstone',
        'ice_stone', 'icestone', 'moon_stone', 'moonstone', 'sun_stone', 'sunstone', 'dusk_stone', 'duskstone',
        'shiny_stone', 'shinystone', 'linking_cord', 'linkcable', 'dragon_scale', 'dragonscale')) e where e.value = p_bag_key)
    end as supply
  ), base as (
    select coalesce(
      (select s.token_price from public.vvm_supplies s, k where s.key = k.supply and s.kind = 'item'),
      (jsonb_build_object('antidote', 0.15, 'parlyz', 0.20, 'burnheal', 0.20, 'iceheal', 0.20) ->> p_bag_key)::numeric) as price
  )
  select (floor(b.price * public.vvm_sell_rate() * 100) / 100)::numeric(12,2) from base b
   where b.price is not null
     and p_bag_key not like 'summon:%' and p_bag_key not like 'rematch:%' and p_bag_key not in ('summon', 'elite', 'expshare', 'disc')
$$;
revoke all on function public.vvm_sell_price(text) from public, anon, authenticated;

/** What a member has been paid for sell-backs today, and what they may still be paid. */
create or replace function public.vvm_sell_left_today(p_user uuid)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select greatest(0, coalesce((select sell_back_per_day from public.vending_settings where id), 5)
    - coalesce((select sum(x.amount) from public.vvm_supply_sales x where x.user_id = p_user and x.created_at >= public.battle_day_start()), 0))::numeric(12,2)
$$;
revoke all on function public.vvm_sell_left_today(uuid) from public, anon, authenticated;

/** Each Bag item a member may sell back: how many (in the saved Bag, less sold since that save) and what each pays. */
create or replace function public.vvm_sellable_for(p_user uuid)
returns table (item_key text, qty integer, price numeric)
language sql stable security definer set search_path to 'public' as $$
  select e.key,
         greatest(0, e.value::int - coalesce((select sum(x.qty) from public.vvm_supply_sales x
                    where x.user_id = p_user and x.item_key = e.key and x.created_at >= g.updated_at), 0))::int,
         public.vvm_sell_price(e.key)
    from public.game_saves g
   cross join lateral jsonb_each_text(case when jsonb_typeof(g.data->'bag') = 'object' then g.data->'bag' else '{}'::jsonb end) e
   where g.user_id = p_user and e.value ~ '^[0-9]{1,6}$' and public.vvm_sell_price(e.key) is not null
$$;
revoke all on function public.vvm_sellable_for(uuid) from public, anon, authenticated;

/** Yours: what you can sell back and what each pays, and (on every row) what today's sales may still pay. */
create or replace function public.vvm_sellable()
returns table (item_key text, qty integer, price numeric, left_today numeric)
language sql stable security definer set search_path to 'public' as $$
  select s.item_key, s.qty, s.price, public.vvm_sell_left_today(auth.uid())
    from public.vvm_sellable_for(auth.uid()) s
   where auth.uid() is not null and public.is_member()
$$;
revoke all on function public.vvm_sellable() from public, anon;
grant execute on function public.vvm_sellable() to authenticated;

/**
 * Sell items back: p_items is [{key, qty}] in Bag keys. All or nothing: if
 * any one is more than you have, none is sold ('not_sellable', with that
 * key); if the lot would pay more than today's cap allows, 'daily_cap'. The
 * tokens go into earned.
 */
create or replace function public.vvm_sell_items(p_items jsonb)
returns table (ok boolean, reason text, item_key text, amount numeric, balance numeric, left_today numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
  it record;
  have record;
  total numeric(12,2) := 0;
  n_items int := 0;
  v_left numeric(12,2);
  v_keys text[] := '{}'; v_qtys int[] := '{}'; v_prices numeric[] := '{}';
begin
  if me is null or not public.is_member() then
    return query select false, 'not_allowed', null::text, 0::numeric, null::numeric, 0::numeric; return;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    return query select false, 'bad_request', null::text, 0::numeric, public.token_balance(me), public.vvm_sell_left_today(me); return;
  end if;
  perform pg_advisory_xact_lock(hashtext('vvm_sell:' || me::text));
  v_left := public.vvm_sell_left_today(me);

  -- Every item checked first; nothing is recorded unless the whole lot can be sold.
  for it in
    select x->>'key' as k, sum((x->>'qty')::int)::int as q
      from jsonb_array_elements(p_items) x
     where (x->>'qty') ~ '^[0-9]{1,4}$' and x->>'key' is not null
     group by 1
  loop
    if it.q is null or it.q <= 0 then continue; end if;
    select s.qty, s.price into have from public.vvm_sellable_for(me) s where s.item_key = it.k;
    if not found or have.price is null or have.qty < it.q then
      return query select false, 'not_sellable', it.k, 0::numeric, public.token_balance(me), v_left; return;
    end if;
    total := total + have.price * it.q;
    n_items := n_items + it.q;
    v_keys := v_keys || it.k; v_qtys := v_qtys || it.q; v_prices := v_prices || have.price;
  end loop;
  if total > v_left then
    return query select false, 'daily_cap', null::text, 0::numeric, public.token_balance(me), v_left; return;
  end if;
  for i in 1 .. coalesce(array_length(v_keys, 1), 0) loop
    insert into public.vvm_supply_sales (user_id, item_key, qty, amount) values (me, v_keys[i], v_qtys[i], v_prices[i] * v_qtys[i]);
  end loop;

  if n_items = 0 then
    return query select false, 'bad_request', null::text, 0::numeric, public.token_balance(me), v_left; return;
  end if;
  if total > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (me, total, 'refund', public.current_token_period(),
            'Sold back to the VVM: ' || n_items || case when n_items = 1 then ' item' else ' items' end, 'earned');
  end if;
  return query select true, 'ok', null::text, total, public.token_balance(me), (v_left - total)::numeric(12,2);
end $function$;
revoke all on function public.vvm_sell_items(jsonb) from public, anon;
grant execute on function public.vvm_sell_items(jsonb) to authenticated;

-- An earlier draft of v103 (never applied) had these; nothing uses them.
drop function if exists public.vvm_bag_key(text);
drop function if exists public.vvm_saved_bag_qty(uuid, text);
