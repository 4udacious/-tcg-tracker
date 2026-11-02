-- The Champion's Emblem: for members who have finished the battle game, by
-- beating the Kanto Elite Four, Red, and Alex's last battle. It carries the
-- member's name and the team they did it with (their Hall of Fame team), and
-- can stand on a shelf of their showcase like a card or a sealed box.
--
--   battle_emblems                  one per member: the team ([{id, name,
--                                   level, shiny}], up to six), when it was
--                                   earned, and the shelf slot it's on (null:
--                                   not on display)
--   battle_claim_emblem(team)       the game claims it after the Hall of
--                                   Fame. Only with every milestone the server
--                                   paid for those battles (battle_milestones:
--                                   kanto:LORELEI, BRUNO, AGATHA, LANCE, RED
--                                   and rival:6), so it can't be faked; the
--                                   first team claimed is kept.
--   get_battle_emblem(user)         a member's emblem, for their showcase
--   set_showcase_emblem_slot(slot)  put yours on a shelf (whatever was in that
--   clear_showcase_emblem()         slot comes off), or take it down
--
-- A card or box placed in the emblem's slot takes it down (a trigger on
-- showcase_slots), so get_showcase and the card and box functions are
-- unchanged. Members who had already finished get theirs from their saved
-- Hall of Fame team. Safe to re-run (no drops).

create table if not exists public.battle_emblems (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  team           jsonb not null,
  earned_at      timestamptz not null default now(),
  showcase_slot  smallint check (showcase_slot between 0 and 11)
);
alter table public.battle_emblems enable row level security;
revoke all on public.battle_emblems from anon, authenticated;

/** A team as sent by the game, kept to what the emblem shows; null if it isn't a usable team. */
create or replace function public.battle_emblem_team(p jsonb)
returns jsonb
language sql immutable set search_path to 'public' as $function$
  select case when jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 6 then (
    select jsonb_agg(jsonb_build_object('id', (e->>'id')::int, 'name', upper(left(e->>'name', 20)),
                                        'level', (e->>'level')::int, 'shiny', coalesce(e->'shiny' = 'true'::jsonb, false)) order by o)
      from jsonb_array_elements(p) with ordinality as t(e, o)
     where jsonb_typeof(e) = 'object'
       and coalesce(e->>'id', '') ~ '^[0-9]{1,4}$'
       and coalesce(e->>'level', '') ~ '^[0-9]{1,3}$' and (e->>'level')::int between 1 and 100
       and coalesce(e->>'name', '') ~ '^[A-Za-z0-9 .''♀♂:-]{1,20}$'
  ) end;
$function$;

/** Has this member won every battle the emblem is for? */
create or replace function public.battle_game_finished(p_user uuid)
returns boolean
language sql stable security definer set search_path to 'public' as $function$
  select (select count(distinct m.key) from public.battle_milestones m
           where m.user_id = p_user
             and m.key in ('kanto:LORELEI', 'kanto:BRUNO', 'kanto:AGATHA', 'kanto:LANCE', 'kanto:RED', 'rival:6')) = 6;
$function$;
revoke all on function public.battle_game_finished(uuid) from public, anon, authenticated;

create or replace function public.battle_claim_emblem(p_team jsonb)
returns boolean
language plpgsql security definer set search_path to 'public' as $function$
declare
  me     uuid := auth.uid();
  v_team jsonb := public.battle_emblem_team(p_team);
begin
  if me is null or not public.is_member() or not public.battle_game_finished(me) then return false; end if;
  if v_team is null or jsonb_array_length(v_team) <> jsonb_array_length(p_team) then return false; end if;
  insert into public.battle_emblems (user_id, team) values (me, v_team) on conflict (user_id) do nothing;
  return true;
end $function$;
revoke all on function public.battle_claim_emblem(jsonb) from public, anon;
grant execute on function public.battle_claim_emblem(jsonb) to authenticated;

create or replace function public.get_battle_emblem(p_user uuid)
returns table (name text, team jsonb, earned_at timestamptz, showcase_slot smallint)
language sql stable security definer set search_path to 'public' as $function$
  select coalesce(nullif(btrim(p.display_name), ''), p.username), e.team, e.earned_at, e.showcase_slot
    from public.battle_emblems e
    join public.profiles p on p.id = e.user_id
   where e.user_id = p_user and auth.uid() is not null;
$function$;
revoke all on function public.get_battle_emblem(uuid) from public, anon;
grant execute on function public.get_battle_emblem(uuid) to authenticated;

create or replace function public.set_showcase_emblem_slot(p_slot integer)
returns void
language plpgsql security definer set search_path to 'public' as $function$
declare me uuid := auth.uid();
begin
  if p_slot < 0 or p_slot > 11 then raise exception 'No such shelf slot'; end if;
  if not exists (select 1 from public.battle_emblems e where e.user_id = me) then raise exception 'You have no emblem'; end if;
  delete from public.showcase_slots where user_id = me and slot = p_slot;
  update public.battle_emblems set showcase_slot = p_slot where user_id = me;
end $function$;
revoke all on function public.set_showcase_emblem_slot(integer) from public, anon;
grant execute on function public.set_showcase_emblem_slot(integer) to authenticated;

create or replace function public.clear_showcase_emblem()
returns void
language sql security definer set search_path to 'public' as $function$
  update public.battle_emblems set showcase_slot = null where user_id = auth.uid();
$function$;
revoke all on function public.clear_showcase_emblem() from public, anon;
grant execute on function public.clear_showcase_emblem() to authenticated;

-- A card or box put where the emblem stands takes the emblem down.
create or replace function public.showcase_slot_takes_emblem_down()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  update public.battle_emblems set showcase_slot = null
   where user_id = new.user_id and showcase_slot = new.slot;
  return new;
end $function$;
revoke all on function public.showcase_slot_takes_emblem_down() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'showcase_slots_take_emblem_down') then
    create trigger showcase_slots_take_emblem_down after insert or update of slot on public.showcase_slots
      for each row execute function public.showcase_slot_takes_emblem_down();
  end if;
end $$;

-- Members who had already finished: their emblem, from the Hall of Fame team in their save.
insert into public.battle_emblems (user_id, team, earned_at)
select g.user_id, public.battle_emblem_team(g.data->'fame'->'team'),
       coalesce(to_timestamp(nullif(g.data->'fame'->>'at', '')::bigint / 1000.0), now())
  from public.game_saves g
 where public.battle_game_finished(g.user_id)
   and public.battle_emblem_team(g.data->'fame'->'team') is not null
on conflict (user_id) do nothing;
