-- Two switches for the battle game, so its battles can go live for members
-- in stages:
--
--   vending_settings.wild_live            wild Pokémon jump out of a tap
--   vending_settings.battle_rewards_open  trainer battles: scalpers, 2v2s,
--                                         gyms and the Elite Four (v58's
--                                         column, which already gates the
--                                         battle pack and token awards -
--                                         those come from trainer battles)
--
-- Both start off: members who use the game get only the vending machine.
-- Admins always have both, so they can test before anything goes live. An
-- admin flips them on the VVM admin page.

alter table public.vending_settings
  add column if not exists wild_live boolean not null default false;

comment on column public.vending_settings.wild_live is
  'Wild Pokémon are live for members in the battle game. Admins always have them.';
comment on column public.vending_settings.battle_rewards_open is
  'Trainer battles (scalpers, 2v2s, gyms, Elite Four) and their pack/token awards are live for members. Admins always have them.';

-- What the caller may meet in the game right now.
create or replace function public.battle_modes()
returns table (wild boolean, trainers boolean)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(public.is_admin() or s.wild_live, false),
         coalesce(public.is_admin() or s.battle_rewards_open, false)
    from public.vending_settings s
   where s.id and auth.uid() is not null and public.is_member()
$$;

-- Admins: switch one kind of battle on or off for members.
create or replace function public.set_battle_mode(p_kind text, p_on boolean)
returns boolean language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can switch battles on or off';
  end if;
  if p_kind = 'wild' then
    update public.vending_settings set wild_live = coalesce(p_on, false), updated_at = now(), updated_by = auth.uid() where id;
  elsif p_kind = 'trainers' then
    update public.vending_settings set battle_rewards_open = coalesce(p_on, false), updated_at = now(), updated_by = auth.uid() where id;
  else
    raise exception 'Unknown battle kind: %', p_kind using errcode = '22023';
  end if;
  return coalesce(p_on, false);
end $$;

revoke execute on function public.battle_modes() from public, anon;
revoke execute on function public.set_battle_mode(text, boolean) from public, anon;
grant execute on function public.battle_modes() to authenticated;
grant execute on function public.set_battle_mode(text, boolean) to authenticated;
