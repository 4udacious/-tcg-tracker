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

test('a wild Ditto transforms on its first turn, into your Pokémon', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot, log } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      const m = individual(speciesByName('CHARMANDER'), 20, Math.random); m.hp = m.stats.hp; learnAtLevel(m)
      m.stats.atk = m.stats.spa = 1   // weak hits, so the Ditto always lives to take its first turn
      window.__vvm.party.splice(0, 9, m); window.__forceWild = 'DITTO'
    })
    const from = log.length
    assert.ok(await bot.encounter('wild'), 'a wild battle started')
    // The log can catch a line mid-typewriter; keep each line once it's whole (the next one doesn't just continue it).
    const seen = log.slice(from), lines = seen.filter((l, i) => !(seen[i + 1] ?? '').startsWith(l)), firstFoe = lines.find((l) => /The wild DITTO used/.test(l))
    assert.match(firstFoe ?? '', /TRANSFORM/, 'the first thing the wild Ditto does is Transform')
    assert.ok(lines.some((l) => /DITTO transformed/.test(l) && /CHARMANDER/.test(l)), 'it transformed into your Charmander')
    assert.ok(!lines.some((l) => /The wild DITTO used/.test(l) && /TACKLE/.test(l)), 'and then fought with fire moves, not Tackle')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the foe\'s HP bar always shows its HP, Pokémon after Pokémon', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      const mk = (n) => { const m = individual(speciesByName(n), 30, Math.random); m.hp = m.stats.hp; learnAtLevel(m); return m }
      window.__vvm.party.splice(0, 9, mk('CHARMANDER'), mk('SQUIRTLE'), mk('PIKACHU'))
      window.__hpBad = []; window.__hpSeen = 0
      // Whenever you're asked for a move, the bar's width matches the foe's HP.
      window.__hpWatch = setInterval(() => {
        const f = window.__battleFoe?.(); if (!f || !/What will/.test(document.getElementById('msg')?.textContent ?? '')) return
        const bar = document.getElementById('ehp'), shown = bar.getBoundingClientRect().width / bar.parentElement.getBoundingClientRect().width
        window.__hpSeen++
        if (Math.abs(shown - f.hp / f.max) > 0.08) window.__hpBad.push(`${f.name} ${f.hp}/${f.max} shown ${(shown * 100).toFixed(0)}%`)
      }, 300)
    })
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { for (const m of window.__vvm.party) { m.hp = m.stats.hp; m.status = null } })
      await bot.encounter('scalper', 400)
    }
    const r = await page.evaluate(() => { clearInterval(window.__hpWatch); return { bad: window.__hpBad, seen: window.__hpSeen } })
    assert.ok(r.seen >= 3, `checked at ${r.seen} move prompts`)
    assert.deepEqual(r.bad.slice(0, 5), [], 'the bar matched the foe\'s HP every time')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a paralyzed Pokémon can\'t parry, dodge or jump: a perfect parry still takes the hit', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    const fight = async (status) => {
      await page.evaluate((st) => {
        const m = individual(speciesByName('MACHOP'), 20, Math.random); learnAtLevel(m)
        Object.assign(m.stats, { hp: 2000, atk: Math.ceil(m.stats.atk / 3), spa: Math.ceil(m.stats.spa / 3) }); m.hp = m.stats.hp; m.status = st   // weak hits, so the foe lives to attack
        window.__vvm.party.splice(0, 9, m); window.__forceWild = 'RATTATA'; window.__autoParry = true
      }, status)
      const from = g.log.length
      assert.ok(await bot.encounter('wild'), 'a wild battle started')
      const attacked = g.log.slice(from).some((l) => /The wild RATTATA used\s*(TACKLE|QUICK ATTACK|BITE|HYPER FANG|DOUBLE HIT|CRUNCH|SUPER FANG)/.test(l))
      return { attacked, hp: await page.evaluate(() => window.__vvm.party[0].hp) }
    }
    const healthy = await fight(null)
    if (healthy.attacked) assert.equal(healthy.hp, 2000, 'healthy: every PERFECT parry takes no damage')
    let para = { attacked: false }
    for (let i = 0; i < 4 && !para.attacked; i++) para = await fight('par')   // until the Rattata lands an attack (not just Tail Whip)
    assert.ok(para.attacked, 'the Rattata attacked the paralyzed Pokémon')
    assert.ok(para.hp < 2000, `paralyzed: the same PERFECT parry is no defence (${para.hp}/2000)`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
