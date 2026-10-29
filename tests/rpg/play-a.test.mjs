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
