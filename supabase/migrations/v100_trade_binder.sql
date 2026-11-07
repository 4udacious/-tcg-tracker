-- Trade binders: members put cards, sealed packs and sealed boxes in a
-- binder for others to browse, and propose trades for them: their own cards,
-- sealed product and tokens, for things in your binder (and tokens).
--
--   · A binder is a list of your items (trade_binder_items) and a short
--     "looking for" note. Only what's still yours and free shows: an item
--     that's listed on the Market, at the graders or the cleaners, opened or
--     sold drops out of view (and comes back if it's free again).
--   · An offer (trade_offers, trade_offer_items) names what the proposer gives
--     (side 'from') and what they want (side 'to'), plus tokens either way.
--     What they want must be in your binder, or, for a counter-offer, part of
--     the offer being countered.
--   · Nothing is held while an offer waits. When it's accepted, every item on
--     both sides is checked again (still owned, still free) and both token
--     balances; if anything is off the offer fails and nothing moves.
--     Otherwise the items change hands, leave both binders and any showcase,
--     and the tokens move (spent from the payer like a Market buy, paid into
--     the other's earned tokens). No fee.
--
-- Everything goes through the functions below (security definer); the
-- tables have no policies. Safe to re-run.

create table if not exists public.trade_binder_items (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_card_id bigint references public.user_cards(id) on delete cascade,
  user_pack_id bigint references public.user_packs(id) on delete cascade,
  user_box_id bigint references public.user_boxes(id) on delete cascade,
  added_at timestamptz not null default now(),
  check (num_nonnulls(user_card_id, user_pack_id, user_box_id) = 1)
);
create unique index if not exists trade_binder_items_card on public.trade_binder_items (user_card_id) where user_card_id is not null;
create unique index if not exists trade_binder_items_pack on public.trade_binder_items (user_pack_id) where user_pack_id is not null;
create unique index if not exists trade_binder_items_box on public.trade_binder_items (user_box_id) where user_box_id is not null;
create index if not exists trade_binder_items_user on public.trade_binder_items (user_id);
alter table public.trade_binder_items enable row level security;

create table if not exists public.trade_binder_notes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  updated_at timestamptz not null default now()
);
alter table public.trade_binder_notes enable row level security;

create table if not exists public.trade_offers (
  id bigint generated always as identity primary key,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  tokens_from numeric(12,2) not null default 0 check (tokens_from >= 0 and tokens_from <= 1000),
  tokens_to numeric(12,2) not null default 0 check (tokens_to >= 0 and tokens_to <= 1000),
  note text check (note is null or char_length(note) <= 200),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'countered', 'failed')),
  reason text,
  counter_of bigint references public.trade_offers(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  from_seen boolean not null default true,
  to_seen boolean not null default false,
  check (from_user <> to_user)
);
create index if not exists trade_offers_from on public.trade_offers (from_user, created_at desc);
create index if not exists trade_offers_to on public.trade_offers (to_user, created_at desc);
alter table public.trade_offers enable row level security;

create table if not exists public.trade_offer_items (
  id bigint generated always as identity primary key,
  offer_id bigint not null references public.trade_offers(id) on delete cascade,
  side text not null check (side in ('from', 'to')),
  user_card_id bigint references public.user_cards(id) on delete cascade,
  user_pack_id bigint references public.user_packs(id) on delete cascade,
  user_box_id bigint references public.user_boxes(id) on delete cascade,
  check (num_nonnulls(user_card_id, user_pack_id, user_box_id) = 1)
);
create index if not exists trade_offer_items_offer on public.trade_offer_items (offer_id);
alter table public.trade_offer_items enable row level security;

alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check check (reason = any (array[
  'monthly_grant', 'admin_adjustment', 'purchase', 'refund', 'timer_reward', 'timer_revoked', 'rebucket', 'grading',
  'market_buy', 'market_sale', 'bid_hold', 'bid_refund', 'interest_reward', 'cleaning', 'battle_reward', 'card_sale', 'trade']));

/* Is this item `p_owner`'s and free to trade? (Not listed, not at the graders or cleaners, not opened or sold.) */
create or replace function public.trade_card_free(p_id bigint, p_owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.user_cards c where c.id = p_id and c.user_id = p_owner and c.lcs_sold_at is null
    and c.market_listing_id is null and c.cleaning_started_at is null and (c.grading_started_at is null or c.graded_at is not null))
$function$;
create or replace function public.trade_pack_free(p_id bigint, p_owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.user_packs p where p.id = p_id and p.user_id = p_owner and p.opened_at is null and p.market_listing_id is null)
$function$;
create or replace function public.trade_box_free(p_id bigint, p_owner uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select exists (select 1 from public.user_boxes b where b.id = p_id and b.user_id = p_owner and b.opened_at is null and b.market_listing_id is null)
$function$;
revoke all on function public.trade_card_free(bigint, uuid), public.trade_pack_free(bigint, uuid), public.trade_box_free(bigint, uuid) from public, anon, authenticated;

/** One item as the trade screens show it: a card with its condition and grade, a sealed pack or a sealed box. */
create or replace function public.trade_item_json(p_card bigint, p_pack bigint, p_box bigint)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case
    when p_card is not null then (
      select jsonb_build_object('kind', 'card', 'id', c.id, 'card_id', v.id, 'name', v.name, 'set_code', v.set_code, 'number', v.number,
        'rarity', v.rarity, 'image_url', v.image_url, 'grade', case when c.graded_at is not null then c.grade end,
        'condition', jsonb_build_object('center_x', c.center_x, 'center_y', c.center_y, 'corners', c.corners, 'edges', c.edges,
          'surface', c.surface, 'border_wear', c.border_wear, 'wear_seed', c.wear_seed, 'crease', c.crease, 'holes', c.holes, 'rips', c.rips))
      from public.user_cards c join public.vending_cards v on v.id = c.card_id where c.id = p_card)
    when p_pack is not null then (
      select jsonb_build_object('kind', 'pack', 'id', p.id, 'name', vp.pack_name, 'set_name', vp.set_name, 'image_url', vp.image_url)
      from public.user_packs p join public.vending_packs vp on vp.id = p.pack_id where p.id = p_pack)
    else (
      select jsonb_build_object('kind', 'box', 'id', b.id, 'name', vb.name, 'set_code', vb.set_code, 'image_url', vb.image_url, 'packs', b.packs)
      from public.user_boxes b join public.vending_boxes vb on vb.id = b.box_id where b.id = p_box)
  end
$function$;
revoke all on function public.trade_item_json(bigint, bigint, bigint) from public, anon, authenticated;

/** A binder's items that are still its owner's and free, as trade_item_json. */
create or replace function public.trade_binder_free_items(p_user uuid)
returns setof jsonb language sql stable security definer set search_path to 'public' as $function$
  select public.trade_item_json(i.user_card_id, i.user_pack_id, i.user_box_id)
  from public.trade_binder_items i
  where i.user_id = p_user and (
    (i.user_card_id is not null and public.trade_card_free(i.user_card_id, p_user)) or
    (i.user_pack_id is not null and public.trade_pack_free(i.user_pack_id, p_user)) or
    (i.user_box_id is not null and public.trade_box_free(i.user_box_id, p_user)))
  order by i.added_at desc, i.id desc
$function$;
revoke all on function public.trade_binder_free_items(uuid) from public, anon, authenticated;

/** Put items in your binder (p_add) or take them out. Only your own free items go in. Returns how many changed. */
create or replace function public.trade_binder_set(p_card_ids bigint[], p_pack_ids bigint[], p_box_ids bigint[], p_add boolean)
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); n integer := 0; k integer;
begin
  if me is null or not public.is_member() then return 0; end if;
  if p_add then
    -- A row left by an item's last owner (it changed hands on the Market) would block it: clear those for what's yours now.
    delete from public.trade_binder_items where user_id <> me and (
      user_card_id in (select x from unnest(coalesce(p_card_ids, '{}')) x where public.trade_card_free(x, me)) or
      user_pack_id in (select x from unnest(coalesce(p_pack_ids, '{}')) x where public.trade_pack_free(x, me)) or
      user_box_id in (select x from unnest(coalesce(p_box_ids, '{}')) x where public.trade_box_free(x, me)));
    insert into public.trade_binder_items (user_id, user_card_id)
      select me, x from unnest(coalesce(p_card_ids, '{}')) x where public.trade_card_free(x, me) on conflict do nothing;
    get diagnostics k = row_count; n := n + k;
    insert into public.trade_binder_items (user_id, user_pack_id)
      select me, x from unnest(coalesce(p_pack_ids, '{}')) x where public.trade_pack_free(x, me) on conflict do nothing;
    get diagnostics k = row_count; n := n + k;
    insert into public.trade_binder_items (user_id, user_box_id)
      select me, x from unnest(coalesce(p_box_ids, '{}')) x where public.trade_box_free(x, me) on conflict do nothing;
    get diagnostics k = row_count; n := n + k;
  else
    delete from public.trade_binder_items where user_id = me and (user_card_id = any (coalesce(p_card_ids, '{}'))
      or user_pack_id = any (coalesce(p_pack_ids, '{}')) or user_box_id = any (coalesce(p_box_ids, '{}')));
    get diagnostics n = row_count;
  end if;
  -- A binder row whose item has changed hands since is no longer anyone's to offer.
  delete from public.trade_binder_items i where i.user_id = me and not (
    (i.user_card_id is not null and exists (select 1 from public.user_cards c where c.id = i.user_card_id and c.user_id = me and c.lcs_sold_at is null)) or
    (i.user_pack_id is not null and exists (select 1 from public.user_packs p where p.id = i.user_pack_id and p.user_id = me and p.opened_at is null)) or
    (i.user_box_id is not null and exists (select 1 from public.user_boxes b where b.id = i.user_box_id and b.user_id = me and b.opened_at is null)));
  return n;
end $function$;
revoke all on function public.trade_binder_set(bigint[], bigint[], bigint[], boolean) from public, anon;
grant execute on function public.trade_binder_set(bigint[], bigint[], bigint[], boolean) to authenticated;

/** Your binder's "looking for" note (empty clears it). */
create or replace function public.trade_binder_set_note(p_note text)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); v text := nullif(btrim(left(coalesce(p_note, ''), 200)), '');
begin
  if me is null or not public.is_member() then return; end if;
  insert into public.trade_binder_notes (user_id, note, updated_at) values (me, v, now())
  on conflict (user_id) do update set note = excluded.note, updated_at = now();
end $function$;
revoke all on function public.trade_binder_set_note(text) from public, anon;
grant execute on function public.trade_binder_set_note(text) to authenticated;

/** Every member with something in their binder: who, how many, their note and a few images, busiest first. */
create or replace function public.trade_binders()
returns table(user_id uuid, username text, display_name text, avatar_url text, note text, items integer, images text[], updated_at timestamptz)
language sql stable security definer set search_path to 'public' as $function$
  with b as (
    select i.user_id, array_agg(x->>'image_url') filter (where x->>'image_url' is not null) imgs, count(*)::int n
    from (select distinct user_id from public.trade_binder_items) i
    cross join lateral public.trade_binder_free_items(i.user_id) x
    group by i.user_id
  )
  select p.id, p.username, p.display_name, p.avatar_url, nt.note, b.n, b.imgs[1:4],
    greatest(nt.updated_at, (select max(added_at) from public.trade_binder_items t where t.user_id = p.id))
  from b join public.profiles p on p.id = b.user_id left join public.trade_binder_notes nt on nt.user_id = p.id
  where public.is_member()
  order by 8 desc nulls last
$function$;
revoke all on function public.trade_binders() from public, anon;
grant execute on function public.trade_binders() to authenticated;

/** One member's binder: their name, note and every free item in it. */
create or replace function public.trade_binder(p_user uuid)
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select case when public.is_member() then jsonb_build_object(
    'user_id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url,
    'note', (select note from public.trade_binder_notes where user_id = p.id),
    'items', coalesce((select jsonb_agg(x) from public.trade_binder_free_items(p.id) x), '[]'::jsonb))
  end
  from public.profiles p where p.id = p_user
$function$;
revoke all on function public.trade_binder(uuid) from public, anon;
grant execute on function public.trade_binder(uuid) to authenticated;

/**
 * Propose a trade to p_to: you give p_give_* and p_tokens_give, you get p_get_*
 * and p_tokens_get. What you give must be yours and free; what you get must
 * be in their binder, or part of the offer you're countering (p_counter_of,
 * which then closes as 'countered'). Both sides need something.
 */
create or replace function public.trade_propose(
  p_to uuid, p_give_cards bigint[], p_give_packs bigint[], p_give_boxes bigint[],
  p_get_cards bigint[], p_get_packs bigint[], p_get_boxes bigint[],
  p_tokens_give numeric, p_tokens_get numeric, p_note text default null, p_counter_of bigint default null)
returns table(ok boolean, reason text, offer_id bigint)
language plpgsql security definer set search_path to 'public' as $function$
#variable_conflict use_column
declare
  me uuid := auth.uid(); v_id bigint; o public.trade_offers;
  gc bigint[]; gp bigint[]; gb bigint[]; wc bigint[]; wp bigint[]; wb bigint[];
  tg numeric(12,2) := round(coalesce(p_tokens_give, 0), 2); tw numeric(12,2) := round(coalesce(p_tokens_get, 0), 2);
  n_give int; n_get int; x bigint;
begin
  if me is null or not public.is_member() then return query select false, 'not_allowed', null::bigint; return; end if;
  if p_to is null or p_to = me or coalesce(public.user_role(p_to)::text, '') not in ('contributor', 'member', 'mod', 'admin') then
    return query select false, 'bad_member', null::bigint; return;
  end if;
  select coalesce(array_agg(distinct v), '{}') into gc from unnest(coalesce(p_give_cards, '{}')) v;
  select coalesce(array_agg(distinct v), '{}') into gp from unnest(coalesce(p_give_packs, '{}')) v;
  select coalesce(array_agg(distinct v), '{}') into gb from unnest(coalesce(p_give_boxes, '{}')) v;
  select coalesce(array_agg(distinct v), '{}') into wc from unnest(coalesce(p_get_cards, '{}')) v;
  select coalesce(array_agg(distinct v), '{}') into wp from unnest(coalesce(p_get_packs, '{}')) v;
  select coalesce(array_agg(distinct v), '{}') into wb from unnest(coalesce(p_get_boxes, '{}')) v;
  n_give := cardinality(gc) + cardinality(gp) + cardinality(gb);
  n_get := cardinality(wc) + cardinality(wp) + cardinality(wb);
  if tg < 0 or tw < 0 or tg > 1000 or tw > 1000 then return query select false, 'bad_tokens', null::bigint; return; end if;
  if (n_give = 0 and tg = 0) or (n_get = 0 and tw = 0) then return query select false, 'one_sided', null::bigint; return; end if;
  if n_give > 25 or n_get > 25 then return query select false, 'too_many', null::bigint; return; end if;
  if (select count(*) from public.trade_offers where from_user = me and status = 'pending') >= 20 then
    return query select false, 'too_many_offers', null::bigint; return;
  end if;
  if char_length(coalesce(p_note, '')) > 200 then return query select false, 'bad_note', null::bigint; return; end if;
  if tg > public.token_balance(me) then return query select false, 'insufficient_tokens', null::bigint; return; end if;

  if p_counter_of is not null then
    select * into o from public.trade_offers where id = p_counter_of for update;
    if o.id is null or o.to_user <> me or o.from_user <> p_to or o.status <> 'pending' then
      return query select false, 'not_counterable', null::bigint; return;
    end if;
  end if;

  foreach x in array gc loop if not public.trade_card_free(x, me) then return query select false, 'bad_give', null::bigint; return; end if; end loop;
  foreach x in array gp loop if not public.trade_pack_free(x, me) then return query select false, 'bad_give', null::bigint; return; end if; end loop;
  foreach x in array gb loop if not public.trade_box_free(x, me) then return query select false, 'bad_give', null::bigint; return; end if; end loop;
  -- What you ask for: theirs and free, and in their binder or in the offer you're countering.
  foreach x in array wc loop
    if not public.trade_card_free(x, p_to) or not (exists (select 1 from public.trade_binder_items where user_id = p_to and user_card_id = x)
      or exists (select 1 from public.trade_offer_items where offer_id = o.id and side = 'from' and user_card_id = x)) then
      return query select false, 'bad_get', null::bigint; return; end if;
  end loop;
  foreach x in array wp loop
    if not public.trade_pack_free(x, p_to) or not (exists (select 1 from public.trade_binder_items where user_id = p_to and user_pack_id = x)
      or exists (select 1 from public.trade_offer_items where offer_id = o.id and side = 'from' and user_pack_id = x)) then
      return query select false, 'bad_get', null::bigint; return; end if;
  end loop;
  foreach x in array wb loop
    if not public.trade_box_free(x, p_to) or not (exists (select 1 from public.trade_binder_items where user_id = p_to and user_box_id = x)
      or exists (select 1 from public.trade_offer_items where offer_id = o.id and side = 'from' and user_box_id = x)) then
      return query select false, 'bad_get', null::bigint; return; end if;
  end loop;

  insert into public.trade_offers (from_user, to_user, tokens_from, tokens_to, note, counter_of)
  values (me, p_to, tg, tw, nullif(btrim(coalesce(p_note, '')), ''), o.id) returning id into v_id;
  insert into public.trade_offer_items (offer_id, side, user_card_id) select v_id, 'from', unnest(gc);
  insert into public.trade_offer_items (offer_id, side, user_pack_id) select v_id, 'from', unnest(gp);
  insert into public.trade_offer_items (offer_id, side, user_box_id) select v_id, 'from', unnest(gb);
  insert into public.trade_offer_items (offer_id, side, user_card_id) select v_id, 'to', unnest(wc);
  insert into public.trade_offer_items (offer_id, side, user_pack_id) select v_id, 'to', unnest(wp);
  insert into public.trade_offer_items (offer_id, side, user_box_id) select v_id, 'to', unnest(wb);
  if o.id is not null then
    update public.trade_offers set status = 'countered', resolved_at = now(), from_seen = false, to_seen = true where id = o.id;
  end if;
  return query select true, 'ok', v_id;
end $function$;
revoke all on function public.trade_propose(uuid, bigint[], bigint[], bigint[], bigint[], bigint[], bigint[], numeric, numeric, text, bigint) from public, anon;
grant execute on function public.trade_propose(uuid, bigint[], bigint[], bigint[], bigint[], bigint[], bigint[], numeric, numeric, text, bigint) to authenticated;

/**
 * Accept or decline an offer made to you. Accepting checks everything again
 * and swaps it all at once; if an item has gone or a balance is short, the
 * offer fails ('unavailable' or 'insufficient_tokens') and nothing moves.
 */
create or replace function public.trade_respond(p_offer bigint, p_accept boolean)
returns table(ok boolean, reason text, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
#variable_conflict use_column
declare me uuid := auth.uid(); o public.trade_offers; bad boolean;
begin
  select * into o from public.trade_offers where id = p_offer for update;
  if o.id is null or o.to_user is distinct from me then return query select false, 'not_yours', public.token_balance(me); return; end if;
  if o.status <> 'pending' then return query select false, 'not_pending', public.token_balance(me); return; end if;
  if not p_accept then
    update public.trade_offers set status = 'declined', resolved_at = now(), from_seen = false, to_seen = true where id = o.id;
    return query select true, 'declined', public.token_balance(me); return;
  end if;

  -- Both members' token rows and every item, locked in one order so two trades can't cross.
  perform pg_advisory_xact_lock(hashtext('trade:' || least(o.from_user, o.to_user)::text));
  perform pg_advisory_xact_lock(hashtext('trade:' || greatest(o.from_user, o.to_user)::text));
  perform 1 from public.user_cards c join public.trade_offer_items i on i.user_card_id = c.id where i.offer_id = o.id order by c.id for update of c;
  perform 1 from public.user_packs p join public.trade_offer_items i on i.user_pack_id = p.id where i.offer_id = o.id order by p.id for update of p;
  perform 1 from public.user_boxes b join public.trade_offer_items i on i.user_box_id = b.id where i.offer_id = o.id order by b.id for update of b;

  select exists (
    select 1 from public.trade_offer_items i
    where i.offer_id = o.id and not (
      (i.user_card_id is not null and public.trade_card_free(i.user_card_id, case i.side when 'from' then o.from_user else o.to_user end)) or
      (i.user_pack_id is not null and public.trade_pack_free(i.user_pack_id, case i.side when 'from' then o.from_user else o.to_user end)) or
      (i.user_box_id is not null and public.trade_box_free(i.user_box_id, case i.side when 'from' then o.from_user else o.to_user end)))
  ) into bad;
  if bad then
    update public.trade_offers set status = 'failed', reason = 'unavailable', resolved_at = now(), from_seen = false, to_seen = true where id = o.id;
    return query select false, 'unavailable', public.token_balance(me); return;
  end if;
  if public.token_balance(o.from_user) < o.tokens_from or public.token_balance(o.to_user) < o.tokens_to then
    update public.trade_offers set status = 'failed', reason = 'insufficient_tokens', resolved_at = now(), from_seen = false, to_seen = true where id = o.id;
    return query select false, 'insufficient_tokens', public.token_balance(me); return;
  end if;

  -- Off any showcase, out of both binders, then to their new owners.
  delete from public.showcase_slots s using public.trade_offer_items i
   where i.offer_id = o.id and (s.user_card_id = i.user_card_id or s.user_box_id = i.user_box_id);
  delete from public.trade_binder_items b using public.trade_offer_items i
   where i.offer_id = o.id and (b.user_card_id = i.user_card_id or b.user_pack_id = i.user_pack_id or b.user_box_id = i.user_box_id);
  update public.user_cards c set user_id = case i.side when 'from' then o.to_user else o.from_user end
    from public.trade_offer_items i where i.offer_id = o.id and c.id = i.user_card_id;
  update public.user_packs p set user_id = case i.side when 'from' then o.to_user else o.from_user end
    from public.trade_offer_items i where i.offer_id = o.id and p.id = i.user_pack_id;
  update public.user_boxes b set user_id = case i.side when 'from' then o.to_user else o.from_user end
    from public.trade_offer_items i where i.offer_id = o.id and b.id = i.user_box_id;

  if o.tokens_from > 0 then
    perform public.spend_tokens(o.from_user, o.tokens_from, 'trade', 'Trade #' || o.id);
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (o.to_user, o.tokens_from, 'trade', public.current_token_period(), 'Trade #' || o.id, 'earned');
  end if;
  if o.tokens_to > 0 then
    perform public.spend_tokens(o.to_user, o.tokens_to, 'trade', 'Trade #' || o.id);
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (o.from_user, o.tokens_to, 'trade', public.current_token_period(), 'Trade #' || o.id, 'earned');
  end if;

  update public.trade_offers set status = 'accepted', resolved_at = now(), from_seen = false, to_seen = true where id = o.id;
  return query select true, 'accepted', public.token_balance(me);
end $function$;
revoke all on function public.trade_respond(bigint, boolean) from public, anon;
grant execute on function public.trade_respond(bigint, boolean) to authenticated;

/** Withdraw an offer you made that's still waiting. */
create or replace function public.trade_cancel(p_offer bigint)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.trade_offers set status = 'cancelled', resolved_at = now(), to_seen = true
   where id = p_offer and from_user = auth.uid() and status = 'pending';
  return found;
end $function$;
revoke all on function public.trade_cancel(bigint) from public, anon;
grant execute on function public.trade_cancel(bigint) to authenticated;

/** Your offers, made and received, over the last 60 days (and any still waiting), each with both sides' items. */
create or replace function public.trade_offers_mine()
returns jsonb language sql stable security definer set search_path to 'public' as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'incoming', o.to_user = auth.uid(), 'status', o.status, 'reason', o.reason, 'note', o.note,
    'tokens_from', o.tokens_from, 'tokens_to', o.tokens_to, 'counter_of', o.counter_of,
    'created_at', o.created_at, 'resolved_at', o.resolved_at,
    'unseen', case when o.to_user = auth.uid() then not o.to_seen else not o.from_seen end,
    'other', jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url),
    'give', coalesce((select jsonb_agg(public.trade_item_json(i.user_card_id, i.user_pack_id, i.user_box_id) order by i.id)
      from public.trade_offer_items i where i.offer_id = o.id and i.side = 'from'), '[]'::jsonb),
    'get', coalesce((select jsonb_agg(public.trade_item_json(i.user_card_id, i.user_pack_id, i.user_box_id) order by i.id)
      from public.trade_offer_items i where i.offer_id = o.id and i.side = 'to'), '[]'::jsonb)
  ) order by (o.status = 'pending') desc, o.created_at desc), '[]'::jsonb)
  from public.trade_offers o
  join public.profiles p on p.id = case when o.to_user = auth.uid() then o.from_user else o.to_user end
  where (o.from_user = auth.uid() or o.to_user = auth.uid())
    and (o.status = 'pending' or o.created_at > now() - interval '60 days')
$function$;
revoke all on function public.trade_offers_mine() from public, anon;
grant execute on function public.trade_offers_mine() to authenticated;

/** How many of your offers need a look: new ones to you, and yours that were answered. */
create or replace function public.trade_unseen()
returns integer language sql stable security definer set search_path to 'public' as $function$
  select count(*)::int from public.trade_offers
  where (to_user = auth.uid() and not to_seen) or (from_user = auth.uid() and not from_seen)
$function$;
revoke all on function public.trade_unseen() from public, anon;
grant execute on function public.trade_unseen() to authenticated;

/** You've seen your offers: clear the badge. */
create or replace function public.trade_mark_seen()
returns void language sql security definer set search_path to 'public' as $function$
  update public.trade_offers set to_seen = true where to_user = auth.uid() and not to_seen;
  update public.trade_offers set from_seen = true where from_user = auth.uid() and not from_seen;
$function$;
revoke all on function public.trade_mark_seen() from public, anon;
grant execute on function public.trade_mark_seen() to authenticated;
