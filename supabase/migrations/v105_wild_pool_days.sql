-- How long a wild pool lasts in the battle game, set by an admin: 1 to 7
-- days (7 by default, Monday to Monday as before). The game works out each
-- machine's pool itself, from which period it is: whole runs of this many
-- days counted from a Monday (Seattle time), so at 7 nothing changes.
--
--   vending_settings.wild_pool_days  1-7, default 7
--   battle_modes()                   also returns pool_days, for the game
--   set_wild_pool_days(days)         admins: change it (Admin → VVM)
--
-- Changing it changes every machine's pool at once (the periods are counted
-- afresh). Safe to re-run.

alter table public.vending_settings
  add column if not exists wild_pool_days integer not null default 7
    check (wild_pool_days between 1 and 7);

comment on column public.vending_settings.wild_pool_days is
  'How many days a wild pool lasts in the battle game before every machine''s pool changes, 1 to 7 (v105).';

-- The game's settings gain a column, so it's dropped and made again (in this one transaction).
drop function if exists public.battle_modes();
create function public.battle_modes()
returns table (wild boolean, trainers boolean, heal_price numeric, find_chance numeric, pool_days integer)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.is_admin() or s.wild_live, false),
         coalesce(public.is_admin() or s.battle_rewards_open, false),
         s.battle_heal_price,
         s.battle_find_chance,
         s.wild_pool_days
    from public.vending_settings s
   where s.id and auth.uid() is not null and public.is_member()
$$;

create or replace function public.set_wild_pool_days(p_days integer)
returns integer language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change how long wild pools last';
  end if;
  if p_days is null or p_days < 1 or p_days > 7 then
    raise exception 'A wild pool lasts 1 to 7 days' using errcode = '22023';
  end if;
  update public.vending_settings set wild_pool_days = p_days, updated_at = now(), updated_by = auth.uid() where id;
  return p_days;
end $$;

revoke execute on function public.battle_modes() from public, anon;
revoke execute on function public.set_wild_pool_days(integer) from public, anon;
grant execute on function public.battle_modes() to authenticated;
grant execute on function public.set_wild_pool_days(integer) to authenticated;
