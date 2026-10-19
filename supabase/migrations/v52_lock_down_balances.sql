-- Part B of the API lockdown (v51), applied once the app stopped using them.
--
-- The admin tokens page now reads admin_token_balances(), which checks
-- is_admin(), and the profile page reads your own balance through
-- token_breakdown(). That leaves the old view, which showed every member's
-- balance to every member, and the three functions that take any user's id
-- and return their balance. The SECURITY DEFINER functions that use those
-- three internally (token_breakdown, market_buy, vending_checkout and the
-- rest) run as postgres and are unaffected.

drop view if exists public.v_token_balances;

revoke execute on function public.token_balance(uuid)     from authenticated;
revoke execute on function public.allowance_balance(uuid) from authenticated;
revoke execute on function public.earned_balance(uuid)    from authenticated;
