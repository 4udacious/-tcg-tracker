// The battle game in a real browser: a Potion on the bench, Herb's first story battle, and the Pokémon Center's free and paid heals, played.
// Part of `npm run test:rpg` (see game.test.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'

const quick = !!process.env.RPG_QUICK

test('the Pokémon Center: three free heals a day, then paid ones; back the next day, and kept in the save', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    const heal = async () => {
      for (let i = 0; i < 20 && !(await page.$('#sheet.open #sheetBody [data-heal]')); i++) {
        await page.waitForTimeout(400)
        await page.evaluate(() => { for (const m of window.__vvm.party) m.hp = 1; document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tParty').click() })
      }
      const before = await page.evaluate(() => ({ off: document.querySelector('[data-heal]').disabled, text: document.querySelector('[data-heal] small').textContent, wallet: window.__vvm.wallet }))
      if (!before.off) await page.evaluate(() => document.querySelector('[data-heal]').click())
      await page.waitForFunction(() => !/Paying/.test(document.querySelector('#sheetBody .toast')?.textContent ?? ''))   // a paid heal settles
      const after = await page.evaluate(() => ({ full: window.__vvm.party.every((m) => m.hp === m.stats.hp), text: document.querySelector('[data-heal] small').textContent, toast: document.querySelector('#sheetBody .toast')?.textContent ?? '', wallet: window.__vvm.wallet }))
      await page.evaluate(() => document.getElementById('sheetClose').click()); await page.waitForTimeout(300)
      return { before, after }
    }
    await page.evaluate(() => document.getElementById('home').click())   // back to idle from the screen the tutorial ends on
    const price = await page.evaluate(() => window.__vvm.healPrice)
    for (let n = 1; n <= 3; n++) {
      const h = await heal()
      assert.equal(h.before.off, false, `free heal ${n} is there`)
      assert.match(h.before.text, new RegExp(`free — ${4 - n} left today`))
      assert.ok(h.after.full, `free heal ${n} heals the party`); assert.equal(h.after.wallet, h.before.wallet, 'and costs nothing')
    }
    // The fourth: paid.
    const paid = await heal()
    assert.equal(paid.before.off, false, 'after the free ones, a heal can still be bought')
    assert.match(paid.before.text, new RegExp(`for ${price.toFixed(2)} tk`))
    assert.ok(paid.after.full, 'the paid heal heals the party')
    assert.equal(paid.after.wallet, Math.round((paid.before.wallet - price) * 100) / 100, 'and takes the price from your tokens')
    assert.match(paid.after.toast, /That was 0\.50 tk/)
    const today = await page.evaluate(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }))
    const saved = await page.evaluate((d) => Object.values(localStorage).some((v) => v.includes(`"heals":{"day":"${d}","used":4}`)), today)
    assert.ok(saved, "today's heals are in the save")
    await page.evaluate(() => window.__vvm.setHeals({ day: '2000-01-01', used: 9 }))   // as if they were used on an earlier day
    const nextDay = await heal()
    assert.match(nextDay.before.text, /free — 3 left today/, 'a new day brings the free heals back')
    assert.equal(nextDay.after.wallet, nextDay.before.wallet)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('glitchers: after two badges, Herb is at the machine on your next tap; the battle plays and is saved', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    const before = await page.evaluate(() => { const v = window.__vvm; v.setRival(1); const was = v.storyDue(); v.badges.push(0, 1); for (const m of v.party) m.hp = m.stats.hp; return { was, now: v.storyDue(), alex: v.rivalDue() } })
    assert.deepEqual(before, { was: null, now: 'HERB', alex: false }, 'Herb\'s first battle is due after two badges')
    assert.ok(await bot.encounter(''), 'a battle happened on the next tap')
    const r = await page.evaluate(() => ({ herb: { ...window.__vvm.story.HERB }, music: window.__audioLog.filter((e) => e.kind === 'music').map((e) => e.name),
      saved: Object.values(localStorage).some((v) => v.includes('"story":{"HERB":{"step"')) }))
    assert.ok(r.music.includes('vs') && r.music.includes('gym'), `the encounter music, then the battle theme: ${r.music.join(', ')}`)
    if (r.herb.step === 1) assert.deepEqual(r.herb, { step: 1, wait: 0, lost: false }, 'won: on to battle 2')
    else assert.deepEqual(r.herb, { step: 0, wait: 3, lost: true }, 'lost: the same battle again, a few taps later')
    assert.ok(r.saved, 'Herb\'s progress is in the save')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('in battle, a Potion can go to a Pokémon on the bench, in 1v1 and 2v2', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    const shown = (p) => page.evaluate((p) => getComputedStyle(document.getElementById(p)).display !== 'none' && !!document.querySelector(`#${p} [data-act]`), p)
    const tap = (sel) => page.dispatchEvent(sel, sel.startsWith('#pBag [data-act="potion"]') ? 'click' : 'pointerdown')   // (the Bag's scrolling list answers clicks)
    /** A team: the first ones full, the last on 1 HP; a Potion in the Bag; then a tap for `kind`, up to the command menu. */
    async function setUp(kind, names) {
      await page.evaluate((names) => {
        const v = window.__vvm
        v.party.splice(0, 9, ...names.map((n) => { const m = individual(speciesByName(n), 20, Math.random); m.hp = m.stats.hp; return m }))
        v.party.at(-1).hp = 1; v.bag.potion = 1; v.renderTools()
      }, names)
      await page.selectOption('#nextTap', kind); await page.evaluate(() => document.activeElement?.blur())
      for (let tries = 0; tries < 5 && !(await shown('pMain')); tries++) {
        await page.evaluate(() => document.getElementById('home').click())
        for (let i = 0; i < 40 && !(await shown('pMain')); i++) { await page.keyboard.press('x'); await page.waitForTimeout(250) }
      }
      assert.ok(await shown('pMain'), `${kind}: the command menu came up`)
    }
    const hurtHp = () => page.evaluate(() => window.__vvm.party.at(-1).hp)

    // 1v1: the one out is at full HP, so the Potion goes to the bench, chosen from your party.
    await setUp('wild', ['PIKACHU', 'EEVEE'])
    await tap('#pMain [data-act="bag"]'); await page.waitForTimeout(300)
    assert.doesNotMatch(await page.getAttribute('#pBag [data-act="potion"]', 'class'), /\boff\b/, 'the Potion is usable: someone on the bench is hurt')
    await tap('#pBag [data-act="potion"]'); await page.waitForTimeout(300)
    assert.ok(await shown('pParty'), 'it asks which Pokémon')
    assert.match(await page.textContent('#pParty'), /EEVEE/); assert.doesNotMatch(await page.textContent('#pParty'), /PIKACHU/, 'only the ones it can help')
    await tap('#pParty [data-act="r0"]')
    for (let i = 0; i < 20 && (await hurtHp()) === 1; i++) await page.waitForTimeout(200)
    assert.ok((await hurtHp()) > 1, 'the benched EEVEE recovered HP')
    assert.equal(await page.evaluate(() => window.__vvm.bag.potion), 0)
    for (let i = 0; i < 400; i++) { await bot.step(); if (!(await bot.inBattle()) && (await bot.atHome())) break }

    // 2v2: two out, one on the bench on 1 HP; the Potion's only target is the bench, so it goes straight there.
    await setUp('duo', ['PIKACHU', 'EEVEE', 'PSYDUCK'])
    await tap('#pMain [data-act="bag"]'); await page.waitForTimeout(300)
    await tap('#pBag [data-act="potion"]'); await page.waitForTimeout(300)
    for (let i = 0; i < 300 && (await hurtHp()) === 1 && (await bot.inBattle()); i++) await bot.step()
    assert.ok((await hurtHp()) > 1, 'the benched PSYDUCK recovered HP in the 2v2')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
