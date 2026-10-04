-- How full each member's shelves are, for the member list. One call rather
-- than a query per row, matching how badge counts are already gathered.
--
-- Deliberately only a count. The showcase is the public face of a
-- collection; user_cards itself stays owner-only, and nothing here opens a
-- window onto it.
create or replace function public.member_showcase_counts()
returns table (user_id uuid, on_display int)
language sql stable security definer set search_path to 'public' as $$
  select s.user_id, count(*)::int
    from public.showcase_slots s
   where auth.uid() is not null
   group by s.user_id;
$$;
