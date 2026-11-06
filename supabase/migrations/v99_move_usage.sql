-- Move usage, for balancing the battle game. At the end of each battle the
-- game sends what you used: per move, how often, its hits, how many landed
-- PERFECT and how many missed, with the battle's kind (wild, trainer,
-- leader, duo) and whether you won. Kept as daily totals per member and move,
-- so it stays small however much people play.
--
-- move_usage_summary(days) is for Admin -> VVM -> Moves: per move over the
-- last `days`, its uses, players, hit rate, PERFECT rate and how often the
-- battles it was used in were won. Safe to re-run.

create table if not exists public.move_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null default ((now() at time zone 'America/Los_Angeles')::date),
  move text not null check (char_length(move) between 1 and 30),
  battle_kind text not null check (battle_kind in ('wild', 'trainer', 'leader', 'duo')),
  uses integer not null default 0,
  hits integer not null default 0,
  perfect integer not null default 0,
  misses integer not null default 0,
  uses_in_wins integer not null default 0,
  battles integer not null default 0,
  primary key (user_id, day, move, battle_kind)
);
alter table public.move_usage enable row level security;
drop policy if exists move_usage_read on public.move_usage;
create policy move_usage_read on public.move_usage for select to authenticated using (user_id = auth.uid() or public.is_mod());

/** One battle's moves, from the game. Caps keep a misbehaving client from writing nonsense. */
create or replace function public.battle_record_moves(p_kind text, p_won boolean, p_moves jsonb)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid(); v jsonb; v_kind text := case when p_kind in ('wild', 'trainer', 'leader', 'duo') then p_kind else 'wild' end;
  v_uses int; v_hits int;
begin
  if me is null or jsonb_typeof(p_moves) <> 'array' then return; end if;
  for v in select * from jsonb_array_elements(p_moves) limit 40 loop
    continue when coalesce(v->>'move', '') !~ '^[A-Z0-9 .''-]{1,30}$';
    v_uses := least(greatest(coalesce((v->>'uses')::int, 0), 0), 100);
    v_hits := least(greatest(coalesce((v->>'hits')::int, 0), 0), 300);
    continue when v_uses = 0 and v_hits = 0;
    insert into public.move_usage as u (user_id, move, battle_kind, uses, hits, perfect, misses, uses_in_wins, battles)
    values (me, v->>'move', v_kind, v_uses, v_hits,
      least(greatest(coalesce((v->>'perfect')::int, 0), 0), v_hits), least(greatest(coalesce((v->>'misses')::int, 0), 0), v_hits),
      case when p_won then v_uses else 0 end, 1)
    on conflict (user_id, day, move, battle_kind) do update set
      uses = u.uses + excluded.uses, hits = u.hits + excluded.hits, perfect = u.perfect + excluded.perfect,
      misses = u.misses + excluded.misses, uses_in_wins = u.uses_in_wins + excluded.uses_in_wins, battles = u.battles + 1;
  end loop;
end $function$;
revoke all on function public.battle_record_moves(text, boolean, jsonb) from public, anon;
grant execute on function public.battle_record_moves(text, boolean, jsonb) to authenticated;

/** Per move over the last p_days (admins): uses, players, battles, hit/PERFECT/miss rates, and the win rate of the battles it was in. */
create or replace function public.move_usage_summary(p_days integer default 30)
returns table(move text, uses bigint, players bigint, battles bigint, hits bigint, perfect_pct numeric, miss_pct numeric, win_pct numeric, by_kind jsonb)
language sql stable security definer set search_path to 'public' as $function$
  select u.move, sum(u.uses), count(distinct u.user_id), sum(u.battles), sum(u.hits),
    round(100.0 * sum(u.perfect) / nullif(sum(u.hits), 0), 1), round(100.0 * sum(u.misses) / nullif(sum(u.hits), 0), 1),
    round(100.0 * sum(u.uses_in_wins) / nullif(sum(u.uses), 0), 1),
    (select jsonb_object_agg(k.battle_kind, k.n) from (select battle_kind, sum(uses) n from public.move_usage x
      where x.move = u.move and x.day > current_date - greatest(p_days, 1) group by battle_kind) k)
  from public.move_usage u
  where public.is_mod() and u.day > current_date - greatest(p_days, 1)
  group by u.move order by sum(u.uses) desc
$function$;
revoke all on function public.move_usage_summary(integer) from public, anon;
grant execute on function public.move_usage_summary(integer) to authenticated;
