-- One switch for the battle game's battles: vending_settings.battle_rewards_open
-- (v58) now means "battles are live for members". Off (the default), the game
-- is only the vending machine for members: no encounters, no battle toggle,
-- and the battle award functions answer only admins, who keep everything so
-- they can test. An admin flips it on the VVM admin page.

comment on column public.vending_settings.battle_rewards_open is
  'Battles are live for members: encounters in the battle game, and battle pack/token awards. Admins always have them.';

create or replace function public.set_battles_live(p_on boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can switch battles on or off';
  end if;
  update public.vending_settings
     set battle_rewards_open = coalesce(p_on, false), updated_at = now(), updated_by = auth.uid()
   where id;
  return coalesce(p_on, false);
end $$;

revoke execute on function public.set_battles_live(boolean) from public, anon;
grant execute on function public.set_battles_live(boolean) to authenticated;
