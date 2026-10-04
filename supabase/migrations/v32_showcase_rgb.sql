-- Coloured showcase lighting.
--
-- `white` keeps the existing warmth slider, cold through amber. `colour`
-- swaps it for a fixed hue, and `rgb` cycles the hue continuously - the
-- gamer-desk look. Warmth stays meaningful only in white mode, and hue only
-- in colour mode, so both columns keep their values while the other mode is
-- selected and switching back finds the room as you left it.

alter table public.showcase_settings
  add column if not exists light_mode text not null default 'white'
    check (light_mode in ('white','colour','rgb')),
  add column if not exists hue smallint not null default 280
    check (hue between 0 and 359);

create or replace function public.update_showcase_lighting(
  p_warmth int, p_brightness int, p_shelf text,
  p_mode text default 'white', p_hue int default 280
) returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_mode not in ('white','colour','rgb') then
    raise exception 'Unknown lighting mode';
  end if;

  insert into public.showcase_settings
    (user_id, warmth, brightness, shelf, light_mode, hue, updated_at)
  values (auth.uid(),
          greatest(0, least(100, p_warmth)),
          greatest(0, least(100, p_brightness)),
          p_shelf, p_mode,
          greatest(0, least(359, p_hue)), now())
  on conflict (user_id) do update
    set warmth     = excluded.warmth,
        brightness = excluded.brightness,
        shelf      = excluded.shelf,
        light_mode = excluded.light_mode,
        hue        = excluded.hue,
        updated_at = now();
end $$;
