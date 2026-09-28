-- Make a cooldown change take effect on cooldowns already running.
--
-- Already applied to the live database. Kept here as the record of the change.
--
-- vending_checkout stamps an absolute vending_cooldown_until on the profile at
-- purchase time, computed from whatever cooldown_hours was at that moment.
-- Lowering the setting afterwards therefore did nothing for anyone mid-wait:
-- the old duration kept ticking. Setting it to 0 looked broken because six
-- members still had future timestamps sitting on their profiles.
--
-- update_vending_settings now clamps in-flight cooldowns to the new duration.
-- It only ever shortens them (least(...)), so raising the cooldown does not
-- retroactively punish someone already waiting; 0 clears them outright.

create or replace function public.update_vending_settings(
  p_monthly_allowance integer,
  p_per_cycle_pack_cap integer default null::integer,
  p_tokens_expire_monthly boolean default true,
  p_cooldown_hours numeric default 3,
  p_tokens_per_timer_report integer default 1,
  p_max_earned_tokens_per_month integer default 15
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new_until timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change vending settings';
  end if;
  if p_cooldown_hours < 0 then
    raise exception 'Cooldown cannot be negative';
  end if;
  if p_tokens_per_timer_report < 0 or p_max_earned_tokens_per_month < 0 then
    raise exception 'Reward values cannot be negative';
  end if;

  update public.vending_settings
     set monthly_allowance            = p_monthly_allowance,
         per_cycle_pack_cap           = p_per_cycle_pack_cap,
         tokens_expire_monthly        = p_tokens_expire_monthly,
         cooldown_hours               = p_cooldown_hours,
         tokens_per_timer_report      = p_tokens_per_timer_report,
         max_earned_tokens_per_month  = p_max_earned_tokens_per_month,
         updated_at                   = now(),
         updated_by                   = auth.uid()
   where id;

  -- Shorten (never extend) cooldowns already in flight.
  v_new_until := now() + make_interval(
    hours => floor(p_cooldown_hours)::int,
    mins  => ((p_cooldown_hours - floor(p_cooldown_hours)) * 60)::int
  );

  update public.profiles
     set vending_cooldown_until = case
           when p_cooldown_hours = 0 then null
           else least(vending_cooldown_until, v_new_until)
         end
   where vending_cooldown_until is not null
     and vending_cooldown_until > now();
end $function$;

-- One-off cleanup for the cooldowns stranded before the fix existed.
update public.profiles
   set vending_cooldown_until = null
 where vending_cooldown_until is not null
   and vending_cooldown_until > now()
   and (select cooldown_hours from public.vending_settings where id) = 0;
