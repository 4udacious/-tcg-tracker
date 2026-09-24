-- Recent purchases at the machine, for the feed under the VVM.
--
-- Grouped by (user, acquired_at): every pack in one checkout is inserted in
-- the same transaction and so shares an identical now(), which makes that
-- pair an exact key for "one purchase" without needing a separate order
-- table.
--
-- SECURITY DEFINER because user_packs is readable only by its owner. This
-- deliberately exposes buyer name, set and count to every signed-in member -
-- the same visibility the lurker list already has, and the point of a
-- shared machine. It does not expose which wrapper or any card contents.

create or replace function public.vending_recent_buys(p_limit int default 6)
returns table (
  buyer      text,
  icon_file  text,
  packs      int,
  sets       text,
  bought_at  timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  select coalesce(p.display_name, p.username)::text,
         ti.file::text,
         count(*)::int,
         string_agg(distinct vp.set_name, ', ')::text,
         up.acquired_at
    from public.user_packs up
    join public.profiles p on p.id = up.user_id
    join public.vending_packs vp on vp.id = up.pack_id
    left join public.trainer_icons ti on ti.id = p.trainer_icon_id
   group by up.user_id, p.display_name, p.username, ti.file, up.acquired_at
   order by up.acquired_at desc
   limit greatest(1, least(p_limit, 20));
$$;
