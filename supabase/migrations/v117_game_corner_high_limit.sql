-- The Game Corner's high-limit room: a row of four high-limit slot machines (9-12), a high-limit roulette wheel
-- (wheel 2, beside the main one) and a high-limit blackjack table (table 4). Same games, same odds, bigger bets:
-- their own smallest bet and limits (Admin -> VVM -> Game Corner), by default 1.00 a bet up to 10.00 a spin on the
-- slots, 25.00 a spin on the roulette (a member's bets together) and 20.00 a hand at blackjack. Anyone may sit; the
-- smallest bet keeps it high.
--
-- Needs v115 (slots, roulette) and v116 (blackjack). The roulette rounds are now per wheel: the key becomes
-- (wheel, round_no); every round so far is wheel 1. game_corner_roulette_bet and _clear take the wheel, 1 if left
-- out, so a page from before this still bets on the main wheel.
--
-- Safe to re-run.

-- ─────────────────────────────────────────────── limits
alter table public.game_corner_settings
  add column if not exists high_min_bet           numeric(12,2) not null default 1.00,
  add column if not exists high_slots_max_bet     numeric(12,2) not null default 10.00,
  add column if not exists high_roulette_max_bet  numeric(12,2) not null default 25.00,
  add column if not exists high_blackjack_max_bet numeric(12,2) not null default 20.00;
alter table public.game_corner_settings drop constraint if exists game_corner_high_caps;
alter table public.game_corner_settings add constraint game_corner_high_caps check (
  high_min_bet > 0 and high_slots_max_bet >= high_min_bet and high_roulette_max_bet >= high_min_bet and high_blackjack_max_bet >= high_min_bet);

/** Admins: the high-limit room's smallest bet and limits (tokens). */
create or replace function public.set_game_corner_high_limits(p_min_bet numeric, p_slots_max numeric, p_roulette_max numeric, p_blackjack_max numeric)
returns public.game_corner_settings
language plpgsql security definer set search_path to 'public' as $$
declare s public.game_corner_settings;
begin
  if not public.is_admin() then raise exception 'Only admins can change the Game Corner'; end if;
  update public.game_corner_settings
     set high_min_bet = round(p_min_bet, 2), high_slots_max_bet = round(p_slots_max, 2),
         high_roulette_max_bet = round(p_roulette_max, 2), high_blackjack_max_bet = round(p_blackjack_max, 2),
         updated_at = now(), updated_by = auth.uid()
   where id returning * into s;
  return s;
end $$;

/** Who may play (members while it's open, admins always), and a bet's size against a room's limits. Internal. */
create or replace function public.game_corner_check_bet(p_amount numeric, p_min numeric, p_max numeric)
returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  if not (select g.is_open from public.game_corner_settings g where g.id) and not public.is_admin() then raise exception 'closed' using errcode = 'P0001'; end if;
  if p_amount is null or p_amount <> round(p_amount, 2) or p_amount < p_min then raise exception 'bet_too_small' using errcode = 'P0001'; end if;
  if p_amount > p_max then raise exception 'bet_too_big' using errcode = 'P0001'; end if;
end $$;

-- ─────────────────────────────────────────────── slots: machines 9-12
alter table public.game_corner_slots add column if not exists high_roller boolean not null default false;
alter table public.game_corner_slots drop constraint if exists game_corner_slots_machine_check;
alter table public.game_corner_slots add constraint game_corner_slots_machine_check check (machine between 1 and 12);
insert into public.game_corner_slots (machine, high_roller) select g, true from generate_series(9, 12) g
on conflict (machine) do update set high_roller = true;

/** v115's spin, with the limits of the machine's room. */
create or replace function public.game_corner_slot_spin(p_bet numeric)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid(); m public.game_corner_slots; s public.game_corner_settings;
  strip text[] := public.game_corner_strip(); n int := array_length(public.game_corner_strip(), 1);
  -- Each payline: the row it takes on reels 1, 2 and 3 (1 top, 2 middle, 3 bottom).
  lines int[] := array[[1,1,1], [2,2,2], [3,3,3], [1,2,3], [3,2,1]];
  v_allow numeric(12,2); v_line_bet numeric; v_grid text[] := '{}'; v_stop int; v_mult numeric;
  v_win numeric(12,2) := 0; v_paid smallint[] := '{}'; v_wins jsonb := '[]'; v_name text;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  select * into m from public.game_corner_slots where user_id = me for update;
  if m.machine is null then raise exception 'not_seated' using errcode = 'P0001'; end if;
  perform public.game_corner_check_bet(p_bet, case when m.high_roller then s.high_min_bet else s.min_bet end,
                                              case when m.high_roller then s.high_slots_max_bet else s.slots_max_bet end);
  if (p_bet * 100) % 5 <> 0 then raise exception 'bad_bet' using errcode = 'P0001'; end if;   -- five lines, a whole cent each
  v_line_bet := p_bet / 5;
  v_name := 'Slots, machine ' || m.machine || case when m.high_roller then ' (high limit)' else '' end;
  v_allow := public.game_corner_take(me, p_bet, v_name);
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
  perform public.game_corner_pay(me, v_win, p_bet, v_allow, 'game_corner_win', v_name || ': ' || array_to_string(v_grid, ' '));
  update public.game_corner_slots
     set seen_at = now(), last_reels = v_grid, last_lines = v_paid, last_bet = p_bet, last_win = v_win, last_at = now(), spins = spins + 1
   where machine = m.machine;
  return jsonb_build_object('machine', m.machine, 'reels', to_jsonb(v_grid), 'lines', v_wins, 'bet', p_bet, 'win', v_win, 'balance', public.token_balance(me));
end $$;

-- ─────────────────────────────────────────────── roulette: wheel 2
alter table public.game_corner_roulette_rounds add column if not exists wheel smallint not null default 1;
alter table public.game_corner_roulette_bets add column if not exists wheel smallint not null default 1;
alter table public.game_corner_roulette_rounds drop constraint if exists game_corner_roulette_rounds_pkey;
alter table public.game_corner_roulette_rounds add constraint game_corner_roulette_rounds_pkey primary key (wheel, round_no);
alter table public.game_corner_roulette_rounds drop constraint if exists game_corner_roulette_rounds_wheel;
alter table public.game_corner_roulette_rounds add constraint game_corner_roulette_rounds_wheel check (wheel in (1, 2));
alter table public.game_corner_roulette_bets drop constraint if exists game_corner_roulette_bets_wheel;
alter table public.game_corner_roulette_bets add constraint game_corner_roulette_bets_wheel check (wheel in (1, 2));
create index if not exists game_corner_roulette_bets_wheel_open on public.game_corner_roulette_bets (wheel, round_no) where settled_at is null;
create index if not exists game_corner_roulette_bets_wheel_round on public.game_corner_roulette_bets (wheel, round_no, user_id);

/** v115's settling, wheel by wheel: both wheels share the clock, each draws its own result. Internal. */
create or replace function public.game_corner_roulette_settle()
returns void
language plpgsql security definer set search_path to 'public' as $$
declare c record; r record; v_result smallint; w record;
begin
  select * into c from public.game_corner_roulette_now();
  for r in
    select distinct b.wheel, b.round_no from public.game_corner_roulette_bets b
     where b.settled_at is null and (b.round_no < c.round_no or (b.round_no = c.round_no and not c.betting))
    union select g::smallint, c.round_no from generate_series(1, 2) g where not c.betting
  loop
    insert into public.game_corner_roulette_rounds (wheel, round_no, result) values (r.wheel, r.round_no, floor(random() * 37)::smallint)
    on conflict (wheel, round_no) do nothing;
    select x.result into v_result from public.game_corner_roulette_rounds x where x.wheel = r.wheel and x.round_no = r.round_no;
    -- Each unsettled bet once (whoever gets here first), then each winner paid once for the round.
    for w in
      with done as (
        update public.game_corner_roulette_bets b
           set payout = b.amount * public.game_corner_roulette_pays(b.kind, b.pick, v_result), settled_at = now()
         where b.wheel = r.wheel and b.round_no = r.round_no and b.settled_at is null
        returning b.user_id, b.amount, b.from_allowance, b.payout)
      select d.user_id, sum(d.payout) as payout, sum(d.amount) as stake, sum(d.from_allowance) as from_allowance
        from done d group by d.user_id
    loop
      perform public.game_corner_pay(w.user_id, w.payout, w.stake, w.from_allowance, 'game_corner_win',
        'Roulette' || case when r.wheel = 2 then ' (high limit)' else '' end || ', round ' || r.round_no || ': ' || v_result);
    end loop;
  end loop;
end $$;

-- The bet and take-back functions take the wheel now (the old ones go, so a call without it isn't ambiguous).
drop function if exists public.game_corner_roulette_bet(text, integer, numeric);
drop function if exists public.game_corner_roulette_clear();

/** A roulette bet on this round of a wheel (1 the main one, 2 high limit), while its bets are open. */
create or replace function public.game_corner_roulette_bet(p_kind text, p_pick integer, p_amount numeric, p_wheel integer default 1)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_settings; c record; v_mine numeric; v_allow numeric(12,2); v_max numeric;
begin
  if coalesce(p_wheel, 0) not in (1, 2) then raise exception 'bad_bet' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  v_max := case when p_wheel = 2 then s.high_roulette_max_bet else s.roulette_max_bet end;
  perform public.game_corner_check_bet(p_amount, case when p_wheel = 2 then s.high_min_bet else s.min_bet end, v_max);
  select * into c from public.game_corner_roulette_now();
  if not c.betting then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  if not ((p_kind = 'number' and p_pick between 0 and 36) or (p_kind in ('dozen', 'column') and p_pick between 1 and 3)
          or (p_kind in ('red', 'black', 'odd', 'even', 'low', 'high') and p_pick is null)) then
    raise exception 'bad_bet' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  select coalesce(sum(amount), 0) into v_mine from public.game_corner_roulette_bets where wheel = p_wheel and round_no = c.round_no and user_id = me;
  if v_mine + p_amount > v_max then raise exception 'bet_too_big' using errcode = 'P0001'; end if;
  v_allow := public.game_corner_take(me, p_amount, 'Roulette' || case when p_wheel = 2 then ' (high limit)' else '' end || ', round ' || c.round_no);
  insert into public.game_corner_roulette_bets (wheel, round_no, user_id, kind, pick, amount, from_allowance)
  values (p_wheel, c.round_no, me, p_kind, p_pick, p_amount, v_allow);
  return jsonb_build_object('wheel', p_wheel, 'round', c.round_no, 'mine', v_mine + p_amount, 'balance', public.token_balance(me));
end $$;

/** Take back your bets on this round of a wheel while its bets are still open. */
create or replace function public.game_corner_roulette_clear(p_wheel integer default 1)
returns numeric
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); c record; v record;
begin
  select * into c from public.game_corner_roulette_now();
  if not c.betting then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  with gone as (delete from public.game_corner_roulette_bets where wheel = p_wheel and round_no = c.round_no and user_id = me and settled_at is null returning amount, from_allowance)
  select coalesce(sum(amount), 0) as amount, coalesce(sum(from_allowance), 0) as from_allowance into v from gone;
  perform public.game_corner_pay(me, v.amount, v.amount, v.from_allowance, 'refund', 'Roulette bets taken back, round ' || c.round_no);
  return v.amount;
end $$;

/** One wheel's table as the page shows it: the clock, everyone's bets, the result once drawn, your last spin, the history. Internal. */
create or replace function public.game_corner_roulette_view(p_me uuid, p_wheel integer)
returns jsonb
language plpgsql stable security definer set search_path to 'public' as $$
declare c record; v jsonb;
begin
  select * into c from public.game_corner_roulette_now();
  select jsonb_build_object(
           'wheel', p_wheel,
           'round', c.round_no,
           'betting', c.betting,
           'bets_close_at', to_timestamp(c.round_no * 30 + 20),
           'round_ends_at', to_timestamp(c.round_no * 30 + 30),
           'result', (select x.result from public.game_corner_roulette_rounds x where x.wheel = p_wheel and x.round_no = c.round_no),
           'bets', coalesce((select jsonb_agg(jsonb_build_object('kind', b.kind, 'pick', b.pick, 'amount', b.amount, 'player', coalesce(p.display_name, p.username), 'mine', b.user_id = p_me) order by b.id)
                               from public.game_corner_roulette_bets b join public.profiles p on p.id = b.user_id where b.wheel = p_wheel and b.round_no = c.round_no), '[]'::jsonb),
           'last', (select jsonb_build_object('round', l.round_no, 'result', x.result, 'stake', sum(l.amount), 'payout', sum(l.payout))
                      from public.game_corner_roulette_bets l join public.game_corner_roulette_rounds x on x.wheel = l.wheel and x.round_no = l.round_no
                     where l.user_id = p_me and l.wheel = p_wheel and l.settled_at is not null
                       and l.round_no = (select max(l2.round_no) from public.game_corner_roulette_bets l2 where l2.user_id = p_me and l2.wheel = p_wheel and l2.settled_at is not null)
                     group by l.round_no, x.result),
           'history', coalesce((select jsonb_agg(h.result order by h.round_no desc)
                                  from (select x.round_no, x.result from public.game_corner_roulette_rounds x
                                         where x.wheel = p_wheel and (x.round_no < c.round_no or not c.betting) order by x.round_no desc limit 16) h), '[]'::jsonb))
    into v;
  return v;
end $$;

-- ─────────────────────────────────────────────── blackjack: table 4
alter table public.game_corner_bj_tables add column if not exists high_roller boolean not null default false;
alter table public.game_corner_bj_tables drop constraint if exists game_corner_bj_tables_table_no_check;
alter table public.game_corner_bj_tables add constraint game_corner_bj_tables_table_no_check check (table_no between 1 and 4);
insert into public.game_corner_bj_tables (table_no, high_roller) values (4, true) on conflict (table_no) do update set high_roller = true;
insert into public.game_corner_bj_seats (table_no, seat) select 4, s from generate_series(1, 5) s on conflict (table_no, seat) do nothing;

/** v116's bet, with the limits of the table's room. */
create or replace function public.game_corner_bj_bet(p_amount numeric)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); g public.game_corner_settings; s public.game_corner_bj_seats; t public.game_corner_bj_tables; v_allow numeric(12,2);
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into g from public.game_corner_settings where id;
  select * into s from public.game_corner_bj_seats where user_id = me;
  if s.table_no is null then raise exception 'not_seated' using errcode = 'P0001'; end if;
  perform 1 from public.game_corner_bj_tables where table_no = s.table_no for update;
  update public.game_corner_bj_seats set seen_at = now() where user_id = me;
  perform public.game_corner_bj_advance(s.table_no);
  select * into t from public.game_corner_bj_tables where table_no = s.table_no;
  perform public.game_corner_check_bet(p_amount, case when t.high_roller then g.high_min_bet else g.min_bet end,
                                                 case when t.high_roller then g.high_blackjack_max_bet else g.blackjack_max_bet end);
  if t.phase <> 'betting' then raise exception 'bets_closed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.game_corner_bj_hands where table_no = s.table_no and round = t.round and seat = s.seat) then
    raise exception 'already_bet' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtext('game_corner:' || me::text));
  v_allow := public.game_corner_take(me, p_amount, 'Blackjack, table ' || s.table_no || case when t.high_roller then ' (high limit)' else '' end);
  insert into public.game_corner_bj_hands (table_no, round, seat, hand, user_id, bet, from_allowance)
  values (s.table_no, t.round, s.seat, 1, me, p_amount, v_allow);
  update public.game_corner_bj_tables set bets_close_at = coalesce(bets_close_at, now() + interval '15 seconds') where table_no = s.table_no;
  perform public.game_corner_bj_advance(s.table_no);   -- deals now if everyone at the table has bet
  return jsonb_build_object('balance', public.token_balance(me));
end $$;

/** v116's view of the tables, each saying whether it's the high-limit one. Internal. */
create or replace function public.game_corner_bj_view(p_me uuid)
returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'mine', (select jsonb_build_object('table', s.table_no, 'seat', s.seat) from public.game_corner_bj_seats s where s.user_id = p_me),
    'tables', coalesce(jsonb_agg(jsonb_build_object(
      'table', t.table_no,
      'high', t.high_roller,
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

-- ─────────────────────────────────────────────── what the page reads
/**
 * Everything the Game Corner page shows (v115, v116), now with the high-limit room: each machine says whether it's
 * a high-limit one, the high-limit wheel comes as roulette_high, and the caps carry the room's limits as caps.high.
 */
create or replace function public.game_corner_state()
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare me uuid := auth.uid(); s public.game_corner_settings; v_slots jsonb; v_t smallint;
begin
  if not public.is_member() then raise exception 'members_only' using errcode = 'P0001'; end if;
  select * into s from public.game_corner_settings where id;
  perform public.game_corner_roulette_settle();
  update public.game_corner_slots set seen_at = now() where user_id = me;
  update public.game_corner_bj_seats set seen_at = now() where user_id = me;
  for v_t in select table_no from public.game_corner_bj_tables order by table_no loop
    perform public.game_corner_bj_advance(v_t);
  end loop;

  select jsonb_agg(jsonb_build_object(
           'machine', m.machine,
           'high', m.high_roller,
           'player', case when m.user_id is not null and m.seen_at > now() - interval '2 minutes' then coalesce(p.display_name, p.username) end,
           'avatar', case when m.user_id is not null and m.seen_at > now() - interval '2 minutes' then p.avatar_url end,
           'mine', m.user_id = me,
           'reels', to_jsonb(m.last_reels), 'lines', to_jsonb(m.last_lines), 'bet', m.last_bet, 'win', m.last_win, 'at', m.last_at, 'spins', m.spins) order by m.machine)
    into v_slots
    from public.game_corner_slots m left join public.profiles p on p.id = m.user_id;

  return jsonb_build_object(
    'now', now(),
    'open', s.is_open,
    'caps', jsonb_build_object('min', s.min_bet, 'slots', s.slots_max_bet, 'roulette', s.roulette_max_bet, 'blackjack', s.blackjack_max_bet,
                               'high', jsonb_build_object('min', s.high_min_bet, 'slots', s.high_slots_max_bet, 'roulette', s.high_roulette_max_bet, 'blackjack', s.high_blackjack_max_bet)),
    'balance', public.token_balance(me),
    'slots', v_slots,
    'roulette', public.game_corner_roulette_view(me, 1),
    'roulette_high', public.game_corner_roulette_view(me, 2),
    'blackjack', public.game_corner_bj_view(me));
end $$;

-- ─────────────────────────────────────────────── access
do $$
declare f text;
begin
  foreach f in array array['public.game_corner_check_bet(numeric, numeric, numeric)', 'public.game_corner_roulette_view(uuid, integer)', 'public.game_corner_bj_view(uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'public.set_game_corner_high_limits(numeric, numeric, numeric, numeric)', 'public.game_corner_slot_spin(numeric)',
    'public.game_corner_roulette_bet(text, integer, numeric, integer)', 'public.game_corner_roulette_clear(integer)',
    'public.game_corner_bj_bet(numeric)', 'public.game_corner_state()']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
