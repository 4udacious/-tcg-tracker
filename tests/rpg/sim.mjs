// The balance simulator: thousands of battles against every Gym Leader, the
// Elite Fours, Red and Alex, for a player arriving at each one's level.
//
//   npm run sim:rpg                 (2000 battles a matchup)
//   SIM_N=500 npm run sim:rpg       (quicker, noisier)
//   SIM_ONLY=LANCE npm run sim:rpg  (only the challenges whose name matches)
//
// It runs inside the game page, so it uses the game's own numbers: the same
// damage formula, type chart, stats, leader levels (leaderLevels), teams, IVs,
// move sets, Full Restores, tells (tellRate) and ring speeds (ringFast). What
// it can't use is a person: the player is modelled as timing errors on the
// rings, at three skill levels (SKILLS). The aim, for the average player: about
// 3 wins in 4 against a leader, Lance (each League's last) about 1 in 2.
//
// Left out, so read the numbers as a guide: statuses and stat moves (yours and
// theirs; a rampage's confusion is in), switching to a better matchup mid-battle, Move Discs, Revives.
import { openGame } from './harness.mjs'

const N = +(process.env.SIM_N ?? 2000), ONLY = process.env.SIM_ONLY ?? ''

/*
 * The player, by skill: `strike` is the spread (ms, one standard deviation)
 * of a tap on your own rings, `defend` on theirs (on an 860 ms ring; faster
 * rings spread it more), `fooled` the chance a tell (feint, second ring,
 * low-high) makes them press at the wrong time. Potions: used under 35% HP.
 */
const SKILLS = {
  casual: { strike: 150, defend: 120, fooled: 0.55, potions: 1 },
  average: { strike: 100, defend: 80, fooled: 0.35, potions: 2 },
  skilled: { strike: 60, defend: 50, fooled: 0.15, potions: 3 },
}

function simulate({ N, SKILLS, ONLY }) {
  const R = Math.random
  const gauss = () => { let u = 0; while (!u) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()) }
  // Your ring, as the game grades it (accuracy()).
  const grade = (dt) => (dt <= 40 ? { mult: 1.6, miss: false } : dt <= 320 ? { mult: 1.45 - (dt - 40) / 280 * 0.65, miss: false } : { mult: 0.7, miss: true })
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
    const movesFor = (f, last) => T.movesFor?.(f) || (T.sig && last && T.sig) || (T.region === 'kanto' && strongMoves(f)) || TRAINER_MOVES[f.name] || WILD_MOVES[f.types[0]] || WILD_MOVES.normal
    let restores = T.restores ?? 1, potions = skill.potions, pp = 3
    let me = party[0], fi = 0, foe = foes[0], fm = movesFor(foe, foes.length === 1), charged = null, conf = 0
    const switchIn = () => { me = party.filter((m) => m.hp > 0).sort((a, b) => bestHit(b, foe) - bestHit(a, foe))[0] }
    const bestHit = (m, f) => Math.max(...m.sim.map((mv) => (mv.power ?? 60) * (mv.hits ?? 1) * soften(gameMult(mv.type, f.types)) * (m.types.includes(mv.type) ? 1.5 : 1)))
    for (let turn = 0; turn < 300; turn++) {
      // You: a Potion when low, otherwise the hardest-hitting move you have the PP for.
      if (me.hp < me.stats.hp * 0.35 && potions > 0) { potions--; me.hp = Math.min(me.stats.hp, me.hp + Math.ceil(me.stats.hp * ITEMS.potion.heal)) }
      else {
        const score = (mv) => (mv.power ?? 60) * (mv.hits ?? 1) * soften(gameMult(mv.type, foe.types)) * (me.types.includes(mv.type) ? 1.5 : 1)
        const mv = me.sim.filter((x) => (x.cost ?? 0) <= pp).sort((a, b) => score(b) - score(a))[0] ?? me.sim[0]
        pp -= mv.cost ?? 0
        let clean = false
        for (let h = 0; h < (mv.hits ?? 1) && foe.hp > 0; h++) {
          const g = grade(Math.abs(gauss() * skill.strike))
          if ((mv.hits ?? 1) > 1 && g.miss) continue
          clean ||= !g.miss
          foe.hp = Math.max(0, foe.hp - damage(me, foe, mv, g.mult))
        }
        if ((mv.cost ?? 0) === 0 && clean) pp = Math.min(5, pp + 1)
      }
      if (foe.hp <= 0) {
        if (++fi >= foes.length) return true
        foe = foes[fi]; fm = movesFor(foe, fi === foes.length - 1); charged = null; conf = 0
        continue
      }
      // Confused (after a rampage): a third of the time it hurts itself instead.
      if (conf && --conf && R() < 1 / 3) { foe.hp = Math.max(0, foe.hp - confusionDmg(foe)); if (foe.hp <= 0) { if (++fi >= foes.length) return true; foe = foes[fi]; fm = movesFor(foe, fi === foes.length - 1); charged = null; conf = 0 } continue }
      // Them: a Full Restore when low (the last kept for the last Pokémon), else usually their hardest-hitting move.
      if (restores > 0 && (fi === foes.length - 1 || restores > 1) && foe.hp < foe.stats.hp * 0.35) { restores--; foe.hp = foe.stats.hp; continue }
      if (!charged && R() < 0.25 * 0.5) continue   // now and then a stat move instead (left out: its effect)
      const score = (m) => (m.power ?? 0) * (m.hits ?? 1) * soften(gameMult(m.type, me.types)) * (foe.types.includes(m.type) ? 1.5 : 1)
      const ranked = fm.filter((m) => !m.splash).slice().sort((a, b) => score(b) - score(a))
      const mv = charged ?? ranked[R() < 0.7 ? 0 : Math.min(1, ranked.length - 1)]
      if (mv.charge && charged !== mv) { charged = mv; continue }
      const released = charged === mv; charged = null
      const tell = R() < (T.tellRate ?? 0.4) ? ['feint', 'double', 'lowHigh'][Math.floor(R() * 3)] : null
      const rampage = mv.rampage ? 3 + Math.floor(R() * 3) : 0
      const hits = rampage || (tell === 'double' ? (mv.hits ?? 1) + 1 : tell === 'lowHigh' ? 2 : mv.hits ?? 1)
      let evaded = 0
      for (let h = 0; h < hits; h++) {
        const low = tell === 'lowHigh' ? h === 0 : mv.kind === 'low'
        const base = released ? 560 : rampage && h ? 400 : mv.fast ? 640 : h === 0 ? 860 : 560
        const approach = base * (T.ringFast ?? 0.8) * (0.75 + R() * 0.4)
        const fooled = tell && (tell === 'double' ? h === hits - 1 : h === 0) && R() < skill.fooled
        const dt = fooled ? 400 : Math.abs(gauss() * skill.defend * Math.sqrt(860 / approach))
        const res = low ? (dt <= 190 ? (dt <= 35 ? 0 : 0.2) : 1) : dt <= 90 ? (dt <= 35 ? 0 : 0.2) : 1
        if (res < 1) evaded++
        if (res > 0) me.hp = Math.max(0, me.hp - damage(foe, me, mv, res))
        if (me.hp <= 0) break
      }
      if (evaded === hits) pp = Math.min(5, pp + 1)
      if (rampage && !conf) conf = 2 + Math.floor(R() * 2)
      if (me.hp <= 0) { if (!party.some((m) => m.hp > 0)) return false; switchIn(); pp = 3 }
    }
    return false
  }

  /* ── every challenge, in the order you meet them, with the party you'd have ── */
  const IVS = (team, floor) => team.map((m) => { for (const k of STAT_KEYS) m.ivs[k] = Math.max(floor, m.ivs[k]); m.stats = statsAt(m, m.level); m.hp = m.stats.hp; return m })
  const leaderTeam = (L, floor = 20, find = (n) => DATA.trainer.find((t) => t.name === n) ?? speciesByName(n)) => (lv) => { const l = leaderLevels(L, lv); return IVS(L.team.map((n, i) => individual(find(n), l[i], R)), floor) }
  // Where you arrive: your best is 3 below the ace's floor, so it's at that floor (leaderLevels).
  const arrive = (L) => Math.max(5, L.min + (L.lvAdj ?? 0) - 3)
  // How many you'd have by then: three early on, a full six by Lv 30.
  const sizeAt = (lv) => (lv < 12 ? 3 : lv < 20 ? 4 : lv < 30 ? 5 : 6)
  const rows = []
  const list = [
    ...GYMS.slice(0, 8).map((L) => ({ name: L.short, group: 'Johto gyms', T: L, team: leaderTeam(L) })),
    ...ELITE.map((L) => ({ name: L.short, group: 'Johto League', T: L, team: leaderTeam(L), last: L.role === 'CHAMPION' })),
    ...GYMS.slice(8).map((L) => ({ name: L.short, group: 'Kanto gyms', T: L, team: leaderTeam(L) })),
    ...KANTO_ELITE.map((L) => ({ name: L.short, group: 'Kanto League', T: L, team: leaderTeam(L), last: !!L.red })),
    ...RIVAL_BATTLES.map((B, n) => { const T = rivalTrainer(n); return { name: `ALEX ${n + 1}`, group: 'Alex', T, team: leaderTeam(T, RIVAL_LOOKS[T.phase].ivs, speciesByName), last: n === 6 } }),
  ]
  list.filter((c) => new RegExp(ONLY, 'i').test(c.name)).forEach((c) => {
    const lv = arrive(c.T), size = sizeAt(lv)
    const out = { name: c.name, group: c.group, arrive: lv, ace: leaderLevels(c.T, [lv]).at(-1), aim: c.last ? 0.5 : 0.75 }
    for (const [k, skill] of Object.entries(SKILLS)) {
      let w = 0
      for (let b = 0; b < N; b++) w += battle(skill, c.T, c.team, partyFor(size, lv)) ? 1 : 0
      out[k] = w / N
    }
    rows.push(out)
  })
  return rows
}

const g = await openGame()
try {
  await g.page.click('#mPlay'); await g.page.waitForTimeout(800)
  const t0 = Date.now()
  const rows = await g.page.evaluate(simulate, { N, SKILLS, ONLY })
  const pct = (x) => `${Math.round(x * 100)}%`.padStart(5)
  const flag = (r) => { const d = r.average - r.aim; return Math.abs(d) <= 0.1 ? '' : d > 0 ? '  easier than the aim' : '  harder than the aim' }
  let group = ''
  console.log(`\n${N} battles a matchup, in ${Math.round((Date.now() - t0) / 1000)} s. Win rates for a player arriving at the leader's level (their best at the ace's floor − 3).\n`)
  console.log(`${'Challenge'.padEnd(12)} ${'Lv'.padStart(3)} ${'Ace'.padStart(4)}  casual average skilled   aim`)
  for (const r of rows) {
    if (r.group !== group) { group = r.group; console.log(`\n${group}`) }
    console.log(`${r.name.padEnd(12)} ${String(r.arrive).padStart(3)} ${String(r.ace).padStart(4)}  ${pct(r.casual)}  ${pct(r.average)}   ${pct(r.skilled)}  ${pct(r.aim)}${flag(r)}`)
  }
  if (g.errors.length) console.log('\nPage errors:', g.errors)
} finally { await g.close() }
