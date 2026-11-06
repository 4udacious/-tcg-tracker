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

test('index.html loads game.js at the address of this version (browsers keep each one for good)', async () => {
  // next.config.ts caches /rpg/game.js?v=… for a year, so the tag must change whenever the file does.
  const { readFile } = await import('node:fs/promises'), { createHash } = await import('node:crypto')
  const js = await readFile(new URL('../../public/rpg/game.js', import.meta.url)), html = await readFile(new URL('../../public/rpg/index.html', import.meta.url), 'utf8')
  const tag = html.match(/game\.js\?v=([0-9a-f]+)/)?.[1]
  assert.equal(tag, createHash('sha1').update(js).digest('hex').slice(0, 10), 'bump the ?v= tag in index.html to the first 10 hex digits of game.js\'s SHA-1')
})

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
    assert.equal(await g.page.evaluate(() => getComputedStyle(document.documentElement).touchAction), 'manipulation', 'no double-tap zoom')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a quick double tap on a phone: no double-tap scroll, and both taps still count', async () => {
  const g = await openGame({ touch: true })
  try {
    const { page } = g
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      const b = document.createElement('button'); b.id = 'dt'; b.textContent = 'tap'; b.style.cssText = 'position:fixed;left:20px;top:20px;width:120px;height:60px;z-index:99999'
      window.__dt = { clicks: 0, prevented: [] }
      b.addEventListener('click', () => window.__dt.clicks++)
      document.body.append(b)
      addEventListener('touchend', (e) => setTimeout(() => window.__dt.prevented.push(e.defaultPrevented)), { capture: false })
    })
    await page.touchscreen.tap(80, 50); await page.waitForTimeout(120); await page.touchscreen.tap(80, 50)
    await page.waitForTimeout(400)
    await page.touchscreen.tap(80, 50)   // a slow third tap: the browser's own
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => window.__dt)
    assert.equal(r.clicks, 3, 'every tap clicked once')
    assert.deepEqual(r.prevented, [false, true, false], 'only the quick second tap has its default cancelled')
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
        eeveeEvo: evoText(speciesByName('EEVEE')),
        cantDefend: ['slp', 'frz', 'par', 'brn', 'psn', 'tox', null].map((s) => cantDefend({ status: s })),
        // Who parries your strikes, and how often: a sure roll (0) and a never roll (1).
        parries: (() => { const yes = () => 0, no = () => 1, mon = { status: null }, L = GYMS[0]
          return { gym: leaderParries(L, mon, 'GOOD', false, yes), unlucky: leaderParries(L, mon, 'GOOD', false, no), perfect: leaderParries(L, mon, 'PERFECT', false, yes), miss: leaderParries(L, mon, 'MISS', false, yes),
            asleep: leaderParries(L, { status: 'slp' }, 'GOOD', false, yes), paralyzed: leaderParries(L, { status: 'par' }, 'GOOD', false, yes), wild: leaderParries(null, mon, 'GOOD', false, yes),
            confused: [leaderParries(L, mon, 'GOOD', true, () => L.parry * 0.9), leaderParries(L, mon, 'GOOD', false, () => L.parry * 0.9)],
            rates: { gyms: GYMS.every((x) => x.parry === 0.15), elite: ELITE.every((x) => x.parry === 0.2), red: KANTO_ELITE.find((x) => x.red).parry, alex: [rivalTrainer(0).parry, rivalTrainer(6).parry], herb: storyTrainer('HERB', 3).parry ?? 0, veteran: 0 } } })(),
        // A confused Pokémon's windows: a parry 80 ms off lands (the window is 90), not once confused.
        confParry: [defendResult({ btn: 'a' }, 80, false, 1).r, defendResult({ btn: 'a' }, 80, false, CONF_DEFEND).r, defendResult({ btn: 'b' }, 150, false, CONF_DEFEND).r],
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
    assert.match(r.eeveeEvo, /Glaceon with an ICE STONE/, 'an ICE STONE, not a ICE STONE'); assert.match(r.eeveeEvo, /Vaporeon with a WATER STONE/)
    assert.deepEqual(r.cantDefend, [true, true, true, false, false, false, false], 'asleep, frozen and paralyzed can\'t defend; burned or poisoned can')
    const p = r.parries
    assert.ok(p.gym && !p.unlucky, 'a Gym Leader parries a GOOD strike on its roll')
    assert.ok(!p.perfect && !p.miss, 'never a PERFECT strike (or a MISS)')
    assert.ok(!p.asleep && !p.paralyzed, 'not while asleep or paralyzed')
    assert.ok(!p.wild, 'wild Pokémon and everyday trainers never parry')
    assert.deepEqual(p.confused, [false, true], 'a confused one parries less often')
    assert.ok(p.rates.gyms && p.rates.elite && p.rates.red === 0.25, `gyms 15%, Elite Four 20%, Red 25% (${JSON.stringify(p.rates)})`)
    assert.ok(p.rates.alex[0] < p.rates.alex[1] && p.rates.herb === 0, 'Alex more with each battle; Herb and Paul don\'t parry')
    assert.deepEqual(r.confParry, ['parry', 'miss', 'miss'], 'confused: the parry and dodge windows are narrower')
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
    let revealed = null
    const evolve = async (holdMs) => {
      revealed = null
      await page.evaluate(() => { const m = individual(speciesByName('CHARMANDER'), 16, Math.random); m.hp = m.stats.hp; window.__vvm.party.splice(0, 9, m); window.__vvm.evolveNow(m) })
      await page.waitForTimeout(1600)
      await page.keyboard.down('z'); await page.waitForTimeout(holdMs); await page.keyboard.up('z')
      for (let i = 0; i < 80 && await page.evaluate(() => !!document.querySelector('.evostage')); i++) {
        // The reveal: a fresh, loaded image of the new form, in colour, and nothing else.
        const shown = await page.evaluate(() => { const c = document.querySelector('.evostage img.c'); return c && { n: document.querySelectorAll('.evostage img').length, loaded: c.complete && c.naturalWidth > 0, filter: getComputedStyle(c).filter } })
        if (shown) revealed = shown
        await page.keyboard.press('x'); await page.waitForTimeout(200)
      }
      return page.evaluate(() => window.__vvm.party[0].name)
    }
    assert.equal(await evolve(300), 'CHARMELEON', 'a short tap of B lets it evolve')
    assert.ok(revealed && revealed.n === 1 && revealed.loaded && !/brightness|invert/.test(revealed.filter), `the new form is shown loaded and in colour, not a silhouette: ${JSON.stringify(revealed)}`)
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

test('a tap outside the Party, Bag or Box closes it, and never counts as a tap on the machine', async () => {
  const g = await openGame({ touch: true })   // a phone: the click after a tap lands on whatever is under the finger
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    await page.evaluate(() => {
      const m = individual(speciesByName('PIKACHU'), 10, Math.random); m.hp = m.stats.hp; window.__vvm.party.push(m)
      document.querySelectorAll('.tool').forEach((t) => { t.disabled = false })   // the toolbar is off until the tutorial's done
      window.__homeTaps = 0; document.getElementById('home').addEventListener('click', () => window.__homeTaps++, true)
    })
    // A point on the machine's screen, above the sheet's card: the dark backdrop while a sheet is open.
    const box = await (await page.$('#home')).boundingBox(), x = box.x + box.width / 2, y = box.y + 40
    for (const tool of ['tParty', 'tBag', 'tBox']) {
      await page.evaluate((t) => document.getElementById(t).click(), tool); await page.waitForSelector("#sheet.open")
      assert.equal(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [x, y]), 'sheet', `${tool}: the backdrop covers the machine there`)
      await page.touchscreen.tap(x, y)
      await page.waitForTimeout(400)
      assert.equal(await page.$eval('#sheet', (el) => el.classList.contains('open')), false, `${tool}: the tap outside closed it`)
      assert.equal(await page.evaluate(() => window.__homeTaps), 0, `${tool}: and the machine didn't get the tap`)
      assert.notEqual(await page.$eval('#tts', (el) => el.textContent), 'STARTING…')
    }
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

test('the Box: release a Pokémon from its page, after a confirm; a party Pokémon can\'t be released', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const names = () => page.evaluate(() => ({ party: window.__vvm.party.map((m) => m.name), box: window.__vvm.box.map((m) => m.name) }))
    await page.evaluate(() => {
      const mk = (n) => { const m = individual(speciesByName(n), 10, Math.random); m.hp = m.stats.hp; return m }
      window.__vvm.party.splice(0, 9, mk('PIKACHU')); window.__vvm.box.splice(0, 99, mk('ABRA'), mk('ZUBAT'))
      document.querySelectorAll('.tool').forEach((t) => { t.disabled = false })
      document.getElementById('tBox').click()
    })
    const tap = async (sel) => { await page.dispatchEvent(`#sheetBody ${sel}`, 'click'); await page.waitForTimeout(150) }
    const openMon = async (name) => { await page.waitForSelector('#sheetBody [data-mon]')
      const i = await page.$$eval('#sheetBody [data-mon]', (bs, n) => bs.find((b) => b.textContent.includes(n))?.getAttribute('data-mon'), name)
      assert.ok(i != null, `${name} has a page`); await tap(`[data-mon="${i}"]`) }
    await openMon('PIKACHU')
    assert.equal(await page.$('#sheetBody [data-release]'), null, 'no RELEASE for a party Pokémon')
    await tap('[data-back]')
    await openMon('ZUBAT')
    await tap('[data-release="ask"]')
    assert.match(await page.$eval('#sheetBody .release.ask', (e) => e.textContent), /Release ZUBAT.*can't be undone/, 'it asks first')
    await tap('[data-release="no"]')
    assert.deepEqual((await names()).box, ['ABRA', 'ZUBAT'], 'KEEP keeps it')
    await tap('[data-release="ask"]'); await tap('[data-release="yes"]')
    assert.deepEqual(await names(), { party: ['PIKACHU'], box: ['ABRA'] }, 'released: gone from the Box')
    assert.match(await page.$eval('#sheet', (e) => e.textContent), /ZUBAT was released/)
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

test('accuracy down (Flash, Sand Attack, Smokescreen, Kinesis, Mud-Slap): your strike rings are dazzled, more each stage; a foe\'s Mud-Slap lowers yours', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(800)
    const r = await page.evaluate(() => {
      const look = (b, v) => { const x = window.__vvm.ringLook(b, v), cs = getComputedStyle(x.el), out = { cls: x.el.className, dz: x.el.dataset.dazzle ?? null, o: parseFloat(cs.getPropertyValue('--dz-o')) || 1, b: parseFloat(cs.getPropertyValue('--dz-b')) || 0 }; x.clear(); return out }
      return { looks: [0, 1, 2, 3, 5].map((b) => look(b, 0)), both: look(2, 2),
        lowering: Object.entries({ ...MOVEDEX, ...SUPPORT }).filter(([, m]) => m.effect === 'accDown' || m.accDown).map(([n]) => n).sort(),
        // A foe's Mud-Slap comes from its own move list, a copy without the flag: looked up by name.
        foeMudSlap: accDownOf(WILD_MOVES.ground.find((m) => m.name === 'MUD-SLAP')), tackle: accDownOf(WILD_MOVES.ground.find((m) => m.name === 'TACKLE')) }
    })
    assert.deepEqual(r.lowering, ['FLASH', 'KINESIS', 'MUD-SLAP', 'SAND ATTACK', 'SMOKESCREEN'], 'every move that lowers accuracy')
    assert.equal(r.looks[0].cls, 'ring', 'accuracy as normal: a plain ring')
    assert.deepEqual(r.looks.slice(1).map((x) => x.dz), ['1', '2', '3', '3'], 'one look per stage, the third the most (lower still looks like the third)')
    assert.ok(r.looks.slice(1, 4).every((x, i, a) => /dazzle/.test(x.cls) && (!i || (x.o < a[i - 1].o && x.b > a[i - 1].b))), `dimmer and blurrier each stage: ${JSON.stringify(r.looks)}`)
    assert.match(r.both.cls, /veil.*dazzle|dazzle.*veil/, 'with an evasive target too, both')
    assert.equal(r.foeMudSlap, 1, "a foe's Mud-Slap lowers your accuracy"); assert.equal(r.tackle, 0)
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
      let balance = 10, owned = { potion: 2, move_disc: 1, full_heal: 1, hyper_potion: 2, max_revive: 1, ultra_ball: 3, thunder_stone: 1, linking_cord: 2, dragon_scale: 1, rematch_gym_1: 1 }
      window.__vvmApi = {
        async machine() { calls.push(['machine']); return { status: 'in_stock', cycle_no: 7, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: false, trainers: false, heal_price: 0.75,
          packs: [{ set_code: 'base2', set_name: 'Jungle', image: '/rpg/a/jungle-scyther.webp', quantity: 3, description: null }], tickets: [],
          supplies: [{ key: 'great_ball', kind: 'item', name: 'Great Ball', description: 'Catch rate ×1.5', price: 0.4, contents: null },
            { key: 'elite_ticket', kind: 'item', name: 'Elite Four Ticket', description: 'All five League battles', price: 5, contents: null },
            { key: 'rematch_gym_0', kind: 'item', name: 'Falkner Rematch', description: 'Rematch Falkner', price: 1, contents: null, max: 1, left_today: null }],
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
    assert.equal(await frame.evaluate(() => window.__vvm.bag.fullheal), 1, 'a bought Full Heal is a FULL HEAL in the Bag')
    assert.deepEqual(await frame.evaluate(() => [window.__vvm.bag.hyper, window.__vvm.bag.maxrevive]), [2, 1], 'bought Hyper Potions and a Max Revive are in the Bag')
    assert.equal(await frame.evaluate(() => window.__vvm.bag.ultra), 3, 'bought Ultra Balls are in the Bag')
    assert.deepEqual(await frame.evaluate(() => [window.__vvm.bag.thunderstone, window.__vvm.bag.linkcable, window.__vvm.bag.dragonscale]), [1, 2, 1], 'bought evolution items are the game\'s own in the Bag')
    assert.equal(await frame.evaluate(() => window.__vvm.bag['rematch:gym_1']), 1, 'a bought rematch ticket is in the Bag, for that leader')
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
    const rematchTile = await frame.$eval('[data-buy="sup:rematch_gym_0"]', (b) => ({ off: b.disabled, text: b.textContent }))
    assert.ok(rematchTile.off && /beat them first/.test(rematchTile.text), `a rematch with a leader you haven't beaten is greyed out (${rematchTile.text})`)
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

test('in the app: a won rematch pays for its ticket even after the day\'s battle tokens are used up', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      const calls = window.__calls = []
      let owed = 1, balance = 10
      window.__vvmApi = {
        async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: true, trainers: true, heal_price: 0.5, find_chance: 0.8,
          packs: [], tickets: [], supplies: [], boxes: [] } },
        async balance() { return balance }, async claim() { return { ok: false } }, async heartbeat() {}, async release() {}, async checkout() { return { ok: false } }, async takeItems() { return [] },
        async awardPack() { return { ok: false } }, async awardMilestone() { return { ok: false } },
        // The day's battle tokens are used up...
        async awardTokens(amount, source) { calls.push(['awardTokens', amount, source]); return { ok: false, reason: 'daily_cap', awarded: 0, balance } },
        // ...but a bought ticket's win is paid outside the cap, once a ticket.
        async awardRematch() { calls.push(['awardRematch']); if (!owed) return { ok: false, reason: 'no_ticket', awarded: 0, balance }; owed--; balance += 2; return { ok: true, reason: 'ok', awarded: 2, balance } },
        async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
      }
      const m = individual(speciesByName('CHARMANDER'), 12, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 5 }, wallet: 10, badges: [0], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    const pay = async () => {
      await frame.evaluate(() => { window.__paid = false; window.__said = []; const msg = document.getElementById('msg')
        const o = new MutationObserver(() => window.__said.push(msg.textContent)); o.observe(msg, { childList: true, subtree: true, characterData: true })
        window.__vvm.payRematch().then(() => { o.disconnect(); window.__paid = true }) })
      for (let i = 0; i < 40 && !(await frame.evaluate(() => window.__paid)); i++) { await frame.evaluate(() => document.getElementById('msg')?.click()); await page.waitForTimeout(250) }
      return frame.evaluate(() => ({ said: window.__said.join(' | '), wallet: window.__vvm.wallet }))
    }
    const first = await pay()
    assert.match(first.said, /You got 2\.00 tokens/, `the ticket's win is paid though the cap is reached (${first.said})`)
    assert.equal(first.wallet, 12)
    const second = await pay()
    assert.match(second.said, /all the battle tokens for today/, `with no ticket owed, it's the usual capped battle tokens (${second.said})`)
    assert.equal(second.wallet, 12)
    assert.deepEqual((await page.evaluate(() => window.__calls)).map((c) => c[0]), ['awardRematch', 'awardRematch', 'awardTokens'])
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the Bag: a Hyper Potion heals 90%, a Max Revive brings a fainted Pokémon back at full HP', async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    const r = await page.evaluate(() => {
      const v = window.__vvm, mk = (n) => { const m = individual(speciesByName(n), 40, Math.random); learnAtLevel(m); return m }
      const hurt = mk('MACHOP'), down = mk('PIDGEY'), fine = mk('ODDISH')
      hurt.hp = 1; down.hp = 0; v.party.splice(0, 9, hurt, down, fine)
      Object.assign(v.bag, { hyper: 1, maxrevive: 1 })
      const said = [v.useItem('hyper', hurt), v.useItem('maxrevive', fine), v.useItem('maxrevive', down)]
      return { said, hurt: [hurt.hp, hurt.stats.hp], down: [down.hp, down.stats.hp], left: [v.bag.hyper, v.bag.maxrevive] }
    })
    assert.equal(r.hurt[0], Math.min(r.hurt[1], 1 + Math.ceil(r.hurt[1] * 0.9)), `Hyper Potion: +90% (${r.hurt})`)
    assert.match(r.said[1], /hasn't fainted/, 'a Max Revive is only for a fainted Pokémon')
    assert.deepEqual([r.down[0], r.said[2].includes('revived')], [r.down[1], true], `Max Revive: back at full HP (${r.down})`)
    assert.deepEqual(r.left, [0, 0], 'one of each used')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('an Ultra Ball catches at ×2: better than a Great Ball (×1.5) and a Poké Ball, and sits in the Bag\'s balls pocket', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const mon = { max: 100, hp: 60, capture: 45, status: null }
      const p = (k) => shakeOdds(mon, k, 1) ** 4
      return { ball: p('ball'), great: p('great'), ultra: p('ultra'), item: ITEMS.ultra?.name, art: ART['item:ultra'], isBall: isBall('ultra'), battle: BATTLE_ITEMS.includes('ultra') }
    })
    assert.ok(r.ultra > r.great && r.great > r.ball, `Ultra > Great > Poké (${r.ball.toFixed(3)}, ${r.great.toFixed(3)}, ${r.ultra.toFixed(3)})`)
    assert.equal(r.item, 'ULTRA BALL'); assert.equal(r.art, '/rpg/a/items/ultra.png'); assert.ok(r.isBall && r.battle, 'a ball, usable in battle')
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

test('in the app: what you buy drops into the tray at angles; a jammed pack hangs at its mouth, a stuck one freed for you bounces in; a tap collects them', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      let n = 0
      window.__vvmApi = {
        async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance: 20, wild: false, trainers: false, heal_price: 0.5, find_chance: 0.35,
          packs: [{ set_code: 'base2', set_name: 'Jungle', image: '/rpg/a/jungle-scyther.webp', quantity: 9, description: null }], tickets: [],
          supplies: [{ key: 'great_ball', kind: 'item', name: 'Great Ball', description: 'Catch rate ×1.5', price: 0.4, contents: null }], boxes: [] } },
        async balance() { return 20 }, async claim() { return { ok: true, reason: 'ok' } }, async heartbeat() {}, async release() {}, async takeItems() { return [] },
        // The first checkout jams a pack on you; on the second, someone else's stuck pack falls out with yours.
        async checkout() { n++; return { ok: true, reason: 'ok', packs_bought: 3, balance: 15, restocked: false, packs_stuck: n === 1 ? 1 : 0, packs_freed: n === 2 ? 1 : 0 } },
        async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
        async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
      }
      const m = individual(speciesByName('CHARMANDER'), 12, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 5 }, wallet: 20, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    await page.waitForTimeout(1200)
    const tray = () => frame.evaluate(() => ({ drops: [...document.querySelectorAll('#trayIn .tdrop')].map((e) => ({ how: e.className.replace('tdrop ', ''), art: e.querySelector('img') ? 'pack' : e.querySelector('.supic')?.className, tilt: e.style.getPropertyValue('--tilt'), w: e.firstElementChild.getBoundingClientRect().width })),
      stuck: document.getElementById('trayStuck').classList.contains('on') && !!document.querySelector('#trayStuck img') }))
    const buy = async () => {
      await frame.waitForFunction(() => /\bidle\b/.test(document.getElementById('home').className), null, { timeout: 10000 })   // back from the last one
      for (let t = 0; t < 4 && !(await frame.$('[data-buy="set:base2"]')); t++) { await frame.evaluate(() => document.getElementById('home').click()); await page.waitForTimeout(1500) }
      await page.waitForTimeout(1200)   // the screen finishes fading in
      await frame.evaluate(() => { for (const k of ['set:base2', 'set:base2', 'set:base2', 'sup:great_ball']) document.querySelector(`[data-buy="${k}"]`).click(); document.getElementById('cbGo').click() })
      await frame.waitForSelector('[data-co="pay"]:not([disabled])'); await frame.evaluate(() => document.querySelector('[data-co="pay"]').click())
      await frame.waitForFunction(() => document.getElementById('checkout').classList.contains('disp'), null, { timeout: 10000 })
      await frame.waitForFunction(() => !document.getElementById('checkout').classList.contains('open'), null, { timeout: 20000 })
      return tray()
    }
    const jam = await buy()
    assert.deepEqual(jam.drops.map((d) => d.art), ['pack', 'pack', 'supic great'], 'two packs and the Great Ball dropped; the third pack jammed')
    assert.ok(jam.stuck, 'the jammed pack hangs at the tray\'s mouth')
    assert.equal(new Set(jam.drops.map((d) => d.tilt)).size, 3, 'each lying at its own angle'); assert.ok(jam.drops.every((d) => d.w > 10), 'and every one is visible')
    const freed = await buy()
    assert.equal(freed.stuck, false, 'a new checkout empties the tray, the jam with it')
    assert.deepEqual(freed.drops.map((d) => d.how), ['fall', 'fall', 'fall', 'fall', 'bounce'], 'all four bought, then someone\'s stuck pack bounces in')
    await frame.evaluate(() => document.getElementById('tray').click()); await page.waitForTimeout(600)
    assert.equal((await tray()).drops.length, 0, 'a tap on the tray collects what\'s in it')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: a roaming legendary met in a wild battle is reported for the home feed', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      const calls = window.__calls = []
      window.__vvmApi = {
        async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: 'u2', holder_name: 'SAM', holder_expires: null, me: 'u1', cooldown_until: null, balance: 10, wild: true, trainers: false, heal_price: 0.5, find_chance: 0,
          packs: [], tickets: [], supplies: [], boxes: [] } },
        async balance() { return 10 }, async claim() { return { ok: false, reason: 'busy', holder_name: 'SAM' } }, async heartbeat() {}, async release() {}, async checkout() { return { ok: false } }, async takeItems() { return [] },
        async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false, reason: 'daily_cap', awarded: 0, balance: 10 } }, async awardMilestone() { return { ok: false } },
        async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
        async logEvent(...a) { calls.push(a); return true },
      }
      const m = individual(speciesByName('CHARMANDER'), 8, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 5 }, wallet: 10, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    await page.waitForTimeout(1200)
    await frame.evaluate(() => { document.getElementById('nextTap').value = 'legend'; document.getElementById('home').click() })
    await frame.waitForFunction(() => getComputedStyle(document.getElementById('battleL')).display !== 'none', null, { timeout: 10000 })
    // Run (or go down trying: a Lv 8 against a legendary), whatever ends it first.
    for (let i = 0; i < 240; i++) {
      const left = await frame.evaluate(() => {
        if (getComputedStyle(document.getElementById('battleL')).display === 'none') return true
        const run = document.querySelector('#pMain [data-act="run"]')
        if (run && run.offsetParent && run.closest('.panel').style.display !== 'none') run.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))
        return false
      })
      if (left) break
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(500)
    // Back at the machine, the battle's images are let go (their decoded frames can be dropped).
    assert.deepEqual(await frame.evaluate(() => [...document.querySelectorAll('#enemy img, #player img, #trainer img, #vsImg')].map((i) => i.getAttribute('src'))), [null, null, null, null], 'the battle\'s sprites released')
    const calls = await page.evaluate(() => window.__calls)
    assert.equal(calls.length, 1, `one report for the feed (${JSON.stringify(calls)})`)
    const [kind, species, id, level] = calls[0]
    assert.ok(['legend_seen', 'legend_ko', 'legend_caught'].includes(kind), kind)
    assert.ok(['RAIKOU', 'ENTEI', 'SUICUNE'].includes(species), species)
    assert.ok(id > 0 && level > 0)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: Pokémon an admin gifts arrive rolled like wild ones, once each, and are then marked collected', async () => {
  const g = await openGame()
  try {
    const { page } = g
    const list = await page.evaluate(() => window.__giftable())
    const { readFile } = await import('node:fs/promises')
    assert.deepEqual(JSON.parse(await readFile(new URL('../../public/rpg/species.json', import.meta.url), 'utf8')), list,
      'public/rpg/species.json (the admin page\'s list) matches the game: regenerate it from window.__giftable()')
    await page.evaluate(() => {
      const calls = window.__calls = []
      window.__vvmApi = {
        async machine() { return { status: 'out_of_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance: 10, wild: true, trainers: true, heal_price: 0.5, find_chance: 0.35, packs: [], tickets: [], supplies: [], boxes: [] } },
        async balance() { return 10 }, async claim() { return { ok: false, reason: 'not_stocked' } }, async heartbeat() {}, async release() {}, async checkout() { return { ok: false } }, async takeItems() { return [] },
        async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
        async loadSave() { return null }, async putSave(d, rev) { calls.push(['putSave', d.giftIds]); return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
        // The same two gifts every time, as if the acknowledgement never got through.
        async pendingGifts() { calls.push(['pending']); return [{ id: 41, species: 'PIKACHU', level: 12, note: 'Discord art contest' }, { id: 42, species: 'EEVEE', level: null, note: null }] },
        async ackGifts(ids) { calls.push(['ack', ids]) },
      }
      const m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 5 }, wallet: 10, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)
    })
    const frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.party.length === 3, null, { timeout: 15000 })
    const r = await frame.evaluate(() => ({ party: window.__vvm.party.map((m) => [m.name, m.level, Object.values(m.ivs).every((v) => v >= 0 && v <= 31), m.hp === m.stats.hp]),
      pop: document.querySelector('#home .find')?.textContent ?? '', feed: document.getElementById('feed')?.textContent ?? '' }))
    assert.deepEqual(r.party.map((x) => x[0]), ['CHARMANDER', 'PIKACHU', 'EEVEE'], 'both gifts joined the party')
    assert.equal(r.party[1][1], 12, 'at the level the admin set'); assert.ok(r.party[2][1] >= 2, 'and the other at a wild one\'s level')
    assert.ok(r.party.every((x) => x[2] && x[3]), 'with IVs rolled, at full HP')
    assert.match(r.pop, /A gift: PIKACHU \(Lv 12\), EEVEE/)
    // Offered again (the acknowledgement "failed"): never added twice.
    await frame.evaluate(() => window.__vvm.collectItems())
    assert.equal(await frame.evaluate(() => window.__vvm.party.length), 3, 'a gift already in the save is skipped')
    const calls = await page.evaluate(() => window.__calls)
    assert.ok(calls.filter((c) => c[0] === 'ack').every((c) => JSON.stringify(c[1]) === '[41,42]'), 'acknowledged, every time it was offered')
    assert.ok(calls.some((c) => c[0] === 'putSave' && JSON.stringify(c[1]) === '[41,42]'), 'the ids are in the account save')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: a game that dies mid-battle reports where it was on the next start; leaving normally, or a second copy opening while it runs, reports nothing', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      const calls = window.__calls = []
      window.__vvmApi = {
        async machine() { return { status: 'out_of_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance: 10, wild: true, trainers: true, heal_price: 0.5, find_chance: 0, packs: [], tickets: [], supplies: [], boxes: [] } },
        async balance() { return 10 }, async claim() { return { ok: false, reason: 'not_stocked' } }, async heartbeat() {}, async release() {}, async checkout() { return { ok: false } }, async takeItems() { return [] },
        async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
        async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
        async reportCrash(note, device) { calls.push(['crash', note, device]) },
      }
      const m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag: { ball: 5 }, wallet: 10, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      localStorage.removeItem('vvm-crumbs:u1')
      window.__open = () => { const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'; RUN++; document.body.replaceChildren(f) }
      window.__open()
    })
    let frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    await page.waitForTimeout(1200)
    await frame.evaluate(() => { document.getElementById('nextTap').value = 'wild'; document.getElementById('home').click() })
    await frame.waitForFunction(() => getComputedStyle(document.getElementById('battleL')).display !== 'none', null, { timeout: 10000 })
    await page.waitForTimeout(3500)
    const note = await page.evaluate(() => JSON.parse(localStorage.getItem('vvm-crumbs:u1')))
    assert.equal(note.open, true, 'a battle on screen: the note is open')
    assert.equal(note.kind, 'wild'); assert.match(note.who, /^wild [A-Z]/); assert.match(note.party, /CHARMANDER 15/)
    assert.ok(note.lines.length > 0 && note.music, `the lines shown and the music: ${JSON.stringify(note.lines)} ${note.music}`)
    assert.ok(note.session?.battles >= 1, 'the session so far: battles'); assert.ok(note.session.mins >= 0 && note.session.nodes > 100 && note.session.imgs > 0, JSON.stringify(note.session))
    // The battle's start, step by step, with the last step reached.
    assert.ok(note.trail?.some((l) => /battle screen/.test(l)) && note.trail.some((l) => /battle set up/.test(l)), `the start's steps: ${JSON.stringify(note.trail)}`)
    assert.ok(note.trail.some((l) => /image /.test(l)) && note.phase, `images as they arrive, and the last step: ${JSON.stringify(note.trail)}`)
    // A second copy of the game opening while this one is mid-battle (another tab, the app open twice) finds the open
    // note, but the first copy answers that it's still running: no crash report.
    await page.evaluate(() => { const f = document.createElement('iframe'); f.id = 'game2'; f.src = '/rpg/index.html?app=1&u=u1'; document.body.appendChild(f) })
    const frame2 = await (await page.waitForSelector('#game2')).contentFrame()
    await frame2.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    await page.waitForTimeout(8500)
    assert.equal((await page.evaluate(() => window.__calls)).filter((c) => c[0] === 'crash').length, 0, 'a copy still running is no crash')
    // Leaving the page normally (pagehide) closes it: nothing to report.
    await page.evaluate(() => document.body.replaceChildren()); await page.waitForTimeout(300)
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('vvm-crumbs:u1'))))?.open, false, 'leaving normally closes the note')
    // A session that died mid-battle leaves its note open (no pagehide): the next start reports it, once.
    await page.evaluate((n) => { localStorage.setItem('vvm-crumbs:u1', JSON.stringify({ ...n, at: Date.now() - 20000 })); window.__open() }, note)
    frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    // It first checks nothing still running wrote the note (up to 7 s), then reports.
    await page.waitForFunction(() => window.__calls.some((c) => c[0] === 'crash'), null, { timeout: 12000 })
    await page.waitForTimeout(500)
    const calls = (await page.evaluate(() => window.__calls)).filter((c) => c[0] === 'crash')
    assert.equal(calls.length, 1, 'reported once')
    assert.equal(calls[0][1].who, note.who); assert.deepEqual(calls[0][1].lines, note.lines)
    assert.match(calls[0][2].ua, /Chrome|HeadlessChrome/); assert.ok(calls[0][2].screen)
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('vvm-crumbs:u1')))
    assert.ok(!after?.open && after?.started !== note.started, 'and the old note is gone, so it is never sent twice')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: one Gym Summon at a time: not for sale while one is in the Bag', async () => {
  const g = await openGame()
  try {
    const { page } = g
    const open = async (bag, owned) => {
      await page.evaluate(([bag, owned]) => {
        let balance = 10
        window.__vvmApi = {
          async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: false, trainers: true, heal_price: 0.5, find_chance: 0,
            packs: [], tickets: [], supplies: [{ key: 'gym_summon', kind: 'item', name: 'Gym Summon', description: 'Summons your next Gym Leader', price: 3, contents: null }], boxes: [] } },
          async balance() { return balance }, async claim() { return { ok: true, reason: 'ok' } }, async heartbeat() {}, async release() {},
          async checkout(p, t, sup) { balance -= 3; for (const x of sup) owned[x.key] = (owned[x.key] ?? 0) + x.qty; return { ok: true, reason: 'ok', packs_bought: 0, supplies_bought: 1, balance } },
          async takeItems(keys) { const out = keys.filter((k) => owned[k]).map((k) => ({ key: k, qty: owned[k] })); for (const k of keys) delete owned[k]; return out },
          async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
          async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
          async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
        }
        const m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
        localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag, wallet: 10, badges: [0, 1], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
        const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
        RUN++; document.body.replaceChildren(f)
      }, [bag, owned])
      const frame = await (await page.waitForSelector('#game')).contentFrame()
      await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
      await page.waitForTimeout(1200)
      // Empty taps: with trainer battles live, Alex (due after the first badge) would otherwise jump out.
      for (let t = 0; t < 4 && !(await frame.$('[data-buy="sup:gym_summon"]')); t++) { await frame.evaluate(() => { document.getElementById('nextTap').value = 'none'; document.getElementById('home').click() }); await page.waitForTimeout(1500) }
      await page.waitForTimeout(1200)
      return frame
    }
    let frame = await open({ ball: 1, 'summon:2': 1 }, {})
    const held = await frame.$eval('[data-buy="sup:gym_summon"]', (b) => ({ off: b.disabled, meta: b.querySelector('.meta').textContent }))
    assert.equal(held.off, true, 'a summon in the Bag: the Gym Summon is greyed out'); assert.match(held.meta, /you have one/)
    // Spares for a gym already beaten (bought before one at a time): they become the next gym's.
    frame = await open({ ball: 1, 'summon:0': 2 }, {})
    const carried = await frame.evaluate(() => ({ old: window.__vvm.bag['summon:0'] ?? 0, next: window.__vvm.bag['summon:2'] ?? 0, feed: document.body.textContent }))
    assert.deepEqual([carried.old, carried.next], [0, 2], 'two spare Zephyr summons are now two for gym 3'); assert.match(carried.feed, /2 spare summons/)
    frame = await open({ ball: 1 }, {})
    assert.equal(await frame.$eval('[data-buy="sup:gym_summon"]', (b) => b.disabled), false, 'none in the Bag: on sale')
    for (let t = 0; t < 10 && !/CART 1/.test(await frame.$eval('#cbSum', (e) => e.textContent)); t++) {   // once the machine's screen has settled
      await frame.evaluate(() => document.querySelector('[data-buy="sup:gym_summon"]').click()); await page.waitForTimeout(500)
    }
    await frame.evaluate(() => document.getElementById('cbGo').click())
    await frame.waitForSelector('[data-co="pay"]:not([disabled])'); await frame.evaluate(() => document.querySelector('[data-co="pay"]').click())
    await frame.waitForFunction(() => Object.entries(window.__vvm.bag).some(([k, v]) => /^summon:/.test(k) && v > 0), null, { timeout: 15000 })
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: a finished game claims the Champion\'s Emblem once, with the Hall of Fame team', async () => {
  const g = await openGame()
  try {
    const { page } = g
    const open = async (bag, owned) => {
      await page.evaluate(([bag, owned]) => {
        let balance = 10
        window.__vvmApi = {
          async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: false, trainers: true, heal_price: 0.5, find_chance: 0,
            packs: [], tickets: [], supplies: [{ key: 'gym_summon', kind: 'item', name: 'Gym Summon', description: 'Summons your next Gym Leader', price: 3, contents: null }], boxes: [] } },
          async balance() { return balance }, async claim() { return { ok: true, reason: 'ok' } }, async heartbeat() {}, async release() {},
          async checkout(p, t, sup) { balance -= 3; for (const x of sup) owned[x.key] = (owned[x.key] ?? 0) + x.qty; return { ok: true, reason: 'ok', packs_bought: 0, supplies_bought: 1, balance } },
          async takeItems(keys) { const out = keys.filter((k) => owned[k]).map((k) => ({ key: k, qty: owned[k] })); for (const k of keys) delete owned[k]; return out },
          async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
          async loadSave() { return null }, async claimEmblem(team) { (window.__claims ??= []).push(team); return true }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
          async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
        }
        const m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
        localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag, wallet: 10, badges: [0, 1], champion: true, eliteStep: 0, redBeaten: true, gifted: true, roam: {}, weekShift: 0, reports: {}, emblemSent: bag.sent ?? false, fame: { at: Date.now(), team: [{ id: 6, name: 'CHARIZARD', level: 70, shiny: false }, { id: 25, name: 'PIKACHU', level: 68, shiny: true }] } }))
        const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
        RUN++; document.body.replaceChildren(f)
      }, [bag, owned])
      const frame = await (await page.waitForSelector('#game')).contentFrame()
      await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
      await page.waitForTimeout(1200)
      // Empty taps: with trainer battles live, Alex (due after the first badge) would otherwise jump out.
      for (let t = 0; t < 4 && !(await frame.$('[data-buy="sup:gym_summon"]')); t++) { await frame.evaluate(() => { document.getElementById('nextTap').value = 'none'; document.getElementById('home').click() }); await page.waitForTimeout(1500) }
      await page.waitForTimeout(1200)
      return frame
    }
    let frame = await open({ ball: 1 }, {})
    await frame.waitForFunction(() => window.parent.__claims?.length === 1, null, { timeout: 10000 })
    const r = await frame.evaluate(() => ({ claims: window.parent.__claims, saved: JSON.parse(localStorage.getItem('vvm-save:u1')).emblemSent, feed: document.body.textContent }))
    assert.deepEqual(r.claims[0].map((m) => `${m.name} ${m.level}${m.shiny ? ' shiny' : ''}`), ['CHARIZARD 70', 'PIKACHU 68 shiny'], 'claimed with the Hall of Fame team')
    assert.equal(r.saved, true, 'and the save remembers it'); assert.match(r.feed, /CHAMPION'S EMBLEM/)
    // A save that has claimed it doesn't claim again.
    await page.evaluate(() => { window.__claims = [] })
    frame = await open({ ball: 1, sent: true }, {})
    await page.waitForTimeout(1500)
    assert.deepEqual(await page.evaluate(() => window.__claims), [], 'claimed once')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: a supply\'s purchase limits: no more in the cart than is left today, and greyed out once today\'s are bought', async () => {
  const g = await openGame()
  try {
    const { page } = g
    const open = async (bag, owned) => {
      await page.evaluate(([bag, owned]) => {
        let balance = 10
        window.__vvmApi = {
          async machine() { return { status: 'in_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: false, trainers: true, heal_price: 0.5, find_chance: 0,
            packs: [], tickets: [], supplies: [{ key: 'potion', kind: 'item', name: 'Potion', description: 'Heals 30% HP', price: 0.25, contents: null, max: 2, left_today: 2 }, { key: 'revive', kind: 'item', name: 'Revive', description: 'Revives', price: 0.6, contents: null, max: 0, left_today: 0 }], boxes: [] } },
          async balance() { return balance }, async claim() { return { ok: true, reason: 'ok' } }, async heartbeat() {}, async release() {},
          async checkout(p, t, sup) { balance -= 3; for (const x of sup) owned[x.key] = (owned[x.key] ?? 0) + x.qty; return { ok: true, reason: 'ok', packs_bought: 0, supplies_bought: 1, balance } },
          async takeItems(keys) { const out = keys.filter((k) => owned[k]).map((k) => ({ key: k, qty: owned[k] })); for (const k of keys) delete owned[k]; return out },
          async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
          async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
          async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
        }
        const m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
        localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: Date.now(), party: [m], box: [], bag, wallet: 10, badges: [0, 1], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
        const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
        RUN++; document.body.replaceChildren(f)
      }, [bag, owned])
      const frame = await (await page.waitForSelector('#game')).contentFrame()
      await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
      await page.waitForTimeout(1200)
      // Empty taps: with trainer battles live, Alex (due after the first badge) would otherwise jump out.
      for (let t = 0; t < 4 && !(await frame.$('[data-buy="sup:potion"]')); t++) { await frame.evaluate(() => { document.getElementById('nextTap').value = 'none'; document.getElementById('home').click() }); await page.waitForTimeout(1500) }
      await page.waitForTimeout(1200)
      return frame
    }
    const frame = await open({ ball: 1 }, {})
    const revive = await frame.$eval('[data-buy="sup:revive"]', (b) => ({ off: b.disabled, meta: b.querySelector('.meta').textContent }))
    assert.equal(revive.off, true, "today's Revives are bought: greyed out"); assert.match(revive.meta, /today's limit is bought/)
    assert.match(await frame.$eval('[data-buy="sup:potion"] .meta', (m) => m.textContent), /2 left today/)
    for (let t = 0; t < 10 && !/CART 2/.test(await frame.$eval('#cbSum', (e) => e.textContent)); t++) {   // once the machine's screen has settled
      await frame.evaluate(() => document.querySelector('[data-buy="sup:potion"]').click()); await page.waitForTimeout(400)
    }
    await frame.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('[data-buy="sup:potion"]').click(); document.querySelector('[data-buy="sup:revive"]').click() })
    await page.waitForTimeout(400)
    assert.match(await frame.$eval('#cbSum', (e) => e.textContent), /CART 2/, 'no more than the 2 left today, and no Revive')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in the app: when a newer version is out, a bar at the machine offers to refresh; a tap saves and reloads the game', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.evaluate(() => {
      window.__vvmApi = {
        async machine() { return { status: 'out_of_stock', cycle_no: 7, seconds_left: 300, frozen: false, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance: 10, wild: false, trainers: false, heal_price: 0.5, find_chance: 0, packs: [], tickets: [], supplies: [], boxes: [] } },
        async balance() { return 10 }, async claim() { return { ok: false, reason: 'not_stocked' } }, async heartbeat() {}, async release() {}, async checkout() { return { ok: false } }, async takeItems() { return [] },
        async awardPack() { return { ok: false } }, async awardTokens() { return { ok: false } }, async awardMilestone() { return { ok: false } },
        async loadSave() { return null }, async putSave(d, rev) { return { ok: true, reason: 'ok', rev: (rev ?? 0) + 1, data: null } }, async deleteSave() {},
        async wildSeed() { return { report: null, machines: [{ code: 'TAC-07', venue: 'Safeway', city: 'Tacoma' }] } }, async buyHeal() { return { ok: false } },
      }
      const m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      localStorage.setItem('vvm-save:u1', JSON.stringify({ v: 1, at: 1, party: [m], box: [], bag: { ball: 1 }, wallet: 10, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
      const f = document.createElement('iframe'); f.id = 'game'; f.style.cssText = 'width:420px;height:900px'; f.src = '/rpg/index.html?app=1&u=u1'
      RUN++; document.body.replaceChildren(f)
    })
    let frame = await (await page.waitForSelector('#game')).contentFrame()
    await frame.waitForFunction(() => window.__vvm && window.__vvm.realShelf, null, { timeout: 15000 })
    assert.equal(await frame.evaluate(() => window.__checkUpdate()), false, 'the same version: nothing to offer')
    assert.equal(await frame.$eval('#updateBar', (b) => b.hidden), true)
    // A newer version goes out: the server's index.html names another game.js.
    await page.route('**/rpg/index.html', async (route) => { const r = await route.fetch(); route.fulfill({ response: r, body: (await r.text()).replace(/game\.js\?v=[0-9a-f]+/, 'game.js?v=0123456789') }) })
    assert.equal(await frame.evaluate(() => window.__checkUpdate()), true, 'a newer version noticed')
    assert.equal(await frame.$eval('#updateBar', (b) => b.hidden), false, 'the bar shows at the machine')
    // Not mid-battle.
    await frame.evaluate(() => { document.getElementById('battleL').style.display = 'block' }); await page.waitForTimeout(1300)
    assert.equal(await frame.$eval('#updateBar', (b) => b.hidden), true, 'hidden during a battle')
    await frame.evaluate(() => { document.getElementById('battleL').style.display = 'none' }); await page.waitForTimeout(1300)
    // A tap: saved, then the game reloads.
    await page.unroute('**/rpg/index.html')
    const reloaded = new Promise((res) => page.on('framenavigated', (f) => { if (f.url().includes('/rpg/index.html?app=1')) res(true) }))
    await frame.evaluate(() => document.getElementById('updateBar').click())
    assert.equal(await Promise.race([reloaded, new Promise((r) => setTimeout(() => r(false), 5000))]), true, 'the game reloaded')
    assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('vvm-save:u1')).at > 1), 'saved first')
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
    assert.deepEqual(b.map((x) => x.restores), [1, 1, 1, 1, 1, 1, 2], 'one Full Restore in each battle, two in the last')
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

test('a wild Pokémon is easier to catch at low HP and with a status: asleep or frozen ×2.5, paralyzed, burned or poisoned ×1.5', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const mon = (hp, status) => ({ max: 100, hp, capture: 45, status })
      const catchP = (m, ball = 'ball', t = 1) => shakeOdds(m, ball, t) ** 4
      const full = catchP(mon(100)), low = catchP(mon(10))
      return {
        full, low,
        status: ['slp', 'frz', 'par', 'brn', 'psn', 'tox'].map((s) => catchP(mon(100, s)) / full),
        lowSlp: catchP(mon(10, 'slp')), capped: shakeOdds({ max: 100, hp: 1, capture: 255, status: 'slp' }, 'great', 1.8),
      }
    })
    assert.ok(r.low > r.full * 2, `low HP helps (${r.full.toFixed(3)} → ${r.low.toFixed(3)})`)
    const [slp, frz, par, brn, psn, tox] = r.status
    assert.ok(slp > par && Math.abs(slp - frz) < 1e-9, 'sleep and freeze help most, and equally')
    assert.ok([brn, psn, tox].every((x) => Math.abs(x - par) < 1e-9) && par > 1, 'paralysis, burn and poison help, and equally')
    assert.ok(r.lowSlp > r.low && r.lowSlp > r.status[0] * r.full, 'low HP and sleep stack')
    assert.equal(r.capped, 1, 'never above certain')
  } finally { await g.close() }
})

test('evasion and accuracy moves: one step at most; PERFECT always lands, weaker timing may fail', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const order = ['PERFECT', 'GREAT', 'GOOD', 'OK', 'MISS'], odds = order.map((l) => STAGE_LANDS[l])
      const rate = (l) => { let n = 0; for (let i = 0; i < 4000; i++) if (stageLands(l)) n++; return n / 4000 }
      return { odds, perfect: rate('PERFECT'), good: rate('GOOD'), miss: rate('MISS'), src: [...document.scripts].length }
    })
    assert.equal(r.odds[0], 1, 'a PERFECT cast always lands')
    assert.ok(r.odds.every((p, i) => i === 0 || (p < r.odds[i - 1] && p > 0)), `worse timing, likelier to fail, never certain to: ${r.odds}`)
    assert.equal(r.perfect, 1); assert.ok(r.good > 0.55 && r.good < 0.75 && r.miss < 0.3, `rolled rates: GOOD ${r.good}, MISS ${r.miss}`)
    const src = await (await import('node:fs/promises')).readFile(new URL('../../public/rpg/game.js', import.meta.url), 'utf8')
    assert.ok(!/stage\((me|foe), '(eva|acc)', acc\.crit \? -?2/.test(src), 'a PERFECT Double Team or Smokescreen no longer moves two steps')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('stat boosts: your stat moves never double, may fail short of PERFECT, top out at +4, and fade a stage per foe knocked out', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => ({ cap: BOOST_CAP, keys: BOOST_KEYS }))
    assert.equal(r.cap, 4); assert.deepEqual(r.keys, ['atk', 'def', 'spa', 'spd', 'spe'])
    const src = await (await import('node:fs/promises')).readFile(new URL('../../public/rpg/game.js', import.meta.url), 'utf8')
    assert.match(src, /n = acc\.label === 'PERFECT' && user !== me \? 2 : 1/, '1v1: only the foe\'s PERFECT doubles a stat move')
    assert.match(src, /if \(user === me && !stageLands\(acc\.label\)\) return false/, '1v1: yours may fail short of PERFECT')
    assert.match(src, /strong && !mine \? 2 : 1/, '2v2: yours never double')
    assert.match(src, /async function fadeBoosts\(\)/, '1v1: boosts fade on a knockout')
    assert.match(src, /wore down a little/, 'and the battle says so')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('Eevee learns Fairy Wind at Lv 25; with it equipped and a full Bond it becomes Sylveon, without it Espeon or Umbreon', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const lv = Object.fromEntries(levelMoves(speciesByName('EEVEE')).map(([l, n]) => [n, l]))
      const mk = (equip) => {
        const m = { ...structuredClone(speciesByName('EEVEE')), level: 30, bond: BOND_FULL, hp: 100 }
        learn(m); if (!m.learned.includes('FAIRY WIND')) m.learned.push('FAIRY WIND')
        m.moves = equip ? [m.moves[0], 'FAIRY WIND', ...m.moves.slice(1, 3)] : m.moves.filter((n) => n !== 'FAIRY WIND')
        return evoDue(m)?.to ?? null
      }
      return { at: lv['FAIRY WIND'], equipped: mk(true), learnedOnly: mk(false), text: evoText({ ...speciesByName('EEVEE'), level: 5 }) }
    })
    assert.equal(r.at, 25, 'Eevee learns Fairy Wind at Lv 25')
    assert.equal(r.equipped, 'SYLVEON', 'equipped and a full Bond: Sylveon')
    assert.ok(['ESPEON', 'UMBREON'].includes(r.learnedOnly), `learned but not equipped: Espeon or Umbreon by the time of day (${r.learnedOnly})`)
    assert.match(r.text, /Sylveon at full Bond, with a Fairy move equipped/i)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('mini-game inputs: streams are tracked, blasts charged, combos swiped, Dig and Waterfall mashed; Phantom Force vanishes, Stone Edge picks', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => Object.fromEntries(['FLAMETHROWER', 'THUNDERBOLT', 'BUG BUZZ', 'DRAGON PULSE', 'DARK PULSE', 'SHADOW BALL', 'ENERGY BALL', 'MOONBLAST', 'EARTH POWER',
      'PLAY ROUGH', 'DYNAMIC PUNCH', 'POISON JAB', 'AIR SLASH', 'MEGAHORN', 'DIG', 'WATERFALL', 'PHANTOM FORCE', 'STONE EDGE', 'BODY SLAM', 'CRUNCH'].map((n) => [n, MOVEDEX[n].input ?? 'ring'])))
    for (const n of ['FLAMETHROWER', 'THUNDERBOLT', 'BUG BUZZ', 'DRAGON PULSE', 'DARK PULSE']) assert.equal(r[n], 'track', n)
    for (const n of ['SHADOW BALL', 'ENERGY BALL', 'MOONBLAST', 'EARTH POWER']) assert.equal(r[n], 'charge', n)
    for (const n of ['PLAY ROUGH', 'DYNAMIC PUNCH', 'POISON JAB', 'AIR SLASH', 'MEGAHORN']) assert.equal(r[n], 'swipe', n)
    assert.equal(r.DIG, 'mash'); assert.equal(r.WATERFALL, 'mash'); assert.equal(r['PHANTOM FORCE'], 'vanish'); assert.equal(r['STONE EDGE'], 'pick')
    assert.equal(r['BODY SLAM'], 'ring'); assert.equal(r.CRUNCH, 'ring', 'simpler 2-PP moves keep the plain ring')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a Pokémon of two types learns moves of its second type too (Lv 8, 22, 38), and a loaded save catches up on ones it has passed', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const r = await g.page.evaluate(() => {
      const at = (n) => Object.fromEntries(levelMoves(speciesByName(n)).map(([lv, m]) => [m, lv]))
      const h = at('HOUNDOUR'), b = at('BULBASAUR'), p = at('PIDGEY')
      const old = { ...structuredClone(speciesByName('HOUNDOUR')), level: 30, learned: ['TACKLE', 'BITE'] }
      catchUpMoves(old)
      return {
        houndour: [h.EMBER, h['FIRE FANG'], h.FLAMETHROWER, h.CRUNCH], bulbasaur: [b['POISON STING'], b['POISON JAB'], b['SLUDGE BOMB']], pidgey: [p.GUST, p['WING ATTACK'], p['AIR SLASH']],
        caughtUp: ['EMBER', 'FIRE FANG', 'SNARL'].every((m) => old.learned.includes(m)), notYet: old.learned.includes('FLAMETHROWER'),
        once: Object.values(DATA.wild.concat(DATA.starters)).every((s) => { const l = levelMoves(s).map(([, m]) => m); return l.length === new Set(l).size }),
      }
    })
    assert.deepEqual(r.houndour, [8, 22, 38, 45])
    assert.deepEqual(r.bulbasaur, [8, 22, 38])
    assert.deepEqual(r.pidgey, [8, 22, 38])
    assert.ok(r.caughtUp && !r.notYet, 'a Lv 30 Houndour from an old save gets Ember, Fire Fang and Snarl, not yet Flamethrower')
    assert.ok(r.once, 'no move is listed twice')
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

test('boxes: an old save fills Box 1 then 2, and you can switch boxes, sort, move one across and deposit', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.waitForTimeout(600)
    await page.evaluate(() => {
      const mk = (n, lv) => { const m = individual(speciesByName(n), lv, Math.random); m.hp = m.stats.hp; learn(m); return m }
      const names = ['PIDGEY', 'RATTATA', 'ZUBAT', 'GEODUDE', 'ODDISH', 'MAGIKARP', 'ABRA', 'EEVEE']
      const party = names.slice(0, 6).map((n) => mk(n, 20))
      const box = Array.from({ length: 40 }, (_, i) => mk(names[i % names.length], 5 + (i * 7) % 40))   // a save from before boxes: no boxNo
      localStorage.setItem('vvm-save', JSON.stringify({ v: 1, at: Date.now(), party, box, bag: {}, wallet: 5, badges: [], champion: false, eliteStep: 0, gifted: true, roam: {}, weekShift: 0, reports: {} }))
    })
    await page.click('#mPlay')
    await page.waitForFunction(() => window.__vvm?.party?.length === 6, null, { timeout: 10000 })
    await page.waitForTimeout(800)
    const open = async () => { await page.evaluate(() => { document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tBox').click() }); await page.waitForSelector('#sheet.open .boxnav') }
    const shown = () => page.evaluate(() => ({
      title: document.querySelector('.boxnav b').textContent, count: document.querySelector('.boxnav span').textContent,
      rows: document.querySelectorAll('#sheetBody .boxrow').length - window.__vvm.party.length,
      levels: [...document.querySelectorAll('#sheetBody .boxrow')].slice(window.__vvm.party.length).map((r) => +r.querySelector('.nm span').textContent.match(/Lv (\d+)/)[1]),
      tabs: [...document.querySelectorAll('.boxtabs button')].map((b) => b.querySelector('i').textContent),
    }))
    await open()
    let r = await shown()
    assert.deepEqual([r.title, r.count, r.rows], ['BOX 1', '30/30', 30], 'the first 30 fill Box 1')
    assert.deepEqual(r.tabs, ['30', '10', '0', '0', '0', '0', '0', '0'], 'eight boxes; the other 10 went to Box 2')
    await page.click('[data-boxgo="1"]'); r = await shown()
    assert.deepEqual([r.title, r.rows], ['BOX 2', 10])
    await page.click('[data-boxsort="level"]'); r = await shown()
    assert.deepEqual(r.levels, [...r.levels].sort((a, b) => b - a), 'sorted by level, highest first')
    // A Pokémon's page: move it to Box 5.
    await page.evaluate(() => document.querySelectorAll('#sheetBody .boxrow .boxmon')[window.__vvm.party.length].click())
    await page.click('[data-moveto="4"]')
    assert.match(await page.textContent('#sheetBody .toast'), /moved to BOX 5/)
    await page.click('[data-back]'); r = await shown()
    assert.deepEqual([r.title, r.rows, r.tabs[4]], ['BOX 2', 9, '1'])
    await page.click('[data-boxto="4"]'); r = await shown()
    assert.deepEqual([r.title, r.rows], ['BOX 5', 1], 'a tab jumps straight to its box')
    // Deposit from the party: into the box being looked at.
    await page.click('[data-deposit="5"]')
    assert.match(await page.textContent('#sheetBody .toast'), /went to BOX 5/); r = await shown()
    assert.equal(r.rows, 2)
    // Box 1 is full: a deposit there goes to the next box with room.
    await page.click('[data-boxto="0"]'); await page.click('[data-deposit="4"]')
    assert.match(await page.textContent('#sheetBody .toast'), /went to BOX 2/)
    const saved = await page.evaluate(() => { window.__saveNow(); const s = JSON.parse(localStorage.getItem('vvm-save')); return { at: s.boxAt, sort: s.boxSort, nos: s.box.map((m) => m.boxNo) } })
    assert.equal(saved.sort, 'level'); assert.equal(saved.at, 1)
    assert.deepEqual([0, 1, 4].map((b) => saved.nos.filter((n) => n === b).length), [30, 10, 2], 'each Pokémon\'s box is in the save')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('played, the sound log keeps only its recent end, so it never grows for as long as the game is open', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(500)
    const n = await page.evaluate(() => { for (let i = 0; i < 5000; i++) Sound.sfx('click'); return window.__audioLog.length })
    assert.ok(n <= 3000, `${n} entries`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the wild pool turns over at midnight on Monday in Seattle, and its countdown points there', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(500)
    const at = async (iso) => { await page.clock.setFixedTime(new Date(iso)); return page.evaluate(() => ({ week: window.__vvm.thisWeek(), next: window.__vvm.nextRotation() })) }
    // 1 Nov 2026 is a Sunday, after the clocks went back: Seattle is UTC-8.
    const sunAfternoon = await at('2026-11-01T23:30:00Z')   // Sunday 3:30 pm in Seattle: Monday already in UTC
    const sunLate = await at('2026-11-02T07:59:00Z')        // Sunday 11:59 pm
    const monEarly = await at('2026-11-02T08:01:00Z')       // Monday 12:01 am
    const monLater = await at('2026-11-02T18:00:00Z')       // Monday 10 am: this morning stays this week
    assert.equal(sunAfternoon.week, sunLate.week, 'Sunday afternoon in Seattle is still last week (it used to turn over here, at midnight UTC)')
    assert.equal(monEarly.week, sunLate.week + 1, 'it turns over at midnight on Monday in Seattle')
    assert.equal(monLater.week, monEarly.week, 'and stays turned over through Monday')
    assert.ok(Math.abs(sunLate.next - 60e3) < 2000, `the countdown points at that midnight (${sunLate.next} ms to go at 11:59 pm)`)
    assert.ok(monEarly.next > 6.9 * 864e5, 'and then a week on')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('everyday trainers grow up with you: evolved teams late, their earliest stages retired, three or four Pokémon', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const v = window.__vvm, at = (lv) => { const m = individual(speciesByName('CHARMANDER'), lv, Math.random); m.hp = m.stats.hp; v.party.splice(0, 9, m); v.badges.splice(0, 99, ...Array.from({ length: 16 }, (_, i) => i)) }
      const out = {}
      for (const lv of [10, 35, 60]) {
        at(lv)
        out[lv] = v.SCALPERS.map((T) => { const decks = Array.from({ length: 12 }, () => v.deckFor(T, lv)); return { who: T.short, sizes: [...new Set(decks.map((d) => d.length))], names: [...new Set(decks.flat().map((m) => m.name))], missing: decks.flat().filter((m) => !m?.stats).length } })
      }
      return out
    })
    for (const t of r[10]) assert.ok(t.sizes.every((n) => n === 2 || n === 3), `${t.who} at Lv 10 brings two or three (${t.sizes})`)
    for (const t of r[60]) {
      assert.ok(t.sizes.every((n) => n === 3 || n === 4), `${t.who} at Lv 60 brings three or four (${t.sizes})`)
      assert.equal(t.missing, 0)
    }
    const late = Object.fromEntries(r[60].map((t) => [t.who, t.names]))
    assert.ok(!late.ROSE.includes('SKITTY') && !late.TYLER.includes('PIKACHU') && !late.DEREK.includes('PATRAT'), 'the earliest stages have retired by Lv 60')
    assert.ok(late.TYLER.includes('ELECTIVIRE') || late.TYLER.includes('JOLTEON') || late.TYLER.includes('RAICHU'), `Tyler's late team is evolved: ${late.TYLER}`)
    assert.ok(late.MARCUS.includes('MACHAMP') || late.MARCUS.includes('ARCANINE'), `Marcus's: ${late.MARCUS}`)
    assert.ok(!r[10].find((t) => t.who === 'DEREK').names.includes('PORYGON-Z'), 'and none of it turns up early')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('gym rematches: every leader comes back fully evolved, at your level', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const v = window.__vvm, m = individual(speciesByName('CHARMANDER'), 60, Math.random); m.hp = m.stats.hp; v.party.splice(0, 9, m)
      return GYMS.map((L) => ({ who: L.short, before: L.team, after: v.rematchTeam(L).map((x) => `${x.name} ${x.level}`), ok: v.rematchTeam(L).every((x) => x.stats && ART[x.id]) }))
    })
    for (const t of r) {
      assert.ok(t.ok, `${t.who}'s rematch team is real species with sprites`)
      assert.equal(+t.after.at(-1).split(' ').at(-1), 62, `${t.who}'s ace is two above your best (${t.after})`)
    }
    const falkner = r.find((t) => t.who === 'FALKNER').after.map((x) => x.split(' ')[0])
    assert.ok(!falkner.includes('PIDGEY') && falkner.some((n) => n === 'PIDGEOT' || n === 'NOCTOWL'), `Falkner's birds have evolved: ${falkner}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the daily challenge: one type a day, the same all day, four fully evolved Pokémon of it', async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.click('#mPlay'); await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const v = window.__vvm, days = Array.from({ length: 14 }, (_, i) => `2026-11-${String(i + 1).padStart(2, '0')}`)
      const cs = days.map((d) => v.dailyChallenge(d))
      return { same: JSON.stringify(v.dailyChallenge('2026-11-02')) === JSON.stringify(v.dailyChallenge('2026-11-02')),
        types: [...new Set(cs.map((c) => c.type))].length,
        bad: cs.flatMap((c) => c.team.filter((n) => { const sp = speciesByName(n); return !sp || !sp.types.includes(c.type) || v.finalForm(n) !== n }).map((n) => `${c.day} ${c.type}: ${n}`)),
        sizes: [...new Set(cs.map((c) => new Set(c.team).size))], who: cs.every((c) => c.who?.vs) }
    })
    assert.ok(r.same, 'the same challenge all day')
    assert.ok(r.types >= 6, `it changes from day to day (${r.types} types in 14 days)`)
    assert.deepEqual(r.bad, [], 'every Pokémon is of the day\'s type, and fully evolved')
    assert.deepEqual(r.sizes, [4], 'four different ones to draw from'); assert.ok(r.who)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('Ditto keeps Transform equipped as it levels', async () => {
  const g = await openGame()
  try {
    const r = await g.page.evaluate(() => [5, 20, 40, 70].map((lv) => { const m = individual(speciesByName('DITTO'), lv, Math.random); learn(m); return { lv, moves: m.moves, n: m.moves.length } }))
    for (const x of r) { assert.ok(x.moves.includes('TRANSFORM'), `Lv ${x.lv}: ${x.moves}`); assert.ok(x.n <= 4) }
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

