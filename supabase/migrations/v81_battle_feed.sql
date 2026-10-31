-- Battle game moments in the home feed (Feed tab), as kind 'battle':
--
--   From battle_milestones (v77: the server's own payout record, once per
--   account): each Gym badge, Elite Four wins and becoming Johto Champion,
--   the Kanto League and beating Red, Alex's rival battles (the last one: the
--   Hall of Fame), and Herb's and Paul's glitcher battles. battle_feed_label
--   turns a key into the item's words and picture.
--
--   From battle_events, which the game reports with battle_log_event(kind,
--   species, mon_id, level): a roaming legendary caught, knocked out or met
--   (it got away), and a shiny caught. Members only, with wild battles live
--   for them (admins always), at most 12 a day, and the same one not twice
--   in ten minutes. Legendary reports must name one of the roaming three.
--
-- Big moments (a highlighted card): Johto Champion, beating Red, the Hall of
-- Fame, catching a legendary, a shiny catch. As before, a member with
-- "show me in the feed" off is left out.
--
-- home_feed is v74's, with the two blocks added. Safe to re-run.

create table if not exists public.battle_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('legend_caught', 'legend_ko', 'legend_seen', 'shiny_caught')),
  species    text not null check (char_length(species) between 1 and 24),
  mon_id     integer not null check (mon_id between 1 and 1100),
  level      integer not null check (level between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists battle_events_created_at on public.battle_events (created_at desc);
create index if not exists battle_events_user on public.battle_events (user_id, created_at desc);

alter table public.battle_events enable row level security;
drop policy if exists battle_events_select_own on public.battle_events;
create policy battle_events_select_own on public.battle_events
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete, truncate, references, trigger on public.battle_events from authenticated;
revoke all on public.battle_events from anon;

create or replace function public.battle_log_event(p_kind text, p_species text, p_mon_id integer, p_level integer)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  v_species text := upper(trim(p_species));
begin
  if me is null or not public.is_member() then return false; end if;
  -- Wild battles must be live for you (admins always have them).
  if not coalesce((select m.wild from public.battle_modes() m), false) then return false; end if;
  if p_kind not in ('legend_caught', 'legend_ko', 'legend_seen', 'shiny_caught') then return false; end if;
  if v_species is null or v_species !~ '^[A-Z0-9 .''♀♂:-]{1,24}$' then return false; end if;
  if p_kind like 'legend_%' and v_species not in ('RAIKOU', 'ENTEI', 'SUICUNE') then return false; end if;
  if p_mon_id is null or p_mon_id not between 1 and 1100 or p_level is null or p_level not between 1 and 100 then return false; end if;

  perform pg_advisory_xact_lock(hashtext('battle_event:' || me::text));
  if (select count(*) from public.battle_events e where e.user_id = me and e.created_at > now() - interval '1 day') >= 12 then return false; end if;
  if exists (select 1 from public.battle_events e where e.user_id = me and e.kind = p_kind and e.species = v_species
               and e.created_at > now() - interval '10 minutes') then return false; end if;

  insert into public.battle_events (user_id, kind, species, mon_id, level) values (me, p_kind, v_species, p_mon_id, p_level);
  return true;
end $$;

-- A milestone key's feed words and picture (null title: not shown).
create or replace function public.battle_feed_label(p_key text)
returns table (title text, detail text, image_url text, big boolean)
language sql immutable as $$
  with g(i, leader, face, badge) as (values
    (0, 'Falkner', 'falkner', 'zephyr'), (1, 'Bugsy', 'bugsy', 'hive'), (2, 'Whitney', 'whitney', 'plain'), (3, 'Morty', 'morty', 'fog'),
    (4, 'Chuck', 'chuck', 'storm'), (5, 'Jasmine', 'jasmine', 'mineral'), (6, 'Pryce', 'pryce', 'glacier'), (7, 'Clair', 'clair', 'rising'),
    (8, 'Brock', 'brock', 'boulder'), (9, 'Misty', 'misty', 'cascade'), (10, 'Lt. Surge', 'lt_surge', 'thunder'), (11, 'Erika', 'erika', 'rainbow'),
    (12, 'Janine', 'janine', 'soul'), (13, 'Sabrina', 'sabrina', 'marsh'), (14, 'Blaine', 'blaine', 'volcano'), (15, 'Blue', 'blue', 'earth')
  ), k as (select split_part(p_key, ':', 1) as kind, split_part(p_key, ':', 2) as arg)
  select
    case
      when k.kind = 'gym' then 'won the ' || upper(g.badge) || ' BADGE'
      when p_key = 'elite:LANCE' then 'became Johto Champion!'
      when k.kind = 'elite' then 'beat Elite Four ' || initcap(k.arg)
      when p_key = 'kanto:RED' then 'beat Red on Mt. Silver!'
      when k.kind = 'kanto' then 'beat Kanto Elite Four ' || initcap(k.arg)
      when p_key = 'rival:6' then 'beat Alex and entered the Hall of Fame!'
      when k.kind = 'rival' then 'beat their rival Alex'
      when k.kind in ('herb', 'paul') then 'stopped ' || initcap(k.kind) || '''s glitch racket'
    end,
    case
      when k.kind = 'gym' then 'Gym Leader ' || g.leader || case when g.i < 8 then ' · Johto badge ' || (g.i + 1) || ' of 8' else ' · Kanto badge ' || (g.i - 7) || ' of 8' end
      when p_key = 'elite:LANCE' then 'The Elite Four and Champion Lance'
      when k.kind = 'elite' then 'Johto League'
      when p_key = 'kanto:RED' then 'The legend himself'
      when k.kind = 'kanto' then 'Kanto League'
      when p_key = 'rival:6' then 'The last battle, and Mewtwo'
      when k.kind = 'rival' then 'Rival battle ' || (k.arg::int + 1) || ' of 7'
      when k.kind in ('herb', 'paul') then 'Glitcher battle ' || (k.arg::int + 1) || ' of 4'
    end,
    case
      when k.kind = 'gym' then '/rpg/a/badges/' || g.badge || '.png'
      when k.kind = 'elite' then '/rpg/a/gym-' || lower(k.arg) || '-face.jpg'
      when k.kind = 'kanto' then '/rpg/a/gym-' || lower(k.arg) || '-face.jpg'
      when k.kind = 'rival' then '/rpg/a/rival-' || (array[1, 1, 1, 2, 2, 3, 3])[k.arg::int + 1] || '-face.jpg'
      when k.kind in ('herb', 'paul') then '/rpg/a/' || k.kind || '-face.jpg'
    end,
    p_key in ('elite:LANCE', 'kanto:RED', 'rival:6')
  from k left join g on k.kind = 'gym' and g.i::text = k.arg
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

    union all
    -- Battle game milestones (v77's payout record, so the server's own): badges, the Leagues, Red, Alex, Herb and Paul.
    select 'battle:' || bm.user_id || ':' || bm.key, 'battle', bm.created_at, bm.user_id,
           l.title, l.detail, l.image_url, '/vending', l.big, false
      from battle_milestones bm
      cross join lateral battle_feed_label(bm.key) l
     where bm.created_at > v_since and bm.created_at < v_until and l.title is not null

    union all
    -- Battle game moments the game reports (battle_log_event): roaming legendaries and shiny catches.
    select 'battlev:' || be.id, 'battle', be.created_at, be.user_id,
           case be.kind
             when 'legend_caught' then 'caught the roaming ' || initcap(be.species) || '!'
             when 'legend_ko'     then 'knocked out the roaming ' || initcap(be.species)
             when 'legend_seen'   then 'ran into the roaming ' || initcap(be.species)
             when 'shiny_caught'  then 'caught a shiny ' || initcap(be.species) || ' ✨'
           end,
           case be.kind
             when 'legend_caught' then 'A legendary, Lv ' || be.level || '. A new one is roaming now.'
             when 'legend_ko'     then 'A new one is roaming, at full HP'
             when 'legend_seen'   then 'It got away'
             when 'shiny_caught'  then 'Lv ' || be.level || ' · 1 in 500'
           end,
           case when be.kind = 'shiny_caught' then '/rpg/a/shiny/' || be.mon_id || '.gif' else '/rpg/a/' || be.mon_id || '.gif' end,
           '/vending', be.kind in ('legend_caught', 'shiny_caught'), false
      from battle_events be
     where be.created_at > v_since and be.created_at < v_until

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

revoke all on function public.home_feed(timestamptz, int) from public, anon;
grant execute on function public.home_feed(timestamptz, int) to authenticated;
revoke all on function public.battle_log_event(text, text, integer, integer) from public, anon;
grant execute on function public.battle_log_event(text, text, integer, integer) to authenticated;
revoke all on function public.battle_feed_label(text) from public, anon;
