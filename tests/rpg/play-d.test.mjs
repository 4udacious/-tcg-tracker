// The battle game in a real browser: a Rare Candy, used from the Bag, played.
// Part of `npm run test:rpg` (see game.test.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'

const quick = !!process.env.RPG_QUICK

test('a Rare Candy: one level from the Bag, its new moves, and the evolution it brings', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      const v = window.__vvm, m = individual(speciesByName('CHARMANDER'), 15, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      v.party.splice(0, 9, m); v.bag.rarecandy = 2; v.renderTools()
      document.getElementById('home').click()   // back to idle from the screen the tutorial ends on
    })
    // The Bag's Medicine pocket, the candy, then the Pokémon.
    const open = async () => {
      for (let i = 0; i < 20 && !(await page.$('#sheet.open #sheetBody [data-item="rarecandy"]')); i++) {
        await page.waitForTimeout(400)
        await page.evaluate(() => { document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tBag').click() })
        await page.waitForTimeout(200); await page.evaluate(() => document.querySelector('#sheetBody [data-tab="medicine"]')?.click())
      }
      await page.dispatchEvent('#sheetBody [data-item="rarecandy"]', 'click'); await page.waitForTimeout(200)
      const label = await page.textContent('#sheetBody [data-target="0"]')
      await page.dispatchEvent('#sheetBody [data-target="0"]', 'click'); await page.waitForTimeout(300)
      return label
    }
    const label = await open()
    assert.match(label, /Lv 15 → 16/, 'the target shows the level it goes to')
    // Lv 16: Charmander evolves, on the battle screen once the sheet has closed.
    for (let i = 0; i < 200 && (await page.evaluate(() => window.__vvm.party[0].name)) !== 'CHARMELEON'; i++) await bot.step()
    const after = await page.evaluate(() => ({ name: window.__vvm.party[0].name, level: window.__vvm.party[0].level, candy: window.__vvm.bag.rarecandy }))
    assert.deepEqual(after, { name: 'CHARMELEON', level: 16, candy: 1 }, 'one level, one candy used, and the evolution played')
    for (let i = 0; i < 300 && !(await bot.atHome()); i++) await bot.step()
    await open()
    const last = await page.evaluate(() => ({ level: window.__vvm.party[0].level, candy: window.__vvm.bag.rarecandy ?? 0, toast: document.querySelector('#sheetBody .toast')?.textContent ?? '' }))
    assert.equal(last.level, 17); assert.equal(last.candy, 0)
    assert.match(last.toast, /grew to Lv\. 17/, `the Bag says so: ${last.toast}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a shiny wild Pokémon: its own sprite, a sparkle and its own announcement', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    await page.evaluate(() => { window.__forceShiny = true; for (const m of window.__vvm.party) m.hp = m.stats.hp })
    // The sprite as the announcement shows (it types out, so keep the fullest text seen). A roaming legendary
    // (never shiny) can turn up instead: then try again.
    let found = null
    for (let tries = 0; tries < 4 && !found; tries++) {
      let seen = null
      const watch = setInterval(async () => { try { const t = await page.evaluate(() => [document.getElementById('msg')?.textContent ?? '', document.querySelector('#enemy img')?.getAttribute('src') ?? '']); if (/A wild/.test(t[0]) && (!seen || t[0].length > seen[0].length)) seen = t } catch {} }, 100)
      try { assert.ok(await bot.encounter('wild'), 'a wild battle happened') } finally { clearInterval(watch) }
      await page.evaluate(() => { for (const m of window.__vvm.party) m.hp = m.stats.hp })
      found = seen
    }
    assert.ok(found, 'a wild (not legendary) Pokémon appeared')
    assert.match(found[0], /A wild shiny/, 'the announcement says it is shiny')
    assert.match(found[1], /\/rpg\/a\/shiny\//, `the shiny sprite: ${found[1]}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

