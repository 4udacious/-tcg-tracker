// The battle game, checked in a real browser. Run with `npm run test:rpg`
// (RPG_QUICK=1 skips the demos and the played battles).
//
// This file is the quick checks. The long played-through tests are split
// across play-a, play-b and play-c, which run side by side with this one
// (--test-concurrency=4: one Chromium each), and the music tests run on their
// own afterwards (music.test.mjs), since they measure timing under load.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'
import { simulate, SKILLS, AIMS } from './sim.mjs'

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
        // Every status move, by timing: never certain, better timing always at least as likely, MISS never.
        statusOdds: Object.entries(SUPPORT).filter(([, m]) => ['status', 'confuse', 'swagger', 'seed', 'yawn'].includes(m.effect)).map(([n, m]) => [n, ...['PERFECT', 'GREAT', 'GOOD', 'OK', 'MISS'].map((l) => statusOdds(m, l))]),
        sorted: sched.every((lv, i) => i === 0 || sched[i - 1] <= lv),
        abra15: evoDue(mon('ABRA', 15)), abra16: evoDue(mon('ABRA', 16))?.to,
        kadabra: evoByItem(mon('KADABRA', 20), 'linkcable', {}).rule?.to,
        golbat: [evoDue(mon('GOLBAT', 30)), evoDue(mon('GOLBAT', 30, { bond: 100 }))?.to],
        rarity: { eevee: rarityOf(speciesByName('EEVEE')), dratini: rarityOf(speciesByName('DRATINI')), caterpie: rarityOf(speciesByName('CATERPIE')) },
        rareShare: withRare / 3000,
        cost: { tackle: moveCost('TACKLE'), doubleKick: moveCost('DOUBLE KICK'), hyperBeam: moveCost('HYPER BEAM') },
        // Gen 1 and 2: every non-legendary, non-mythical Pokémon from #1 to #251.
        gen12Missing: (() => { const have = new Set([...DATA.starters, ...DATA.wild, ...DATA.trainer, ...DATA.forms].map((x) => x.id)), legends = new Set([144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251])
          return Array.from({ length: 251 }, (_, i) => i + 1).filter((i) => !legends.has(i) && !have.has(i)) })(),
        both: [evoDue(mon('SLOWPOKE', 37))?.to, evoByItem(mon('SLOWPOKE', 37), 'linkcable', {}).rule?.to, evoByItem(mon('POLIWHIRL', 30), 'waterstone', {}).rule?.to, evoByItem(mon('POLIWHIRL', 30), 'linkcable', {}).rule?.to],
        eevee30: evoDue(mon('EEVEE', 30)),
        more: [evoDue(mon('NATU', 25))?.to, evoByItem(mon('ONIX', 20), 'linkcable', {}).rule?.to, evoByItem(mon('GROWLITHE', 20), 'firestone', {}).rule?.to, evoByItem(mon('NIDORINO', 20), 'moonstone', {}).rule?.to, evoDue(mon('MAREEP', 15))?.to],
        stones: [evoByItem(mon('CLEFAIRY', 20), 'moonstone', {}).rule?.to, evoByItem(mon('GLOOM', 25), 'sunstone', {}).rule?.to, evoByItem(mon('GLOOM', 25), 'leafstone', {}).rule?.to,
          evoByItem(mon('MURKROW', 20), 'duskstone', {}).rule?.to, evoByItem(mon('SCYTHER', 20), 'linkcable', {}).rule?.to,
          evoByItem(mon('TOGETIC', 30), 'shinystone', {}).rule?.to, evoByItem(mon('ROSELIA', 30), 'shinystone', {}).rule?.to, evoDue(mon('FLABÉBÉ', 19))?.to],
        babies: [evoDue(mon('CLEFFA', 10, { bond: 100 }))?.to, evoDue(mon('CLEFFA', 10))],
        tyrogue: ['HITMONLEE', 'HITMONCHAN', 'HITMONTOP'].includes(evoDue(mon('TYROGUE', 20))?.to),
        tangela: [evoDue(mon('TANGELA', 20)), evoDue(Object.assign(mon('TANGELA', 33), {}))?.to],
        // The AI skips moves that would do nothing.
        works: (() => {
          const stg = new Map(), S = (m) => { if (!stg.has(m)) stg.set(m, { atk: 0, acc: 0, eva: 0 }); return stg.get(m) }
          const owl = mon('HOOTHOOT', 20), asleep = mon('PIDGEY', 20, { status: 'slp' }), grass = mon('ODDISH', 20), steel = mon('MAGNEMITE', 20), awake = mon('PIDGEY', 20)
          const boosted = mon('SCYTHER', 20); S(boosted).atk = 4
          const works = (n, u, t, f) => moveWorks(n, u, t, S, f)
          return {
            singAsleep: works('SING', owl, asleep), singAwake: works('SING', owl, awake), seedGrass: works('LEECH SEED', owl, grass), toxicSteel: works('TOXIC', owl, steel),
            swordsAt4: works('SWORDS DANCE', boosted, awake), rainInRain: works('RAIN DANCE', owl, awake, { weather: 'rain' }),
            owlPick: foeStatusMove(owl, Math.random, false, (n) => works(n, owl, asleep)),
          }
        })(),
      }
    })
    assert.deepEqual(r.defend, ['parry*', 'parry', 'miss', 'dodge', 'miss', 'jump*', 'jump', 'miss'])
    assert.deepEqual(r.tox, [10, 20, 30])
    assert.deepEqual(r.sleep, ['asleep', 'asleep', 'wake'])
    assert.ok(r.sing.perfect > 0.75 && r.sing.perfect < 0.87, `Sing on PERFECT: ${r.sing.perfect}`); assert.equal(r.sing.miss, 0); assert.ok(r.sing.good > 0.5 && r.sing.good < 0.7, `Sing on GOOD: ${r.sing.good}`)
    for (const [n, perfect, great, good, ok, miss] of r.statusOdds) {
      assert.ok(perfect < 1 && perfect > 0.8, `${n} on PERFECT: ${perfect}`)
      assert.ok(perfect >= great && great >= good && good >= ok && ok > miss && miss === 0, `${n}: ${[perfect, great, good, ok, miss].join(' ')}`)
    }
    assert.ok(r.sorted, 'level schedule in level order')
    assert.equal(r.abra15, null); assert.equal(r.abra16, 'KADABRA'); assert.equal(r.kadabra, 'ALAKAZAM')
    assert.deepEqual(r.golbat, [null, 'CROBAT'])
    assert.deepEqual(r.rarity, { eevee: 'uncommon', dratini: 'rare', caterpie: 'common' })
    assert.ok(r.rareShare > 0.08 && r.rareShare < 0.25, `share of pools with a rare: ${r.rareShare}`)
    assert.deepEqual(r.cost, { tackle: 0, doubleKick: 2, hyperBeam: 3 })
    assert.deepEqual(r.gen12Missing, [], 'every non-legendary Gen 1-2 Pokémon is in')
    assert.deepEqual(r.both, ['SLOWBRO', 'SLOWKING', 'POLIWRATH', 'POLITOED'])
    assert.equal(r.eevee30, null, "Eevee's placeholder level evolutions stay off")
    assert.deepEqual(r.more, ['XATU', 'STEELIX', 'ARCANINE', 'NIDOKING', 'FLAAFFY'])
    assert.deepEqual(r.stones, ['CLEFABLE', 'BELLOSSOM', 'VILEPLUME', 'HONCHKROW', 'SCIZOR', 'TOGEKISS', 'ROSERADE', 'FLOETTE'])
    assert.deepEqual(r.babies, ['CLEFAIRY', null]); assert.ok(r.tyrogue, 'Tyrogue evolves at 20')
    assert.equal(r.tangela[0], null); assert.equal(r.tangela[1], 'TANGROWTH')
    assert.deepEqual({ ...r.works, owlPick: undefined }, { singAsleep: false, singAwake: true, seedGrass: false, toxicSteel: false, swordsAt4: false, rainInRain: false, owlPick: undefined })
    assert.notEqual(r.works.owlPick, 'HYPNOSIS', 'Hoothoot doesn\'t try to put a sleeping Pokémon to sleep')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('rewards: evolution hold-to-stop, gym discs, packs, a disc on the shelf', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(1200)
    // A Lv 16 Charmander evolves; a tap of B doesn't stop it, a 3 s hold does.
    const evolve = async (holdMs) => {
      await page.evaluate(() => { const m = individual(speciesByName('CHARMANDER'), 16, Math.random); m.hp = m.stats.hp; window.__vvm.party.splice(0, 9, m); window.__vvm.evolveNow(m) })
      await page.waitForTimeout(1600)
      await page.keyboard.down('z'); await page.waitForTimeout(holdMs); await page.keyboard.up('z')
      for (let i = 0; i < 80 && await page.evaluate(() => !!document.querySelector('.evostage')); i++) { await page.keyboard.press('x'); await page.waitForTimeout(200) }
      return page.evaluate(() => window.__vvm.party[0].name)
    }
    assert.equal(await evolve(300), 'CHARMELEON', 'a short tap of B lets it evolve')
    assert.equal(await evolve(3300), 'CHARMANDER', 'holding B for 3 s stops it')
    const r = await page.evaluate(async () => {
      const v = window.__vvm
      const gymTypes = GYMS.filter((L) => !DISC_POOL.some((n) => moveInfo(n).type === L.type)).map((L) => L.short)
      const gd = v.gymDisc(GYMS[0])
      const pack = await v.givePack('test')
      SHOP.disc.on = true; SHOP.disc.rate = 100
      return { gymTypes, gymDiscType: moveInfo(gd).type, pack, bagPacks: Object.keys(v.bag).filter((k) => k.startsWith('pack:')).length, shelf: v.rollShelf().filter((x) => x.startsWith('disc')) }
    })
    assert.deepEqual(r.gymTypes, [], 'every Gym Leader has a disc of their type')
    assert.equal(r.gymDiscType, 'flying')
    assert.match(r.pack, /PACK$/); assert.equal(r.bagPacks, 0, 'packs go to the collection, not the Bag')
    assert.equal(r.shelf.length, 1); assert.match(r.shelf[0], /^disc:/)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('battle switches: wild and trainers each keep their kind away, and are kept', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(1000)
    const tapAs = async (kind) => {
      await page.selectOption('#nextTap', kind); await page.evaluate(() => document.getElementById('home').click())
      await page.waitForTimeout(2200)
      const st = await page.evaluate(() => ({ home: document.getElementById('home').className, battle: getComputedStyle(document.getElementById('battleL')).display }))
      await page.evaluate(() => document.getElementById('home').click()); await page.waitForTimeout(900)   // back to idle
      return st
    }
    // Wild off: even a tap pinned to a wild Pokémon, before any tutorial, opens the purchase screen.
    await page.click('#bWild'); assert.match(await page.textContent('#bWild'), /OFF/); assert.match(await page.textContent('#bTrainers'), /ON/)
    await page.click('#bTrainers')
    let st = await tapAs('wild'); assert.match(st.home, /\bin\b/); assert.equal(st.battle, 'none')
    st = await tapAs('scalper'); assert.match(st.home, /\bin\b/); assert.equal(st.battle, 'none')
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('vvm-wild'), localStorage.getItem('vvm-trainers')]), ['off', 'off'])
    // Trainer battles pick one of the two trainer themes at random.
    assert.deepEqual(await page.evaluate(() => [...new Set(Array.from({ length: 60 }, () => window.__vvm.trainerTheme()))].sort()), ['battle', 'battleB'])
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the Box: party to Box, Box to party, and a swap with a full party', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const names = () => page.evaluate(() => ({ party: window.__vvm.party.map((m) => m.name), box: window.__vvm.box.map((m) => m.name) }))
    await page.evaluate(() => {
      const mk = (n) => { const m = individual(speciesByName(n), 10, Math.random); m.hp = m.stats.hp; return m }
      window.__vvm.party.push(...['PIKACHU', 'EEVEE'].map(mk)); window.__vvm.box.push(mk('ABRA'))
      document.querySelectorAll('.tool').forEach((t) => { t.disabled = false })   // the toolbar is off until the tutorial's done
      document.getElementById('tBox').click()
    })
    const tap = async (sel) => { await page.dispatchEvent(`#sheetBody ${sel}`, 'click'); await page.waitForTimeout(150) }
    await page.waitForSelector('#sheetBody [data-deposit]')
    await tap('[data-deposit="1"]')                                   // EEVEE to the Box
    assert.deepEqual(await names(), { party: ['PIKACHU'], box: ['ABRA', 'EEVEE'] })
    assert.ok(await page.$eval('#sheetBody [data-deposit="0"]', (b) => b.disabled), 'the last party Pokémon stays')
    await tap('[data-withdraw="0"]')                                  // ABRA to the party
    assert.deepEqual(await names(), { party: ['PIKACHU', 'ABRA'], box: ['EEVEE'] })
    // A full party: SWAP IN, then the party member it replaces, in that slot.
    await page.evaluate(() => { for (const n of ['ODDISH', 'ZUBAT', 'GEODUDE', 'MAGIKARP']) { const m = individual(speciesByName(n), 10, Math.random); m.hp = m.stats.hp; window.__vvm.party.push(m) } })
    await page.evaluate(() => { document.getElementById('sheetClose').click() }); await page.waitForTimeout(300)
    await page.evaluate(() => document.getElementById('tBox').click()); await page.waitForSelector('#sheetBody [data-withdraw]')
    await tap('[data-withdraw="0"]'); await tap('[data-swapat="2"]')  // EEVEE in for ODDISH
    assert.deepEqual(await names(), { party: ['PIKACHU', 'ABRA', 'EEVEE', 'ZUBAT', 'GEODUDE', 'MAGIKARP'], box: ['ODDISH'] })
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the Bag: medicine, balls, Move Discs and other in their own pockets', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    await page.evaluate(() => {
      const m = individual(speciesByName('PIKACHU'), 10, Math.random); m.hp = m.stats.hp; window.__vvm.party.push(m)
      discItem('TAILWIND'); Object.assign(window.__vvm.bag, { potion: 2, antidote: 1, ball: 3, great: 1, 'disc:TAILWIND': 1, thunderstone: 1 })
      document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tBag').click()
    })
    await page.waitForSelector('#sheetBody [data-tab]')
    const pocket = async (t) => {
      await page.dispatchEvent(`#sheetBody [data-tab="${t}"]`, 'click'); await page.waitForTimeout(150)
      return page.$$eval('#sheetBody .irow b', (bs) => bs.map((b) => b.textContent))
    }
    assert.deepEqual((await pocket('medicine')).sort(), ['ANTIDOTE', 'POTION'])
    assert.deepEqual((await pocket('balls')).sort(), ['GREAT BALL', 'POKé BALL'])
    assert.deepEqual(await pocket('discs'), ['TAILWIND'])
    assert.deepEqual(await pocket('other'), ['THUNDER STONE'])
    assert.match(await page.textContent('#sheetBody [data-tab="balls"]'), /4/, 'a pocket shows how many it holds')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('attack effects: every move has its own look, and every one plays without errors', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(async () => {
      document.getElementById('home').style.display = 'none'; document.getElementById('battleL').style.display = 'block'
      const A = { x: 100, y: 194 }, T = { x: 220, y: 114 }, el = document.getElementById('player'), recipes = {}
      const names = Object.keys(MOVEDEX)
      for (const name of names) recipes[name] = window.__fx.recipe(moveInfo(name))
      // In batches, so the run is quick but the layer doesn't hold hundreds of particles at once.
      for (let i = 0; i < names.length; i += 12) await Promise.all(names.slice(i, i + 12).map(async (name) => {
        const mv = moveInfo(name); await window.__fx.strike(mv, A, T, el, true); window.__fx.impact(T, mv.type, true)
      }))
      const counts = {}; for (const R of Object.values(recipes)) counts[R] = (counts[R] ?? 0) + 1
      return { recipes, counts, total: names.length }
    })
    for (const [name, R] of Object.entries(r.recipes)) assert.ok(typeof R === 'string' && R, `${name} has an effect`)
    assert.ok(Object.keys(r.counts).length >= 25, `moves use many different effects (${Object.keys(r.counts).length})`)
    assert.ok(Math.max(...Object.values(r.counts)) < r.total * 0.25, `no one effect covers a quarter of the moves: ${JSON.stringify(r.counts)}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: the save is the account\'s, and a newer one from another device wins', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      const mk = (n) => { const m = individual(speciesByName(n), 12, Math.random); m.hp = m.stats.hp; learnAtLevel(m); return m }
      const save = (name, at, rev) => ({ v: 1, at, rev, party: [mk(name)], box: [], bag: {}, wallet: 0, badges: [], champion: false, eliteStep: 0, freeHeal: 1, gifted: true, roam: {}, weekShift: 0, reports: {} })
      const calls = window.__calls = []
      let acct = { data: save('EEVEE', 2000, 5), rev: 5 }
      window.__elsewhere = () => { acct = { data: save('PIKACHU', 3000, acct.rev), rev: acct.rev + 1 } }   // played and saved on another device
      window.__vvmApi = {
        async machine() { return { status: 'maintenance', cycle_no: 1, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance: 1, wild: true, trainers: true, packs: [], tickets: [], supplies: [] } },
        async takeItems() { return [] }, async heartbeat() {}, async release() {},
        async loadSave() { calls.push(['loadSave']); return acct },
        async putSave(data, rev) {
          calls.push(['putSave', rev])
          if (rev !== acct.rev) return { ok: false, reason: 'conflict', rev: acct.rev, data: acct.data }
          acct = { data, rev: rev + 1 }; return { ok: true, reason: 'ok', rev: acct.rev, data: null }
        },
        async deleteSave() {},
      }
      // This browser holds an older copy, from revision 4.
      localStorage.setItem('vvm-save:u1', JSON.stringify(save('CHARMANDER', 1000, 4)))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)   // stop this page's own game first
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm?.party[0]?.name === 'EEVEE', null, { timeout: 15000 })
    // Saving sends it up, made from revision 5.
    await frame.evaluate(() => window.__saveNow())
    await page.waitForFunction(() => window.__calls.some((c) => c[0] === 'putSave' && c[1] === 5))
    // Meanwhile it's played elsewhere: the next save is refused and the newer one (PIKACHU) loads.
    await page.evaluate(() => window.__elsewhere())
    await frame.evaluate(() => window.__saveNow())
    await frame.waitForFunction(() => window.__vvm?.party[0]?.name === 'PIKACHU', null, { timeout: 15000 })
    const local = await frame.evaluate(() => JSON.parse(localStorage.getItem('vvm-save:u1')))
    assert.equal(local.party[0].name, 'PIKACHU'); assert.equal(local.rev, 7)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: sold out shows the real clock, with nothing covering the stamp or the notice', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.setViewportSize({ width: 390, height: 844 })
    await page.evaluate(() => {
      window.__vvmApi = {
        async machine() { return { status: 'out_of_stock', cycle_no: 3, seconds_left: 192, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance: 11.56, wild: false, trainers: false, packs: [], tickets: [], supplies: [] } },
        async loadSave() { return null }, async putSave() { return { ok: true, rev: 1 } }, async takeItems() { return [] }, async claim() { return { ok: false, reason: 'not_stocked' } }, async release() {},
      }
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:390px;height:844px;border:0'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)   // stop this page's own game first
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm?.realShelf, null, { timeout: 15000 })
    await frame.evaluate(() => document.getElementById('home').click())
    await frame.waitForFunction(() => /\bout\b/.test(document.getElementById('home').className), null, { timeout: 10000 }); await page.waitForTimeout(1500)
    const st = await frame.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect()
      return { cls: document.getElementById('home').className, line: document.getElementById('homeLine').textContent, sub: document.getElementById('homeSub').textContent,
        walletTop: r('#wallet').top, noticeBottom: r('.attract .notice').bottom, stampBottom: r('.attract .stamp').bottom, rowsBottom: r('#attractRows').bottom }
    })
    assert.doesNotMatch(st.cls, /has-sup/, 'no empty supplies shelf when sold out')
    assert.equal(st.line, 'SOLD OUT'); assert.match(st.sub, /changes in 3:\d\d/)
    assert.ok(st.walletTop >= st.noticeBottom - 1, 'the tokens chip sits below the notice')
    assert.ok(st.stampBottom <= st.rowsBottom + 30, 'the stamp sits on the packs')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: the real machine, checkout, packs, sealed boxes and tokens go through the bridge', async () => {
  const g = await openGame()
  try {
    const { page } = g
    // A stand-in for the VVM tab's bridge (lib/vending/gameBridge.ts) on the parent, and the game in a same-origin frame.
    await page.evaluate(() => {
      const calls = window.__calls = []
      let balance = 10, owned = { potion: 2, move_disc: 1 }
      window.__vvmApi = {
        async machine() { calls.push(['machine']); return { status: 'in_stock', cycle_no: 7, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: false, trainers: false, heal_price: 0.75,
          packs: [{ set_code: 'base2', set_name: 'Jungle', image: '/rpg/a/jungle-scyther.webp', quantity: 3, description: null }], tickets: [],
          supplies: [{ key: 'great_ball', kind: 'item', name: 'Great Ball', description: 'Catch rate ×1.5', price: 0.4, contents: null },
            { key: 'elite_ticket', kind: 'item', name: 'Elite Four Ticket', description: 'All five League battles', price: 5, contents: null }],
          boxes: [{ box_id: 5, name: 'Jungle Booster Box', set_name: 'Jungle', packs: 36, price: 3, image: '/rpg/a/jungle-scyther.webp', quantity: 2, max: 1 }] } },
        async balance() { return balance },
        async claim() { calls.push(['claim']); return { ok: true, reason: 'ok', holder_name: null, expires_at: null } },
        async heartbeat() { calls.push(['heartbeat']) },
        async release() { calls.push(['release']) },
        async checkout(packs, tickets, supplies, boxes) {
          calls.push(['checkout', packs, tickets, supplies, boxes])
          balance -= packs.reduce((a, p) => a + p.qty, 0) + supplies.reduce((a, s) => a + s.qty * 0.4, 0) + boxes.reduce((a, b) => a + b.qty * 3, 0)
          for (const s of supplies) owned[s.key] = (owned[s.key] ?? 0) + s.qty
          return { ok: true, reason: 'ok', packs_bought: 1, tickets_bought: 0, supplies_bought: 1, balance, restocked: false }
        },
        async buyHeal() { calls.push(['buyHeal']); if (balance < 0.75) return { ok: false, reason: 'insufficient_tokens', price: 0.75, balance }; balance -= 0.75; return { ok: true, reason: 'ok', price: 0.75, balance } },
        async takeItems(keys) { calls.push(['take', keys]); const out = keys.filter((k) => owned[k]).map((k) => ({ key: k, qty: owned[k] })); for (const k of keys) delete owned[k]; return out },
        async awardPack(source) { calls.push(['awardPack', source]); return { ok: true, reason: 'ok', set_name: 'Fossil', pack_name: 'Lapras', image_url: '/packs/x.webp', left_today: 2 } },
        async awardTokens(amount, source) { calls.push(['awardTokens', amount, source]); balance += Math.min(amount, 1); return { ok: true, reason: 'ok', awarded: Math.min(amount, 1), balance } },
        async loadSave() { calls.push(['loadSave']); return null },
        async wildSeed() { calls.push(['wildSeed']); return { report: { code: 'TAC-07', venue: 'Safeway', city: 'Tacoma', at: '2026-10-30T18:00:00Z' }, machines: [{ code: 'KNT-02', venue: 'WinCo Foods', city: 'Kent' }] } },
        async putSave(data, rev) { calls.push(['putSave', rev]); return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } },
        async deleteSave() {},
      }
      // A save, so the game opens past the tutorial.
      const m = individual(speciesByName('CHARMANDER'), 12, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 1 }, wallet: 99, badges: [], champion: false, eliteStep: 0, freeHeal: 1, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)   // stop this page's own game first
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf && window.__vvm.bag.potion === 2, null, { timeout: 15000 })
    const start = await frame.evaluate(() => ({ wallet: document.getElementById('wallet').textContent, discs: Object.keys(window.__vvm.bag).filter((k) => k.startsWith('disc:')).length }))
    assert.equal(start.wallet, '10.00 tk', 'the wallet is the real balance'); assert.equal(start.discs, 1, 'a bought Move Disc became a disc in the Bag')
    // The wild pool is the machine of your latest real timer report (Timers tab), not one of the game's own.
    await frame.waitForFunction(() => /TAC-07/.test(document.getElementById('poolWhere').textContent), null, { timeout: 10000 })
    const pool = await frame.evaluate(() => ({ where: document.getElementById('poolWhere').textContent, shown: [...document.querySelectorAll('#poolMons .nm')].map((b) => b.textContent), want: window.__vvm.poolFor('TAC-07') }))
    assert.match(pool.where, /TAC-07 · Safeway, Tacoma.*from your latest timer report/)
    assert.deepEqual(pool.shown, pool.want, 'the six shown are that machine\'s pool this week')
    // Neither kind of battle is live (admin switches): no battle switches, and even a tap pinned to a wild Pokémon
    // claims the real machine and shows its shelf.
    assert.deepEqual(await frame.evaluate(() => [document.getElementById('bWild').hidden, document.getElementById('bTrainers').hidden]), [true, true])
    await frame.evaluate(() => { document.getElementById('nextTap').value = 'wild'; document.getElementById('home').click() })
    await frame.waitForSelector('[data-buy="set:base2"]', { timeout: 10000 }); await page.waitForTimeout(1200)   // the screen finishes fading in
    assert.equal(await frame.evaluate(() => document.querySelector('[data-buy="sup:elite_ticket"]')), null, 'no Elite Four ticket on the shelf before all 8 badges')
    await frame.evaluate(() => { for (const k of ['set:base2', 'sup:great_ball', 'box:5', 'box:5']) document.querySelector(`[data-buy="${k}"]`).click() })   // the box twice: only 1 is allowed
    await frame.evaluate(() => document.getElementById('cbGo').click())
    await frame.waitForSelector('[data-co="pay"]:not([disabled])'); await frame.evaluate(() => document.querySelector('[data-co="pay"]').click())
    await frame.waitForFunction(() => window.__vvm.bag.great === 1, null, { timeout: 10000 })
    const pack = await frame.evaluate(() => window.__vvm.givePack('trainer'))
    assert.equal(pack, 'a FOSSIL PACK')
    const calls = await page.evaluate(() => window.__calls)
    const co = calls.find((c) => c[0] === 'checkout')
    assert.deepEqual(co.slice(1), [[{ set_code: 'base2', qty: 1 }], [], [{ key: 'great_ball', qty: 1 }], [{ box_id: 5, qty: 1 }]], 'packs, supplies and a sealed box (up to its limit) in one checkout')
    assert.ok(calls.some((c) => c[0] === 'claim')); assert.ok(calls.some((c) => c[0] === 'awardPack' && c[1] === 'trainer'))
    assert.deepEqual(calls.find((c) => c[0] === 'putSave'), ['putSave', null], 'a browser save from before goes up to the account')
    assert.equal(await frame.evaluate(() => document.getElementById('wallet').textContent), '5.60 tk')
    assert.equal(await frame.evaluate(() => getComputedStyle(document.getElementById('battleL')).display), 'none', 'no battle happened')
    // With all 8 Johto badges, the next visit's shelf has the ticket (greyed out here: trainer battles aren't live).
    await frame.evaluate(() => window.__vvm.badges.push(0, 1, 2, 3, 4, 5, 6, 7))
    for (let i = 0; i < 4 && !(await frame.$('[data-buy="sup:elite_ticket"]')); i++) {   // back to idle first, then a tap opens the shelf again
      await frame.evaluate(() => document.getElementById('home').click()); await page.waitForTimeout(2000)
    }
    const tile = await frame.waitForSelector('[data-buy="sup:elite_ticket"]', { timeout: 10000 })
    assert.equal(await tile.evaluate((b) => b.disabled), true)
    await page.waitForTimeout(1200); await tile.evaluate((b) => b.querySelector('b').click())
    assert.equal(await frame.evaluate(() => document.getElementById('cbSum').textContent), 'CART empty', 'a greyed-out tile never goes in the cart')
    // A battle at a stocked machine doesn't hold it; coming back from one does, so the shelf can be bought from
    // straight away (it used to need tapping out and back in: the server refused the checkout, not_holder).
    await frame.evaluate(() => { window.__vvm.machine.lockedBy = null })
    const claims = (await page.evaluate(() => window.__calls)).filter((c) => c[0] === 'claim').length
    await frame.evaluate(() => window.__vvm.backToMachine('in'))
    assert.equal((await page.evaluate(() => window.__calls)).filter((c) => c[0] === 'claim').length, claims + 1, 'back from a battle: the machine is claimed')
    assert.equal(await frame.evaluate(() => window.__vvm.machine.lockedBy), 'YOU')
    await frame.evaluate(() => document.querySelector('[data-buy="sup:great_ball"]').click())
    assert.match(await frame.evaluate(() => document.getElementById('cbSum').textContent), /CART 1/)
    // The Pokémon Center after today's 3 free heals: the server's price, paid through the bridge.
    const healed = await frame.evaluate(async () => {
      const v = window.__vvm, day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
      v.setHeals({ day, used: v.FREE_HEALS }); for (const m of v.party) m.hp = 1
      document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tParty').click()
      const btn = document.querySelector('#sheetBody [data-heal]'), text = btn.querySelector('small').textContent, before = v.wallet
      btn.click()
      for (let i = 0; i < 50 && /Paying/.test(document.querySelector('#sheetBody .toast')?.textContent ?? 'Paying'); i++) await new Promise((r) => setTimeout(r, 100))
      const out = { text, before, after: v.wallet, full: v.party.every((m) => m.hp === m.stats.hp), toast: document.querySelector('#sheetBody .toast').textContent, wallet: document.getElementById('wallet').textContent }
      document.getElementById('sheetClose').click()
      return out
    })
    assert.match(healed.text, /for 0\.75 tk/, "the admin's price, from the machine")
    assert.ok(healed.full, 'the paid heal heals the party'); assert.match(healed.toast, /That was 0\.75 tk/)
    assert.equal(Math.round((healed.before - healed.after) * 100) / 100, 0.75, 'the server took the price'); assert.equal(healed.wallet, `${healed.after.toFixed(2)} tk`)
    assert.equal((await page.evaluate(() => window.__calls)).filter((c) => c[0] === 'buyHeal').length, 1)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: while someone else shops, your taps stay on the machine and battles still jump out; the admin sets how often spare items turn up', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      const calls = window.__calls = []
      window.__vvmApi = {
        async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: true, holder_id: 'u2', holder_name: 'SAM', holder_expires: null, me: 'u1', cooldown_until: null, balance: 10, wild: true, trainers: true, heal_price: 0.5, find_chance: 0.8,
          packs: [{ set_code: 'base2', set_name: 'Jungle', image: '/rpg/a/jungle-scyther.webp', quantity: 3, description: null }], tickets: [], supplies: [], boxes: [] } },
        async balance() { return 10 }, async claim() { calls.push('claim'); return { ok: false, reason: 'busy', holder_name: 'SAM' } },
        async heartbeat() {}, async release() {}, async checkout() { return { ok: false, reason: 'not_holder' } }, async takeItems() { return [] },
        async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false, reason: 'daily_cap', awarded: 0, balance: 10 } }, async awardMilestone() { return { ok: false } },
        async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
      }
      const m = individual(speciesByName('CHARMANDER'), 12, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 5 }, wallet: 10, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    assert.equal(await frame.evaluate(() => window.__vvm.findChance), 0.8, "the admin's find chance, from the machine")
    await page.waitForTimeout(1200)
    const tap = async (kind) => { await frame.evaluate((k) => { document.getElementById('nextTap').value = k; document.getElementById('home').click() }, kind); await page.waitForTimeout(1600) }
    const screen = () => frame.evaluate(() => ({ cls: document.getElementById('home').className, tts: document.getElementById('tts').textContent, pop: document.querySelector('#home .find')?.textContent ?? '', battle: getComputedStyle(document.getElementById('battleL')).display !== 'none' }))
    assert.match((await screen()).tts, /SAM IS USING IT.*keep tapping/)
    for (let n = 1; n <= 2; n++) {
      await tap('none')   // an empty tap
      const s = await screen()
      assert.match(s.cls, /\bidle\b/, `empty tap ${n}: still on the idle screen, not a "tap to go back" one (${s.cls})`)
      assert.match(s.pop, /Nothing jumped out\. SAM is still shopping/)
    }
    await tap('wild')   // the next tap rolls straight away: a wild one jumps out
    await frame.waitForFunction(() => getComputedStyle(document.getElementById('battleL')).display !== 'none', null, { timeout: 10000 })
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('rival: Alex\'s seven battles, their phases, teams, Full Restores and milestones', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const PORY = ['PORYGON', 'PORYGON2', 'PORYGON-Z']
      const battles = RIVAL_BATTLES.map((B, n) => {
        const T = rivalTrainer(n), sp = B.team.map(speciesByName)
        return { n, phase: T.phase, theme: RIVAL_LOOKS[T.phase].theme, restores: T.restores, size: B.team.length, last: B.team.at(-1),
          pory: B.team.filter((x) => PORY.includes(x)), mewtwo: B.team.includes('MEWTWO'), missing: B.team.filter((x, i) => !sp[i] || !ART[sp[i].id] || !ART[sp[i].id + 'b'] || !ART['cry:' + sp[i].id]),
          types: new Set(sp.flatMap((s) => s?.types ?? [])).size, art: ['vs', 'face', 'body', 'down', 'faceDown'].every((k) => ART[T[k]]), moves: T.movesFor(speciesByName(B.team.at(-1))) }
      })
      // Which battle is due at each point in the game.
      const due = (johto, kanto, champion, red = false) => RIVAL_BATTLES.map((B) => B.due({ johto, kanto, champion, red })).lastIndexOf(true)
      const mins = RIVAL_BATTLES.map((B) => B.min)
      // Levels: set, whatever yours are (a party whose best is Lv 30 meets the same team as anyone).
      window.__vvm.party.splice(0, 9, individual(speciesByName('PIKACHU'), 30, Math.random))
      const lv = window.__vvm.rivalTeam(rivalTrainer(0)).map((m) => m.level)
      // Battles 1-6 come straight after a leader: how far their ace sits above that leader's.
      const after = [GYMS[0], GYMS[2], GYMS[4], GYMS[6], GYMS[8], GYMS[14]], above = after.map((L, n) => RIVAL_BATTLES[n].min - L.min)
      const lv7 = leaderLevels(rivalTrainer(6))
      return { last7: RIVAL_BATTLES[6].last, intro7: RIVAL_BATTLES[6].intro, team6: RIVAL_BATTLES[5].team, team7: RIVAL_BATTLES[6].team, battles: battles.map((b) => ({ ...b, moves: !!b.moves })), dueAt: [due(0, 0, false), due(1, 0, false), due(3, 0, false), due(5, 0, false), due(7, 0, false), due(8, 0, true), due(8, 1, true), due(8, 6, true), due(8, 7, true), due(8, 8, true), due(8, 8, true, true)], mins, lv, above, lv7, songs: ['rival', 'rival2', 'rival3', 'rivalTalk'].every((n) => SONGS[n]) }
    })
    const b = r.battles
    assert.equal(b.length, 7)
    assert.deepEqual(b.map((x) => x.phase), [1, 1, 1, 2, 2, 3, 3], 'phase 1: battles 1-3, phase 2: 4-5, phase 3: 6-7')
    assert.deepEqual(b.map((x) => x.theme), ['rival', 'rival', 'rival', 'rival2', 'rival2', 'rival3', 'rival3'])
    assert.ok(r.songs, 'the three rival themes and the encounter music exist')
    assert.deepEqual(b.map((x) => x.restores), [1, 1, 1, 1, 1, 1, 1], 'one Full Restore at most, in every battle')
    assert.deepEqual(b.map((x) => x.pory.join()), ['PORYGON', 'PORYGON', 'PORYGON', 'PORYGON2', 'PORYGON2', 'PORYGON-Z', 'PORYGON-Z'], 'Porygon in every team, evolving with the phases')
    assert.deepEqual(b.map((x) => x.mewtwo), [false, false, false, false, false, false, true], 'Mewtwo joins for the last battle')
    assert.ok(b.every((x) => ['PORYGON', 'PORYGON2', 'PORYGON-Z', 'MEWTWO'].includes(x.last)), 'the ace is always Porygon or Mewtwo')
    assert.deepEqual(r.team6, ['STARMIE', 'MAGNEZONE', 'TYRANITAR', 'ARCANINE', 'ALAKAZAM', 'PORYGON-Z'], 'battle 6: Alakazam, Porygon-Z the ace')
    assert.match(r.last7.join(' '), /Meet Mewtwo/, 'Alex unveils Mewtwo just before sending it out')
    assert.doesNotMatch(r.intro7.join(' '), /Mewtwo/i, 'the last battle\'s opening only teases it')
    assert.deepEqual(r.team7, ['STARMIE', 'ARCANINE', 'ZAPDOS', 'TYRANITAR', 'PORYGON-Z', 'MEWTWO'], 'the last battle: Zapdos, and Alex closes with Mewtwo')
    assert.ok(b.every((x, i) => !i || x.size >= b[i - 1].size), 'the team only grows')
    assert.ok(b.every((x) => x.types >= x.size), `balanced: as many types as Pokémon (${b.map((x) => `${x.types}/${x.size}`).join(' ')})`)
    assert.deepEqual(b.flatMap((x) => x.missing), [], 'every Pokémon has its sprites and cry')
    assert.ok(b.every((x) => x.art), 'every look has its art (or Alex\'s standing in)')
    assert.ok(b.every((x) => x.moves), 'the aces fight with their own moves')
    assert.deepEqual(r.dueAt, [-1, 0, 1, 2, 3, 3, 4, 4, 5, 5, 6], 'due after 1, 3, 5 and 7 Johto badges, then after Brock (Kanto\'s first), Blaine (the seventh), and after Red')
    assert.ok(r.mins.every((m, i) => !i || m > r.mins[i - 1]), 'each battle is tougher than the last')
    assert.deepEqual(r.lv, [12, 14, 16], 'set levels, whatever yours are: the first battle 12-16')
    assert.ok(r.above.every((x) => x >= 3 && x <= 5), `battles 1-6: a few levels above the leader just beaten (${r.above})`)
    assert.ok(r.lv7.at(-1) === 80 && r.lv7.slice(0, -1).every((x) => x >= 76 && x <= 79), `the last battle: the high 70s, the ace Lv 80 (${r.lv7})`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('glitchers: Herb\'s and Paul\'s four battles each, their evolving teams and milestones', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const of = (who) => STORY[who].battles.map((B, n) => {
        const T = storyTrainer(who, n), sp = B.team.map(speciesByName)
        return { team: B.team, min: B.min, size: B.team.length, types: new Set(sp.flatMap((s) => s?.types ?? [])).size, hard: T.hard,
          missing: B.team.filter((x, i) => !sp[i] || !ART[sp[i].id] || !ART[sp[i].id + 'b'] || !ART['cry:' + sp[i].id]),
          art: ['vs', 'face', 'body', 'down', 'faceDown'].every((k) => ART[T[k]]), aceMoves: T.movesFor(speciesByName(B.team.at(-1)))?.map((m) => m.name) ?? null }
      })
      const v = window.__vvm
      // Who is due at each point in the game, with Alex out of the way.
      v.setRival(7)
      const due = (b, champion) => { v.badges.splice(0, 99, ...b); v.setLeague({ champion }); return v.storyDue() }
      const at = (n) => Array.from({ length: n }, (_, i) => i)
      const dueAt = [due([], false), due(at(2), false), due(at(4), false)]
      v.setStory('HERB', 1); dueAt.push(due(at(4), false))
      v.setStory('PAUL', 1); dueAt.push(due(at(8), true))
      v.setStory('HERB', 1, 3); dueAt.push(due(at(8), true))   // Herb lost to: back a few taps later, so Paul is first
      // The gap between story battles: after Alex, Herb and Paul wait; after Paul, Herb and Alex wait, but Paul's own rematch doesn't.
      v.setStory('HERB', 0); v.setStory('PAUL', 0); v.badges.splice(0, 99, 0, 1); v.setLeague({ champion: false })
      const gap = []
      Object.assign(v.storyGap, { taps: 5, who: 'ALEX' }); gap.push(v.storyDue())
      Object.assign(v.storyGap, { taps: 0 }); gap.push(v.storyDue())
      v.setRival(1); Object.assign(v.storyGap, { taps: 5, who: 'HERB' }); gap.push(v.rivalDue())   // Alex's 2nd is due at 3 badges
      v.badges.push(2); gap.push(v.rivalDue(), v.storyDue())
      Object.assign(v.storyGap, { who: 'ALEX' }); gap.push(v.rivalDue())
      Object.assign(v.storyGap, { taps: 0, who: null }); v.setRival(7)
      return { herb: of('HERB'), paul: of('PAUL'), dueAt, gap, songs: STORY_THEMES.every((n) => SONGS[n]) }
    })
    for (const [who, b] of [['Herb', r.herb], ['Paul', r.paul]]) {
      assert.equal(b.length, 4, `${who}: four battles`)
      assert.deepEqual(b.flatMap((x) => x.missing), [], `${who}: every Pokémon has its sprites and cry`)
      assert.ok(b.every((x) => x.art && x.hard), `${who}: their own art, and they fight like a leader`)
      assert.ok(b.every((x, i) => !i || (x.size >= b[i - 1].size && x.min > b[i - 1].min)), `${who}: the team only grows, and each battle is tougher`)
      assert.ok(b.every((x) => x.types >= x.size - 1), `${who}: balanced types (${b.map((x) => `${x.types}/${x.size}`).join(' ')})`)
      assert.equal(b[0].aceMoves, null, `${who}: the first ace has no special set yet`)
      assert.ok(b.slice(1).every((x) => x.aceMoves?.length === 3), `${who}: from the second battle, the ace fights with its stronger set`)
    }
    assert.deepEqual(r.herb.map((x) => x.team.at(-1)), ['GIMMIGHOUL', 'GHOLDENGO', 'GHOLDENGO', 'GHOLDENGO'], 'Herb\'s Gimmighoul evolves into Gholdengo')
    assert.ok(r.herb[0].team.includes('MEOWTH') && r.herb[1].team.includes('PERSIAN') && r.herb[1].team.includes('ROTOM'), 'Meowth grows up, and Rotom joins to do the glitching')
    assert.deepEqual(r.paul.map((x) => x.team.at(-1)), ['HIPPOPOTAS', 'HIPPOWDON', 'HIPPOWDON', 'HIPPOWDON'], 'Paul\'s Hippopotas evolves into Hippowdon')
    assert.ok(r.paul[1].team.includes('MUNCHLAX') && r.paul[2].team.includes('SNORLAX') && !r.paul[2].team.includes('MUNCHLAX'), 'Munchlax joins, then becomes Snorlax')
    assert.deepEqual(r.dueAt, [null, 'HERB', 'HERB', 'PAUL', 'HERB', 'PAUL'], 'Herb after 2 badges; Paul after 4 once Herb is beaten; then whichever is lower; a lost one waits')
    assert.deepEqual(r.gap, [null, 'HERB', false, false, 'HERB', true], 'story battles keep a gap: Herb waits out Alex\'s, Alex waits out Herb\'s, Herb\'s own rematch doesn\'t wait')
    assert.ok(r.songs, 'their battle themes exist')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the Kanto League: Lorelei, Bruno, Agatha, Lance, then Red, on one ticket; every leader at set levels, climbing', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const v = window.__vvm, blue = GYMS.find((L) => L.short === 'BLUE')
      const now = []
      now.push(v.leagueNow())   // a new game: no League yet
      for (let i = 0; i < 8; i++) v.badges.push(i); now.push(v.leagueNow())   // all of Johto's badges: the Johto League
      v.setLeague({ champion: true }); now.push(v.leagueNow())   // Champion, Kanto's gyms to go: none
      for (let i = 8; i < 16; i++) v.badges.push(i); now.push(v.leagueNow())   // all sixteen: the Kanto League
      const key = v.leagueKey()
      v.setLeague({ red: true }); now.push(v.leagueNow())   // Red beaten: none
      return { now, key, name: ITEMS[key]?.name, who: KANTO_ELITE.map((L) => L.short), mins: KANTO_ELITE.map((L) => L.min), redL: KANTO_ELITE.at(-1),
        missing: KANTO_ELITE.flatMap((L) => L.team).filter((n) => { const s = speciesByName(n); return !s || !ART[s.id] }),
        art: KANTO_ELITE.every((L) => ART[L.vs] && ART[L.face] && ART[L.body]), sig: KANTO_ELITE.every((L) => L.sig?.length >= 3),
        themes: [LEAGUES.kanto.battle(KANTO_ELITE[0]), LEAGUES.kanto.battle(KANTO_ELITE[4])], songs: !!(SONGS.kantoElite && SONGS.red),
        blueTitle: blue.title, red: leaderLevels(KANTO_ELITE.at(-1)), falkner: leaderLevels(GYMS[0]),
        // Every leader in the order you meet them: Johto's gyms, the Johto League, Kanto's gyms, the Kanto League and Red.
        aces: [...GYMS.slice(0, 8), ...ELITE, ...GYMS.slice(8), ...KANTO_ELITE].map((L) => [L.short, L.low, L.min]),
        // Set levels: the same team whatever your party's levels are.
        same: JSON.stringify(leaderLevels(blue)) === JSON.stringify(leaderLevels(blue, [100])),
        johto: ELITE.map((L) => [L.short, L.min]),
        // The Kanto League's other Pokémon fight with the stronger moves, as Kanto's gyms do.
        strong: KANTO_ELITE.every((L) => L.region === 'kanto') && strongMoves(speciesByName('GYARADOS')).some((m) => m.power >= 65) }
    })
    assert.deepEqual(r.now, [null, 'elite', null, 'kanto', null], 'the Johto League with 8 badges; the Kanto League as Champion with all 16; none once Red is beaten')
    assert.equal(r.key, 'summon:kanto'); assert.equal(r.name, 'KANTO LEAGUE TICKET')
    assert.deepEqual(r.who, ['LORELEI', 'BRUNO', 'AGATHA', 'LANCE', 'RED'])
    assert.ok(r.mins.every((m, i) => !i || m > r.mins[i - 1]), `each tougher than the last: ${r.mins}`)
    assert.ok(r.aces.every(([, lo, ace], i) => lo < ace && (!i || ace > r.aces[i - 1][2])), `every leader's ace above the last one's: ${JSON.stringify(r.aces)}`)
    assert.deepEqual(r.falkner, [9, 11, 13], 'Falkner: 9, then his ace at 13')
    assert.ok(r.red.every((x) => x >= 70 && x <= 75), `Red in the low to mid 70s (${r.red})`)
    assert.ok(r.same, 'a leader\'s levels don\'t follow yours')
    assert.equal(r.redL.restores, 3); assert.equal(r.redL.team.at(-1), 'PIKACHU')
    assert.deepEqual(r.missing, []); assert.ok(r.art, 'everyone has art (placeholders for the new faces)'); assert.ok(r.sig, 'every ace has its signature moves')
    assert.deepEqual(r.themes, ['kantoElite', 'red']); assert.ok(r.songs)
    assert.ok(r.strong, 'the Kanto League uses the stronger moves')
    assert.match(r.blueTitle, /EVERY TYPE/)
    const [lance, ...four] = [r.johto.at(-1), ...r.johto.slice(0, 4)]
    assert.ok(four.every(([, ace]) => lance[1] > ace), `Johto's Champion Lance is the toughest of the Johto League: ${JSON.stringify(r.johto)}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('every leader\'s team: real species with sprites and cries, the mid-game on the stronger moves below its ace', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const leaders = [...GYMS, ...ELITE, ...KANTO_ELITE]
      return {
        missing: leaders.flatMap((L) => L.team.filter((n) => { const s = DATA.trainer.find((t) => t.name === n) ?? speciesByName(n); return !s || !ART[s.id] || !ART[s.id + 'b'] || !ART['cry:' + s.id] }).map((n) => `${L.short}: ${n}`)),
        strong: [...GYMS.slice(3, 8), ...ELITE.slice(0, 4)].every((L) => L.strong) && !GYMS[0].strong && !GYMS[1].strong && !GYMS[2].strong,
        mamoswine: !!TRAINER_MOVES.MAMOSWINE && GYMS[6].team.at(-1) === 'MAMOSWINE',
        sizes: [...GYMS.slice(8, 15), ...ELITE.slice(0, 4), ...KANTO_ELITE.slice(0, 3)].map((L) => L.team.length),
      }
    })
    assert.deepEqual(r.missing, [], 'every leader\'s Pokémon has its sprites and cry')
    assert.ok(r.strong, 'Morty to Clair and the Johto Elite Four use the stronger moves; Falkner, Bugsy and Whitney don\'t')
    assert.ok(r.mamoswine, 'Pryce\'s ace is Mamoswine, with his signature moves')
    assert.ok(r.sizes.every((n) => n === 6), `the Kanto gyms and both Elite Fours bring six: ${r.sizes}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('balance: every leader, Elite Four member, Red, Alex, Herb and Paul within 15 points of their aim (sim.mjs, average player)', async () => {
  const g = await openGame()
  try {
    await g.page.click('#mPlay'); await g.page.waitForTimeout(800)
    const rows = await g.page.evaluate(simulate, { N: 1000, SKILLS: { average: SKILLS.average }, ONLY: '', AIMS })
    assert.ok(rows.length >= 41, `every fight simulated (${rows.length})`)
    const off = rows.filter((r) => Math.abs(r.average - r.aim) > 0.15).map((r) => `${r.group} ${r.name}: ${Math.round(r.average * 100)}% (aim ${Math.round(r.aim * 100)}%)`)
    assert.deepEqual(off, [], 'a fight drifted from its aim: re-tune it with `npm run sim:rpg`, or set its own aim in sim.mjs (AIMS)')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the toughest leaders switch out of a bad matchup, never to their ace, and only some leaders do', async () => {
  const g = await openGame()
  try {
    await g.page.click('#mPlay'); await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const mon = (n, lv = 60) => { const m = individual(speciesByName(n), lv, () => 0.5); m.hp = m.stats.hp; return m }
      const me = mon('TYPHLOSION'), mine = [MOVEDEX.EMBER, MOVEDEX.TACKLE]
      const moves = (f) => WILD_MOVES[f.types[0]] ?? WILD_MOVES.normal
      const grass = mon('VENUSAUR'), water = mon('BLASTOISE'), grass2 = mon('VILEPLUME'), weakWater = mon('BLASTOISE'); weakWater.hp = 1
      return {
        toWater: switchPick(grass, [grass2, water], me, mine, moves)?.name,   // fire on grass: out, to the one that resists it and hits back, not another grass
        hurtSkipped: switchPick(grass, [weakWater], me, mine, moves)?.name ?? null,   // not to one about to faint
        stays: switchPick(water, [grass], me, mine, moves)?.name ?? null,   // fire on water isn't super effective: it stays in
        who: [...GYMS, ...ELITE, ...KANTO_ELITE, ...RIVAL_BATTLES.map((B, n) => rivalTrainer(n))].filter((T) => T.switches).map((T) => T.short + (T.rival ? ` ${RIVAL_BATTLES.findIndex((B) => B.team === T.team) + 1}` : '')),
      }
    })
    assert.equal(r.toWater, 'BLASTOISE')
    assert.equal(r.hurtSkipped, null)
    assert.equal(r.stays, null)
    assert.deepEqual(r.who, ['LANCE', 'RED', 'ALEX 7'])
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('trainers and wild Pokémon keep pace with you only up to a few levels below your next challenge, so out-levelling a gym doesn\'t pay', async () => {
  const g = await openGame()
  try {
    const { page } = g
    const KANTO_CAPS = await page.evaluate(() => KANTO_ELITE.map((L) => L.min - L.gap))
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const v = window.__vvm, top = (T, lv) => { let hi = 0; for (let i = 0; i < 40; i++) hi = Math.max(hi, ...v.deckFor(T, lv).map((m) => m.level)); return hi }
      const out = { capNone: v.trainerCap() }
      out.under = top(HERB, 8)   // below the cap: as before, around your lead
      out.over = [top(HERB, 40), top(BRIAN, 40)]   // far above it: held at the next gym's level
      // Wild ones the same: around your lead below the cap, held at it above.
      const wild = (lv) => { v.party.splice(0, 9, individual(speciesByName('PIKACHU'), lv, Math.random)); let lo = 99, hi = 0; for (let i = 0; i < 40; i++) { const l = v.wildLevel(speciesByName('PIDGEY')); lo = Math.min(lo, l); hi = Math.max(hi, l) } return [lo, hi] }
      out.wildUnder = wild(10); out.wildOver = wild(40)
      v.badges.push(0, 1, 2); out.capMorty = v.trainerCap(); out.overMorty = top(PAUL, 60)
      out.gymAces = GYMS.slice(0, 4).map((L) => L.min - L.gap)   // each gym's cap: `gap` below its ace
      // The Kanto League: all sixteen badges as Champion.
      for (let i = 3; i < 16; i++) v.badges.push(i); v.setLeague({ champion: true })
      out.kanto = [v.trainerCap()]; v.setLeague({ kanto: 2 }); out.kanto.push(v.trainerCap()); v.setLeague({ red: true }); out.kanto.push(v.trainerCap())
      return out
    })
    assert.equal(r.capNone, 10, 'before any badge, the cap is 3 below Falkner\'s ace')
    assert.ok(r.under <= 10, `below the cap, levels still follow your lead (${r.under})`)
    assert.deepEqual(r.over, [r.gymAces[0], r.gymAces[0]], 'a Lv 40 lead meets trainers no higher than the first gym')
    assert.ok(r.wildUnder[0] >= 7 && r.wildUnder[1] <= 10, `wild Pokémon below the cap: up to 3 under your lead (${r.wildUnder})`)
    assert.deepEqual(r.wildOver, [r.gymAces[0], r.gymAces[0]], 'a Lv 40 lead meets wild Pokémon no higher than the first gym')
    assert.equal(r.capMorty, r.gymAces[3]); assert.equal(r.overMorty, r.gymAces[3], 'with three badges, the fourth gym sets the cap')
    assert.deepEqual(r.kanto, [KANTO_CAPS[0], KANTO_CAPS[2], 100], 'in the Kanto League, below the member you\'re on; no cap once Red is beaten')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('names: Nidoran\'s ♀ and ♂ are in the game font and sit on the line', async () => {
  const g = await openGame()
  try {
    const r = await g.page.evaluate(async () => {
      await document.fonts.load('20px Pix', '♀♂N'); await document.fonts.ready
      const ctx = document.createElement('canvas').getContext('2d'); ctx.font = '20px Pix'
      const m = (s) => { const x = ctx.measureText(s); return { below: x.actualBoundingBoxDescent, above: x.actualBoundingBoxAscent } }
      return { f: m('♀'), m: m('♂'), N: m('N') }
    })
    for (const k of ['f', 'm']) {
      assert.ok(r[k].below <= 0.5, `${k === 'f' ? '♀' : '♂'} doesn't drop below the baseline (${r[k].below})`)
      assert.ok(Math.abs(r[k].above - r.N.above) <= 1, `${k === 'f' ? '♀' : '♂'} is as tall as the capitals (${r[k].above} vs ${r.N.above})`)
    }
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

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
    assert.deepEqual(g.log.filter((l) => l.startsWith('BUG')), [], 'only the dialogue shows while an attack is announced')

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

test('shiny Pokémon: every shiny sprite loads, and shininess survives evolution and the save', async () => {
  const g = await openGame()
  try {
    await g.page.click('#mPlay'); await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(async () => {
      const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i.naturalWidth > 0); i.onerror = () => ok(false); i.src = src })
      const broken = []
      for (const id of SHINY_IDS) for (const k of ['s' + id, 's' + id + 'b']) if (!(await img(ART[k]))) broken.push(k)
      // Every wild species, and everything it evolves into, has its shiny.
      const evos = DATA.evos ?? {}, reach = new Set(DATA.wild.map((w) => w.name)), q = [...reach]
      while (q.length) for (const e of evos[q.pop()] ?? []) if (!reach.has(e.to)) { reach.add(e.to); q.push(e.to) }
      const uncovered = [...reach].filter((n) => !SHINY_IDS.has(speciesByName(n).id))
      const m = individual(speciesByName('PIDGEY'), 18, Math.random); m.shiny = true
      const before = spr(m), back = spr(m, true)
      evolveInto(m, 'PIDGEOTTO')
      const plain = individual(speciesByName('PIDGEY'), 5, Math.random)
      return { broken, uncovered, n: SHINY_IDS.size, before, back, after: spr(m), kept: JSON.parse(JSON.stringify(m)).shiny, plain: spr(plain) }
    })
    assert.deepEqual(r.broken, [], 'every shiny sprite loads')
    assert.deepEqual(r.uncovered, [], 'every Pokémon you can meet wild, or evolve one into, has a shiny')
    assert.ok(r.n >= 200, `${r.n} shiny species`)
    assert.equal(r.before, '/rpg/a/shiny/16.gif'); assert.equal(r.back, '/rpg/a/shiny/16-back.gif')
    assert.equal(r.after, '/rpg/a/shiny/17.gif', 'still shiny after evolving'); assert.equal(r.kept, true, 'and in the save')
    assert.equal(r.plain, '/rpg/a/16.gif', 'an ordinary one keeps its usual sprite')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

