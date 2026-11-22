-- The VVM's idle screen shows the packs of the six sets stocked most recently, not a fixed few.
--
-- vending_set_info.stocked_at: when an admin last stocked the set (Admin -> VVM: a restock, more packs than before,
-- or unlimited), set by set_vending_set_quantity. updated_at isn't enough: a description edit moves it too, and so
-- does lowering a set's limit. Filled in from updated_at for the sets stocked before this.
--
-- vending_attract_packs(): those sets' wrapper art, newest set first and dealt round them (each set's first wrapper,
-- then each set's second...), so the screen's rows mix the sets. The VVM page reads it and hands it to the machine.
--
-- Safe to re-run.

alter table public.vending_set_info add column if not exists stocked_at timestamptz;
update public.vending_set_info set stocked_at = updated_at
 where stocked_at is null and (total_quantity is null or total_quantity > 0);

/** The VVM admin page's quantity save for a set, now noting when it's stocked. */
create or replace function public.set_vending_set_quantity(p_set_code text, p_total integer, p_reset_claimed boolean default false)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change machine inventory';
  end if;
  if p_total is not null and p_total < 0 then
    raise exception 'Quantity cannot be negative';
  end if;

  insert into public.vending_set_info (set_code, total_quantity, claimed_quantity, updated_at, updated_by, stocked_at)
  values (p_set_code, p_total, 0, now(), auth.uid(), case when p_total is null or p_total > 0 then now() end)
  on conflict (set_code) do update
    set total_quantity = excluded.total_quantity,
        claimed_quantity = case when p_reset_claimed then 0 else public.vending_set_info.claimed_quantity end,
        -- Stocked: restocked, given more than it had, or made unlimited. Lowering a limit isn't stocking.
        stocked_at = case
          when (p_reset_claimed and (p_total is null or p_total > 0))
            or p_total is null
            or p_total > coalesce(public.vending_set_info.total_quantity, 0)
          then now() else public.vending_set_info.stocked_at end,
        updated_at = now(),
        updated_by = auth.uid();
end $$;

/** The idle screen's packs: the wrappers of the p_sets sets stocked most recently, dealt round the sets, newest first. */
create or replace function public.vending_attract_packs(p_sets integer default 6)
returns text[]
language sql stable security definer set search_path to 'public' as $$
  with sets as (
    select set_code, row_number() over (order by stocked_at desc, set_code) as k
      from public.vending_set_info
     where stocked_at is not null
     order by stocked_at desc, set_code
     limit greatest(1, least(coalesce(p_sets, 6), 20))
  ), packs as (
    select p.image_url, s.k, row_number() over (partition by p.set_code order by p.sort_order, p.id) as w
      from public.vending_packs p join sets s on s.set_code = p.set_code
     where p.is_active and p.image_url is not null
  )
  select coalesce(array_agg(image_url order by w, k), '{}') from packs
$$;

revoke execute on function public.vending_attract_packs(integer) from public, anon;
grant execute on function public.vending_attract_packs(integer) to authenticated;
