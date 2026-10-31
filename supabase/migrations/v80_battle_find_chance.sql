-- The battle game: how often an empty tap at the machine turns up a spare
-- item (a stray Poké Ball or Potion, or a few cents of tokens in the change
-- slot). Until now a fixed 35% in the game; now an admin slider.
--
--   vending_settings.battle_find_chance  0 (never) to 1 (every empty tap); default 0.35
--   battle_modes()                       also returns find_chance, for the game
--   set_battle_find_chance(chance)       admins: change it
--
-- Found tokens still go through battle_award_tokens and its daily limit.
--
-- Safe to re-run.

alter table public.vending_settings
  add column if not exists battle_find_chance numeric(3,2) not null default 0.35
    check (battle_find_chance >= 0 and battle_find_chance <= 1);

comment on column public.vending_settings.battle_find_chance is
  'How often an empty tap in the battle game turns up a spare item, 0 to 1.';

-- battle_modes gains a column, so it is dropped and made again (same access as v79).
drop function if exists public.battle_modes();
create function public.battle_modes()
returns table (wild boolean, trainers boolean, heal_price numeric, find_chance numeric)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.is_admin() or s.wild_live, false),
         coalesce(public.is_admin() or s.battle_rewards_open, false),
         s.battle_heal_price,
         s.battle_find_chance
    from public.vending_settings s
   where s.id and auth.uid() is not null and public.is_member()
$$;

create or replace function public.set_battle_find_chance(p_chance numeric)
returns numeric language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change how often spare items turn up';
  end if;
  if p_chance is null or p_chance < 0 or p_chance > 1 then
    raise exception 'The find chance must be between 0 and 1' using errcode = '22023';
  end if;
  update public.vending_settings set battle_find_chance = round(p_chance, 2), updated_at = now(), updated_by = auth.uid() where id;
  return round(p_chance, 2);
end $$;

revoke execute on function public.battle_modes() from public, anon;
revoke execute on function public.set_battle_find_chance(numeric) from public, anon;
grant execute on function public.battle_modes() to authenticated;
grant execute on function public.set_battle_find_chance(numeric) to authenticated;
