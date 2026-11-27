-- How members defend in the battle game, for balancing guard, heavy blows and
-- stun (PR #218). Move usage (v99) only covers your own strikes; this covers
-- the rings thrown at you. At the end of each battle the game sends what
-- happened on your rings: how many, PERFECT, parried, jumped, dodged or missed;
-- the heavy blows (red rings) among them, dodged or parried by mistake; how
-- often your guard broke; and how often you stunned a foe. Kept as daily totals
-- per member and battle kind, so it stays small however much people play.
--
-- defence_usage_summary(days) is for Admin -> VVM -> Moves: per battle kind
-- over the last `days`. Safe to re-run.

create table if not exists public.defence_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default ((now() at time zone 'America/Los_Angeles')::date),
  battle_kind text not null check (battle_kind in ('wild', 'trainer', 'leader', 'duo')),
  battles integer not null default 0,
  wins integer not null default 0,
  rings integer not null default 0,
  perfect integer not null default 0,
  parries integer not null default 0,
  jumps integer not null default 0,
  dodges integer not null default 0,
  misses integer not null default 0,
  heavy integer not null default 0,
  heavy_dodged integer not null default 0,
  heavy_parried integer not null default 0,
  guard_breaks integer not null default 0,
  stuns integer not null default 0,
  primary key (user_id, day, battle_kind)
);
alter table public.defence_usage enable row level security;
drop policy if exists defence_usage_read on public.defence_usage;
create policy defence_usage_read on public.defence_usage for select to authenticated using (user_id = auth.uid() or public.is_mod());

/** One battle's defence, from the game. Each count is capped (a long battle has a few hundred rings at most). */
create or replace function public.battle_record_defence(p_kind text, p_won boolean, p_def jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); v_kind text := case when p_kind in ('wild', 'trainer', 'leader', 'duo') then p_kind else 'wild' end;
  v_rings int;
  n jsonb := '{}';
  k text;
begin
  if me is null or jsonb_typeof(p_def) <> 'object' then return; end if;
  v_rings := least(greatest(coalesce((p_def->>'rings')::int, 0), 0), 500);
  if v_rings = 0 then return; end if;
  -- every other count: 0 to the battle's rings (breaks and stuns, 0 to 100)
  foreach k in array array['perfect', 'parries', 'jumps', 'dodges', 'misses', 'heavy', 'heavy_dodged', 'heavy_parried'] loop
    n := n || jsonb_build_object(k, least(greatest(coalesce((p_def->>k)::int, 0), 0), v_rings));
  end loop;
  foreach k in array array['guard_breaks', 'stuns'] loop
    n := n || jsonb_build_object(k, least(greatest(coalesce((p_def->>k)::int, 0), 0), 100));
  end loop;
  insert into public.defence_usage as u (user_id, battle_kind, battles, wins, rings, perfect, parries, jumps, dodges, misses,
    heavy, heavy_dodged, heavy_parried, guard_breaks, stuns)
  values (me, v_kind, 1, case when p_won then 1 else 0 end, v_rings, (n->>'perfect')::int, (n->>'parries')::int, (n->>'jumps')::int,
    (n->>'dodges')::int, (n->>'misses')::int, (n->>'heavy')::int, (n->>'heavy_dodged')::int, (n->>'heavy_parried')::int,
    (n->>'guard_breaks')::int, (n->>'stuns')::int)
  on conflict (user_id, day, battle_kind) do update set
    battles = u.battles + 1, wins = u.wins + excluded.wins, rings = u.rings + excluded.rings, perfect = u.perfect + excluded.perfect,
    parries = u.parries + excluded.parries, jumps = u.jumps + excluded.jumps, dodges = u.dodges + excluded.dodges,
    misses = u.misses + excluded.misses, heavy = u.heavy + excluded.heavy, heavy_dodged = u.heavy_dodged + excluded.heavy_dodged,
    heavy_parried = u.heavy_parried + excluded.heavy_parried, guard_breaks = u.guard_breaks + excluded.guard_breaks,
    stuns = u.stuns + excluded.stuns;
end $function$;
revoke all on function public.battle_record_defence(text, boolean, jsonb) from public, anon;
grant execute on function public.battle_record_defence(text, boolean, jsonb) to authenticated;

/**
 * Per battle kind over the last p_days (admins): battles, players, win rate, rings a battle, and how those rings went
 * (shares of all rings), the heavy blows (shares of those), and guard breaks and stuns a battle.
 */
create or replace function public.defence_usage_summary(p_days integer default 30)
returns table(battle_kind text, battles bigint, players bigint, win_pct numeric, rings_per_battle numeric,
  perfect_pct numeric, parry_pct numeric, jump_pct numeric, dodge_pct numeric, miss_pct numeric,
  heavy bigint, heavy_dodged_pct numeric, heavy_parried_pct numeric, breaks_per_battle numeric, stuns_per_battle numeric)
language sql stable security definer set search_path to 'public' as $function$
  select u.battle_kind, sum(u.battles), count(distinct u.user_id), round(100.0 * sum(u.wins) / nullif(sum(u.battles), 0), 1),
    round(sum(u.rings)::numeric / nullif(sum(u.battles), 0), 1),
    round(100.0 * sum(u.perfect) / nullif(sum(u.rings), 0), 1), round(100.0 * sum(u.parries) / nullif(sum(u.rings), 0), 1),
    round(100.0 * sum(u.jumps) / nullif(sum(u.rings), 0), 1), round(100.0 * sum(u.dodges) / nullif(sum(u.rings), 0), 1),
    round(100.0 * sum(u.misses) / nullif(sum(u.rings), 0), 1),
    sum(u.heavy), round(100.0 * sum(u.heavy_dodged) / nullif(sum(u.heavy), 0), 1), round(100.0 * sum(u.heavy_parried) / nullif(sum(u.heavy), 0), 1),
    round(sum(u.guard_breaks)::numeric / nullif(sum(u.battles), 0), 2), round(sum(u.stuns)::numeric / nullif(sum(u.battles), 0), 2)
  from public.defence_usage u
  where public.is_mod() and u.day > current_date - greatest(p_days, 1)
  group by u.battle_kind
  order by array_position(array['wild', 'trainer', 'leader', 'duo'], u.battle_kind)
$function$;
revoke all on function public.defence_usage_summary(integer) from public, anon;
grant execute on function public.defence_usage_summary(integer) to authenticated;
