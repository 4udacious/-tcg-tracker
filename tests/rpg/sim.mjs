// The balance simulator: thousands of battles against every Gym Leader, the
// Elite Fours, Red, Alex, Herb and Paul, at their set levels, for a player arriving where the game leaves them,
// and every double battle (PAIRS), a 2v2 against two of them at once, at your level.
//
//   npm run sim:rpg                 (2000 battles a matchup)
//   SIM_N=500 npm run sim:rpg       (quicker, noisier)
//   SIM_ONLY=LANCE npm run sim:rpg  (only the challenges whose name matches)
//   SIM_ONLY=Double SIM_PAIR_LV=90 npm run sim:rpg  (the double battles, all with your best at Lv 90)
//
// It runs inside the game page, so it uses the game's own numbers: the same
// damage formula, type chart, stats, leader levels (leaderLevels), teams, IVs,
// move sets, Full Restores, tells (tellRate), ring speeds (ringFast) and the
// leaders' parries (parry, leaderParries). What
// it can't use is a person: the player is modelled as timing errors on the
// rings, at three skill levels (SKILLS). The aim, for the average player: about
// 2 wins in 3 against a leader (they parry), Lance and Red (each League's last)
// about 1 in 3.
//
// Left out, so read the numbers as a guide: statuses and stat moves (yours and
// theirs; a rampage's confusion is in), your own switching to a better
// matchup mid-battle (the leaders' is in), Move Discs, Revives. A leader's
// parries by your timing, and the counter after a PERFECT one, are in. So are
// guard, heavy blows and stun (GUARD, HEAVY, STUN): your guard spent and won
// back, red rings dodged (or parried from habit), and the foes' stun bars.
//
// A double battle is a 2v2 (duoBattle below): your first two against one of
// each pair's, with the shared PP pool, spread moves, their partner-aware
// picks (duoSmartPick, the game's own), Full Restores, parries and faster
// rings. You arrive with your best at the level you'd beat the later of the
// two (their ace's), and they're set above it (pairTeam). Left out besides:
// your switching, their stat moves' effects, a PERFECT parry's counter.
import { pathToFileURL } from 'node:url'
import { openGame } from './harness.mjs'

const N = +(process.env.SIM_N ?? 2000), ONLY = process.env.SIM_ONLY ?? ''

/*
 * The player, by skill: `strike` is the spread (ms, one standard deviation)
 * of a tap on your own rings, `defend` on theirs (on an 860 ms ring; faster
 * rings spread it more), `fooled` the chance a tell (feint, second ring,
 * low-high) makes them press at the wrong time. Potions: used under 35% HP.
 * `heavyParry`: the chance they parry a red ring (a heavy blow) from habit
 * instead of dodging it. `rest`: at that much guard or less, they dodge normal
 * rings too, to win some back (0: never).
 */
/**
 * Fights with an aim of their own (the rest, the leaders who parry: about 2 in 3, each League's last about 1 in 3): Alex's first battle is the friendly one,
 * the last the hardest in the game. Herb and Paul don't parry: 3 in 4, their first glitcher battles easy (their Pokémon haven't evolved yet), their last 2 in 3.
 * The leaders' aims went down when they began parrying (players asked for more of a challenge).
 */
export const AIMS = { 'ALEX 1': 0.9, 'ALEX 7': 0.15, 'HERB 1': 0.9, 'PAUL 1': 0.9, 'HERB 2': 0.75, 'HERB 3': 0.75, 'PAUL 2': 0.75, 'PAUL 3': 0.75, 'HERB 4': 0.65, 'PAUL 4': 0.65 }
/** Double battles are meant to be hard: about 1 win in 3 for an average player, the Champions' pairs (`top`) 1 in 4. */
export const PAIR_AIM = { pair: 0.33, top: 0.25 }

export const SKILLS = {
  casual: { strike: 150, defend: 120, fooled: 0.55, potions: 1, heavyParry: 0.4, rest: 0 },
  average: { strike: 100, defend: 80, fooled: 0.35, potions: 2, heavyParry: 0.2, rest: 25 },
  skilled: { strike: 60, defend: 50, fooled: 0.15, potions: 3, heavyParry: 0.08, rest: 35 },
}

export function simulate({ N, SKILLS, ONLY, AIMS, PAIR_AIM = { pair: 0.33, top: 0.25 }, PAIR_LV = 0 }) {
  const R = Math.random
  const gauss = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()) }
  // Your ring, as the game grades it (accuracy()).
  const grade = (dt) => (dt <= 40 ? { mult: 1.6, miss: false } : dt <= 320 ? { mult: 1.45 - (dt - 40) / 280 * 0.65, miss: false } : { mult: 0.7, miss: true })
  const label = (dt) => (dt <= 40 ? 'PERFECT' : dt <= 120 ? 'GREAT' : dt <= 220 ? 'GOOD' : dt <= 320 ? 'OK' : 'MISS')
  /*
   * Guard, heavy blows and stun (GUARD, HEAVY, STUN in the game). One ring on one of yours, by the game's own rules
   * (defendResult, takenOf, guardCost, stunFromDefend): what got through, whether it counts for PP, and how much it fills
   * the attacker's stun bar. `g` is that Pokémon's guard, { guard, broken }. You dodge a red ring, unless you parry it
   * from habit (`heavyParry`); and a normal one too once your guard's down to `rest`, to win some back.
   */
  let hurt = 0   // what your side lost to their attacks this battle, in your Pokémon's full HP bars
  const hit = (m, dmg) => { const from = m.hp; m.hp = Math.max(0, m.hp - dmg); hurt += (from - m.hp) / m.stats.hp }
  const guardOf = (map, m) => map.get(m) ?? (map.set(m, { guard: GUARD.max, broken: false }), map.get(m))
  const defend = (g, { low, heavy, approach, fooled }, skill) => {
    const dt = fooled ? 400 : Math.abs(gauss() * skill.defend * Math.sqrt(860 / approach))
    if (g.broken) { g.broken = false; g.guard = GUARD.back; return { taken: takenOf({ r: 'miss' }, heavy) * GUARD.broken, evaded: false, stun: 0 } }
    const btn = low ? 'up' : heavy ? (R() < skill.heavyParry ? 'a' : 'b') : g.guard <= skill.rest ? 'b' : 'a'
    const res = defendResult({ btn }, dt, low, 1, heavy), cost = guardCost(res, heavy)
    if (cost) { g.guard = cost === Infinity ? 0 : Math.max(0, Math.min(GUARD.max, g.guard - cost)); if (g.guard <= 0) g.broken = true }
    return { taken: takenOf(res, heavy), evaded: heavy ? res.r === 'dodge' : res.r === 'parry' || res.r === 'jump', stun: stunFromDefend(res, heavy) }
  }
  // A foe's stun bar: full, it's stunned (`skip`: it loses its next turn; otherwise it lost the rest of its attack).
  const stunOf = (map, m) => map.get(m) ?? (map.set(m, { stun: 0, stunned: null }), map.get(m))
  const fill = (map, m, T, n, theirs) => {
    const t = stunOf(map, m), max = stunMax(T)
    if (!n || t.stunned || m.hp <= 0) return false
    t.stun = Math.min(max, t.stun + n); if (t.stun < max) return false
    t.stunned = { skip: !theirs }; return true
  }
  // The end of a turn: guard comes back, stun drains.
  const tick = (guards, stuns) => {
    for (const g of guards.values()) if (!g.broken) g.guard = Math.min(GUARD.max, g.guard + GUARD.regen)
    for (const t of stuns.values()) if (!t.stunned) t.stun = Math.max(0, t.stun - STUN.decay)
  }
  const damage = (att, def, mv, mult) => {
    const spec = mv.cat === 'spec', A = spec ? att.stats.spa : att.stats.atk, D = spec ? def.stats.spd : def.stats.def
    const base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * (mv.power ?? 60) * A / D) / 50) + 2
    return Math.max(1, Math.round(base * (att.types.includes(mv.type) ? 1.5 : 1) * soften(gameMult(mv.type, def.types)) * mult))
  }

  /* ── your party, arriving at a leader: species from the game's own pools, evolved by level, best moves equipped ── */
  const pool = [...DATA.starters, ...DATA.wild].filter((s) => !EVO_HOW[s.name] || DATA.evos?.[s.name]?.length)
  function grow(sp, level) {
    let m = individual(sp, level, R)
    for (let i = 0; i < 3; i++) { const e = evoDue(m); if (!e?.to || e.item) break; evolveInto(m, e.to) }
    learn(m)
    const attacks = m.learned.filter((n) => MOVEDEX[n] && !SUPPORT[n]), basic = attacks.find((n) => MOVEDEX[n].cost === 0) ?? attacks[0]
    const best = attacks.filter((n) => n !== basic).sort((a, b) => (MOVEDEX[b].power ?? 60) * (MOVEDEX[b].hits ?? 1) - (MOVEDEX[a].power ?? 60) * (MOVEDEX[a].hits ?? 1)).slice(0, 3)
    m.sim = [basic, ...best].filter(Boolean).map((n) => ({ name: n, ...MOVEDEX[n] }))
    m.hp = m.stats.hp
    return m
  }
  function partyFor(size, best) {
    return Array.from({ length: size }, (_, i) => grow(pool[Math.floor(R() * pool.length)], Math.max(2, best - (i ? 1 + Math.floor(R() * 4) : 0))))
  }

  /* ── one battle ── */
  function battle(skill, T, teamOf, party) {
    const foes = teamOf(party.map((m) => m.level))
    const movesFor = (f, last) => T.movesFor?.(f) || (T.sig && last && T.sig) || ((T.region === 'kanto' || (T.strong && !last)) && strongMoves(f)) || TRAINER_MOVES[f.name] || WILD_MOVES[f.types[0]] || WILD_MOVES.normal
    let restores = T.restores ?? 1, potions = skill.potions, pp = 3, switches = T.switches ?? 0
    // As the game keeps them: the one out, and the rest in order, the ace last.
    const roster = foes.slice(1)
    let me = party[0], foe = foes[0], fm = movesFor(foe, !roster.length), charged = null, conf = 0
    const guards = new Map(), stuns = new Map()
    const next = (m) => { foe = m; fm = movesFor(foe, !roster.length); charged = null; conf = 0 }
    const switchIn = () => { me = party.filter((m) => m.hp > 0).sort((a, b) => bestHit(b, foe) - bestHit(a, foe))[0] }
    const bestHit = (m, f) => Math.max(...m.sim.map((mv) => (mv.power ?? 60) * (mv.hits ?? 1) * soften(gameMult(mv.type, f.types)) * (m.types.includes(mv.type) ? 1.5 : 1)))
    for (let turn = 0; turn < 300; turn++) {
      if (turn) tick(guards, stuns)
      // You: a Potion when low, otherwise the hardest-hitting move you have the PP for.
      if (me.hp < me.stats.hp * 0.35 && potions > 0) { potions--; me.hp = Math.min(me.stats.hp, me.hp + Math.ceil(me.stats.hp * ITEMS.potion.heal)) }
      else {
        const score = (mv) => (mv.power ?? 60) * (mv.hits ?? 1) * soften(gameMult(mv.type, foe.types)) * (me.types.includes(mv.type) ? 1.5 : 1)
        const mv = me.sim.filter((x) => (x.cost ?? 0) <= pp).sort((a, b) => score(b) - score(a))[0] ?? me.sim[0]
        pp -= mv.cost ?? 0
        let clean = false, countered = false
        for (let h = 0; h < (mv.hits ?? 1) && foe.hp > 0; h++) {
          const dt = Math.abs(gauss() * skill.strike), g = grade(dt)
          if ((mv.hits ?? 1) > 1 && g.miss) continue
          clean ||= !g.miss
          // A leader parries now and then, the more the worse your timing (the game's own rule): a fifth of the
          // damage, or, a PERFECT parry, none at all and a counter after. Stunned, it can't, and takes STUN.mult.
          const stunned = !!stunOf(stuns, foe).stunned
          const parried = !stunned && leaderParries(T, foe, label(dt), conf > 0, R)
          if (parried === 'perfect') { countered = true; continue }
          foe.hp = Math.max(0, foe.hp - damage(me, foe, mv, g.mult * (parried ? DEFEND_TAKEN.parry : 1) * (stunned ? STUN.mult : 1)))
          if (!parried) fill(stuns, foe, T, stunFromStrike(label(dt), gameMult(mv.type, foe.types)), false)
        }
        if (countered && foe.hp > 0) me.hp = Math.max(1, me.hp - Math.max(1, Math.round(damage(foe, me, MOVEDEX.TACKLE, 1) * LEADER_COUNTER)))
        if ((mv.cost ?? 0) === 0 && clean) pp = Math.min(5, pp + 1)
      }
      if (foe.hp <= 0) {
        if (!roster.length) return true
        next(roster.shift())
        continue
      }
      // Stunned: its turn lost (stunned by your strike), or the stun just ends (stunned during its last attack).
      const st = stunOf(stuns, foe)
      if (st.stunned) { const { skip } = st.stunned; st.stunned = null; st.stun = 0; if (skip) continue }
      // Confused (after a rampage): a third of the time it hurts itself instead.
      if (conf && --conf && R() < 1 / 3) { foe.hp = Math.max(0, foe.hp - confusionDmg(foe)); if (foe.hp <= 0) { if (!roster.length) return true; next(roster.shift()) } continue }
      // The toughest leaders pull a Pokémon out of a bad matchup: the game's own rule (switchPick).
      if (switches > 0 && roster.length > 1 && !charged && (T.switchSure || R() < 0.7)) {
        const to = switchPick(foe, roster.slice(0, -1), me, me.sim, (f) => movesFor(f, false))
        if (to) { switches--; roster.splice(roster.indexOf(to), 1); roster.splice(roster.length - 1, 0, foe); next(to); continue }
      }
      // Them: a Full Restore when low (the last kept for the last Pokémon), else usually their hardest-hitting move.
      if (restores > 0 && (!roster.length || restores > 1) && foe.hp < foe.stats.hp * 0.35) { restores--; foe.hp = foe.stats.hp; continue }
      if (!charged && R() < 0.25 * 0.5) continue   // now and then a stat move instead (left out: its effect)
      const score = (m) => (m.power ?? 0) * (m.hits ?? 1) * soften(gameMult(m.type, me.types)) * (foe.types.includes(m.type) ? 1.5 : 1)
      const ranked = fm.filter((m) => !m.splash).slice().sort((a, b) => score(b) - score(a))
      const mv = charged ?? ranked[R() < 0.7 ? 0 : Math.min(1, ranked.length - 1)]
      if (mv.charge && charged !== mv) { charged = mv; continue }
      const released = charged === mv; charged = null
      const heavy = heavyRoll(mv, T, R, released)
      const tell = !heavy && R() < (T.tellRate ?? 0.4) ? ['feint', 'double', 'lowHigh'][Math.floor(R() * 3)] : null
      const rampage = mv.rampage ? 3 + Math.floor(R() * 3) : 0
      const hits = rampage || (tell === 'double' ? (mv.hits ?? 1) + 1 : tell === 'lowHigh' ? 2 : mv.hits ?? 1)
      let evaded = 0, faced = 0
      for (let h = 0; h < hits; h++) {
        const low = tell === 'lowHigh' ? h === 0 : mv.kind === 'low'
        const base = released ? 560 : rampage && h ? 400 : mv.fast ? 640 : h === 0 ? 860 : 560
        const approach = base * (T.ringFast ?? 0.8) * (0.75 + R() * 0.4)
        const fooled = tell && (tell === 'double' ? h === hits - 1 : h === 0) && R() < skill.fooled
        const d = defend(guardOf(guards, me), { low, heavy: heavy || (rampage > 0 && h === hits - 1), approach, fooled }, skill)
        faced++; if (d.evaded) evaded++
        if (d.taken > 0) hit(me, damage(foe, me, mv, d.taken))
        if (me.hp <= 0) break
        if (fill(stuns, foe, T, d.stun, true)) break   // stunned: the rest of its attack is lost
      }
      if (evaded === faced) pp = Math.min(5, pp + 1)
      if (rampage && !conf) conf = 2 + Math.floor(R() * 2)
      if (me.hp <= 0) { if (!party.some((m) => m.hp > 0)) return false; switchIn(); pp = 3 }
    }
    return false
  }

  /* ── a double battle: your first two against one of each pair's three ── */
  // Your own Earthquake rolling into your partner, who can jump it (no guard or stun in it).
  const jumpTaken = (approach, skill) => takenOf(defendResult({ btn: 'up' }, Math.abs(gauss() * skill.defend * Math.sqrt(860 / approach)), true, 1))
  function duoBattle(skill, crew, party) {
    const lv = Math.max(...party.map((m) => m.level))
    const teams = crew.map((T) => { const t = pairTeam(T, lv, R); t.at(-1).pairAce = true; return t })
    const field = teams.map((t, i) => ({ m: t[0], T: crew[i], bench: t.slice(1), charged: null, statused: false }))
    const restores = crew.map((T) => T.restores ?? 0)
    const mine = party.slice(0, 2), up = (side) => side.filter((x) => x && x.hp > 0)
    let pp = 2, potions = skill.potions
    const guards = new Map(), stuns = new Map()
    const foesUp = () => field.filter((f) => f.m.hp > 0)
    const refill = () => {
      // A foe out: the next of the same trainer's, or, with none left, their partner's.
      for (const f of field) if (f.m.hp <= 0) { const from = f.bench.length ? f : field.find((g) => g.bench.length); if (from) { f.m = from.bench.shift(); f.T = from.T; f.charged = null; f.statused = false } }
      // One of yours out: the healthiest of the rest.
      for (let i = 0; i < 2; i++) if (!mine[i] || mine[i].hp <= 0) mine[i] = party.filter((m) => m.hp > 0 && !mine.includes(m)).sort((a, b) => b.hp - a.hp)[0] ?? mine[i]
    }
    const share = (d, m) => Math.min(1, d / Math.max(1, m.hp))
    for (let turn = 0; turn < 200; turn++) {
      if (turn) tick(guards, stuns)
      const acts = []
      let spend = pp
      for (const me of up(mine)) {
        if (me.hp < me.stats.hp * 0.35 && potions > 0) { potions--; acts.push({ who: me, mine: true, item: true, prio: 6 }); continue }
        const partner = up(mine).find((x) => x !== me), foes = foesUp()
        let best = null
        for (const mv of me.sim) {
          if ((mv.cost ?? 0) > spend) continue
          if (mv.spread) {
            const v = foes.reduce((n, f) => n + share(estHit(me, f.m, mv) * 0.75, f.m), 0) - (mv.spread === 'all' && partner ? 2 * share(estHit(me, partner, mv) * 0.75, partner) : 0)
            if (!best || v > best.v) best = { v, mv, f: null }
          } else for (const f of foes) { const d = estHit(me, f.m, mv), v = share(d, f.m) + (d >= f.m.hp ? 0.5 : 0); if (!best || v > best.v) best = { v, mv, f } }
        }
        if (!best) continue
        spend -= best.mv.cost ?? 0
        acts.push({ who: me, mine: true, mv: best.mv, f: best.f, prio: best.mv.prio ?? (best.mv.fast ? 1 : 0) })
      }
      for (const [i, f] of field.entries()) {
        if (f.m.hp <= 0) continue
        if (f.charged) { acts.push({ who: f.m, slot: f, mv: f.charged, released: true, prio: 1 }); continue }
        if (restores[crew.indexOf(f.T)] > 0 && f.m.hp < f.m.stats.hp * 0.35) { restores[crew.indexOf(f.T)]--; acts.push({ who: f.m, slot: f, restore: true, prio: 6 }); continue }
        if (!f.statused && R() < 0.1) { f.statused = true; continue }   // a stat move now and then (its effect left out)
        const partner = field.find((g, j) => j !== i && g.m.hp > 0)?.m
        const p = duoSmartPick(f.m, pairMoves(f.T, f.m, !!f.m.pairAce), up(mine), partner, R)
        if (p) acts.push({ who: f.m, slot: f, mv: p.mv, target: p.target, prio: p.mv.prio ?? (p.mv.fast ? 1 : 0) })
      }
      acts.forEach((a) => { a.roll = R() })
      acts.sort((a, b) => b.prio - a.prio || b.who.stats.spe - a.who.stats.spe || a.roll - b.roll)
      for (const a of acts) {
        if (a.who.hp <= 0 || (a.slot && a.slot.m !== a.who)) continue
        if (a.item) { a.who.hp = Math.min(a.who.stats.hp, a.who.hp + Math.ceil(a.who.stats.hp * ITEMS.potion.heal)); continue }
        if (a.restore) { a.who.hp = a.who.stats.hp; continue }
        if (a.mine) {
          const foes = foesUp(); if (!foes.length) break
          const targets = a.mv.spread ? foes : [a.f && a.f.m.hp > 0 && foes.includes(a.f) ? a.f : foes[0]]
          const mult = targets.length > 1 ? 0.75 : 1
          let clean = false
          const parriers = new Set()
          for (const f of targets) for (let h = 0; h < (a.mv.hits ?? 1) && f.m.hp > 0; h++) {
            const dt = Math.abs(gauss() * skill.strike), g = grade(dt)
            if ((a.mv.hits ?? 1) > 1 && g.miss) continue
            clean ||= !g.miss
            const stunned = !!stunOf(stuns, f.m).stunned
            const parried = !stunned && leaderParries(f.T, f.m, label(dt), false, R)
            if (parried === 'perfect') { parriers.add(f.m); continue }
            f.m.hp = Math.max(0, f.m.hp - damage(a.who, f.m, a.mv, g.mult * mult * (parried ? DEFEND_TAKEN.parry : 1) * (stunned ? STUN.mult : 1)))
            if (!parried) fill(stuns, f.m, f.T, stunFromStrike(label(dt), gameMult(a.mv.type, f.m.types)), false)
          }
          // Each that PERFECT parried counters, never for the knockout.
          for (const m of parriers) if (m.hp > 0) a.who.hp = Math.max(1, a.who.hp - Math.max(1, Math.round(damage(m, a.who, MOVEDEX.TACKLE, 1) * LEADER_COUNTER)))
          // Earthquake and the like roll on into your partner, who can jump it.
          const partner = a.mv.spread === 'all' ? up(mine).find((x) => x !== a.who) : null
          if (partner) partner.hp = Math.max(0, partner.hp - damage(a.who, partner, a.mv, 0.75 * jumpTaken(820, skill)))
          if ((a.mv.cost ?? 0) === 0 && clean) pp = Math.min(5, pp + 1)
          pp = Math.max(0, pp - (a.mv.cost ?? 0))
        } else {
          const mv = a.mv, st = stunOf(stuns, a.who)
          if (st.stunned) { const { skip } = st.stunned; st.stunned = null; st.stun = 0; if (skip) continue }
          if (mv.charge && !a.released) { a.slot.charged = mv; continue }
          a.slot.charged = null
          const yours = up(mine); if (!yours.length) break
          const spread = SPREAD.has(mv.name)
          const targets = spread ? yours : [a.target && a.target.hp > 0 && yours.includes(a.target) ? a.target : yours[Math.floor(R() * yours.length)]]
          const hits = mv.rampage ? 3 + Math.floor(R() * 3) : mv.hits ?? 1
          const heavy = !spread && heavyRoll(mv, a.slot.T, R, !!a.released)
          let rings = 0, evaded = 0
          hitting: for (const t of targets) for (let h = 0; h < hits && t.hp > 0; h++) {
            const approach = (a.released || mv.fast ? 640 : h === 0 ? 820 : 560) * (0.75 + R() * 0.4) * (a.slot.T.duoFast ?? 1)
            const d = defend(guardOf(guards, t), { low: mv.kind === 'low', heavy: heavy || (!!mv.rampage && h === hits - 1), approach, fooled: false }, skill)
            rings++; if (d.evaded) evaded++
            if (d.taken > 0) hit(t, damage(a.who, t, mv, d.taken * (spread ? 0.75 : 1)))
            if (fill(stuns, a.who, a.slot.T, d.stun, true)) break hitting   // stunned: the rest of its attack is lost
          }
          if (rings && evaded === rings) pp = Math.min(5, pp + 1)
          const partner = spread ? field.find((g) => g.m !== a.who && g.m.hp > 0)?.m : null
          if (partner) partner.hp = Math.max(0, partner.hp - damage(a.who, partner, mv, 0.75))
        }
        refill()   // whoever fainted is replaced at once (they don't act until next turn)
        if (!foesUp().length || !up(mine).length) break
      }
      if (!foesUp().length) return true
      if (!up(mine).length) return false
    }
    return false
  }

  /* ── every challenge, in the order you meet them, with the party you'd have ── */
  const IVS = (team, floor) => team.map((m) => { for (const k of STAT_KEYS) m.ivs[k] = Math.max(floor, m.ivs[k]); m.stats = statsAt(m, m.level); m.hp = m.stats.hp; return m })
  const leaderTeam = (L, floor = L.ivs ?? 20, find = (n) => DATA.trainer.find((t) => t.name === n) ?? speciesByName(n)) => () => { const l = leaderLevels(L); const all = [L.team, ...(L.alts ?? [])]; return IVS(all[Math.floor(R() * all.length)].map((n, i) => individual(find(n), l[i], R)), floor) }   // any of their teams, as in the game
  // Where you arrive. A leader: `gap` below their ace, the most everyday trainers take you to (trainerCap). A story
  // battle (Alex, Herb, Paul) turns up straight after the win that makes it due: where that leader's cap left you,
  // plus 2 levels from beating them.
  const order = [
    ...GYMS.slice(0, 8).map((L, i) => [L, { johto: i + 1, kanto: 0, champion: false, red: false }]),
    ...ELITE.map((L) => [L, { johto: 8, kanto: 0, champion: L.role === 'CHAMPION', red: false }]),
    ...GYMS.slice(8).map((L, i) => [L, { johto: 8, kanto: i + 1, champion: true, red: false }]),
    ...KANTO_ELITE.map((L) => [L, { johto: 8, kanto: 8, champion: true, red: !!L.red }]),
  ]
  const before = (T) => order.find(([, p]) => T.due(p))[0]
  const arrive = (c) => Math.max(5, c.story ? before(c.T).min - before(c.T).gap + 2 : c.T.min - c.T.gap)
  // How many you'd have by then: three early on, a full six by Lv 30.
  const sizeAt = (lv) => (lv < 12 ? 3 : lv < 20 ? 4 : lv < 30 ? 5 : 6)
  const rows = []
  const list = [
    ...GYMS.slice(0, 8).map((L) => ({ name: L.short, group: 'Johto gyms', T: L, team: leaderTeam(L) })),
    ...ELITE.map((L) => ({ name: L.short, group: 'Johto League', T: L, team: leaderTeam(L), last: L.role === 'CHAMPION' })),
    ...GYMS.slice(8).map((L) => ({ name: L.short, group: 'Kanto gyms', T: L, team: leaderTeam(L) })),
    ...KANTO_ELITE.map((L) => ({ name: L.short, group: 'Kanto League', T: L, team: leaderTeam(L), last: !!L.red })),
    ...RIVAL_BATTLES.map((B, n) => { const T = rivalTrainer(n); return { name: `ALEX ${n + 1}`, group: 'Alex', T, team: leaderTeam(T, T.ivs, speciesByName), last: n === 6, story: true } }),
    ...Object.keys(STORY).flatMap((who) => STORY[who].battles.map((B, n) => { const T = storyTrainer(who, n); return { name: `${who} ${n + 1}`, group: 'Herb and Paul', T, team: leaderTeam(T, T.ivs, speciesByName), story: true } })),
    // Double battles: arriving with your best at the later of the two's ace level.
    ...PAIRS.map((P) => {
      const A = pairMember(P.a), B = pairMember(P.b)
      return { name: P.id.toUpperCase(), group: 'Double battles', T: A, crew: [pairSide(A, P), pairSide(B, P)], duo: true,
        lv: PAIR_LV || Math.max(A.min, B.min), aim: P.top ? PAIR_AIM.top : PAIR_AIM.pair }
    }),
  ]
  list.filter((c) => new RegExp(ONLY, 'i').test(`${c.group}:${c.name}`)).forEach((c) => {
    const lv = c.duo ? c.lv : arrive(c), size = c.duo ? 6 : sizeAt(lv)
    const out = { name: c.name, group: c.group, arrive: lv, ace: c.duo ? pairLevel(c.crew[0], lv, 2) : c.T.min, aim: c.aim ?? AIMS[c.name] ?? (c.last ? 0.35 : 0.65) }
    for (const [k, skill] of Object.entries(SKILLS)) {
      let w = 0, lost = 0
      for (let b = 0; b < N; b++) { hurt = 0; w += (c.duo ? duoBattle(skill, c.crew, partyFor(size, lv)) : battle(skill, c.T, c.team, partyFor(size, lv))) ? 1 : 0; lost += hurt }
      out[k] = w / N; out[k + 'Hurt'] = lost / N
    }
    rows.push(out)
  })
  return rows
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
const g = await openGame()
try {
  await g.page.click('#mPlay'); await g.page.waitForTimeout(800)
  const t0 = Date.now()
  const rows = await g.page.evaluate(simulate, { N, SKILLS, ONLY, AIMS, PAIR_AIM, PAIR_LV: +(process.env.SIM_PAIR_LV ?? 0) })
  const pct = (x) => `${Math.round(x * 100)}%`.padStart(5)
  const flag = (r) => { const d = r.average - r.aim; return Math.abs(d) <= 0.1 ? '' : d > 0 ? '  easier than the aim' : '  harder than the aim' }
  let group = ''
  console.log(`\n${N} battles a matchup, in ${Math.round((Date.now() - t0) / 1000)} s. Win rates for a player arriving with their best at Lv (a leader's ace − 3; a story battle's − 5).\n`)
  console.log(`${'Challenge'.padEnd(12)} ${'Lv'.padStart(3)} ${'Ace'.padStart(4)}  casual average skilled   aim   HP bars lost (skilled)`)
  for (const r of rows) {
    if (r.group !== group) { group = r.group; console.log(`\n${group}`) }
    console.log(`${r.name.padEnd(12)} ${String(r.arrive).padStart(3)} ${String(r.ace).padStart(4)}  ${pct(r.casual)}  ${pct(r.average)}   ${pct(r.skilled)}  ${pct(r.aim)}   ${r.skilledHurt.toFixed(1).padStart(4)}${flag(r)}`)
  }
  if (g.errors.length) console.log('\nPage errors:', g.errors)
} finally { await g.close() }
}
