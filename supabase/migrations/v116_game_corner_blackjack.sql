-- The Game Corner, part 2: blackjack tables, played with tokens (v115 has the slots and the roulette).
--
-- Three tables of five seats. Sit at a free seat (or one whose player hasn't looked in 2 minutes) and you're dealt
-- in from the next hand. Everyone at a table, and anyone watching it, sees every seat's bet, cards and result, and
-- the dealer's.
--
-- A hand:
--   * Bets. Once someone bets, the rest of the table has 15 s to bet too; it deals at once when everyone sitting
--     there (and looking) has bet. From the smallest bet up to the table limit (blackjack_max_bet, v115).
--   * The deal: two cards each, face up, and the dealer one up and one face down, from a six-deck shoe that's
--     reshuffled once three-quarters of it is dealt. A blackjack (an ace and a ten-card as your first two) pays 3 to
--     2. The dealer checks the face-down card for a blackjack straight away; if it's there the hand ends then (a
--     player's blackjack pushes, everything else loses), so nobody doubles or splits into one.
--   * Turns, seat by seat: hit, stand, double down (on any first two cards: the bet doubled and one card more), or
--     split (a pair, once: a second bet and two hands; split aces get one card each, and an ace and a ten after a
--     split is 21, not a blackjack; doubling after a split is fine). 20 s a decision, then you stand; a player who
--     has left the table or closed the page stands at once. 21 stands by itself.
--   * The dealer turns the face-down card and draws to 17, standing on every 17, soft ones too. A win pays even
--     money, a push gives the bet back.
--   No insurance and no surrender. With perfect play the house keeps about half a percent of what's bet, the best
--   odds in the Game Corner.
--
-- Like the roulette, nothing runs on a timer: each read (game_corner_state) and each move carries a table forward as
-- far as the clock says (game_corner_bj_advance), so a hand runs out its turns even if everyone has gone.
--
-- Tokens as in v115: a bet, a double or a split is spent like a purchase (reason game_corner_bet); what comes back
-- (a win or a push) goes to the buckets the stake came from (game_corner_win); a bet taken back before the deal is a
-- refund.
--
-- Safe to re-run.

-- ─────────────────────────────────────────────── tables, seats, hands
create table if not exists public.game_corner_bj_tables (
  table_no      smallint primary key check (table_no between 1 and 3),
  phase         text not null default 'betting' check (phase in ('betting', 'playing', 'done')),
  round         integer not null default 1,
  bets_close_at timestamptz,                    -- betting: when it deals (null until someone bets)
  turn_seat     smallint,                       -- playing: whose turn it is, which of their hands, and until when
  turn_hand     smallint,
  turn_ends_at  timestamptz,
  dealer        smallint[] not null default '{}',   -- the dealer's cards; the second is face down while the players play
  done_at       timestamptz,                    -- done: when the dealer played and the hand was paid
  next_at       timestamptz,                    -- done: when the next hand's bets open
  shoe          smallint[],                     -- six decks, shuffled. A card c is rank c % 13 (0 ace, 1-8 two to nine,
  shoe_pos      integer not null default 0,     -- 9-12 ten to king) of suit c / 13 (spades, hearts, diamonds, clubs)
  dealt         integer not null default 0      -- hands dealt at this table, ever
);
insert into public.game_corner_bj_tables (table_no) select g from generate_series(1, 3) g on conflict (table_no) do nothing;

create table if not exists public.game_corner_bj_seats (
  table_no smallint not null references public.game_corner_bj_tables(table_no),
  seat     smallint not null check (seat between 1 and 5),
  user_id  uuid unique references public.profiles(id) on delete set null,   -- one seat a member, at any table
  seen_at  timestamptz,
  primary key (table_no, seat)
);
insert into public.game_corner_bj_seats (table_no, seat)
select t, s from generate_series(1, 3) t cross join generate_series(1, 5) s on conflict (table_no, seat) do nothing;

create table if not exists public.game_corner_bj_hands (
  table_no       smallint not null,
  round          integer not null,
  seat           smallint not null,
  hand           smallint not null check (hand in (1, 2)),   -- 2: the second hand of a split
  user_id        uuid not null references public.profiles(id) on delete cascade,
  cards          smallint[] not null default '{}',
  bet            numeric(12,2) not null check (bet > 0),     -- doubled, once doubled
  from_allowance numeric(12,2) not null default 0,
  doubled        boolean not null default false,
  split          boolean not null default false,
  status         text not null default 'betting' check (status in ('betting', 'playing', 'stood', 'bust', 'blackjack')),
  result         text check (result in ('blackjack', 'win', 'push', 'lose')),   -- once the hand is paid
  payout         numeric(12,2),
  created_at     timestamptz not null default now(),
  primary key (table_no, round, seat, hand)
);
create index if not exists game_corner_bj_hands_open on public.game_corner_bj_hands (user_id) where result is null;

alter table public.game_corner_bj_tables enable row level security;   -- read and changed only through the functions below
alter table public.game_corner_bj_seats enable row level security;
alter table public.game_corner_bj_hands enable row level security;
revoke all on public.game_corner_bj_tables, public.game_corner_bj_seats, public.game_corner_bj_hands from anon, authenticated;

-- ─────────────────────────────────────────────── cards
/** A fresh six-deck shoe, shuffled. */
create or replace function public.game_corner_bj_shoe()
returns smallint[]
language sql volatile as $$
  select array_agg((g % 52)::smallint order by random()) from generate_series(0, 311) g
$$;

/** A hand's best total: aces count 11 where that doesn't bust it. */
create or replace function public.game_corner_bj_total(p_cards smallint[])
returns integer
language sql immutable as $$
  select case when bool_or(c % 13 = 0) and sum(least(10, c % 13 + 1)) + 10 <= 21 then sum(least(10, c % 13 + 1)) + 10
              else coalesce(sum(least(10, c % 13 + 1)), 0) end::int
    from unnest(p_cards) c
$$;

/** The next card off a table's shoe (a new shoe if it ever runs out). Internal; the table is locked. */
create or replace function public.game_corner_bj_draw(p_table integer)
returns smallint
language plpgsql security definer set search_path to 'public' as $$
declare v smallint;
begin
  update public.game_corner_bj_tables set shoe = public.game_corner_bj_shoe(), shoe_pos = 0
   where table_no = p_table and (shoe is null or shoe_pos >= coalesce(array_length(shoe, 1), 0));
  update public.game_corner_bj_tables set shoe_pos = shoe_pos + 1 where table_no = p_table returning shoe[shoe_pos] into v;
  return v;
end $$;

-- ─────────────────────────────────────────────── a hand, start to finish (internal; the table is locked)
/** The dealer plays, and every hand is paid. Then the results show for a few seconds before the next hand's bets. */
create or replace function public.game_corner_bj_finish(p_table integer)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  t public.game_corner_bj_tables; v_dealer smallint[]; v_bj boolean; v_total int; v_drawn int := 0;
  h public.game_corner_bj_hands; v_result text; v_pay numeric(12,2);
begin
  select * into t from public.game_corner_bj_tables where table_no = p_table;
  v_dealer := t.dealer;
  v_bj := array_length(v_dealer, 1) = 2 and public.game_corner_bj_total(v_dealer) = 21;
  -- The dealer draws to 17, standing on soft 17 too, unless every hand has bust or been paid as a blackjack.
  if not v_bj and exists (select 1 from public.game_corner_bj_hands where table_no = p_table and round = t.round and status = 'stood') then
    while public.game_corner_bj_total(v_dealer) < 17 loop
      v_dealer := v_dealer || public.game_corner_bj_draw(p_table);
      v_drawn := v_drawn + 1;
    end loop;
  end if;
  v_total := public.game_corner_bj_total(v_dealer);
  for h in select * from public.game_corner_bj_hands where table_no = p_table and round = t.round order by seat, hand loop
    v_result := case
      when h.status = 'blackjack' then case when v_bj then 'push' else 'blackjack' end
      when h.status = 'bust' or v_bj then 'lose'
      when v_total > 21 or public.game_corner_bj_total(h.cards) > v_total then 'win'
      when public.game_corner_bj_total(h.cards) = v_total then 'push'
      else 'lose' end;
    -- 3 to 2 rounds down to the cent, as a casino would.
    v_pay := case v_result when 'blackjack' then floor(h.bet * 250) / 100 when 'win' then h.bet * 2 when 'push' then h.bet else 0 end;
    update public.game_corner_bj_hands
       set result = v_result, payout = v_pay, status = case when status = 'playing' then 'stood' else status end
     where table_no = p_table and round = t.round and seat = h.seat and hand = h.hand;
    perform public.game_corner_pay(h.user_id, v_pay, h.bet, h.from_allowance, 'game_corner_win',
      'Blackjack, table ' || p_table || ': ' || v_result || ' (' || public.game_corner_bj_total(h.cards) || ' against ' || v_total || ')');
  end loop;
  -- The page turns the dealer's cards over one by one (the face-down card at 0.4 s, each draw 0.8 s after), then
  -- shows the results for about 6 s.
  update public.game_corner_bj_tables
     set phase = 'done', dealer = v_dealer, turn_seat = null, turn_hand = null, turn_ends_at = null,
         done_at = now(), next_at = now() + interval '1 second' * (6 + 0.8 * (1 + v_drawn))
   where table_no = p_table;
end $$;

/** The next hand still to play gets the turn, with 20 s from p_from; once there's none, the dealer plays. */
create or replace function public.game_corner_bj_next(p_table integer, p_from timestamptz)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare t public.game_corner_bj_tables; v_seat smallint; v_hand smallint;
begin
  select * into t from public.game_corner_bj_tables where table_no = p_table;
  select h.seat, h.hand into v_seat, v_hand from public.game_corner_bj_hands h
   where h.table_no = p_table and h.round = t.round and h.status = 'playing' order by h.seat, h.hand limit 1;
  if v_seat is null then
    perform public.game_corner_bj_finish(p_table);
  else
    update public.game_corner_bj_tables set turn_seat = v_seat, turn_hand = v_hand, turn_ends_at = p_from + interval '20 seconds'
     where table_no = p_table;
  end if;
end $$;

/** Deals the hand: two cards to each bet, seat by seat, and two to the dealer, the second face down. */
create or replace function public.game_corner_bj_deal(p_table integer)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare t public.game_corner_bj_tables; v_seat smallint; v_dealer smallint[] := '{}';
begin
  select * into t from public.game_corner_bj_tables where table_no = p_table;
  for k in 1..2 loop
    for v_seat in select h.seat from public.game_corner_bj_hands h where h.table_no = p_table and h.round = t.round order by h.seat loop
      update public.game_corner_bj_hands set cards = cards || public.game_corner_bj_draw(p_table), status = 'playing'
       where table_no = p_table and round = t.round and seat = v_seat and hand = 1;
    end loop;
    v_dealer := v_dealer || public.game_corner_bj_draw(p_table);
  end loop;
  update public.game_corner_bj_hands set status = 'blackjack'
   where table_no = p_table and round = t.round and public.game_corner_bj_total(cards) = 21;
  update public.game_corner_bj_tables set phase = 'playing', dealer = v_dealer, bets_close_at = null, dealt = dealt + 1
   where table_no = p_table;
  -- The dealer looks under an ace or a ten for a blackjack: if it's there, the hand is over before anyone plays.
  if public.game_corner_bj_total(v_dealer) = 21 then
    perform public.game_corner_bj_finish(p_table);
  else
    perform public.game_corner_bj_next(p_table, now());
  end if;
end $$;

/** The next hand's bets open. Seats nobody has looked at in 2 minutes are freed; the shoe is reshuffled at 3/4. */
create or replace function public.game_corner_bj_new_round(p_table integer)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  update public.game_corner_bj_seats set user_id = null
   where table_no = p_table and user_id is not null and seen_at < now() - interval '2 minutes';
  update public.game_corner_bj_tables
     set phase = 'betting', round = round + 1, dealer = '{}', bets_close_at = null, done_at = null, next_at = null,
         turn_seat = null, turn_hand = null, turn_ends_at = null,
         shoe = case when shoe is null or shoe_pos > 234 then public.game_corner_bj_shoe() else shoe end,
         shoe_pos = case when shoe is null or shoe_pos > 234 then 0 else shoe_pos end
   where table_no = p_table;
end $$;

/**
 * Carries a table forward as far as the clock says: deals once the bets close (or everyone there has bet), stands
 * a hand whose 20 s are up (or whose player has gone) and passes the turn on, and opens the next hand's bets once
 * the results have shown. Looks first without locking, and locks the table only when something is due, so the reads
 * every second don't queue behind each other. Internal.
 */
create or replace function public.game_corner_bj_advance(p_table integer)
returns void
language plpgsql security definer set search_path to 'public' as $$
declare
  t public.game_corner_bj_tables; v_user uuid; v_due text; v_locked boolean := false; i int := 0;
begin
  loop
    i := i + 1;
    exit when i > 60;
    select * into t from public.game_corner_bj_tables where table_no = p_table;
    exit when t.table_no is null;
    v_due := null;
    if t.phase = 'betting' then
      if not exists (select 1 from public.game_corner_bj_hands where table_no = p_table and round = t.round) then
        if t.bets_close_at is not null then v_due := 'unbet'; end if;   -- every bet taken back: the clock stops
      elsif t.bets_close_at <= now() or not exists (
          select 1 from public.game_corner_bj_seats s
           where s.table_no = p_table and s.user_id is not null and s.seen_at > now() - interval '15 seconds'
             and not exists (select 1 from public.game_corner_bj_hands h where h.table_no = p_table and h.round = t.round and h.user_id = s.user_id)) then
        v_due := 'deal';
      end if;
    elsif t.phase = 'playing' then
      select h.user_id into v_user from public.game_corner_bj_hands h
       where h.table_no = p_table and h.round = t.round and h.seat = t.turn_seat and h.hand = t.turn_hand;
      if t.turn_ends_at <= now() then
        v_due := 'timeout';
      elsif not exists (select 1 from public.game_corner_bj_seats s
                         where s.table_no = p_table and s.user_id = v_user and s.seen_at > now() - interval '15 seconds') then
        v_due := 'away';
      end if;
    elsif t.phase = 'done' and t.next_at <= now() then
      v_due := 'next';
    end if;
    exit when v_due is null;
    if not v_locked then
      perform 1 from public.game_corner_bj_tables where table_no = p_table for update;
      v_locked := true;
      continue;   -- look again, now that nobody else can move it
    end if;
    if v_due = 'unbet' then
      update public.game_corner_bj_tables set bets_close_at = null where table_no = p_table;
    elsif v_due = 'deal' then
      perform public.game_corner_bj_deal(p_table);
    elsif v_due in ('timeout', 'away') then
      update public.game_corner_bj_hands set status = 'stood'
       where table_no = p_table and round = t.round and seat = t.turn_seat and hand = t.turn_hand and status = 'playing';
      -- After a timeout the next player's 20 s run on from the last's, so a table nobody is watching plays out at once.
      perform public.game_corner_bj_next(p_table, case when v_due = 'timeout' then t.turn_ends_at else now() end);
    elsif v_due = 'next' then
      perform public.game_corner_bj_new_round(p_table);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────── what members do
/** Sit at a blackjack seat (leaving any other): free, or its player hasn't looked in 2 minutes and has no cards out. */
create or replace function public.game_corner_bj_sit(p_table integer, p_seat integer)
returns boolean
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_bj_seats;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  if not (select g.is_open from public.game_corner_settings g where g.id) and not public.is_admin() then raise exception 'closed' using errcode = 'P0001'; end if;
  perform 1 from public.game_corner_bj_tables where table_no = p_table for update;
  if not found then raise exception 'no_such_seat' using errcode = 'P0001'; end if;
  perform public.game_corner_bj_advance(p_table);
  select * into s from public.game_corner_bj_seats where table_no = p_table and seat = p_seat for update;
  if s.table_no is null then raise exception 'no_such_seat' using errcode = 'P0001'; end if;
  if s.user_id = me then
    update public.game_corner_bj_seats set seen_at = now() where table_no = p_table and seat = p_seat;
    return true;
  end if;
  if s.user_id is not null and (s.seen_at > now() - interval '2 minutes'
      or exists (select 1 from public.game_corner_bj_hands h where h.user_id = s.user_id and h.result is null)) then
    raise exception 'seat_taken' using errcode = 'P0001';
  end if;
  -- Not while you have a bet or cards out on a hand still being played, here or at another table.
  if exists (select 1 from public.game_corner_bj_hands h where h.user_id = me and h.result is null) then
    raise exception 'in_hand' using errcode = 'P0001';
  end if;
  update public.game_corner_bj_seats set user_id = null where user_id = me;
  update public.game_corner_bj_seats set user_id = me, seen_at = now() where table_no = p_table and seat = p_seat;
  return true;
end $$;

/** Get up from the table. A bet not yet dealt comes back; cards already out stand, and the hand is played out without you. */
create or replace function public.game_corner_bj_leave()
returns void
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); v_table smallint; t public.game_corner_bj_tables; h record;
begin
  select table_no into v_table from public.game_corner_bj_seats where user_id = me;
  if v_table is null then return; end if;
  perform 1 from public.game_corner_bj_tables where table_no = v_table for update;
  perform public.game_corner_bj_advance(v_table);
  select * into t from public.game_corner_bj_tables where table_no = v_table;
  if t.phase = 'betting' then
    perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
    for h in delete from public.game_corner_bj_hands where table_no = v_table and round = t.round and user_id = me returning bet, from_allowance loop
      perform public.game_corner_pay(me, h.bet, h.bet, h.from_allowance, 'refund', 'Blackjack, table ' || v_table || ': bet taken back');
    end loop;
  end if;
  update public.game_corner_bj_seats set user_id = null where user_id = me;
  perform public.game_corner_bj_advance(v_table);   -- your turn, if it was, passes on
end $$;

/** Bet on the next hand at your table, while its bets are open. One bet a hand. */
create or replace function public.game_corner_bj_bet(p_amount numeric)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); g public.game_corner_settings; s public.game_corner_bj_seats; t public.game_corner_bj_tables; v_allow numeric(12,2);
begin
  select * into g from public.game_corner_settings where id;
  perform public.game_corner_check(p_amount, g.blackjack_max_bet);
  select * into s from public.game_corner_bj_seats where user_id = me;
  if s.table_no is null then raise exception 'not_seated' using errcode = 'P0001'; end if;
  perform 1 from public.game_corner_bj_tables where table_no = s.table_no for update;
  update public.game_corner_bj_seats set seen_at = now() where user_id = me;
  perform public.game_corner_bj_advance(s.table_no);
  select * into t from public.game_corner_bj_tables where table_no = s.table_no;
  if t.phase <> 'betting' then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.game_corner_bj_hands where table_no = s.table_no and round = t.round and seat = s.seat) then
    raise exception 'already_bet' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  v_allow := public.game_corner_take(me, p_amount, 'Blackjack, table ' || s.table_no);
  insert into public.game_corner_bj_hands (table_no, round, seat, hand, user_id, bet, from_allowance)
  values (s.table_no, t.round, s.seat, 1, me, p_amount, v_allow);
  update public.game_corner_bj_tables set bets_close_at = coalesce(bets_close_at, now() + interval '15 seconds') where table_no = s.table_no;
  perform public.game_corner_bj_advance(s.table_no);   -- deals now if everyone at the table has bet
  return jsonb_build_object('balance', public.token_balance(me));
end $$;

/** Take back your bet before the deal. */
create or replace function public.game_corner_bj_unbet()
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); v_table smallint; t public.game_corner_bj_tables; h record; v_back numeric(12,2) := 0;
begin
  select table_no into v_table from public.game_corner_bj_seats where user_id = me;
  if v_table is null then raise exception 'not_seated' using errcode = 'P0001'; end if;
  perform 1 from public.game_corner_bj_tables where table_no = v_table for update;
  perform public.game_corner_bj_advance(v_table);
  select * into t from public.game_corner_bj_tables where table_no = v_table;
  if t.phase <> 'betting' then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  for h in delete from public.game_corner_bj_hands where table_no = v_table and round = t.round and user_id = me returning bet, from_allowance loop
    perform public.game_corner_pay(me, h.bet, h.bet, h.from_allowance, 'refund', 'Blackjack, table ' || v_table || ': bet taken back');
    v_back := v_back + h.bet;
  end loop;
  perform public.game_corner_bj_advance(v_table);
  return v_back;
end $$;

/**
 * Your move, on your turn: 'hit', 'stand', 'double' (first two cards: the bet doubled, one more card, and stand) or
 * 'split' (a pair, once: a second bet, a card more for each; split aces take that one card and stand).
 */
create or replace function public.game_corner_bj_act(p_action text)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid(); v_table smallint; t public.game_corner_bj_tables; h public.game_corner_bj_hands;
  v_cards smallint[]; v_total int; v_allow numeric(12,2); v_aces boolean;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select table_no into v_table from public.game_corner_bj_seats where user_id = me;
  if v_table is null then raise exception 'not_seated' using errcode = 'P0001'; end if;
  perform 1 from public.game_corner_bj_tables where table_no = v_table for update;
  update public.game_corner_bj_seats set seen_at = now() where user_id = me;
  perform public.game_corner_bj_advance(v_table);   -- a turn that has run out is gone first
  select * into t from public.game_corner_bj_tables where table_no = v_table;
  select * into h from public.game_corner_bj_hands where table_no = v_table and round = t.round and seat = t.turn_seat and hand = t.turn_hand;
  if t.phase <> 'playing' or h.user_id is distinct from me or h.status <> 'playing' then
    raise exception 'not_your_turn' using errcode = 'P0001';
  end if;

  if p_action = 'hit' then
    update public.game_corner_bj_hands set cards = cards || public.game_corner_bj_draw(v_table)
     where table_no = v_table and round = t.round and seat = h.seat and hand = h.hand returning cards into v_cards;
    v_total := public.game_corner_bj_total(v_cards);
    if v_total >= 21 then
      update public.game_corner_bj_hands set status = case when v_total > 21 then 'bust' else 'stood' end
       where table_no = v_table and round = t.round and seat = h.seat and hand = h.hand;
      perform public.game_corner_bj_next(v_table, now());
    else
      update public.game_corner_bj_tables set turn_ends_at = now() + interval '20 seconds' where table_no = v_table;
    end if;

  elsif p_action = 'stand' then
    update public.game_corner_bj_hands set status = 'stood' where table_no = v_table and round = t.round and seat = h.seat and hand = h.hand;
    perform public.game_corner_bj_next(v_table, now());

  elsif p_action = 'double' then
    if array_length(h.cards, 1) <> 2 then raise exception 'cant_double' using errcode = 'P0001'; end if;
    perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
    v_allow := public.game_corner_take(me, h.bet, 'Blackjack, table ' || v_table || ': double down');
    v_cards := h.cards || public.game_corner_bj_draw(v_table);
    update public.game_corner_bj_hands
       set cards = v_cards, bet = bet * 2, from_allowance = from_allowance + v_allow, doubled = true,
           status = case when public.game_corner_bj_total(v_cards) > 21 then 'bust' else 'stood' end
     where table_no = v_table and round = t.round and seat = h.seat and hand = h.hand;
    perform public.game_corner_bj_next(v_table, now());

  elsif p_action = 'split' then
    if h.hand <> 1 or array_length(h.cards, 1) <> 2 or least(10, h.cards[1] % 13 + 1) <> least(10, h.cards[2] % 13 + 1)
       or exists (select 1 from public.game_corner_bj_hands where table_no = v_table and round = t.round and seat = h.seat and hand = 2) then
      raise exception 'cant_split' using errcode = 'P0001';
    end if;
    perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
    v_allow := public.game_corner_take(me, h.bet, 'Blackjack, table ' || v_table || ': split');
    v_aces := h.cards[1] % 13 = 0;
    -- The first card stays, the second starts the other hand; a card more for each.
    update public.game_corner_bj_hands set cards = array[h.cards[1], public.game_corner_bj_draw(v_table)], split = true
     where table_no = v_table and round = t.round and seat = h.seat and hand = 1;
    insert into public.game_corner_bj_hands (table_no, round, seat, hand, user_id, cards, bet, from_allowance, split, status)
    values (v_table, t.round, h.seat, 2, me, array[h.cards[2], public.game_corner_bj_draw(v_table)], h.bet, v_allow, true, 'playing');
    -- Split aces stand on their one card; any split hand on 21 stands.
    update public.game_corner_bj_hands set status = 'stood'
     where table_no = v_table and round = t.round and seat = h.seat and (v_aces or public.game_corner_bj_total(cards) = 21);
    if (select status from public.game_corner_bj_hands where table_no = v_table and round = t.round and seat = h.seat and hand = 1) = 'playing' then
      update public.game_corner_bj_tables set turn_ends_at = now() + interval '20 seconds' where table_no = v_table;
    else
      perform public.game_corner_bj_next(v_table, now());
    end if;

  else
    raise exception 'bad_move' using errcode = 'P0001';
  end if;
  return jsonb_build_object('balance', public.token_balance(me));
end $$;

-- ─────────────────────────────────────────────── what the page reads
/**
 * The three tables as anyone may see them: each seat's player and hands (cards, bet, result), whose turn it is and
 * until when, and the dealer's cards, the face-down one hidden (-1) while the players play. Never the shoe. Internal.
 */
create or replace function public.game_corner_bj_view(p_me uuid)
returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'mine', (select jsonb_build_object('table', s.table_no, 'seat', s.seat) from public.game_corner_bj_seats s where s.user_id = p_me),
    'tables', coalesce(jsonb_agg(jsonb_build_object(
      'table', t.table_no,
      'phase', t.phase,
      'round', t.round,
      'bets_close_at', t.bets_close_at,
      'turn', case when t.phase = 'playing' then jsonb_build_object('seat', t.turn_seat, 'hand', t.turn_hand, 'ends_at', t.turn_ends_at) end,
      'dealer', case when t.phase = 'playing' then to_jsonb(array[t.dealer[1], -1]) else to_jsonb(t.dealer) end,
      'done_at', t.done_at,
      'next_at', t.next_at,
      'shoe_left', case when t.shoe is null then 312 else array_length(t.shoe, 1) - t.shoe_pos end,
      'seats', (select jsonb_agg(jsonb_build_object(
          'seat', s.seat,
          'player', case when s.user_id is not null and s.seen_at > now() - interval '2 minutes' then coalesce(p.display_name, p.username) end,
          'avatar', case when s.user_id is not null and s.seen_at > now() - interval '2 minutes' then p.avatar_url end,
          'mine', coalesce(s.user_id = p_me, false),
          'hands', coalesce((select jsonb_agg(jsonb_build_object(
                'hand', h.hand, 'player', coalesce(hp.display_name, hp.username), 'mine', h.user_id = p_me,
                'cards', to_jsonb(h.cards), 'bet', h.bet, 'doubled', h.doubled, 'split', h.split,
                'status', h.status, 'result', h.result, 'payout', h.payout) order by h.hand)
              from public.game_corner_bj_hands h join public.profiles hp on hp.id = h.user_id
             where h.table_no = t.table_no and h.round = t.round and h.seat = s.seat), '[]'::jsonb)) order by s.seat)
        from public.game_corner_bj_seats s left join public.profiles p on p.id = s.user_id
       where s.table_no = t.table_no)) order by t.table_no), '[]'::jsonb))
  from public.game_corner_bj_tables t
$$;

/**
 * Everything the Game Corner page shows, read once a second while it's open (v115, now with the blackjack tables):
 * your balance and the caps, the row of slot machines, the roulette table, and the blackjack tables. Settles any
 * roulette round that's due and carries each blackjack table forward, and counts as a look at your slot machine and
 * your blackjack seat (they stay yours while the page is open).
 */
create or replace function public.game_corner_state()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_settings; c record; v_slots jsonb; v_roulette jsonb; v_t smallint;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  perform public.game_corner_roulette_settle();
  update public.game_corner_slots set seen_at = now() where user_id = me;
  update public.game_corner_bj_seats set seen_at = now() where user_id = me;
  for v_t in select table_no from public.game_corner_bj_tables order by table_no loop
    perform public.game_corner_bj_advance(v_t);
  end loop;
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
    'roulette', v_roulette,
    'blackjack', public.game_corner_bj_view(me));
end $$;

-- ─────────────────────────────────────────────── access
do $$
declare f text;
begin
  -- Internal: only the functions below call these.
  foreach f in array array[
    'public.game_corner_bj_draw(integer)', 'public.game_corner_bj_finish(integer)', 'public.game_corner_bj_next(integer, timestamptz)',
    'public.game_corner_bj_deal(integer)', 'public.game_corner_bj_new_round(integer)', 'public.game_corner_bj_advance(integer)',
    'public.game_corner_bj_view(uuid)', 'public.game_corner_bj_shoe()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.game_corner_bj_sit(integer, integer)', 'public.game_corner_bj_leave()', 'public.game_corner_bj_bet(numeric)',
    'public.game_corner_bj_unbet()', 'public.game_corner_bj_act(text)', 'public.game_corner_bj_total(smallint[])',
    'public.game_corner_state()']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
