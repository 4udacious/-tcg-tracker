-- Double battles: two trainers you've beaten, back together as a tag team.
--
-- Each pair (30: Johto's and Kanto's gyms two at a time, the Elite Fours,
-- Lance & Clair, Koga & Janine, Alex & Red, and the same for Hoenn and
-- Sinnoh, with Byron & Roark, Volkner & Flint and Wallace & Cynthia) is its
-- own supply, a ticket on the machine's shelf like the rematch tickets (v89):
-- 2 tokens, one a checkout, 3% of restocks each (change any of it in Admin ->
-- VVM -> Rematches). In the game it's a 2v2 against the strongest three of
-- each of their teams, above your level (public/rpg/game.js, PAIRS).
--
-- Only for those who've beaten both: buying one needs both battles' paid
-- milestones (battle_milestones). A trigger on user_items checks it, like
-- rematch_needs_win (v89), and raises double_not_beaten, which undoes the
-- whole checkout. The game leaves the ticket off your shelf until then.
--
-- A win pays 6.00 (the game's DOUBLE_TOKENS) outside the daily battle-token
-- cap, once per ticket taken into the game, like a rematch (v93):
-- rematch_credits.doubles counts the tickets taken, and battle_award_double()
-- pays one, recorded in battle_awards as kind 'rematch', source 'double'.
--
-- Safe to re-run (no drops).

insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order, max_per_checkout) values
  ('double_falkner_bugsy', 'item', 'Falkner & Bugsy Double', 'Double battle with Falkner and Bugsy: 2v2, their strongest 3 each', 2.00, 3, true, 230, 1),
  ('double_whitney_morty', 'item', 'Whitney & Morty Double', 'Double battle with Whitney and Morty: 2v2, their strongest 3 each', 2.00, 3, true, 231, 1),
  ('double_chuck_jasmine', 'item', 'Chuck & Jasmine Double', 'Double battle with Chuck and Jasmine: 2v2, their strongest 3 each', 2.00, 3, true, 232, 1),
  ('double_pryce_clair', 'item', 'Pryce & Clair Double', 'Double battle with Pryce and Clair: 2v2, their strongest 3 each', 2.00, 3, true, 233, 1),
  ('double_brock_misty', 'item', 'Brock & Misty Double', 'Double battle with Brock and Misty: 2v2, their strongest 3 each', 2.00, 3, true, 234, 1),
  ('double_surge_erika', 'item', 'Lt. Surge & Erika Double', 'Double battle with Lt. Surge and Erika: 2v2, their strongest 3 each', 2.00, 3, true, 235, 1),
  ('double_janine_sabrina', 'item', 'Janine & Sabrina Double', 'Double battle with Janine and Sabrina: 2v2, their strongest 3 each', 2.00, 3, true, 236, 1),
  ('double_blaine_blue', 'item', 'Blaine & Blue Double', 'Double battle with Blaine and Blue: 2v2, their strongest 3 each', 2.00, 3, true, 237, 1),
  ('double_will_karen', 'item', 'Will & Karen Double', 'Double battle with Will and Karen, Johto Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 238, 1),
  ('double_koga_bruno', 'item', 'Koga & Bruno Double', 'Double battle with Koga and Bruno, Johto Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 239, 1),
  ('double_lorelei_agatha', 'item', 'Lorelei & Agatha Double', 'Double battle with Lorelei and Agatha, Kanto Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 240, 1),
  ('double_bruno_lance', 'item', 'Bruno & Lance (Kanto) Double', 'Double battle with Bruno and Lance, Kanto Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 241, 1),
  ('double_lance_clair', 'item', 'Lance & Clair Double', 'Double battle with Lance and Clair, the dragon clan: 2v2, their strongest 3 each', 2.00, 3, true, 242, 1),
  ('double_koga_janine', 'item', 'Koga & Janine Double', 'Double battle with Koga and Janine, father and daughter: 2v2, their strongest 3 each', 2.00, 3, true, 243, 1),
  ('double_alex_red', 'item', 'Alex & Red Double', 'Double battle with Alex and Red: 2v2, their strongest 3 each', 2.00, 3, true, 244, 1),
  ('double_roxanne_brawly', 'item', 'Roxanne & Brawly Double', 'Double battle with Roxanne and Brawly: 2v2, their strongest 3 each', 2.00, 3, true, 245, 1),
  ('double_wattson_flannery', 'item', 'Wattson & Flannery Double', 'Double battle with Wattson and Flannery: 2v2, their strongest 3 each', 2.00, 3, true, 246, 1),
  ('double_norman_winona', 'item', 'Norman & Winona Double', 'Double battle with Norman and Winona: 2v2, their strongest 3 each', 2.00, 3, true, 247, 1),
  ('double_tateliza_juan', 'item', 'Tate & Liza and Juan Double', 'Double battle with Tate & Liza and Juan: 2v2, their strongest 3 each', 2.00, 3, true, 248, 1),
  ('double_roark_gardenia', 'item', 'Roark & Gardenia Double', 'Double battle with Roark and Gardenia: 2v2, their strongest 3 each', 2.00, 3, true, 249, 1),
  ('double_maylene_wake', 'item', 'Maylene & Crasher Wake Double', 'Double battle with Maylene and Crasher Wake: 2v2, their strongest 3 each', 2.00, 3, true, 250, 1),
  ('double_fantina_byron', 'item', 'Fantina & Byron Double', 'Double battle with Fantina and Byron: 2v2, their strongest 3 each', 2.00, 3, true, 251, 1),
  ('double_candice_volkner', 'item', 'Candice & Volkner Double', 'Double battle with Candice and Volkner: 2v2, their strongest 3 each', 2.00, 3, true, 252, 1),
  ('double_sidney_phoebe', 'item', 'Sidney & Phoebe Double', 'Double battle with Sidney and Phoebe, Hoenn Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 253, 1),
  ('double_glacia_drake', 'item', 'Glacia & Drake Double', 'Double battle with Glacia and Drake, Hoenn Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 254, 1),
  ('double_aaron_bertha', 'item', 'Aaron & Bertha Double', 'Double battle with Aaron and Bertha, Sinnoh Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 255, 1),
  ('double_flint_lucian', 'item', 'Flint & Lucian Double', 'Double battle with Flint and Lucian, Sinnoh Elite Four: 2v2, their strongest 3 each', 2.00, 3, true, 256, 1),
  ('double_byron_roark', 'item', 'Byron & Roark Double', 'Double battle with Byron and Roark, father and son: 2v2, their strongest 3 each', 2.00, 3, true, 257, 1),
  ('double_volkner_flint', 'item', 'Volkner & Flint Double', 'Double battle with Volkner and Flint, best friends: 2v2, their strongest 3 each', 2.00, 3, true, 258, 1),
  ('double_wallace_cynthia', 'item', 'Wallace & Cynthia Double', 'Double battle with Wallace and Cynthia, two Champions: 2v2, their strongest 3 each', 2.00, 3, true, 259, 1)
on conflict (key) do nothing;

/** The two battles a double battle ticket needs: the pair's milestones. Null for any other supply. */
create or replace function public.double_milestones(p_key text)
returns text[]
language sql immutable set search_path to 'public' as $function$
  select array[a, b] from (values
    ('double_falkner_bugsy', 'gym:0', 'gym:1'),
    ('double_whitney_morty', 'gym:2', 'gym:3'),
    ('double_chuck_jasmine', 'gym:4', 'gym:5'),
    ('double_pryce_clair', 'gym:6', 'gym:7'),
    ('double_brock_misty', 'gym:8', 'gym:9'),
    ('double_surge_erika', 'gym:10', 'gym:11'),
    ('double_janine_sabrina', 'gym:12', 'gym:13'),
    ('double_blaine_blue', 'gym:14', 'gym:15'),
    ('double_will_karen', 'elite:WILL', 'elite:KAREN'),
    ('double_koga_bruno', 'elite:KOGA', 'elite:BRUNO'),
    ('double_lorelei_agatha', 'kanto:LORELEI', 'kanto:AGATHA'),
    ('double_bruno_lance', 'kanto:BRUNO', 'kanto:LANCE'),
    ('double_lance_clair', 'elite:LANCE', 'gym:7'),
    ('double_koga_janine', 'elite:KOGA', 'gym:12'),
    ('double_alex_red', 'rival:0', 'kanto:RED'),
    ('double_roxanne_brawly', 'gym:16', 'gym:17'),
    ('double_wattson_flannery', 'gym:18', 'gym:19'),
    ('double_norman_winona', 'gym:20', 'gym:21'),
    ('double_tateliza_juan', 'gym:22', 'gym:23'),
    ('double_roark_gardenia', 'gym:24', 'gym:25'),
    ('double_maylene_wake', 'gym:26', 'gym:27'),
    ('double_fantina_byron', 'gym:28', 'gym:29'),
    ('double_candice_volkner', 'gym:30', 'gym:31'),
    ('double_sidney_phoebe', 'hoenn:SIDNEY', 'hoenn:PHOEBE'),
    ('double_glacia_drake', 'hoenn:GLACIA', 'hoenn:DRAKE'),
    ('double_aaron_bertha', 'sinnoh:AARON', 'sinnoh:BERTHA'),
    ('double_flint_lucian', 'sinnoh:FLINT', 'sinnoh:LUCIAN'),
    ('double_byron_roark', 'gym:29', 'gym:24'),
    ('double_volkner_flint', 'gym:31', 'sinnoh:FLINT'),
    ('double_wallace_cynthia', 'hoenn:WALLACE', 'sinnoh:CYNTHIA')
  ) t(k, a, b) where k = p_key;
$function$;

create or replace function public.double_needs_wins()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare v_need text[] := public.double_milestones(new.item_key);
begin
  if v_need is null or new.qty <= coalesce(case when tg_op = 'UPDATE' then old.qty end, 0) then return new; end if;
  if (select count(distinct m.key) from public.battle_milestones m where m.user_id = new.user_id and m.key = any(v_need)) < 2 then
    raise exception 'double_not_beaten' using errcode = 'P0001';
  end if;
  return new;
end $function$;
revoke all on function public.double_needs_wins() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'user_items_double_needs_wins') then
    create trigger user_items_double_needs_wins before insert or update of qty on public.user_items
      for each row execute function public.double_needs_wins();
  end if;
end $$;

-- Double battle tickets taken into the game: one more double battle win owed.
alter table public.rematch_credits add column if not exists doubles int not null default 0 check (doubles >= 0);

create or replace function public.double_ticket_taken()
returns trigger
language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.item_key like 'double\_%' and new.qty < old.qty then
    insert into public.rematch_credits (user_id, doubles) values (new.user_id, old.qty - new.qty)
    on conflict (user_id) do update set doubles = rematch_credits.doubles + excluded.doubles, updated_at = now();
  end if;
  return new;
end $function$;
revoke all on function public.double_ticket_taken() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'user_items_double_taken') then
    create trigger user_items_double_taken after update of qty on public.user_items
      for each row execute function public.double_ticket_taken();
  end if;
end $$;

/** A won double battle: 6.00 into earned tokens for one of your tickets, outside the daily battle cap. */
create or replace function public.battle_award_double()
returns table(ok boolean, reason text, awarded numeric, balance numeric)
language plpgsql security definer set search_path to 'public' as $function$
declare
  me uuid := auth.uid();
  v_pay constant numeric(12,2) := 6.00;   -- DOUBLE_TOKENS in public/rpg/game.js
begin
  if not public.battle_rewards_allowed() then
    return query select false, 'not_allowed', 0::numeric, coalesce(public.token_balance(me), 0); return;
  end if;
  perform pg_advisory_xact_lock(hashtext('battle_award:' || me::text));
  update public.rematch_credits set doubles = doubles - 1, updated_at = now() where user_id = me and doubles > 0;
  if not found then
    return query select false, 'no_ticket', 0::numeric, public.token_balance(me); return;
  end if;
  insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
  values (me, v_pay, 'battle_reward', public.current_token_period(), 'Battle — double battle', 'earned');
  insert into public.battle_awards (user_id, kind, amount, source) values (me, 'rematch', v_pay, 'double');
  return query select true, 'ok', v_pay, public.token_balance(me);
end $function$;
revoke all on function public.battle_award_double() from public, anon;
grant execute on function public.battle_award_double() to authenticated;
