-- Selling battle supplies back to the VVM, for half what the shop charges.
--
-- Two limits, and an item sells only within both:
--
--  * What you bought. Every supply bought at the machine is counted in
--    vvm_supply_buys (since v86), a bundle as each of the items inside it.
--    You may sell back up to what you've bought of an item, less what's still
--    on your account (bought, but not yet collected into the game:
--    user_items) and less what you've already sold back (vvm_supply_sales,
--    below). So items the game gave you (the starting Bag, a Gym Leader's
--    Move Disc, battle drops) can't be turned into tokens, and nothing sells
--    twice.
--  * What's still in your Bag, as your account's save last had it
--    (game_saves, v60), less anything sold since that save. Bought and then
--    used up (thrown, drunk, evolved with) doesn't sell. The game saves just
--    before it sells, and again just after, without what it sold.
--
-- Only everyday items sell back: balls, potions, cures, revives, Rare
-- Candies, evolution items and Move Discs. Gym Summons, League tickets and
-- rematch tickets don't (they're progress, and a rematch ticket's win is
-- already paid out separately, v93).
--
-- The price is SELL_RATE (half) of the item's shop price today, rounded down
-- to the cent, paid into earned tokens (token_ledger reason 'refund'). Safe
-- to re-run.

create table if not exists public.vvm_supply_sales (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_key    text not null,
  qty         integer not null check (qty > 0),
  amount      numeric(12,2) not null check (amount >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists vvm_supply_sales_user_item on public.vvm_supply_sales (user_id, item_key);
alter table public.vvm_supply_sales enable row level security;
-- No policies: only the functions below (security definer) touch it.
revoke all on public.vvm_supply_sales from anon, authenticated;

/** The share of the shop price an item sells back for. */
create or replace function public.vvm_sell_rate()
returns numeric language sql immutable as $$ select 0.5::numeric $$;

/** What each supply is called in the game's Bag (BAG_OF in public/rpg/game.js); a Move Disc is any 'disc:NAME'. Only these sell back. */
create or replace function public.vvm_bag_key(p_key text)
returns text language sql immutable as $$
  select case when p_key = 'move_disc' then 'disc:' else jsonb_build_object(
    'potion', 'potion', 'super_potion', 'super', 'hyper_potion', 'hyper', 'revive', 'revive', 'max_revive', 'maxrevive',
    'poke_ball', 'ball', 'great_ball', 'great', 'ultra_ball', 'ultra', 'rare_candy', 'rarecandy', 'full_heal', 'fullheal',
    'thunder_stone', 'thunderstone', 'water_stone', 'waterstone', 'fire_stone', 'firestone', 'leaf_stone', 'leafstone',
    'ice_stone', 'icestone', 'moon_stone', 'moonstone', 'sun_stone', 'sunstone', 'dusk_stone', 'duskstone',
    'shiny_stone', 'shinystone', 'linking_cord', 'linkcable', 'dragon_scale', 'dragonscale') ->> p_key end
$$;

/** What each item sells back for now: half its shop price, rounded down to the cent (null: it doesn't sell back). */
create or replace function public.vvm_sell_price(p_key text)
returns numeric language sql stable security definer set search_path to 'public' as $$
  select (floor(s.token_price * public.vvm_sell_rate() * 100) / 100)::numeric(12,2)
    from public.vvm_supplies s
   where s.key = p_key and s.kind = 'item' and public.vvm_bag_key(p_key) is not null
$$;
revoke all on function public.vvm_sell_price(text) from public, anon, authenticated;

/** How many of an item the member's saved Bag holds, less what they've sold since that save. */
create or replace function public.vvm_saved_bag_qty(p_user uuid, p_key text)
returns integer language sql stable security definer set search_path to 'public' as $$
  select coalesce((
    select greatest(0,
      coalesce(case when p_key = 'move_disc'
        then (select sum(e.value::int) from jsonb_each_text(case when jsonb_typeof(g.data->'bag') = 'object' then g.data->'bag' else '{}'::jsonb end) e
               where e.key like 'disc:%' and e.value ~ '^[0-9]{1,6}$')
        else (select (g.data->'bag'->>public.vvm_bag_key(p_key))::int where (g.data->'bag'->>public.vvm_bag_key(p_key)) ~ '^[0-9]{1,6}$') end, 0)
      - coalesce((select sum(x.qty) from public.vvm_supply_sales x
                   where x.user_id = p_user and x.item_key = p_key and x.created_at >= g.updated_at), 0))::int
      from public.game_saves g where g.user_id = p_user), 0)
$$;
revoke all on function public.vvm_saved_bag_qty(uuid, text) from public, anon, authenticated;

/** How many of each item a member may sell back (bought, less still on the account, less sold; and no more than the saved Bag holds), and for how much each. */
create or replace function public.vvm_sellable_for(p_user uuid)
returns table (item_key text, qty integer, price numeric)
language sql stable security definer set search_path to 'public' as $$
  with bought as (
    -- On their own...
    select b.supply_key as k, sum(b.qty)::int as n
      from public.vvm_supply_buys b join public.vvm_supplies s on s.key = b.supply_key and s.kind = 'item'
     where b.user_id = p_user group by 1
    union all
    -- ...and inside bundles.
    select c.key, sum(b.qty * c.value::int)::int
      from public.vvm_supply_buys b join public.vvm_supplies s on s.key = b.supply_key and s.kind = 'bundle'
      cross join lateral jsonb_each_text(coalesce(s.contents, '{}'::jsonb)) c(key, value)
     where b.user_id = p_user group by 1
  ), totals as (select k, sum(n)::int as n from bought group by k)
  select t.k,
         least(public.vvm_saved_bag_qty(p_user, t.k), greatest(0, t.n
           - coalesce((select sum(u.qty) from public.user_items u where u.user_id = p_user and u.item_key = t.k), 0)
           - coalesce((select sum(x.qty) from public.vvm_supply_sales x where x.user_id = p_user and x.item_key = t.k), 0)))::int,
         public.vvm_sell_price(t.k)
    from totals t
   where public.vvm_sell_price(t.k) is not null
$$;
revoke all on function public.vvm_sellable_for(uuid) from public, anon, authenticated;

/** Yours: what you can sell back, and for how much each. */
create or replace function public.vvm_sellable()
returns table (item_key text, qty integer, price numeric)
language sql stable security definer set search_path to 'public' as $$
  select * from public.vvm_sellable_for(auth.uid()) where auth.uid() is not null and public.is_member()
$$;
revoke all on function public.vvm_sellable() from public, anon;
grant execute on function public.vvm_sellable() to authenticated;

/**
 * Sell items back: p_items is [{key, qty}] in supply keys ('ultra_ball',
 * 'move_disc'...). All or nothing: if any one is more than you may sell, none
 * is sold ('not_sellable', with that key). The tokens go into earned.
 */
create or replace function public.vvm_sell_items(p_items jsonb)
returns table (ok boolean, reason text, item_key text, amount numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
  it record;
  have record;
  total numeric(12,2) := 0;
  n_items int := 0;
  first_name text;
begin
  if me is null or not public.is_member() then
    return query select false, 'not_allowed', null::text, 0::numeric, null::numeric; return;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    return query select false, 'bad_request', null::text, 0::numeric, public.token_balance(me); return;
  end if;
  perform pg_advisory_xact_lock(hashtext('vvm_sell:' || me::text));

  for it in
    select x->>'key' as k, sum((x->>'qty')::int)::int as q
      from jsonb_array_elements(p_items) x
     where (x->>'qty') ~ '^[0-9]{1,4}$'
     group by 1
  loop
    if it.q is null or it.q <= 0 then continue; end if;
    select s.qty, s.price into have from public.vvm_sellable_for(me) s where s.item_key = it.k;
    if not found or have.price is null or have.qty < it.q then
      return query select false, 'not_sellable', it.k, 0::numeric, public.token_balance(me); return;
    end if;
    insert into public.vvm_supply_sales (user_id, item_key, qty, amount) values (me, it.k, it.q, have.price * it.q);
    total := total + have.price * it.q;
    n_items := n_items + it.q;
    if first_name is null then select s.name into first_name from public.vvm_supplies s where s.key = it.k; end if;
  end loop;

  if n_items = 0 then
    return query select false, 'bad_request', null::text, 0::numeric, public.token_balance(me); return;
  end if;
  if total > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (me, total, 'refund', public.current_token_period(),
            left('Sold back to the VVM: ' || case when n_items = 1 then coalesce(first_name, 'an item') else n_items || ' items' end, 200), 'earned');
  end if;
  return query select true, 'ok', null::text, total, public.token_balance(me);
end $function$;
revoke all on function public.vvm_sell_items(jsonb) from public, anon;
grant execute on function public.vvm_sell_items(jsonb) to authenticated;
