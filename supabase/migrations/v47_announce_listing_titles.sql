-- Tells every member about listing titles (v46), through market mail.
--
-- One 'announcement' notice each. Unread, it shows as a banner across the
-- app that links to the Market; opening the Market marks it read like any
-- other notice, and the banner's cross retires just this one.
--
-- Safe to run twice: nobody gets the same announcement a second time.

insert into public.market_notices (user_id, kind, message)
select p.id, 'announcement', m.msg
  from public.profiles p
 cross join (select 'New in the Market: give your listings their own title, and rename them any time while they''re up, auctions included.'::text as msg) m
 where p.role in ('member', 'mod', 'admin')
   and not exists (
     select 1 from public.market_notices n
      where n.user_id = p.id and n.kind = 'announcement' and n.message = m.msg
   );
