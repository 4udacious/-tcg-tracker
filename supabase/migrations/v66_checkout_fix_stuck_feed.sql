-- 1. A checkout fix. When a set in the cart had no active wrapper, the
--    checkout returned "no_art_for_set" partway through granting: packs from
--    the sets before it in the cart were already in the member's collection,
--    stock and claimed counts already moved, and no tokens were spent. The
--    wrapper check now runs with the other checks, before anything is
--    written, and the one left in the granting loop raises instead (undoing
--    everything) for a wrapper switched off between the two.
--
-- 2. Stuck packs in the Recent buys feed. vending_recent_buys gains a
--    `kind`: 'buy' as before, 'jammed' when a pack jams on someone (v65), and
--    'freed' when a stuck pack drops for someone else. A freed pack is no
--    longer counted into that buyer's own purchase line.

create or replace function public.vending_checkout(p_items jsonb, p_tickets jsonb default '[]'::jsonb, p_supplies jsonb default '[]'::jsonb, p_boxes jsonb default '[]'::jsonb)
returns table (ok boolean, reason text, packs_bought integer, spent numeric, balance numeric, restocked boolean, tickets_bought integer, supplies_bought integer, boxes_bought integer,
               packs_stuck integer, packs_freed integer)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me           uuid := auth.uid();
  se           public.vending_session;
  v_cycle      bigint;
  v_packs      int := 0;
  v_tickets    int := 0;
  v_supplies   int := 0;
  v_boxes      int := 0;
  v_cost       numeric(12,2) := 0;
  v_balance    numeric(12,2);
  v_cooldown   numeric;
  v_restocked  boolean := false;
  it           record;
  v_have       int;
  v_arts       bigint[];
  v_price      numeric(12,2);
  v_remaining  int;
  v_limit      int;
  v_owned      int;
  v_note       text;
  v_set_total  int;
  v_set_left   int;
  v_kind       text;
  v_contents   jsonb;
  v_box        public.vending_boxes;
  v_jam_odds   integer;
  v_free_pct   numeric;
  v_stuck      int := 0;
  v_freed      int := 0;
  v_stuck_id   bigint;
  v_jam_here   boolean;
begin
  perform 1 from public.vending_state where id for update;
  select * into se from public.vending_session where id for update;

  if se.holder_id is null or se.holder_id <> me or se.expires_at <= now() then
    return query select false, 'not_holder', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
  end if;
  v_cycle := se.cycle_no;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.set_code is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;
    select quantity into v_have from public.vending_stock
      where cycle_no = v_cycle and set_code = it.set_code for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    -- Lifetime inventory for the set, locked so two buyers can't both pass.
    select i.total_quantity, (i.total_quantity - i.claimed_quantity)
      into v_set_total, v_set_left
      from public.vending_set_info i
     where i.set_code = it.set_code for update;
    if v_set_total is not null and coalesce(v_set_left, 0) < it.qty then
      return query select false, 'set_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    -- A set needs a wrapper to hand out. Checked here, before anything is
    -- written: a return further down would keep the packs already granted.
    if not exists (select 1 from public.vending_packs vp where vp.set_code = it.set_code and vp.is_active) then
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    v_packs := v_packs + it.qty;
    v_cost  := v_cost + it.qty;
  end loop;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.ticket_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_ticket_stock s
      where s.cycle_no = v_cycle and s.ticket_id = it.ticket_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    select t.token_price, (t.total_quantity - t.claimed_quantity), t.per_user_limit
      into v_price, v_remaining, v_limit
      from public.raffle_tickets t
     where t.id = it.ticket_id and t.is_active
       and (t.starts_at is null or now() >= t.starts_at)
       and (t.ends_at   is null or now() <  t.ends_at)
     for update;

    if v_price is null then
      return query select false, 'ticket_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;
    if v_remaining < it.qty then
      return query select false, 'ticket_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    if v_limit is not null then
      select count(*)::int into v_owned
        from public.user_raffle_tickets u
       where u.ticket_id = it.ticket_id and u.user_id = me;
      if v_owned + it.qty > v_limit then
        return query select false, 'ticket_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
      end if;
    end if;

    v_tickets := v_tickets + it.qty;
    v_cost    := v_cost + (it.qty * v_price);
  end loop;

  -- Supplies: on the shelf this cycle, still switched on, and (for a
  -- bundle) still made of real items. The price is read here, under a
  -- share lock, so an admin edit cannot land between charging and granting.
  for it in select (e->>'key')::text as key, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_supplies, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.qty > 20 or it.key is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    if not exists (select 1 from public.vvm_supply_stock st
                    where st.cycle_no = v_cycle and st.supply_key = it.key) then
      return query select false, 'supply_not_stocked', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    select s.token_price, s.kind, s.contents
      into v_price, v_kind, v_contents
      from public.vvm_supplies s
     where s.key = it.key and s.is_active
     for share;

    if v_price is null then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;
    if v_kind = 'bundle' and exists (
         select 1 from jsonb_each(v_contents) c
          where not exists (select 1 from public.vvm_supplies i
                             where i.key = c.key and i.kind = 'item')) then
      return query select false, 'supply_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    v_supplies := v_supplies + it.qty;
    v_cost     := v_cost + (it.qty * v_price);
  end loop;

  -- Boxes: on the shelf this cycle, some left, and within your limit. The
  -- box row is locked so two buyers can't both take the last one.
  for it in select (e->>'box_id')::bigint as box_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_boxes, '[]'::jsonb)) e loop
    if it.qty is null or it.qty <= 0 or it.box_id is null then
      return query select false, 'bad_request', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    select s.quantity into v_have from public.vending_box_stock s
      where s.cycle_no = v_cycle and s.box_id = it.box_id for update;
    if v_have is null or v_have < it.qty then
      return query select false, 'insufficient_stock', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    select * into v_box from public.vending_boxes b where b.id = it.box_id and b.is_active for update;
    if v_box.id is null then
      return query select false, 'box_unavailable', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;
    if v_box.total_quantity - v_box.claimed_quantity < it.qty then
      return query select false, 'box_sold_out', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;
    if v_box.per_user_limit is not null then
      select count(*)::int into v_owned from public.user_vending_boxes u
       where u.box_id = it.box_id and u.user_id = me and u.bought_at >= v_box.restocked_at;
      if v_owned + it.qty > v_box.per_user_limit then
        return query select false, 'box_limit_reached', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
      end if;
    end if;
    if not exists (select 1 from public.vending_packs vp where vp.set_code = v_box.set_code and vp.is_active) then
      return query select false, 'no_art_for_set', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
    end if;

    v_boxes := v_boxes + it.qty;
    v_cost  := v_cost + (it.qty * v_box.token_price);
  end loop;

  if v_packs + v_tickets + v_supplies + v_boxes = 0 then
    return query select false, 'empty_cart', 0, 0::numeric, public.token_balance(me), false, 0, 0, 0, 0, 0; return;
  end if;

  v_balance := public.token_balance(me);
  if v_balance < v_cost then
    return query select false, 'insufficient_tokens', 0, 0::numeric, v_balance, false, 0, 0, 0, 0, 0; return;
  end if;

  select coalesce(s.pack_jam_odds, 50), coalesce(s.stuck_pack_free_percent, 50)
    into v_jam_odds, v_free_pct
    from public.vending_settings s where s.id;

  for it in select (e->>'set_code')::text as set_code, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e loop
    update public.vending_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and set_code = it.set_code;

    update public.vending_set_info
       set claimed_quantity = claimed_quantity + it.qty
     where set_code = it.set_code and total_quantity is not null;

    select array_agg(vp.id) into v_arts
      from public.vending_packs vp
     where vp.set_code = it.set_code and vp.is_active;

    -- Checked up front; if a wrapper was switched off since, undo the lot.
    if v_arts is null or array_length(v_arts, 1) is null then
      raise exception 'no_art_for_set';
    end if;

    -- Now and then the machine jams on one pack: paid for, but it never
    -- drops. It stays in the machine (vending_stuck_packs) until it falls
    -- out for someone else. At most one per checkout.
    v_jam_here := v_stuck = 0 and random() < 1.0 / greatest(v_jam_odds, 1);
    if v_jam_here then
      insert into public.vending_stuck_packs (pack_id, set_code, stuck_by, cycle_no)
      values (v_arts[1 + floor(random() * array_length(v_arts, 1))::int], it.set_code, me, v_cycle);
      v_stuck := 1;
    end if;

    insert into public.user_packs (user_id, pack_id, cycle_no)
    select me, v_arts[1 + floor(random() * array_length(v_arts, 1))::int], v_cycle
      from generate_series(1, it.qty - case when v_jam_here then 1 else 0 end);
  end loop;

  -- Someone else's stuck pack, the oldest, may fall out with yours: free,
  -- on top of what you paid for. Only on a checkout with packs in it.
  if v_packs > 0 and random() * 100 < v_free_pct then
    select sp.id into v_stuck_id
      from public.vending_stuck_packs sp
     where sp.freed_at is null and sp.stuck_by <> me
     order by sp.stuck_at
     limit 1
     for update skip locked;
    if v_stuck_id is not null then
      with p as (
        insert into public.user_packs (user_id, pack_id, cycle_no)
        select me, sp.pack_id, v_cycle from public.vending_stuck_packs sp where sp.id = v_stuck_id
        returning id
      )
      update public.vending_stuck_packs sp
         set freed_to = me, freed_at = now(), user_pack_id = (select id from p)
       where sp.id = v_stuck_id;
      v_freed := 1;
    end if;
  end if;

  for it in select (e->>'ticket_id')::bigint as ticket_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_tickets, '[]'::jsonb)) e loop
    update public.vending_ticket_stock
       set quantity = quantity - it.qty
     where cycle_no = v_cycle and ticket_id = it.ticket_id;

    update public.raffle_tickets
       set claimed_quantity = claimed_quantity + it.qty
     where id = it.ticket_id;

    insert into public.user_raffle_tickets (user_id, ticket_id, cycle_no)
    select me, it.ticket_id, v_cycle from generate_series(1, it.qty);
  end loop;

  -- Items straight in, bundles opened into their items. One upsert for the
  -- lot, summed per item first, because an upsert cannot touch the same row
  -- twice in one statement (a Potion bought alone and in a bundle would).
  if v_supplies > 0 then
    insert into public.user_items as u (user_id, item_key, qty)
    select me, g.item_key, sum(g.qty)::int
      from (
        select s.key as item_key, l.qty
          from jsonb_to_recordset(coalesce(p_supplies, '[]'::jsonb)) as l(key text, qty int)
          join public.vvm_supplies s on s.key = l.key and s.kind = 'item'
        union all
        select c.key, l.qty * (c.value)::int
          from jsonb_to_recordset(coalesce(p_supplies, '[]'::jsonb)) as l(key text, qty int)
          join public.vvm_supplies b on b.key = l.key and b.kind = 'bundle'
          cross join lateral jsonb_each(b.contents) c
      ) g
     group by g.item_key
    on conflict (user_id, item_key) do update
      set qty = u.qty + excluded.qty, updated_at = now();
  end if;

  -- Boxes, sealed: the purchase (for the limit) and the box itself, opened later (open_box).
  for it in select (e->>'box_id')::bigint as box_id, (e->>'qty')::int as qty
              from jsonb_array_elements(coalesce(p_boxes, '[]'::jsonb)) e loop
    select * into v_box from public.vending_boxes b where b.id = it.box_id;
    update public.vending_box_stock set quantity = quantity - it.qty where cycle_no = v_cycle and box_id = it.box_id;
    update public.vending_boxes set claimed_quantity = claimed_quantity + it.qty where id = it.box_id;
    insert into public.user_vending_boxes (user_id, box_id, cycle_no)
    select me, it.box_id, v_cycle from generate_series(1, it.qty);
    insert into public.user_boxes (user_id, box_id, packs, cycle_no)
    select me, it.box_id, v_box.packs, v_cycle from generate_series(1, it.qty);
  end loop;

  v_note := array_to_string(array_remove(array[
    case when v_boxes > 0
         then v_boxes || ' booster box' || case when v_boxes = 1 then '' else 'es' end end,
    case when v_packs > 0
         then v_packs || ' pack' || case when v_packs = 1 then '' else 's' end
              || case when v_stuck > 0 then ' (1 jammed in the machine)' else '' end end,
    case when v_tickets > 0
         then v_tickets || ' raffle ticket' || case when v_tickets = 1 then '' else 's' end end,
    case when v_supplies > 0
         then v_supplies || ' battle suppl' || case when v_supplies = 1 then 'y' else 'ies' end end
  ], null), ', ');

  perform public.spend_tokens(me, v_cost, 'purchase', v_note);

  -- The cooldown and the restock roll are about packs and tickets (a box is
  -- packs). A supplies-only checkout skips both.
  if v_packs + v_tickets + v_boxes > 0 then
    select cooldown_hours into v_cooldown from public.vending_settings where id;
    update public.profiles
       set vending_cooldown_until = now() + make_interval(hours => floor(v_cooldown)::int,
                                                          mins  => ((v_cooldown - floor(v_cooldown)) * 60)::int)
     where id = me;

    v_restocked := public.maybe_restock(v_cycle);
  end if;

  perform public.vending_release();

  return query select true, 'ok', v_packs, v_cost, public.token_balance(me), v_restocked, v_tickets, v_supplies, v_boxes, v_stuck, v_freed;
end $function$;

revoke execute on function public.vending_checkout(jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.vending_checkout(jsonb, jsonb, jsonb, jsonb) to authenticated;

drop function if exists public.vending_recent_buys(integer);
create function public.vending_recent_buys(p_limit integer default 6)
returns table (buyer text, icon_file text, packs integer, sets text, bought_at timestamp with time zone, kind text)
language sql stable security definer set search_path to 'public' as $function$
  select coalesce(p.display_name, p.username)::text, ti.file::text, x.packs, x.sets, x.at, x.kind
    from (
      select up.user_id, count(*)::int as packs, string_agg(distinct vp.set_name, ', ')::text as sets, up.acquired_at as at, 'buy'::text as kind
        from public.user_packs up
        join public.vending_packs vp on vp.id = up.pack_id
       where not exists (select 1 from public.vending_stuck_packs sp where sp.user_pack_id = up.id)
       group by up.user_id, up.acquired_at
      union all
      -- A box from the machine (its purchase, so a box resold later still shows): its packs, named by the box.
      select v.user_id, sum(b.packs)::int, string_agg(distinct b.name, ', ')::text, v.bought_at, 'buy'
        from public.user_vending_boxes v
        join public.vending_boxes b on b.id = v.box_id
       group by v.user_id, v.bought_at
      union all
      -- A pack that jammed on someone, and the one that dropped for someone else later.
      select sp.stuck_by, 1, vp.set_name::text, sp.stuck_at, 'jammed'
        from public.vending_stuck_packs sp join public.vending_packs vp on vp.id = sp.pack_id
      union all
      select sp.freed_to, 1, vp.set_name::text, sp.freed_at, 'freed'
        from public.vending_stuck_packs sp join public.vending_packs vp on vp.id = sp.pack_id
       where sp.freed_at is not null and sp.freed_to is not null
    ) x
    join public.profiles p on p.id = x.user_id
    left join public.trainer_icons ti on ti.id = p.trainer_icon_id
   order by x.at desc, x.kind
   limit greatest(1, least(p_limit, 20));
$function$;
revoke execute on function public.vending_recent_buys(integer) from public, anon;
grant execute on function public.vending_recent_buys(integer) to authenticated;
