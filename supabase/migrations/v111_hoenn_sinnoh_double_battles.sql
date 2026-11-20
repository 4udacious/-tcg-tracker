-- Double battles for Hoenn and Sinnoh: their 15 pairs, after v109's Johto
-- and Kanto ones. Each is its own ticket on the VVM's shelf, exactly like
-- v109's (2 tokens, one a checkout, 3% of restocks each), for those who've
-- beaten both: Hoenn's and Sinnoh's gyms two at a time, their Elite Fours,
-- Byron & Roark, Volkner & Flint, and Wallace & Cynthia.
--
-- double_milestones() is redefined with all 30 pairs, so the trigger from
-- v109 (double_needs_wins) checks these too; the payout (v109's
-- battle_award_double) needs nothing new. Apply with v107 (the Hoenn & Sinnoh
-- League), after v109. Safe to re-run.

insert into public.vvm_supplies (key, kind, name, description, token_price, appearance_rate, is_active, sort_order, max_per_checkout) values
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
