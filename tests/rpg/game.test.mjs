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
    assert.equal(r.sing.perfect, 1); assert.equal(r.sing.miss, 0); assert.ok(r.sing.good > 0.5 && r.sing.good < 0.7, `Sing on GOOD: ${r.sing.good}`)
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

test('in the app: the real machine, checkout, packs and tokens go through the bridge', async () => {
  const g = await openGame()
  try {
    const { page } = g
    // A stand-in for PlayFrame's bridge (lib/vending/gameBridge.ts) on the parent, and the game in a same-origin frame.
    await page.evaluate(() => {
      const calls = window.__calls = []
      let balance = 10, owned = { potion: 2, move_disc: 1 }
      window.__vvmApi = {
        async machine() { calls.push(['machine']); return { status: 'in_stock', cycle_no: 7, holder_id: null, holder_name: null, holder_expires: null, me: 'u1', cooldown_until: null, balance, wild: false, trainers: false,
          packs: [{ set_code: 'base2', set_name: 'Jungle', image: '/rpg/a/jungle-scyther.webp', quantity: 3, description: null }], tickets: [],
          supplies: [{ key: 'great_ball', kind: 'item', name: 'Great Ball', description: 'Catch rate ×1.5', price: 0.4, contents: null }] } },
        async balance() { return balance },
        async claim() { calls.push(['claim']); return { ok: true, reason: 'ok', holder_name: null, expires_at: null } },
        async heartbeat() { calls.push(['heartbeat']) },
        async release() { calls.push(['release']) },
        async checkout(packs, tickets, supplies) {
          calls.push(['checkout', packs, tickets, supplies])
          balance -= packs.reduce((a, p) => a + p.qty, 0) + supplies.reduce((a, s) => a + s.qty * 0.4, 0)
          for (const s of supplies) owned[s.key] = (owned[s.key] ?? 0) + s.qty
          return { ok: true, reason: 'ok', packs_bought: 1, tickets_bought: 0, supplies_bought: 1, balance, restocked: false }
        },
        async takeItems(keys) { calls.push(['take', keys]); const out = keys.filter((k) => owned[k]).map((k) => ({ key: k, qty: owned[k] })); for (const k of keys) delete owned[k]; return out },
        async awardPack(source) { calls.push(['awardPack', source]); return { ok: true, reason: 'ok', set_name: 'Fossil', pack_name: 'Lapras', image_url: '/packs/x.webp', left_today: 2 } },
        async awardTokens(amount, source) { calls.push(['awardTokens', amount, source]); balance += Math.min(amount, 1); return { ok: true, reason: 'ok', awarded: Math.min(amount, 1), balance } },
        async loadSave() { calls.push(['loadSave']); return null },
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
    // Neither kind of battle is live (admin switches): no battle switches, and even a tap pinned to a wild Pokémon
    // claims the real machine and shows its shelf.
    assert.deepEqual(await frame.evaluate(() => [document.getElementById('bWild').hidden, document.getElementById('bTrainers').hidden]), [true, true])
    await frame.evaluate(() => { document.getElementById('nextTap').value = 'wild'; document.getElementById('home').click() })
    await frame.waitForSelector('[data-buy="set:base2"]', { timeout: 10000 }); await page.waitForTimeout(1200)   // the screen finishes fading in
    await frame.evaluate(() => { for (const k of ['set:base2', 'sup:great_ball']) document.querySelector(`[data-buy="${k}"]`).click() })
    await frame.evaluate(() => document.getElementById('cbGo').click())
    await frame.waitForSelector('[data-co="pay"]:not([disabled])'); await frame.evaluate(() => document.querySelector('[data-co="pay"]').click())
    await frame.waitForFunction(() => window.__vvm.bag.great === 1, null, { timeout: 10000 })
    const pack = await frame.evaluate(() => window.__vvm.givePack('trainer'))
    assert.equal(pack, 'a FOSSIL PACK')
    const calls = await page.evaluate(() => window.__calls)
    const co = calls.find((c) => c[0] === 'checkout')
    assert.deepEqual(co.slice(1), [[{ set_code: 'base2', qty: 1 }], [], [{ key: 'great_ball', qty: 1 }]])
    assert.ok(calls.some((c) => c[0] === 'claim')); assert.ok(calls.some((c) => c[0] === 'awardPack' && c[1] === 'trainer'))
    assert.deepEqual(calls.find((c) => c[0] === 'putSave'), ['putSave', null], 'a browser save from before goes up to the account')
    assert.equal(await frame.evaluate(() => document.getElementById('wallet').textContent), '8.60 tk')
    assert.equal(await frame.evaluate(() => getComputedStyle(document.getElementById('battleL')).display), 'none', 'no battle happened')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

for (const [mode, label] of [['demo', 'Watch'], ['duo', 'Watch 2v2'], ['gym', 'Watch gym']]) {
  test(`the ${label} demo plays through`, { skip: quick }, async () => {
    const g = await openGame({ mode })
    try {
      const seen = new Set()
      for (let i = 0; i < 120 && ![...seen].some((t) => /fainted/.test(t)); i++) {
        await g.page.waitForTimeout(1000)
        seen.add(await g.page.evaluate(() => document.getElementById('msg')?.textContent ?? ''))
      }
      assert.ok([...seen].some((t) => /fainted/.test(t)), 'a Pokémon fainted within 120 s')
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

test('music: every song\'s parts line up, and every note and chord reads', async () => {
  const g = await openGame()
  try {
    await g.page.waitForTimeout(800)
    const problems = await g.page.evaluate(() => {
      const out = []
      for (const [name, s] of Object.entries(SONGS)) {
        const parts = s.sections ? [...(s.intro ? [['intro', { ...s, ...s.intro }]] : []), ...s.sections.map((x, k) => [`section ${k + 1}`, { ...s, ...x }])] : [['', s]]
        for (const [label, p] of parts) {
          const where = `${name}${label ? ` (${label})` : ''}`, L = p.lead.length
          if (p.bass?.length && p.bass.length !== L) out.push(`${where}: bass ${p.bass.length} steps, lead ${L}`)
          if (p.drums.length !== L) out.push(`${where}: drums ${p.drums.length} steps, lead ${L}`)
          if (p.chords && p.chords.length * p.chordLen < L) out.push(`${where}: chords cover ${p.chords.length * p.chordLen} of ${L} steps`)
          for (const n of [...p.lead, ...(p.bass ?? [])]) if (n !== '.' && n !== '-' && Number.isNaN(MIDI(/^(.+?)([~^v!]?)$/.exec(n)[1]))) out.push(`${where}: note ${n}`)
          for (const c of p.chords ?? []) if (!/^([A-G][#b]?)(m|dim|aug)?(maj7|7)?$/.test(c)) out.push(`${where}: chord ${c}`)
        }
      }
      // The League's music, as the Elite Four battles play it: each member's intro, then the Elite Four or Champion theme.
      for (const n of [...Object.values(LEAGUE_INTRO), 'elite', 'champion', 'gym']) if (!SONGS[n]) out.push(`missing song ${n}`)
      if (ELITE.some((L) => !LEAGUE_INTRO[L.short.toLowerCase()])) out.push('a League member without an intro')
      return out
    })
    assert.deepEqual(problems, [])
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
