// The battle game in a real browser: the Kanto League and Alex's first rival battle, played.
// Part of `npm run test:rpg` (see game.test.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'

const quick = !!process.env.RPG_QUICK

test('rival: after the first badge, Alex is at the machine on your next tap; the battle plays and is saved', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    // (A lost tutorial leaves your starter fainted, and Alex waits for a Pokémon that can fight: heal first.)
    const before = await page.evaluate(() => { const v = window.__vvm; delete v.bag.expshare; const was = v.rivalDue(); v.badges.push(0); for (const m of v.party) m.hp = m.stats.hp; return { was, now: v.rivalDue() } })
    assert.deepEqual(before, { was: false, now: true }, 'no rival battle before a badge; the first is due after one')
    // An ordinary tap ("Random"): Alex takes it.
    assert.ok(await bot.encounter(''), 'a battle happened on the next tap')
    const r = await page.evaluate(() => ({ rival: window.__vvm.rival, due: window.__vvm.rivalDue(), music: window.__audioLog.filter((e) => e.kind === 'music').map((e) => e.name), expshare: window.__vvm.bag.expshare,
      saved: Object.values(localStorage).some((v) => v.includes('"rival":{"step"')) }))
    assert.ok(r.music.includes('rivalTalk') && r.music.includes('rival'), `the encounter music, then the first rival theme: ${r.music.join(', ')}`)
    if (r.rival.step === 1) assert.deepEqual(r.rival, { step: 1, wait: 0, lost: false }, 'won: on to battle 2')
    else assert.deepEqual([r.rival.step, r.rival.lost, r.rival.wait, r.due], [0, true, 3, false], 'lost: the same battle again, a few taps later')
    assert.equal(r.expshare, 1, 'after the first battle, win or lose, Alex gave you the EXP. SHARE')
    assert.ok(r.saved, 'the rival\'s progress is in the save')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('the Kanto League in play: the ticket from the Bag, Lorelei\'s battle to her theme, and the ladder moves on or starts over', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page, bot } = g
    await bot.finishTutorial()
    await page.evaluate(() => {
      const v = window.__vvm
      for (let i = 0; i < 16; i++) if (!v.badges.includes(i)) v.badges.push(i)
      v.setLeague({ champion: true }); v.setRival(7)   // (Alex is done, so the taps are only for this)
      KANTO_ELITE[0].team = ['LAPRAS']   // a short battle: this is about the ladder, not the fight
      for (const n of ['GARCHOMP', 'TYRANITAR', 'GENGAR', 'GYARADOS', 'ARCANINE']) { const m = individual(speciesByName(n), 90, Math.random); m.hp = m.stats.hp; v.party.push(m) }
      for (const m of v.party) m.hp = m.stats.hp
      v.bag[v.leagueKey()] = 1; v.renderTools()
    })
    // Back to idle from the screen the tutorial ends on, then open the Bag.
    await page.evaluate(() => document.getElementById('home').click())
    for (let i = 0; i < 20 && !(await page.$('#sheetBody [data-tab]')); i++) {
      await page.waitForTimeout(400)
      await page.evaluate(() => { document.querySelectorAll('.tool').forEach((t) => { t.disabled = false }); document.getElementById('tBag').click() })
    }
    await page.dispatchEvent('#sheetBody [data-tab="other"]', 'click'); await page.waitForTimeout(200)
    await page.dispatchEvent('#sheetBody [data-item="summon:kanto"]', 'click'); await page.waitForTimeout(300)
    const ladder = await page.textContent('#sheetBody')
    assert.match(ladder, /LORELEI.*BRUNO.*AGATHA.*LANCE.*RED/s, 'the ladder shows all five')
    assert.match(ladder, /CHALLENGE LORELEI/)
    await page.dispatchEvent('#sheetBody [data-elite="kanto"]', 'click')
    let fought = false
    for (let i = 0; i < 60 && !fought; i++) { await bot.step(); fought = await bot.inBattle() }
    assert.ok(fought, 'Lorelei came out')
    for (let i = 0; i < 700; i++) { await bot.step(); if (!(await bot.inBattle()) && (await bot.atHome())) break }
    const r = await page.evaluate(() => ({ league: window.__vvm.league, ticket: window.__vvm.bag['summon:kanto'] ?? 0, music: window.__audioLog.filter((e) => e.kind === 'music').map((e) => e.name) }))
    assert.ok(r.music.includes('kantoElite'), `the Kanto Elite Four theme: ${r.music.join(', ')}`)
    if (r.league.kanto === 1) assert.equal(r.ticket, 1, 'won: the ticket stays for Bruno')
    else assert.deepEqual([r.league.kanto, r.ticket], [0, 0], 'lost: the ticket is used up, and the next starts from Lorelei')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
