-- Descriptions for the items on the vending machine shelf.
--
-- Already applied to the live database. Kept here as the record of the change.
--
-- The machine sells by set rather than by individual wrapper art ("wrapper
-- varies"), so the blurb a shopper reads is keyed by set_code, not by a row in
-- vending_packs. Raffle tickets already carry their own description column.

create table if not exists public.vending_set_info (
  set_code    text primary key,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

alter table public.vending_set_info enable row level security;

create policy vending_set_info_select on public.vending_set_info
  for select using (public.is_member());
create policy vending_set_info_write on public.vending_set_info
  for all using (public.is_admin()) with check (public.is_admin());

-- Seed a row per set already in the machine so the admin screen isn't empty.
insert into public.vending_set_info (set_code)
select distinct set_code from public.vending_packs where set_code is not null
on conflict (set_code) do nothing;

-- get_vending_stock gains description. The return type changes, so it has to be
-- dropped rather than replaced.
drop function if exists public.get_vending_stock(bigint);

create function public.get_vending_stock(p_cycle bigint)
returns table(set_code text, set_name text, display_image_url text,
              quantity integer, description text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select s.set_code, p.set_name, p.image_url, s.quantity, i.description
    from public.vending_stock s
    join public.vending_packs p on p.id = s.display_pack_id
    left join public.vending_set_info i on i.set_code = s.set_code
   where s.cycle_no = p_cycle
   order by p.sort_order;
$function$;
