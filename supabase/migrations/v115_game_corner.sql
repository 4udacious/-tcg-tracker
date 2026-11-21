-- The Game Corner, part 1: slots and roulette, played with tokens.
--
-- Real casino odds (the house wins slowly, so it drains tokens from the
-- economy rather than adding them):
--   * Slots: three reels, each a strip of 26 stops (1 Seven, 2 Bars, 3
--     Pikachu, 4 Poke Balls, 7 Cherries, 9 blanks), seen three rows at a
--     time: a 3x3 window and five paylines (the three rows and the two
--     diagonals), all played every spin, the bet split evenly across them.
--     On a line, three of a kind pays 400x / 80x / 30x / 15x / 8x its share
--     of the bet, two Cherries 4x. Returns 95.2% over time (every line is one
--     stop from each reel, so any number of lines returns the same); on five
--     lines something pays on 67% of spins, more than the bet on 31%.
--   * Roulette: one shared single-zero wheel (house edge 2.7%). A round every
--     30 s: bets for the first 20 s, then the spin. A number pays 36x the bet
--     (35 to 1 and the bet back), a dozen or a column 3x, red/black, odd/even
--     and 1-18/19-36 2x; zero loses every outside bet.
--
-- Shared: the slots are a row of 8 machines, each held by whoever sits at it
-- (free again after 2 minutes without a spin or a look), and everyone sees
-- their neighbours' reels and wins. Everyone at the roulette table sees every
-- bet on it, by name, and the same spin.
--
-- Nothing runs on a timer: a round is settled by the first read (or bet)
-- after its betting closes, the way get_vending_state restocks (v17). The
-- result is drawn then, after the last bet could have been placed.
--
-- Tokens: a bet is spent like any purchase (allowance first, then earned,
-- spend_tokens), reason game_corner_bet. Winnings (reason game_corner_win) go
-- back to the buckets the bet came from, in proportion, so the Game Corner
-- can't turn an expiring allowance into lasting earned tokens. Bets are
-- capped per game (game_corner_settings, Admin -> VVM -> Game Corner); no
-- daily cap.
--
-- It starts closed: hidden from members (the page and the VVM's card show
-- only to admins), who can still play it to try it out. An admin opens it in
-- Admin -> VVM -> Game Corner.
--
-- Safe to re-run.

-- ─────────────────────────────────────────────── settings
create table if not exists public.game_corner_settings (
  id                boolean primary key default true check (id),
  is_open           boolean not null default false,   -- closed until an admin opens it
  min_bet           numeric(12,2) not null default 0.10 check (min_bet > 0),
  slots_max_bet     numeric(12,2) not null default 1.00,
  roulette_max_bet  numeric(12,2) not null default 5.00,   -- a member's bets on one spin, all together
  blackjack_max_bet numeric(12,2) not null default 5.00,   -- part 2
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles(id),
  constraint game_corner_caps check (slots_max_bet >= min_bet and roulette_max_bet >= min_bet and blackjack_max_bet >= min_bet)
);
insert into public.game_corner_settings (id) values (true) on conflict (id) do nothing;
alter table public.game_corner_settings enable row level security;
drop policy if exists game_corner_settings_read on public.game_corner_settings;
create policy game_corner_settings_read on public.game_corner_settings for select using (public.is_member());
revoke insert, update, delete, truncate on public.game_corner_settings from anon, authenticated;

/** Admins: open or close the Game Corner, and set its bets (tokens). */
create or replace function public.set_game_corner_settings(p_open boolean, p_min_bet numeric, p_slots_max numeric, p_roulette_max numeric, p_blackjack_max numeric)
returns public.game_corner_settings
language plpgsql security definer set search_path to 'public' as $$
declare s public.game_corner_settings;
begin
  if not public.is_admin() then raise exception 'Only admins can change the Game Corner'; end if;
  update public.game_corner_settings
     set is_open = p_open, min_bet = round(p_min_bet, 2), slots_max_bet = round(p_slots_max, 2),
         roulette_max_bet = round(p_roulette_max, 2), blackjack_max_bet = round(p_blackjack_max, 2),
         updated_at = now(), updated_by = auth.uid()
   where id returning * into s;
  return s;
end $$;

-- ─────────────────────────────────────────────── tokens
-- Two more reasons a ledger row can have.
alter table public.token_ledger drop constraint if exists token_ledger_reason_check;
alter table public.token_ledger add constraint token_ledger_reason_check check (reason = any (array[
  'monthly_grant', 'admin_adjustment', 'purchase', 'refund', 'timer_reward', 'timer_revoked', 'rebucket', 'grading',
  'market_buy', 'market_sale', 'bid_hold', 'bid_refund', 'interest_reward', 'cleaning', 'battle_reward', 'card_sale',
  'trade', 'game_corner_bet', 'game_corner_win']));

/** A bet: spent like a purchase. Returns how much of it came from the allowance (the rest from earned). Internal. */
create or replace function public.game_corner_take(p_user uuid, p_amount numeric, p_note text)
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare v_allow numeric(12,2);
begin
  if p_amount is null or p_amount <= 0 then raise exception 'bad_bet' using errcode = 'P0001'; end if;
  if public.token_balance(p_user) < p_amount then raise exception 'not_enough_tokens' using errcode = 'P0001'; end if;
  v_allow := least(p_amount, greatest(0, public.allowance_balance(p_user)));
  perform public.spend_tokens(p_user, p_amount, 'game_corner_bet', p_note);
  return v_allow;
end $$;

/** Winnings (or a refund), back to the buckets the stake came from, in proportion. Internal. */
create or replace function public.game_corner_pay(p_user uuid, p_amount numeric, p_stake numeric, p_from_allowance numeric, p_reason text, p_note text)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare v_allow numeric(12,2); v_earned numeric(12,2);
begin
  if p_amount is null or p_amount <= 0 then return; end if;
  v_allow := case when p_stake > 0 then round(p_amount * least(1, greatest(0, p_from_allowance / p_stake)), 2) else 0 end;
  v_earned := p_amount - v_allow;
  if v_allow > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, v_allow, p_reason, public.current_token_period(), p_note, 'allowance');
  end if;
  if v_earned > 0 then
    insert into public.token_ledger (user_id, delta, reason, period, note, bucket)
    values (p_user, v_earned, p_reason, public.current_token_period(), p_note, 'earned');
  end if;
end $$;

/** Who may play (members while it's open, admins always), and a bet's size: an error code the page explains, or null. Internal. */
create or replace function public.game_corner_check(p_amount numeric, p_max numeric)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare s public.game_corner_settings;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  if not s.is_open and not public.is_admin() then raise exception 'closed' using errcode = 'P0001'; end if;   -- admins try it out while it's closed
  if p_amount is null or p_amount <> round(p_amount, 2) or p_amount < s.min_bet then raise exception 'bet_too_small' using errcode = 'P0001'; end if;
  if p_amount > p_max then raise exception 'bet_too_big' using errcode = 'P0001'; end if;
end $$;

-- ─────────────────────────────────────────────── slots
create table if not exists public.game_corner_slots (
  machine    smallint primary key check (machine between 1 and 8),
  user_id    uuid unique references public.profiles(id) on delete set null,
  seen_at    timestamptz,
  last_reels text[],                -- the 3x3 window, reel by reel: reel 1 top, middle, bottom, then reel 2, then reel 3
  last_lines smallint[],            -- the paylines that paid (1 top, 2 middle, 3 bottom, 4 top-left to bottom-right, 5 bottom-left to top-right)
  last_bet   numeric(12,2),
  last_win   numeric(12,2),
  last_at    timestamptz,
  spins      integer not null default 0
);
insert into public.game_corner_slots (machine) select g from generate_series(1, 8) g on conflict (machine) do nothing;
alter table public.game_corner_slots enable row level security;   -- read and changed only through the functions below
revoke all on public.game_corner_slots from anon, authenticated;

/** The reel strip, 26 stops (every reel the same strip, each stopping on its own). */
create or replace function public.game_corner_strip()
returns text[]
language sql immutable as $$
  select array['SEVEN','BLANK','CHERRY','BALL','BLANK','PIKACHU','CHERRY','BLANK','BAR','CHERRY','BALL','BLANK','PIKACHU',
               'CHERRY','BLANK','BALL','BAR','CHERRY','BLANK','PIKACHU','BLANK','CHERRY','BALL','BLANK','CHERRY','BLANK']
$$;

/** What one payline's three symbols pay, as a multiple of the line's share of the bet. */
create or replace function public.game_corner_slot_pays(p_line text[])
returns numeric
language sql immutable set search_path to 'public' as $$
  select case
    when p_line[1] = p_line[2] and p_line[2] = p_line[3] and p_line[1] <> 'BLANK' then
      case p_line[1] when 'SEVEN' then 400 when 'BAR' then 80 when 'PIKACHU' then 30 when 'BALL' then 15 when 'CHERRY' then 8 end
    when (select count(*) from unnest(p_line) r where r = 'CHERRY') = 2 then 4
    else 0 end;
$$;

/** Sit at a slot machine (and leave any other): yours if it's free, or its player hasn't spun or looked in 2 minutes. */
create or replace function public.game_corner_slot_sit(p_machine integer)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); m public.game_corner_slots;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  if not (select s.is_open from public.game_corner_settings s where s.id) and not public.is_admin() then raise exception 'closed' using errcode = 'P0001'; end if;
  select * into m from public.game_corner_slots where machine = p_machine for update;
  if m.machine is null then raise exception 'no_such_machine' using errcode = 'P0001'; end if;
  if m.user_id = me then update public.game_corner_slots set seen_at = now() where machine = p_machine; return true; end if;
  if m.user_id is not null and m.seen_at > now() - interval '2 minutes' then raise exception 'seat_taken' using errcode = 'P0001'; end if;
  update public.game_corner_slots set user_id = null where user_id = me;
  update public.game_corner_slots set user_id = me, seen_at = now(), last_reels = null, last_lines = null, last_bet = null, last_win = null, last_at = null where machine = p_machine;
  return true;
end $$;

/** Get up from your slot machine. */
create or replace function public.game_corner_slot_leave()
returns void
language sql security definer set search_path to 'public' as $$
  update public.game_corner_slots set user_id = null where user_id = auth.uid();
$$;

/**
 * Spin your slot machine for p_bet tokens, split evenly across the five paylines (so in fifths of a cent: 0.10 is
 * 0.02 a line). Returns the 3x3 window (reel by reel), what each paying line won, the total and your balance after.
 */
create or replace function public.game_corner_slot_spin(p_bet numeric)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid(); m public.game_corner_slots; s public.game_corner_settings;
  strip text[] := public.game_corner_strip(); n int := array_length(public.game_corner_strip(), 1);
  -- Each payline: the row it takes on reels 1, 2 and 3 (1 top, 2 middle, 3 bottom).
  lines int[] := array[[1,1,1], [2,2,2], [3,3,3], [1,2,3], [3,2,1]];
  v_allow numeric(12,2); v_line_bet numeric; v_grid text[] := '{}'; v_stop int; v_mult numeric;
  v_win numeric(12,2) := 0; v_paid smallint[] := '{}'; v_wins jsonb := '[]';
begin
  select * into s from public.game_corner_settings where id;
  perform public.game_corner_check(p_bet, s.slots_max_bet);
  if (p_bet * 100) % 5 <> 0 then raise exception 'bad_bet' using errcode = 'P0001'; end if;   -- five lines, a whole cent each
  v_line_bet := p_bet / 5;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  select * into m from public.game_corner_slots where user_id = me for update;
  if m.machine is null then raise exception 'not_seated' using errcode = 'P0001'; end if;
  v_allow := public.game_corner_take(me, p_bet, 'Slots, machine ' || m.machine);
  for r in 1..3 loop
    v_stop := floor(random() * n)::int;
    for k in 0..2 loop v_grid := v_grid || strip[1 + (v_stop + k) % n]; end loop;   -- this reel's three rows, top down
  end loop;
  for l in 1..5 loop
    v_mult := public.game_corner_slot_pays(array[v_grid[lines[l][1]], v_grid[3 + lines[l][2]], v_grid[6 + lines[l][3]]]);
    if v_mult > 0 then
      v_win := v_win + round(v_line_bet * v_mult, 2); v_paid := v_paid || l::smallint;
      v_wins := v_wins || jsonb_build_object('line', l, 'mult', v_mult, 'win', round(v_line_bet * v_mult, 2));
    end if;
  end loop;
  perform public.game_corner_pay(me, v_win, p_bet, v_allow, 'game_corner_win', 'Slots, machine ' || m.machine || ': ' || array_to_string(v_grid, ' '));
  update public.game_corner_slots
     set seen_at = now(), last_reels = v_grid, last_lines = v_paid, last_bet = p_bet, last_win = v_win, last_at = now(), spins = spins + 1
   where machine = m.machine;
  return jsonb_build_object('machine', m.machine, 'reels', to_jsonb(v_grid), 'lines', v_wins, 'bet', p_bet, 'win', v_win, 'balance', public.token_balance(me));
end $$;

-- ─────────────────────────────────────────────── roulette
create table if not exists public.game_corner_roulette_rounds (
  round_no   bigint primary key,            -- floor(epoch / 30): the round's 30 seconds
  result     smallint not null check (result between 0 and 36),
  settled_at timestamptz not null default now()
);
create table if not exists public.game_corner_roulette_bets (
  id             bigserial primary key,
  round_no       bigint not null,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('number', 'red', 'black', 'odd', 'even', 'low', 'high', 'dozen', 'column')),
  pick           smallint,                   -- a number 0-36, or a dozen or column 1-3
  amount         numeric(12,2) not null check (amount > 0),
  from_allowance numeric(12,2) not null default 0,
  payout         numeric(12,2),
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  constraint game_corner_roulette_pick check (
    (kind = 'number' and pick between 0 and 36) or (kind in ('dozen', 'column') and pick between 1 and 3)
    or (kind not in ('number', 'dozen', 'column') and pick is null))
);
create index if not exists game_corner_roulette_bets_open on public.game_corner_roulette_bets (round_no) where settled_at is null;
create index if not exists game_corner_roulette_bets_round on public.game_corner_roulette_bets (round_no, user_id);
alter table public.game_corner_roulette_rounds enable row level security;
alter table public.game_corner_roulette_bets enable row level security;
revoke all on public.game_corner_roulette_rounds, public.game_corner_roulette_bets from anon, authenticated;

/** The red numbers on a single-zero wheel. */
create or replace function public.game_corner_red(n integer)
returns boolean
language sql immutable as $$ select n = any (array[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]) $$;

/** What a bet returns on a result, as a multiple of the bet (the bet back included); 0 if it loses. */
create or replace function public.game_corner_roulette_pays(p_kind text, p_pick integer, p_result integer)
returns integer
language sql immutable set search_path to 'public' as $$
  select case
    when p_kind = 'number' then case when p_result = p_pick then 36 else 0 end
    when p_result = 0 then 0
    when p_kind = 'red' then case when public.game_corner_red(p_result) then 2 else 0 end
    when p_kind = 'black' then case when not public.game_corner_red(p_result) then 2 else 0 end
    when p_kind = 'odd' then case when p_result % 2 = 1 then 2 else 0 end
    when p_kind = 'even' then case when p_result % 2 = 0 then 2 else 0 end
    when p_kind = 'low' then case when p_result <= 18 then 2 else 0 end
    when p_kind = 'high' then case when p_result >= 19 then 2 else 0 end
    when p_kind = 'dozen' then case when (p_result - 1) / 12 + 1 = p_pick then 3 else 0 end
    when p_kind = 'column' then case when (p_result - 1) % 3 + 1 = p_pick then 3 else 0 end
    else 0 end;
$$;

/** The roulette clock: this round, and whether its bets are still open. */
create or replace function public.game_corner_roulette_now(out round_no bigint, out betting boolean, out into_round numeric)
language sql stable as $$
  select floor(extract(epoch from now()) / 30)::bigint, (extract(epoch from now())::numeric % 30) < 20, extract(epoch from now())::numeric % 30;
$$;

/**
 * Settles every round whose betting has closed: draws its result (once, the first time it's needed) and pays its
 * winning bets. Also draws the current round's result once its betting closes, bets or not, so everyone watching
 * sees the same spin. Internal; called by the state read and by a bet.
 */
create or replace function public.game_corner_roulette_settle()
returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record; r bigint; v_result smallint; w record;
begin
  select * into c from public.game_corner_roulette_now();
  for r in
    select distinct b.round_no from public.game_corner_roulette_bets b
     where b.settled_at is null and (b.round_no < c.round_no or (b.round_no = c.round_no and not c.betting))
    union select c.round_no where not c.betting
  loop
    insert into public.game_corner_roulette_rounds (round_no, result) values (r, floor(random() * 37)::smallint)
    on conflict (round_no) do nothing;
    select x.result into v_result from public.game_corner_roulette_rounds x where x.round_no = r;
    -- Each unsettled bet once (whoever gets here first), then each winner paid once for the round.
    for w in
      with done as (
        update public.game_corner_roulette_bets b
           set payout = b.amount * public.game_corner_roulette_pays(b.kind, b.pick, v_result), settled_at = now()
         where b.round_no = r and b.settled_at is null
        returning b.user_id, b.amount, b.from_allowance, b.payout)
      select d.user_id, sum(d.payout) as payout, sum(d.amount) as stake, sum(d.from_allowance) as from_allowance
        from done d group by d.user_id
    loop
      perform public.game_corner_pay(w.user_id, w.payout, w.stake, w.from_allowance, 'game_corner_win', 'Roulette, round ' || r || ': ' || v_result);
    end loop;
  end loop;
end $$;

/** A roulette bet on this round, while its bets are open. Your bets on one spin can't come to more than the cap. */
create or replace function public.game_corner_roulette_bet(p_kind text, p_pick integer, p_amount numeric)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_settings; c record; v_mine numeric; v_allow numeric(12,2);
begin
  select * into s from public.game_corner_settings where id;
  perform public.game_corner_check(p_amount, s.roulette_max_bet);
  select * into c from public.game_corner_roulette_now();
  if not c.betting then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  if not ((p_kind = 'number' and p_pick between 0 and 36) or (p_kind in ('dozen', 'column') and p_pick between 1 and 3)
          or (p_kind in ('red', 'black', 'odd', 'even', 'low', 'high') and p_pick is null)) then
    raise exception 'bad_bet' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  select coalesce(sum(amount), 0) into v_mine from public.game_corner_roulette_bets where round_no = c.round_no and user_id = me;
  if v_mine + p_amount > s.roulette_max_bet then raise exception 'bet_too_big' using errcode = 'P0001'; end if;
  v_allow := public.game_corner_take(me, p_amount, 'Roulette, round ' || c.round_no);
  insert into public.game_corner_roulette_bets (round_no, user_id, kind, pick, amount, from_allowance)
  values (c.round_no, me, p_kind, p_pick, p_amount, v_allow);
  return jsonb_build_object('round', c.round_no, 'mine', v_mine + p_amount, 'balance', public.token_balance(me));
end $$;

/** Take back your bets on this round while its bets are still open: the tokens go back where they came from. */
create or replace function public.game_corner_roulette_clear()
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); c record; v record;
begin
  select * into c from public.game_corner_roulette_now();
  if not c.betting then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  with gone as (delete from public.game_corner_roulette_bets where round_no = c.round_no and user_id = me and settled_at is null returning amount, from_allowance)
  select coalesce(sum(amount), 0) as amount, coalesce(sum(from_allowance), 0) as from_allowance into v from gone;
  perform public.game_corner_pay(me, v.amount, v.amount, v.from_allowance, 'refund', 'Roulette bets taken back, round ' || c.round_no);
  return v.amount;
end $$;

-- ─────────────────────────────────────────────── what the page reads
/**
 * Everything the Game Corner page shows, read once a second while it's open: your balance and the caps, the row
 * of slot machines (who's at each, their last spin), and the roulette table (this round's clock and everyone's
 * bets, its result once the betting's closed, your winnings last round, the last results). Settles any roulette
 * round that's due, and counts as a look at your slot machine (it stays yours while the page is open).
 */
create or replace function public.game_corner_state()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_settings; c record; v_slots jsonb; v_roulette jsonb;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  perform public.game_corner_roulette_settle();
  update public.game_corner_slots set seen_at = now() where user_id = me;
  select * into c from public.game_corner_roulette_now();

  select jsonb_agg(jsonb_build_object(
           'machine', m.machine,
           'player', case when m.user_id is not null and m.seen_at > now() - interval '2 minutes' then coalesce(p.display_name, p.username) end,
           'avatar', case when m.user_id is not null and m.seen_at > now() - interval '2 minutes' then p.avatar_url end,
           'mine', m.user_id = me,
           'reels', to_jsonb(m.last_reels), 'lines', to_jsonb(m.last_lines), 'bet', m.last_bet, 'win', m.last_win, 'at', m.last_at, 'spins', m.spins) order by m.machine)
    into v_slots
    from public.game_corner_slots m left join public.profiles p on p.id = m.user_id;

  select jsonb_build_object(
           'round', c.round_no,
           'betting', c.betting,
           'bets_close_at', to_timestamp(c.round_no * 30 + 20),
           'round_ends_at', to_timestamp(c.round_no * 30 + 30),
           'result', (select x.result from public.game_corner_roulette_rounds x where x.round_no = c.round_no),
           'bets', coalesce((select jsonb_agg(jsonb_build_object('kind', b.kind, 'pick', b.pick, 'amount', b.amount, 'player', coalesce(p.display_name, p.username), 'mine', b.user_id = me) order by b.id)
                               from public.game_corner_roulette_bets b join public.profiles p on p.id = b.user_id where b.round_no = c.round_no), '[]'::jsonb),
           'last', (select jsonb_build_object('round', l.round_no, 'result', x.result, 'stake', sum(l.amount), 'payout', sum(l.payout))
                      from public.game_corner_roulette_bets l join public.game_corner_roulette_rounds x on x.round_no = l.round_no
                     where l.user_id = me and l.settled_at is not null and l.round_no = (select max(l2.round_no) from public.game_corner_roulette_bets l2 where l2.user_id = me and l2.settled_at is not null)
                     group by l.round_no, x.result),
           'history', coalesce((select jsonb_agg(h.result order by h.round_no desc) from (select x.round_no, x.result from public.game_corner_roulette_rounds x where x.round_no < c.round_no or not c.betting order by x.round_no desc limit 16) h), '[]'::jsonb))
    into v_roulette;

  return jsonb_build_object(
    'now', now(),
    'open', s.is_open,
    'caps', jsonb_build_object('min', s.min_bet, 'slots', s.slots_max_bet, 'roulette', s.roulette_max_bet, 'blackjack', s.blackjack_max_bet),
    'balance', public.token_balance(me),
    'slots', v_slots,
    'roulette', v_roulette);
end $$;

-- ─────────────────────────────────────────────── access
revoke all on function public.game_corner_take(uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.game_corner_pay(uuid, numeric, numeric, numeric, text, text) from public, anon, authenticated;
revoke all on function public.game_corner_check(numeric, numeric) from public, anon, authenticated;
revoke all on function public.game_corner_roulette_settle() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_game_corner_settings(boolean, numeric, numeric, numeric, numeric)',
    'public.game_corner_slot_sit(integer)', 'public.game_corner_slot_leave()', 'public.game_corner_slot_spin(numeric)',
    'public.game_corner_slot_pays(text[])', 'public.game_corner_strip()', 'public.game_corner_red(integer)', 'public.game_corner_roulette_pays(text, integer, integer)',
    'public.game_corner_roulette_now()', 'public.game_corner_roulette_bet(text, integer, numeric)', 'public.game_corner_roulette_clear()',
    'public.game_corner_state()']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
