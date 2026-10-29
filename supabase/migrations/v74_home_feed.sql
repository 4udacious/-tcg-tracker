-- The home feed: what the community has been up to, newest first.
--
-- home_feed(before, limit) unions the app's activity into one shape, one row
-- per item:
--   timer     "Got it" timer reports, rolled up per machine per 2 hours
--             ("Safeway · Tacoma · at :07 · 3 hits, :05–:12")
--   pull      holo and secret rares pulled from VVM packs (a god pack is one
--             item, not eleven)
--   grade     cards back from grading at 9 or 10
--   listing   new market listings;  sale  market sales
--   badge     achievements earned
--   interest  per set, the top products 3+ members want, when someone new
--             adds one ("UPC (Umbreon) ×8 · Booster Bundle ×7 · +5 more"); and the
--             start of each interest-check fortnight
--   member    newly approved members
--   comment   machine comments
--   showcase  cards and boxes put on a showcase
-- Each row has an actor (null for community items), a short title and detail,
-- an image, a link, whether it's a big moment (secret rare, god pack, a 10),
-- whether it's on one of the caller's favourite machines, and its reactions.
--
-- home_highlights() is the strip at the top: auctions ending within 2 hours,
-- machines with a hit in the last hour (favourite machines first), and secret
-- rares and god packs from the last day.
--
-- feed_reactions holds 🔥 and 👍 reactions, keyed by the item's ref.
-- profiles.show_in_feed (default on) lets a member keep their activity out of
-- the feed; their items are left out, though they still count towards
-- anonymous totals like "5 members want…".
--
-- set_show_in_feed(on) saves that choice (Settings → Home feed).
--
-- Pending members get nothing. Safe to re-run.

alter table public.profiles
  add column if not exists show_in_feed boolean not null default true;

create table if not exists public.feed_reactions (
  ref        text not null,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('fire', 'thumbs')),
  created_at timestamptz not null default now(),
  primary key (ref, user_id, emoji)
);

alter table public.feed_reactions enable row level security;

drop policy if exists feed_reactions_read on public.feed_reactions;
create policy feed_reactions_read on public.feed_reactions
  for select to authenticated using (true);

drop policy if exists feed_reactions_add_own on public.feed_reactions;
create policy feed_reactions_add_own on public.feed_reactions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists feed_reactions_remove_own on public.feed_reactions;
create policy feed_reactions_remove_own on public.feed_reactions
  for delete to authenticated using (user_id = auth.uid());

-- A machine's name as the timers page shows it.
create or replace function public.feed_machine_label(m public.machines)
returns text
language sql immutable as $$
  select coalesce(nullif(m.nickname, ''), nullif(m.venue, ''), m.machine_code)
         || coalesce(' · ' || nullif(m.city, ''), '');
$$;

create or replace function public.home_feed(p_before timestamptz default null, p_limit int default 40)
returns table (
  ref text, kind text, at timestamptz,
  actor_id uuid, actor_name text, actor_icon text, actor_color text,
  title text, detail text, image_url text, href text,
  big boolean, fav boolean,
  fire int, thumbs int, my_fire boolean, my_thumbs boolean
)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  v_me    uuid := auth.uid();
  v_role  text;
  v_until timestamptz := coalesce(p_before, now() + interval '1 minute');
  v_since timestamptz := now() - interval '14 days';
begin
  select pr.role::text into v_role from profiles pr where pr.id = v_me;
  if v_role is null or v_role = 'pending' then
    return;
  end if;

  return query
  with items as (
    -- "Got it" timer reports, one item per machine per 2-hour window.
    select 'timer:' || t.machine_id || ':' || t.bucket as ref, 'timer'::text as kind, t.at,
           t.actor_id, 'got it at ' || feed_machine_label(m) as title,
           case when t.n = 1 then 'At :' || lpad(t.last_minute::text, 2, '0')
                else t.n || ' hits · :' || lpad(t.min_minute::text, 2, '0')
                     || case when t.max_minute <> t.min_minute then '–:' || lpad(t.max_minute::text, 2, '0') else '' end
           end as detail,
           null::text as image_url, '/timers'::text as href, false as big,
           exists (select 1 from machine_favorites f where f.user_id = v_me and f.machine_id = t.machine_id) as fav
      from (
        select tr.machine_id,
               floor(extract(epoch from tr.reported_at) / 7200)::bigint as bucket,
               max(tr.reported_at) as at,
               (array_agg(tr.user_id order by tr.reported_at desc))[1] as actor_id,
               (array_agg(tr.minutes order by tr.reported_at desc))[1] as last_minute,
               min(tr.minutes) as min_minute,
               max(tr.minutes) as max_minute,
               count(*) as n
          from timer_reports tr
          join profiles p on p.id = tr.user_id and p.show_in_feed
         where tr.success and tr.reported_at > v_since and tr.reported_at < v_until
         group by 1, 2
      ) t
      join machines m on m.id = t.machine_id

    union all
    -- Holo and secret rare pulls (not from god packs, which get one item below).
    select 'pull:' || uc.id, 'pull', up.opened_at, up.user_id,
           'pulled ' || vc.name,
           case vc.rarity when 'S' then 'Secret rare' else 'Holo rare' end || coalesce(' · ' || vp.set_name, ''),
           vc.image_url, '/members/' || up.user_id, vc.rarity = 'S', false
      from user_cards uc
      join user_packs up on up.id = uc.user_pack_id
      join vending_cards vc on vc.id = uc.card_id
      left join vending_packs vp on vp.id = up.pack_id
     where vc.rarity in ('H', 'S') and not up.god_pack
       and up.opened_at > v_since and up.opened_at < v_until

    union all
    select 'godpack:' || up.id, 'pull', up.opened_at, up.user_id,
           'opened a god pack!', coalesce(vp.set_name || ' · ', '') || 'every card a holo',
           vp.image_url, '/members/' || up.user_id, true, false
      from user_packs up
      left join vending_packs vp on vp.id = up.pack_id
     where up.god_pack and up.opened_at > v_since and up.opened_at < v_until

    union all
    -- Grading results worth showing off.
    select 'grade:' || uc.id, 'grade', uc.graded_at, uc.user_id,
           'got a ' || uc.grade || ' on ' || vc.name, 'Grading result',
           vc.image_url, '/members/' || uc.user_id, uc.grade >= 10, false
      from user_cards uc
      join vending_cards vc on vc.id = uc.card_id
     where uc.grade >= 9 and uc.graded_at > v_since and uc.graded_at < v_until

    union all
    -- New market listings, with the first item's picture.
    select 'listing:' || ml.id, 'listing', ml.created_at, ml.seller_id,
           'listed ' || coalesce(nullif(ml.title, ''), 'something') ||
             case when ml.kind = 'auction' then ' for auction' else '' end,
           case when ml.kind = 'auction'
                then 'Bids from ' || ml.price || ' tokens'
                else ml.price || ' tokens' end,
           (select coalesce(vc.image_url, vp.image_url)
              from market_listing_items mi
              left join user_cards uc on uc.id = mi.user_card_id
              left join vending_cards vc on vc.id = uc.card_id
              left join user_packs up on up.id = mi.user_pack_id
              left join vending_packs vp on vp.id = up.pack_id
             where mi.listing_id = ml.id
             order by mi.id limit 1),
           '/market', false, false
      from market_listings ml
     where ml.status <> 'cancelled' and ml.created_at > v_since and ml.created_at < v_until

    union all
    select 'sale:' || ml.id, 'sale', ml.settled_at, ml.seller_id,
           'sold ' || coalesce(nullif(ml.title, ''), 'something'),
           'for ' || ml.sold_price || ' tokens',
           null, '/market', ml.sold_price >= 100, false
      from market_listings ml
     where ml.status = 'sold' and ml.settled_at > v_since and ml.settled_at < v_until

    union all
    -- Achievements.
    select 'badge:' || ua.id, 'badge', ua.completed_at, ua.user_id,
           'earned ' || a.name, a.description,
           '/badges/' || bi.file, '/members/' || ua.user_id, false, false
      from user_achievements ua
      join achievements a on a.id = ua.achievement_id
      left join badge_icons bi on bi.id = a.badge_icon_id
     where ua.completed_at > v_since and ua.completed_at < v_until

    union all
    -- Interest pulse: per set, the products 3+ members want, as of the newest want.
    select 'interest:' || y.set_id || ':' || max(y.latest)::date, 'interest', max(y.latest), null::uuid,
           'Most wanted from ' || s.name,
           array_to_string((array_agg(y.name || ' ×' || y.n order by y.n desc, y.name))[1:3], ' · ')
             || case when count(*) > 3 then ' · +' || (count(*) - 3) || ' more' else '' end,
           (array_agg(y.image_url order by y.n desc, y.name) filter (where y.image_url is not null))[1],
           '/interest', false, false
      from (
        select p.set_id, p.name, p.image_url, count(*) as n, max(pi.created_at) as latest
          from product_interest pi
          join products p on p.id = pi.product_id
         where pi.expires_at is null or pi.expires_at > now()
         group by p.id
        having count(*) >= 3
      ) y
      join sets s on s.id = y.set_id
     group by y.set_id, s.name
    having max(y.latest) > v_since and max(y.latest) < v_until

    union all
    select 'fortnight:' || interest_period(), 'interest', interest_period()::timestamptz, null::uuid,
           'A new interest-check fortnight is open',
           'Update your list to claim ' || coalesce((select vs.interest_reward_tokens from vending_settings vs where vs.id), 0) || ' tokens',
           null, '/interest', false, false
     where interest_period()::timestamptz > v_since and interest_period()::timestamptz < v_until

    union all
    -- New members.
    select 'member:' || p.id, 'member', p.approved_at, p.id,
           'joined the community', null,
           null, '/members/' || p.id, false, false
      from profiles p
     where p.approved_at > v_since and p.approved_at < v_until and p.role <> 'pending'

    union all
    -- Machine comments.
    select 'comment:' || c.id, 'comment', c.created_at, c.user_id,
           'commented on ' || feed_machine_label(m),
           left(c.body, 140) || case when length(c.body) > 140 then '…' else '' end,
           null, '/timers', false,
           exists (select 1 from machine_favorites f where f.user_id = v_me and f.machine_id = c.machine_id)
      from machine_comments c
      join machines m on m.id = c.machine_id
     where c.created_at > v_since and c.created_at < v_until

    union all
    -- Showcase additions.
    select 'showcase:' || sh.user_id || ':' || sh.slot || ':' || extract(epoch from sh.placed_at)::bigint, 'showcase', sh.placed_at, sh.user_id,
           'added ' || coalesce(vc.name, 'a sealed box') || ' to their showcase', null,
           vc.image_url, '/members/' || sh.user_id, false, false
      from showcase_slots sh
      left join user_cards uc on uc.id = sh.user_card_id
      left join vending_cards vc on vc.id = uc.card_id
     where sh.placed_at > v_since and sh.placed_at < v_until
       and (sh.user_card_id is not null or sh.user_box_id is not null)

  )
  select i.ref, i.kind, i.at,
         i.actor_id, coalesce(nullif(pr.display_name, ''), pr.username), ti.file, pr.name_color,
         i.title, i.detail, i.image_url, i.href, i.big, i.fav,
         coalesce(rx.fire, 0), coalesce(rx.thumbs, 0), coalesce(rx.my_fire, false), coalesce(rx.my_thumbs, false)
    from items i
    left join profiles pr on pr.id = i.actor_id
    left join trainer_icons ti on ti.id = pr.trainer_icon_id
    left join lateral (
      select count(*) filter (where fr.emoji = 'fire')::int as fire,
             count(*) filter (where fr.emoji = 'thumbs')::int as thumbs,
             bool_or(fr.emoji = 'fire' and fr.user_id = v_me) as my_fire,
             bool_or(fr.emoji = 'thumbs' and fr.user_id = v_me) as my_thumbs
        from feed_reactions fr where fr.ref = i.ref
    ) rx on true
   where i.at is not null
     and (i.actor_id is null or pr.show_in_feed)
   order by i.at desc
   limit greatest(1, least(p_limit, 100));
end;
$$;

create or replace function public.home_highlights()
returns table (kind text, ref text, at timestamptz, title text, detail text, image_url text, href text, fav boolean)
language plpgsql stable security definer set search_path to 'public' as $$
#variable_conflict use_column
declare
  v_me   uuid := auth.uid();
  v_role text;
begin
  select pr.role::text into v_role from profiles pr where pr.id = v_me;
  if v_role is null or v_role = 'pending' then
    return;
  end if;

  return query
  (
    -- Auctions closing soon; `at` is when they end.
    select 'ending'::text, 'listing:' || ml.id, ml.ends_at,
           coalesce(nullif(ml.title, ''), 'Auction'),
           coalesce(ml.current_bid, ml.price) || ' tokens' || case when ml.current_bid is null then ' to start' else ' current bid' end,
           (select coalesce(vc.image_url, vp.image_url)
              from market_listing_items mi
              left join user_cards uc on uc.id = mi.user_card_id
              left join vending_cards vc on vc.id = uc.card_id
              left join user_packs up on up.id = mi.user_pack_id
              left join vending_packs vp on vp.id = up.pack_id
             where mi.listing_id = ml.id order by mi.id limit 1),
           '/market', false
      from market_listings ml
     where ml.status = 'active' and ml.kind = 'auction'
       and ml.ends_at > now() and ml.ends_at < now() + interval '2 hours'
     order by ml.ends_at
     limit 3
  )
  union all
  (
    -- Machines with a hit in the last hour, favourites first.
    select 'hit', 'timer:' || tr.machine_id, max(tr.reported_at),
           feed_machine_label(m),
           'Got it at :' || lpad(((array_agg(tr.minutes order by tr.reported_at desc))[1])::text, 2, '0')
             || case when count(*) > 1 then ' · ' || count(*) || ' hits' else '' end,
           null, '/timers',
           exists (select 1 from machine_favorites f where f.user_id = v_me and f.machine_id = tr.machine_id)
      from timer_reports tr
      join machines m on m.id = tr.machine_id
     where tr.success and tr.reported_at > now() - interval '1 hour'
     group by tr.machine_id, m.id
     order by 8 desc, 3 desc
     limit 3
  )
  union all
  (
    -- Big pulls from the last day.
    select 'pull', 'pull:' || uc.id, up.opened_at,
           coalesce(nullif(pr.display_name, ''), pr.username) || ' pulled ' || vc.name, 'Secret rare',
           vc.image_url, '/members/' || up.user_id, false
      from user_cards uc
      join user_packs up on up.id = uc.user_pack_id
      join vending_cards vc on vc.id = uc.card_id
      join profiles pr on pr.id = up.user_id and pr.show_in_feed
     where vc.rarity = 'S' and up.opened_at > now() - interval '1 day'
    union all
    select 'pull', 'godpack:' || up.id, up.opened_at,
           coalesce(nullif(pr.display_name, ''), pr.username) || ' opened a god pack!', vp.set_name,
           vp.image_url, '/members/' || up.user_id, false
      from user_packs up
      join profiles pr on pr.id = up.user_id and pr.show_in_feed
      left join vending_packs vp on vp.id = up.pack_id
     where up.god_pack and up.opened_at > now() - interval '1 day'
     order by 3 desc
     limit 2
  );
end;
$$;

create or replace function public.set_show_in_feed(p_on boolean)
returns void
language sql security definer set search_path to 'public' as $$
  update profiles set show_in_feed = p_on where id = auth.uid();
$$;

revoke all on function public.set_show_in_feed(boolean) from public, anon;
grant execute on function public.set_show_in_feed(boolean) to authenticated;
revoke all on function public.home_feed(timestamptz, int) from public, anon;
revoke all on function public.home_highlights() from public, anon;
grant execute on function public.home_feed(timestamptz, int) to authenticated;
grant execute on function public.home_highlights() to authenticated;
