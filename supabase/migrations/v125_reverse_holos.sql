-- Reverse holos, for the five Pokemon sets that printed one in every pack: Legendary Collection (base6),
-- Expedition (ecard1), Aquapolis (ecard2), Skyridge (ecard3) and EX Ruby & Sapphire (ex1). 667 cards.
--
-- Each is a card of its own: rarity V ("Reverse Holo"), numbered after its card with _rh ('3_rh' beside Charizard's
-- '3'), so it sorts beside it, collects and trades separately, and has its own art (/cards/base6-3_rh.webp: the
-- card's art with the set's reverse foil laid around the picture). Every numbered card in these sets had one except
-- Expedition's six basic Energy, Aquapolis's three Crystal Pokemon and EX Ruby & Sapphire's eight Pokemon-ex (from
-- TCGplayer's and PriceCharting's records); the e-Card sets' H-numbered holos are holo versions, not reverses.
-- Legendary Collection 110, Expedition 159, Aquapolis 147, Skyridge 150, EX Ruby & Sapphire 101. Names come from the cards
-- they reverse.
--
-- open_pack: a pack from one of these sets holds 6 commons, not 7, and a reverse holo, turned over just before the
-- rare. Which one goes by its card's rarity: a common's 55 times in 100, an uncommon's 30, a rare's 11, a holo's (or
-- a Crystal Pokemon's) 4, as reverse sheets ran. Every other set opens as before.
--
-- The card shop pays a reverse holo a little under a rare (lcs_prices V).
--
-- Needs v124 (Legendary Collection and Skyridge). Safe to re-run.

-- V joins the rarities a card can have (as v96 added One Piece's L and P).
alter table public.vending_cards drop constraint if exists vending_cards_rarity_check;
alter table public.vending_cards add constraint vending_cards_rarity_check check (rarity in ('C', 'U', 'R', 'H', 'S', 'L', 'P', 'V'));

-- set|numbers, the cards with a reverse holo.
insert into public.vending_cards (set_code, number, name, rarity)
select b.set_code, b.number || '_rh', b.name, 'V'
  from (
    select parts[1] as set_code, unnest(string_to_array(parts[2], ',')) as number
      from (select string_to_array(btrim(line, E' \t\r'), '|') as parts
              from unnest(string_to_array($rh$
base6|1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110
ecard1|1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159
ecard2|1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147
ecard3|1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150
ex1|1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,104,105,106,107,108,109
$rh$, E'\n')) as line where btrim(line, E' \t\r') <> '') t
  ) v
  join public.vending_cards b on b.set_code = v.set_code and b.number = v.number
on conflict (set_code, number) do nothing;

-- Every one found its card: a set missing here means v124 isn't in, or a number moved.
do $$
declare r record;
begin
  for r in select * from (values ('base6', 110), ('ecard1', 159), ('ecard2', 147), ('ecard3', 150), ('ex1', 101)) e(set_code, n) loop
    if (select count(*) from public.vending_cards c where c.set_code = r.set_code and c.rarity = 'V') <> r.n then
      raise exception 'reverse holos: % has % of %', r.set_code,
        (select count(*) from public.vending_cards c where c.set_code = r.set_code and c.rarity = 'V'), r.n;
    end if;
  end loop;
end $$;

insert into public.lcs_prices (rarity, price) values ('V', 0.08) on conflict (rarity) do nothing;

-- open_pack as v113 left it, with the reverse-holo slot in the Pokemon pack.
do $$
declare d text := pg_get_functiondef('public.open_pack(bigint)'::regprocedure);
  decl_a text := $q$v_ex boolean; v_mid char(1);$q$;
  ex_a text := $q$    v_ex := random() < 0.25;
  end if;
  return query
$q$;
  commons_a text := $q$c.rarity = 'C' order by random() limit 7) a$q$;
  rare_a text := $q$    union all select id, 3 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare
                                     and (v_ex is null or (c.name like '% ex') = v_ex) order by random() limit 1) d),$q$;
begin
  if position('v_rev' in d) > 0 then return; end if;   -- already done
  if position(decl_a in d) = 0 or position(ex_a in d) = 0 or position(commons_a in d) = 0 or position(rare_a in d) = 0 then
    raise exception 'open_pack has changed: update v125 by hand';
  end if;
  d := replace(d, decl_a, $q$v_ex boolean; v_mid char(1); v_rev boolean;$q$);
  d := replace(d, ex_a, $q$    v_ex := random() < 0.25;
  end if;
  -- A set with reverse holos (v125): one in every pack, in place of a common.
  v_rev := exists (select 1 from public.vending_cards vc where vc.set_code = v_code and vc.rarity = 'V');
  return query
$q$);
  d := replace(d, commons_a, $q$c.rarity = 'C' order by random() limit case when v_rev then 6 else 7 end) a$q$);
  d := replace(d, rare_a, $q$    -- The reverse holo, by its card's rarity (a common's 55 in 100, an uncommon's 30, a rare's 11, a holo's 4), before the rare.
    union all select id, 3 from (select x.id from (select c.id, b.rarity as br, count(*) over (partition by b.rarity) as n
                                                     from public.vending_cards c
                                                     join public.vending_cards b on b.set_code = c.set_code and b.number = left(c.number, -3)
                                                    where v_rev and c.set_code = v_code and c.rarity = 'V') x
                                  order by -ln(1 - random()) * x.n / (case x.br when 'C' then 55 when 'U' then 30 when 'R' then 11 else 4 end)
                                  limit 1) rv
    union all select id, 4 from (select c.id from public.vending_cards c where c.set_code = v_code and c.rarity = v_rare
                                     and (v_ex is null or (c.name like '% ex') = v_ex) order by random() limit 1) d),$q$);
  execute d;
end $$;
