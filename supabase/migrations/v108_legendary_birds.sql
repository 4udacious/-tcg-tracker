-- The battle game's roaming legendaries are now Articuno, Zapdos and Moltres
-- (Kanto's legendary birds), in place of Raikou, Entei and Suicune. The home
-- feed's legendary moments (battle_log_event, v81) accept the birds; the
-- three dogs stay accepted too, so a game a step behind doesn't lose a post.
-- Safe to re-run.

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
  if p_kind like 'legend_%' and v_species not in ('ARTICUNO', 'ZAPDOS', 'MOLTRES', 'RAIKOU', 'ENTEI', 'SUICUNE') then return false; end if;
  if p_mon_id is null or p_mon_id not between 1 and 1100 or p_level is null or p_level not between 1 and 100 then return false; end if;

  perform pg_advisory_xact_lock(hashtext('battle_event:' || me::text));
  if (select count(*) from public.battle_events e where e.user_id = me and e.created_at > now() - interval '1 day') >= 12 then return false; end if;
  if exists (select 1 from public.battle_events e where e.user_id = me and e.kind = p_kind and e.species = v_species
               and e.created_at > now() - interval '10 minutes') then return false; end if;

  insert into public.battle_events (user_id, kind, species, mon_id, level) values (me, p_kind, v_species, p_mon_id, p_level);
  return true;
end $$;

revoke all on function public.battle_log_event(text, text, integer, integer) from public, anon;
grant execute on function public.battle_log_event(text, text, integer, integer) to authenticated;
