-- Lock down what the API can reach directly. Part A of two (v52 finishes it
-- once the app no longer reads balances through the old view).
--
-- Everything in public was callable by anyone holding the site's public
-- key, signed in or not, because Supabase grants EXECUTE on new functions to
-- anon and authenticated by default and every function here is SECURITY
-- DEFINER. That is fine for functions that check auth.uid(), and a disaster
-- for the internal helpers that take a user or listing and trust it:
--
--   release_hold, market_pay_seller   credit any user any amount
--   spend_tokens, hold_tokens         debit any user
--   market_transfer_items             hand a live listing's items to anyone
--   market_return_items               pull items out from under a listing
--   market_notify                     send anyone a fake market notice
--   maybe_restock, build_vending_stock  force restocks, rewrite stock
--
-- Separately, v_token_balances was a plain view over profiles with full
-- privileges for anon: it exposed every balance, and as an updatable view
-- owned by postgres it let anyone write to profiles, role included, past
-- every policy. And profiles_update_self let a member change any column of
-- their own row bar role - their monthly allowance override, their vending
-- cooldown, the mod-only title and name colour.
--
-- None of it shows signs of use: refunds never exceed holds, seller payouts
-- match sales to the cent, nobody has an allowance override, and every card
-- in a live listing still belongs to its seller.
--
-- Internal callers are unaffected: they are SECURITY DEFINER functions owned
-- by postgres, so the helpers they call are checked against postgres.
--
-- From here on, new functions start closed. A function the app calls needs
-- its own grant in the migration that creates it:
--
--   grant execute on function public.my_function(args) to authenticated;
--
-- and a new view should be created with (security_invoker = true).

-- ───────────────────────────────────── 0. new objects start closed
-- First, so the functions this migration creates are born closed too.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

-- ─────────────────────────── 1. internal helpers: never called directly
revoke execute on function public.spend_tokens(uuid, numeric, text, text)              from public, anon, authenticated;
revoke execute on function public.hold_tokens(uuid, numeric, text)                     from public, anon, authenticated;
revoke execute on function public.release_hold(uuid, numeric, numeric, text)           from public, anon, authenticated;
revoke execute on function public.market_pay_seller(bigint, uuid, numeric)             from public, anon, authenticated;
revoke execute on function public.market_transfer_items(bigint, uuid)                  from public, anon, authenticated;
revoke execute on function public.market_return_items(bigint)                          from public, anon, authenticated;
revoke execute on function public.market_notify(uuid, bigint, text, numeric, numeric, uuid) from public, anon, authenticated;
revoke execute on function public.maybe_restock(bigint)                                from public, anon, authenticated;
revoke execute on function public.build_vending_stock(bigint, boolean)                 from public, anon, authenticated;

-- ───────────────────── 2. nothing at all for anyone who is not signed in
-- Every remaining function keeps exactly the access members have today:
-- authenticated is granted explicitly first, then PUBLIC and anon are
-- removed. Trigger functions are left alone - they cannot be called
-- directly, and the auth service fires handle_new_user.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
       and pg_get_function_result(p.oid) <> 'trigger'
  loop
    if f.proname not in ('spend_tokens','hold_tokens','release_hold','market_pay_seller',
                         'market_transfer_items','market_return_items','market_notify',
                         'maybe_restock','build_vending_stock') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
    execute format('revoke execute on function %s from public, anon', f.sig);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ─────────────────────────── 3. achievements: your own (mods: anyone's)
create or replace function public.check_achievements(target uuid)
returns setof bigint language sql security definer set search_path to 'public' as $function$
  insert into public.user_achievements (user_id, achievement_id)
  select target, a.id
    from public.achievements a
   where (target = auth.uid() or public.is_mod())
     and a.is_active
     and (a.starts_at is null or now() >= a.starts_at)
     and (a.ends_at   is null or now() <  a.ends_at)
     and exists (select 1 from public.achievement_requirements r where r.achievement_id = a.id)
     and not exists (select 1 from public.user_achievements ua
                      where ua.user_id = target and ua.achievement_id = a.id)
     and not exists (
       select 1 from public.v_achievement_progress vp
        where vp.user_id = target and vp.achievement_id = a.id
          and vp.current_qty < vp.required_qty)
  on conflict (user_id, achievement_id) do nothing
  returning achievement_id;
$function$;

-- ──────────────────── 4. profiles: members edit their name and icon only
-- Admins keep editing through the table (the allowance override page does),
-- and SECURITY DEFINER functions run as postgres, so set_name_color,
-- set_user_title and the vending cooldown are unaffected.
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;
  if (to_jsonb(new) - 'display_name' - 'trainer_icon_id')
     is distinct from (to_jsonb(old) - 'display_name' - 'trainer_icon_id') then
    raise exception 'You can only change your display name and trainer icon'
      using errcode = '42501';
  end if;
  return new;
end $function$;

-- Members' own updates fire it, so they need to be able to run it.
grant execute on function public.profiles_guard() to authenticated;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- ─────────────────────────────────────────────────────────────── 5. views
-- Balances for the admin page, behind an admin check. Replaces
-- v_token_balances, which v52 drops once the page reads from here.
create or replace function public.admin_token_balances()
returns table (user_id uuid, username text, display_name text, role public.app_role,
               effective_allowance numeric, balance numeric,
               allowance_balance numeric, earned_balance numeric)
language plpgsql stable security definer set search_path to 'public' as $function$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
  select p.id, p.username, p.display_name, p.role,
         coalesce(p.monthly_token_allowance, (select s.monthly_allowance from public.vending_settings s where s.id)),
         public.token_balance(p.id), public.allowance_balance(p.id), public.earned_balance(p.id)
    from public.profiles p
   where p.role <> 'pending'
   order by p.username;
end $function$;
grant execute on function public.admin_token_balances() to authenticated;

-- Until v52: readable by members (the admin page still uses it), and never
-- writable by anyone.
revoke all on public.v_token_balances from anon, authenticated;
grant select on public.v_token_balances to authenticated;

-- Comments are for members, which the tables' own policies already say; the
-- view was skipping them by running as its owner.
alter view public.v_machine_comments set (security_invoker = true);

-- Read-only views stay read-only.
revoke insert, update, delete, truncate, references, trigger
  on public.v_machine_comments, public.v_interest_overview,
     public.v_achievement_progress, public.v_user_collection
  from authenticated;
