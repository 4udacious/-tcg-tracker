// Drives the battle game (public/rpg) in a real browser: a static server for
// public/, Chromium through playwright-core, and a bot that plays the way a
// person would: it taps rings as they close, mashes, enters swipes, holds and
// lets go of buttons, and picks moves from a wish list.
//
// Chromium: set CHROMIUM_PATH, or install one with `npx playwright install chromium`.
import { chromium } from 'playwright-core'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../public/', import.meta.url))
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.json': 'application/json' }

function serve() {
  const srv = http.createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
    try {
      const body = await readFile(join(ROOT, path))
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body)
    } catch { res.writeHead(404).end() }
  })
  return new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok(srv)))
}

/** Opens the game (`touch`: as a phone, with a touchscreen). Returns the page, the page errors seen so far, a log of what the screen said, and the bot. */
export async function openGame({ mode, touch = false } = {}) {
  const srv = await serve()
  // Audio may play without a click, so the music tests hear real time pass.
  const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), args: ['--autoplay-policy=no-user-gesture-required'] })
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, ...(touch ? { hasTouch: true, isMobile: true } : {}) })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const missing = []
  page.on('response', (r) => { if (r.status() >= 400) missing.push(r.url()) })
  await page.goto(`http://127.0.0.1:${srv.address().port}/rpg/index.html${mode ? `?mode=${mode}` : ''}`)
  const log = []
  let last = ''

  const bot = {
    /** Moves to prefer, in order, when picking from a menu. */
    want: [],
    /** One action: whatever the screen is asking for. */
    async step() {
      // The defend buttons must never show while an announcement waits for a tap (a tap there would be a parry).
      if (await page.evaluate(() => document.getElementById('msg')?.classList.contains('wait') && document.getElementById('pDefend')?.style.display === 'block')) log.push('BUG: defend buttons shown under a waiting announcement')
      const st = await page.evaluate((want) => {
        const b = document.getElementById('bStrike')
        const shown = (el) => el && el.closest('.panel')?.style.display !== 'none' && el.offsetParent
        if (shown(b) && /WAKE UP|MASH/i.test(b.textContent)) return { mash: true }
        const pad = document.getElementById('pPad')
        if (pad && pad.style.display !== 'none') return { swipe: [...document.querySelectorAll('#padCue i')].filter((i) => !i.className).map((i) => i.textContent) }
        const ring = () => [...document.querySelectorAll('.ring')].map((x) => x.getAnimations()[0]).find((a) => a && a.playState === 'running')
        if (shown(b) && /HOLD B/.test(b.textContent)) { const r = ring(); return { guard: r ? r.effect.getTiming().duration - r.currentTime : 600 } }
        if (shown(b) && /HOLD A/.test(b.textContent) && document.querySelector('.meter')) return { charge: true }
        if (shown(b) && /HOLD A/.test(b.textContent) && document.querySelector('.track')) return { track: true }
        if (shown(b)) { const r = ring(); if (r) return { ring: r.effect.getTiming().duration - r.currentTime } }
        for (const p of [...document.querySelectorAll('.panel')].filter((p) => p.style.display !== 'none' && p.offsetParent)) {
          const bs = [...p.querySelectorAll('[data-act]')].filter((x) => !x.disabled && !x.classList.contains('off') && !/back|run|bag|party|switch/i.test(x.dataset.act))
          let pick = bs.find((x) => x.dataset.act === 'fight')
          if (!pick) for (const w of want) { pick = bs.find((x) => x.textContent.includes(w)); if (pick) break }
          pick ??= bs[0]
          if (pick) { pick.id ||= 'bot' + Math.random().toString(36).slice(2); return { tap: '#' + pick.id } }
        }
        return {}
      }, bot.want)
      const kb = page.keyboard
      if (st.mash) for (let i = 0; i < 16; i++) { await kb.press('x'); await page.waitForTimeout(40) }
      else if (st.swipe) for (const g of st.swipe) { await kb.press({ '◀': 'ArrowLeft', '▲': 'ArrowUp', '▼': 'ArrowDown', '▶': 'ArrowRight' }[g]); await page.waitForTimeout(120) }
      else if (st.guard != null) { await kb.down('z'); await page.waitForTimeout(Math.max(0, st.guard - 20)); await kb.up('z') }
      else if (st.charge) { await kb.down('x'); await page.waitForTimeout(980); await kb.up('x') }
      else if (st.track) { await kb.down('x'); await page.waitForTimeout(2300); await kb.up('x') }
      else if (st.ring != null) { await page.waitForTimeout(Math.max(0, st.ring - 25)); await kb.press('x') }
      else if (st.tap) await page.dispatchEvent(st.tap, 'pointerdown').catch(() => {})
      else await kb.press('x')
      await page.waitForTimeout(260)
      const said = await page.evaluate(() => [document.getElementById('msg')?.textContent ?? '', ...[...document.querySelectorAll('.pop')].map((p) => p.textContent)].join(' / '))
      if (said !== last) { log.push(said); last = said }
    },
    inBattle: () => page.evaluate(() => getComputedStyle(document.getElementById('battleL')).display !== 'none'),
    atHome: () => page.evaluate(() => getComputedStyle(document.getElementById('home')).display !== 'none' && document.getElementById('msg')?.offsetParent == null),
    /** Play mode from the start: the tutorial battle, through to the free machine. */
    async finishTutorial(maxSteps = 400) {
      await page.click('#mPlay'); await page.click('#tts')
      for (let i = 0; i < maxSteps && !log.some((l) => /VVM is free/.test(l)); i++) await bot.step()
      for (let i = 0; i < 300 && !(await bot.atHome()); i++) await bot.step()
    },
    /** Taps the machine for this kind of encounter ('wild', 'scalper', 'duo') and plays it out. True if a battle happened. */
    async encounter(kind, maxSteps = 300) {
      for (let i = 0; i < 300 && !(await bot.atHome()); i++) await bot.step()
      await page.selectOption('#nextTap', kind); await page.evaluate(() => document.activeElement?.blur())
      let fought = false
      for (let tries = 0; tries < 5 && !fought; tries++) {
        await page.evaluate(() => document.getElementById('home').click())   // a state screen needs a tap back to idle first
        for (let i = 0; i < 25 && !fought; i++) { await bot.step(); fought = await bot.inBattle() }
      }
      for (let i = 0; fought && i < maxSteps; i++) { await bot.step(); if (!(await bot.inBattle()) && (await bot.atHome())) break }
      return fought
    },
  }
  const close = async () => { await browser.close(); srv.close() }
  return { page, errors, missing, log, bot, close }
}
