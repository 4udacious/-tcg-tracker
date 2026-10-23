// The battle game, checked in a real browser. Run with `npm run test:rpg`
// (about 6 minutes; RPG_QUICK=1 skips the demos and the played battle).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'

const quick = !!process.env.RPG_QUICK

test('loads cleanly, and every species has its sprites and cry', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(1000)
    const broken = await g.page.evaluate(async () => {
      const ids = new Set([...DATA.starters, ...DATA.wild, ...DATA.trainer, ...DATA.forms].map((s) => s.id))
      const img = (src) => new Promise((ok) => { if (!src) return ok(false); const i = new Image(); i.onload = () => ok(i.naturalWidth > 0); i.onerror = () => ok(false); i.src = src })
      const bad = []
      for (const id of ids) {
        for (const k of [id, id + 'b']) if (!(await img(ART[k]))) bad.push(`sprite ${k}`)
        if (!ART['cry:' + id] || !(await fetch(ART['cry:' + id], { method: 'HEAD' })).ok) bad.push(`cry ${id}`)
      }
      return bad
    })
    assert.deepEqual(broken, [])
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('battle rules', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const mon = (n, lv, extra = {}) => { const s = speciesByName(n); const m = { ...structuredClone(s), level: lv, ivs: { hp: 15, attack: 15, defense: 15, 'special-attack': 15, 'special-defense': 15, speed: 15 }, nature: ['Hardy'], ...extra }; m.stats = statsAt(m, lv); m.hp = m.stats.hp; return m }
      const defend = (btn, dt, low = btn === 'up') => { const x = defendResult(btn && { btn }, dt, low, 1); return `${x.r}${x.perfect ? '*' : ''}` }
      const tox = { hp: 160, stats: { hp: 160 }, status: 'tox', toxN: 0 }
      const sleeper = { status: 'slp', sleep: 2 }
      const lands = (label, mult) => Array.from({ length: 4000 }, () => statusLands(SUPPORT.SING, { label, mult }, Math.random)).filter(Boolean).length / 4000
      const sched = levelMoves(mon('TREECKO', 5)).map(([lv]) => lv)
      // Rarity: how often a rare species is in a weekly pool of 6, over many draws.
      let withRare = 0
      for (let i = 0; i < 3000; i++) {
        const left = [...DATA.wild], pool = []
        while (pool.length < 6) pool.push(left.splice(left.indexOf(weightedPick(left, rarityWeight, Math.random)), 1)[0])
        if (pool.some((w) => rarityOf(w) === 'rare')) withRare++
      }
      return {
        defend: [defend('a', 20), defend('a', 60), defend('a', 100), defend('b', 150), defend('b', 200), defend('up', 30), defend('up', 180), defend(null, 0)],
        tox: [statusTick(tox), statusTick(tox), statusTick(tox)],
        sleep: [statusAtAction(sleeper, Math.random), statusAtAction(sleeper, Math.random), statusAtAction(sleeper, Math.random)],
        sing: { perfect: lands('PERFECT', 1.6), good: lands('GOOD', 1), miss: lands('MISS', 0.7) },
        sorted: sched.every((lv, i) => i === 0 || sched[i - 1] <= lv),
        abra15: evoDue(mon('ABRA', 15)), abra16: evoDue(mon('ABRA', 16))?.to,
        kadabra: evoByItem(mon('KADABRA', 20), 'linkcable', {}).rule?.to,
        golbat: [evoDue(mon('GOLBAT', 30)), evoDue(mon('GOLBAT', 30, { bond: 100 }))?.to],
        rarity: { eevee: rarityOf(speciesByName('EEVEE')), dratini: rarityOf(speciesByName('DRATINI')), caterpie: rarityOf(speciesByName('CATERPIE')) },
        rareShare: withRare / 3000,
        cost: { tackle: moveCost('TACKLE'), doubleKick: moveCost('DOUBLE KICK'), hyperBeam: moveCost('HYPER BEAM') },
      }
    })
    assert.deepEqual(r.defend, ['parry*', 'parry', 'miss', 'dodge', 'miss', 'jump*', 'jump', 'miss'])
    assert.deepEqual(r.tox, [10, 20, 30])
    assert.deepEqual(r.sleep, ['asleep', 'asleep', 'wake'])
    assert.equal(r.sing.perfect, 1); assert.equal(r.sing.miss, 0); assert.ok(r.sing.good > 0.5 && r.sing.good < 0.7, `Sing on GOOD: ${r.sing.good}`)
    assert.ok(r.sorted, 'level schedule in level order')
    assert.equal(r.abra15, null); assert.equal(r.abra16, 'KADABRA'); assert.equal(r.kadabra, 'ALAKAZAM')
    assert.deepEqual(r.golbat, [null, 'CROBAT'])
    assert.deepEqual(r.rarity, { eevee: 'uncommon', dratini: 'rare', caterpie: 'common' })
    assert.ok(r.rareShare > 0.08 && r.rareShare < 0.25, `share of pools with a rare: ${r.rareShare}`)
    assert.deepEqual(r.cost, { tackle: 0, doubleKick: 2, hyperBeam: 3 })
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

for (const [mode, label] of [['demo', 'Watch'], ['duo', 'Watch 2v2'], ['gym', 'Watch gym']]) {
  test(`the ${label} demo plays through`, { skip: quick }, async () => {
    const g = await openGame({ mode })
    try {
      const seen = new Set()
      for (let i = 0; i < 90 && ![...seen].some((t) => /fainted/.test(t)); i++) {
        await g.page.waitForTimeout(1000)
        seen.add(await g.page.evaluate(() => document.getElementById('msg')?.textContent ?? ''))
      }
      assert.ok([...seen].some((t) => /fainted/.test(t)), 'a Pokémon fainted within 90 s')
      assert.deepEqual(g.errors, [])
    } finally { await g.close() }
  })
}

test('play: the tutorial, then wild battles with new moves, then a save', { skip: quick }, async () => {
  const g = await openGame()
  try {
    await g.bot.finishTutorial()
    assert.ok(g.log.some((l) => /VVM is free/.test(l)), 'finished the tutorial')
    // A sturdier lead that knows status and input moves, with free PP so the bot can use them.
    await g.page.evaluate(() => {
      for (const t of [MOVEDEX, SUPPORT]) for (const k in t) t[k].cost = 0
      const m = window.__vvm.party[0]; m.level = 30; m.stats = statsAt(m, 30); m.hp = m.stats.hp
      m.moves = ['SCRATCH', 'TOXIC', 'DOUBLE KICK', 'CROSS CHOP']; m.learned = [...new Set([...m.learned, ...m.moves])]
    })
    g.bot.want = ['TOXIC', 'CROSS CHOP', 'DOUBLE KICK', 'SCRATCH']
    assert.ok(await g.bot.encounter('wild'), 'a wild battle started')
    assert.ok(g.log.some((l) => /used/.test(l)), 'moves were used')

    // A save made mid-Transform keeps the Pokémon as it really is.
    const saved = await g.page.evaluate(() => {
      const m = window.__vvm.party[0], realId = m.id
      m.form = { id: m.id, types: m.types, stats: m.stats, moves: m.moves }; m.id = 132; m.types = ['normal']
      window.__saveNow()
      const key = Object.keys(localStorage).find((k) => k.startsWith('vvm-save'))
      const s = JSON.parse(localStorage.getItem(key)).party[0]
      Object.assign(m, { id: m.form.id, types: m.form.types }); delete m.form
      return { realId, savedId: s.id, hasForm: 'form' in s }
    })
    assert.equal(saved.savedId, saved.realId); assert.equal(saved.hasForm, false)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
