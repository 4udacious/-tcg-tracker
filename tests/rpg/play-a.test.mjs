// The battle game in a real browser: the three Watch demos, and the EXP. SHARE with the Hall of Fame.
// Part of `npm run test:rpg` (see game.test.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'

const quick = !!process.env.RPG_QUICK

for (const [mode, label] of [['demo', 'Watch'], ['duo', 'Watch 2v2'], ['gym', 'Watch gym']]) {
  test(`the ${label} demo plays through`, { skip: quick }, async () => {
    const g = await openGame({ mode })
    try {
      // Watch gym plays on to the win: the badge (a win once froze the game just before it, with no page error).
      const until = mode === 'gym' ? /BADGE/ : /fainted/, secs = mode === 'gym' ? 240 : 120
      const seen = new Set()
      for (let i = 0; i < secs && ![...seen].some((t) => until.test(t)); i++) {
        await g.page.waitForTimeout(1000)
        seen.add(await g.page.evaluate(() => document.getElementById('msg')?.textContent ?? ''))
      }
      assert.ok([...seen].some((t) => until.test(t)), mode === 'gym' ? 'Falkner beaten and the ZEPHYR BADGE given within 240 s' : 'a Pokémon fainted within 120 s')
      assert.deepEqual(g.errors, [])
    } finally { await g.close() }
  })
}

test('the EXP. SHARE switches off and on from the Bag, and after Alex\'s last battle your team goes into the Hall of Fame', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      const v = window.__vvm
      v.bag.expshare = 1
      for (let i = 0; i < 16; i++) if (!v.badges.includes(i)) v.badges.push(i)
      for (const n of ['TYPHLOSION', 'GYARADOS']) { const m = individual(speciesByName(n), 80, Math.random); m.hp = m.stats.hp; v.party.push(m) }
    })
    // The switch: in the Bag's OTHER pocket, kept in the save.
    await page.evaluate(() => document.getElementById('home').click())
    for (let i = 0; i < 20 && !(await page.$('#sheetBody [data-tab]')); i++) {
      await page.waitForTimeout(400)
      await page.evaluate(() => { document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tBag').click() })
    }
    await page.dispatchEvent('#sheetBody [data-tab="other"]', 'click'); await page.waitForTimeout(200)
    assert.match(await page.textContent('#sheetBody [data-share]'), /ON/)
    await page.dispatchEvent('#sheetBody [data-share]', 'click'); await page.waitForTimeout(200)
    const off = await page.evaluate(() => ({ on: window.__vvm.shareOn, row: document.querySelector('#sheetBody [data-share]').textContent, saved: JSON.parse(localStorage.getItem('vvm-save')).shareOn }))
    assert.deepEqual([off.on, off.saved], [false, false], 'switched off, and saved off')
    assert.match(off.row, /OFF/)
    await page.dispatchEvent('#sheetBody [data-share]', 'click'); await page.waitForTimeout(200)
    assert.equal(await page.evaluate(() => window.__vvm.shareOn), true, 'and back on')
    await page.click('#sheetClose').catch(() => {}); await page.waitForTimeout(400)
    // The Hall of Fame: every Pokémon, the badges, the credits, to its own anthem; then kept in the Party sheet.
    const seen = await page.evaluate(async () => {
      const v = window.__vvm, shown = []
      const watch = setInterval(() => { const b = document.querySelector('#hof .hofone b'); if (b && !shown.includes(b.textContent)) shown.push(b.textContent) }, 100)
      const done = v.hallOfFame()
      const tap = setInterval(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })), 700)
      await done; clearInterval(watch); clearInterval(tap)
      return { shown, party: v.party.map((m) => m.name), fame: v.fame, music: window.__audioLog.filter((e) => e.kind === 'music').map((e) => e.name), left: !!document.getElementById('hof'), saved: JSON.parse(localStorage.getItem('vvm-save')).fame }
    })
    assert.deepEqual(seen.shown, seen.party, 'each of your Pokémon in turn')
    assert.deepEqual(seen.fame.team.map((m) => m.name), seen.party)
    assert.deepEqual(seen.saved.team, seen.fame.team, 'the Hall of Fame is saved')
    assert.ok(seen.music.includes('hallOfFame'), 'to its own music')
    assert.equal(seen.left, false, 'and it clears away after')
    assert.equal(await page.evaluate(() => KANTO_ELITE.map((L) => L.introSong).join()), 'e4Lorelei,e4Bruno,e4Agatha,e4KantoLance,', 'the Kanto Elite Four each have their own intro')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('CPU trainers use a Full Heal on a Pokémon with a status, instead of moving', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot, log } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      for (const t of [MOVEDEX, SUPPORT]) for (const k in t) t[k].cost = 0
      const m = individual(speciesByName('CHARMANDER'), 40, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      m.moves = ['SCRATCH', 'TOXIC', 'THUNDER WAVE', 'WILL-O-WISP']; m.learned = [...new Set([...m.learned, ...m.moves])]
      m.stats.atk = m.stats.spa = 1   // a long battle: statuses, not damage
      window.__vvm.party.splice(0, 9, m); window.__forceFoeHeal = true
    })
    bot.want = ['TOXIC', 'THUNDER WAVE', 'WILL-O-WISP', 'SCRATCH']
    // A status has to land first (some Pokémon shrug some off), so up to three battles until one does.
    let lines = []
    for (let i = 0; i < 3 && !lines.some((l) => /used\s*a FULL HEAL!/.test(l)); i++) {
      await page.evaluate(() => { for (const m of window.__vvm.party) { m.hp = m.stats.hp; m.status = null } })
      const from = log.length
      assert.ok(await bot.encounter('scalper', 500), 'a trainer battle happened')
      lines = log.slice(from)
      assert.ok(lines.filter((l) => /used\s*a FULL HEAL!$/.test(l)).length <= 1, 'a regular trainer has just one')
    }
    assert.ok(lines.some((l) => /used\s*a FULL HEAL!/.test(l)), 'the trainer used a Full Heal')
    assert.ok(lines.some((l) => /is no longer\s*(poisoned|badly poisoned|paralyzed|burned)/.test(l)), 'and its Pokémon was cured')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a veteran: an everyday trainer, tougher, for three times the tokens and a pack', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot, log } = g
    await bot.finishTutorial()
    const before = await page.evaluate(() => {
      const m = individual(speciesByName('CHARIZARD'), 70, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      window.__vvm.party.splice(0, 9, m); for (let i = 0; i < 4; i++) window.__vvm.badges.push(i)
      window.__forceVeteran = true
      return window.__vvm.wallet
    })
    const from = log.length
    assert.ok(await bot.encounter('scalper', 500), 'a trainer battle happened')
    const lines = log.slice(from).join(' | ')
    assert.match(await page.evaluate(() => document.getElementById('feedList')?.textContent ?? ''), /beat a veteran: VETERAN /, 'the feed says who')
    assert.match(lines, /handed over/, 'a pack for beating them')
    const after = await page.evaluate(() => window.__vvm.wallet)
    assert.ok(after - before >= 1.5 - 1e-9, `three times their tokens (${(after - before).toFixed(2)})`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('Stone Edge and Phantom Force played: the glowing stone picked, the shadow tapped as it flickers in', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    for (const [move, sp] of [['STONE EDGE', 'TYRANITAR'], ['PHANTOM FORCE', 'GENGAR']]) {
      await page.evaluate(([mv, s]) => {
        MOVEDEX[mv].cost = 0
        const m = individual(speciesByName(s), 60, Math.random); learnAtLevel(m)
        m.moves = ['TACKLE', mv]; if (!m.learned.includes(mv)) m.learned.push(mv); Object.assign(m.stats, { hp: 3000 }); m.hp = 3000
        window.__vvm.party.splice(0, 9, m); window.__forceWild = 'SNORLAX'
      }, [move, sp])
      bot.want = [move]
      const from = g.log.length
      assert.ok(await bot.encounter('wild'), 'a wild battle started')
      const lines = g.log.slice(from)
      assert.ok(lines.some((l) => l.includes(`used${move}`) || l.includes(`used ${move}`)), `${move} was used`)
      assert.ok(lines.some((l) => new RegExp(`${move}!.*(PERFECT|GREAT|GOOD)`).test(l)), `${move} landed: ${lines.filter((l) => l.includes(move)).slice(0, 4).join(' | ')}`)
    }
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a roaming legendary stays for 4 turns before it flees (unless it can\'t move: asleep, it stays), and remembers every ball thrown at it', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      const v = window.__vvm
      const m = individual(speciesByName('SNORLAX'), 100, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      v.party.splice(0, v.party.length, m); v.bag.ball = 20; window.__forceShakes = 0
      // Every line the battle says, kept as it finishes typing (a sampled read can miss a quick one).
      const said = window.__said = [], msg = document.getElementById('msg')
      new MutationObserver(() => { if (said.at(-1) !== msg.textContent) said.push(msg.textContent) }).observe(msg, { childList: true, subtree: true, characterData: true })
    })
    const meetLegend = async () => {
      for (let i = 0; i < 300 && !(await bot.atHome()); i++) await bot.step()
      await page.selectOption('#nextTap', 'legend'); await page.evaluate(() => document.activeElement?.blur())
      let fought = false
      for (let i = 0; i < 40 && !fought; i++) { await page.evaluate(() => document.getElementById('home').click()); await bot.step(); fought = await bot.inBattle() }
      assert.ok(fought, 'a legendary battle started')
    }
    const thrown = () => page.evaluate(() => window.__said.filter((t) => /threw a.*BALL!$/.test(t)).length)
    /** Every turn, a ball: open the Bag, pick the Poké Ball, then let the bot time the throw. Until the battle ends, or `upTo` balls. */
    const throwBalls = async (upTo = Infinity) => {
      const from = await thrown()
      for (let i = 0; i < 400 && (await bot.inBattle()) && (await thrown()) - from < upTo; i++) {
        const tapped = await page.evaluate(() => {
          const shown = (id) => { const p = document.getElementById(id); return p && p.style.display !== 'none' && p.offsetParent }
          const tap = (sel, type = 'pointerdown') => { const b = document.querySelector(sel); if (!b) return false; b.dispatchEvent(new (type === 'click' ? MouseEvent : PointerEvent)(type, { bubbles: true })); return true }
          if (shown('pBag')) return tap('#pBag [data-act="ball"]', 'click')   // the Bag's scrolling list answers clicks
          if (shown('pMain')) return tap('#pMain [data-act="bag"]')
          return false
        })
        if (tapped) await page.waitForTimeout(300); else await bot.step()
      }
    }
    await meetLegend()
    // Other trainers' taps can throw at the roamers too, so count from here.
    const before = await page.evaluate(() => Object.fromEntries(Object.entries(window.__vvm.ROAM).map(([k, m]) => [k, m.balls ?? 0])))
    await throwBalls()
    const r = await page.evaluate(() => Object.fromEntries(Object.entries(window.__vvm.ROAM).map(([k, m]) => [k, { turn: m.turn, balls: m.balls ?? 0, hp: m.hp }])))
    const said = await page.evaluate(() => window.__said.slice())
    const name = Object.keys(r).find((k) => r[k].turn != null), met = r[name]
    assert.ok(said.some((t) => /fled!/.test(t)), 'it fled')
    assert.equal(met.turn, 4, 'after four turns of attacking')
    assert.equal(met.balls - before[name], 5, 'a ball each turn, and one more as it fled: all five remembered')
    assert.ok(said.some((t) => /is tiring!/.test(t)), 'and you\'re told each one helps')
    // The count is saved with it, for whoever meets it next.
    const saved = await page.waitForFunction((n) => JSON.parse(localStorage.getItem('vvm-save') ?? '{}').roam?.[n]?.balls, name, { timeout: 15000 }).then((h) => h.jsonValue()).catch(() => null)
    assert.equal(saved, met.balls)
    // Running is its move for the turn: fast asleep, it can't, however long the battle goes.
    await page.evaluate(() => { for (const m of Object.values(window.__vvm.ROAM)) { m.status = 'slp'; m.sleep = 99 } window.__said.length = 0 })
    await meetLegend()
    await throwBalls(7)
    const asleep = await page.evaluate(() => ({ said: window.__said.slice() }))
    assert.ok(await bot.inBattle(), 'still there after seven balls')
    assert.ok(!asleep.said.some((t) => /fled!/.test(t)) && asleep.said.some((t) => /fast asleep/.test(t)), 'asleep, and it never ran')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
