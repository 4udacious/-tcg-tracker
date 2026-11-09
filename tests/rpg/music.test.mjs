// The battle game in a real browser: the music: its parts, and that it keeps time under load. Run on its own, after the rest, so other tests don't steal its CPU.
// Part of `npm run test:rpg` (see game.test.mjs).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openGame } from './harness.mjs'

const quick = !!process.env.RPG_QUICK

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

test('music keeps time when the phone is busy: no late notes through main-thread stalls', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      RUN++; Sound.stopMusic()   // stop the page's own demo, which changes the music
      // A busy phone: the main thread stalls for half a second every five seconds.
      window.__stall = setInterval(() => { const end = performance.now() + 500; while (performance.now() < end); }, 5000)
      // Count sounds that start after their time (already past when they're made).
      const start = AudioScheduledSourceNode.prototype.start
      window.__late = 0
      // (From a second in: this is about keeping time through the loop, not the song's first notes.)
      AudioScheduledSourceNode.prototype.start = function (when = 0, ...a) { const c = this.context; if (!(c instanceof OfflineAudioContext) && c.currentTime > 1 && c.currentTime - when > 0.03) window.__late++; return start.call(this, when, ...a) }
      Sound.setOn(true); Sound.music('battleB')   // the densest arrangement
    })
    await page.waitForTimeout(25000)
    const r = await page.evaluate(() => { clearInterval(window.__stall); Sound.stopMusic(); return { late: window.__late, tier: MUSIC_LOAD.tier } })
    assert.equal(r.late, 0, `${r.late} sounds started late`)
    assert.equal(r.tier, 0, 'main-thread stalls alone never thin the music (only a slow audio thread does)')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('music: finished notes leave the audio graph, so a song costs no more on its tenth loop than its first', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.waitForTimeout(800)
    await page.evaluate(() => {
      RUN++; Sound.stopMusic()
      window.__busReady = (s, m) => { window.__ac = m.context }
      // Count the notes built (each behind one gain of its own) and the disconnections.
      const v = window.voice, kv = window.kitVoice, cut = AudioNode.prototype.disconnect
      window.__made = 0; window.__cut = 0
      window.voice = (...a) => { window.__made++; return v(...a) }
      window.kitVoice = (...a) => { window.__made++; return kv(...a) }
      AudioNode.prototype.disconnect = function (...a) { window.__cut++; return cut.apply(this, a) }
      Sound.setOn(true); Sound.music('champion')
    })
    await page.waitForTimeout(15000)
    const r = await page.evaluate(() => ({ made: window.__made, cut: window.__cut, waiting: window.__ac.__retire.length, tier: MUSIC_LOAD.tier }))
    // Every note's gain is let go once it's over: only the last moment's notes (and the ones queued ahead) are still waiting.
    assert.ok(r.made > 400, `a lot of notes were played (${r.made})`)
    assert.ok(r.cut > r.made * 0.85, `most of them were disconnected again (${r.cut} of ${r.made})`)
    assert.ok(r.waiting < 400, `few notes still waiting to retire (${r.waiting})`)
    assert.equal(r.tier, 0, 'the Champion theme plays in full on a machine that keeps up')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('music: when the audio thread can\'t keep up, the music lightens to its melody, bass and drums', { skip: quick }, async () => {
  const g = await openGame()
  try {
    const { page } = g
    await page.waitForTimeout(800)
    // Each part of a song has a level: the ornaments (tremolo, runs, doubled lines) go first, then the colour, never the core.
    const levels = await page.evaluate(() => {
      const ac = new OfflineAudioContext(2, 48000, 48000), out = {}, seen = { lead: new Set(), trem: new Set() }
      const keep = { ...INST }
      for (const k in INST) INST[k] = (a, ch, t, f, d, v) => { out[k] ??= new Set(); out[k].add(window.__lvl) }
      scheduleSong(ac, ac.createGain(), SONGS.champion, 0)
      for (const e of ac.__q) { window.__lvl = e.lvl; e.fn() }
      Object.assign(INST, keep)
      return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort()]))
    })
    assert.deepEqual(levels.violins, [2], 'the tremolo strings and doubled violins are ornaments')
    assert.deepEqual(levels.lowstrings, [0], 'the bass is core')
    assert.ok(levels.piano.includes(0) && levels.piano.includes(2), 'the piano melody is core, its runs are ornaments')
    // A phone whose audio thread falls behind: an overload far beyond the song (silent, so it's all cost).
    const r = await page.evaluate(async () => {
      RUN++; Sound.stopMusic()
      window.__busReady = (s, m) => { window.__ac = m.context }
      Sound.setOn(true); Sound.music('champion')
      await new Promise((ok) => setTimeout(ok, 2500))
      const ac = window.__ac, t = ac.currentTime + 0.1, sink = ac.createGain(); sink.gain.value = 0; sink.connect(ac.destination)
      for (let i = 0; i < 2500; i++) {
        const o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), f = ac.createBiquadFilter()
        o.type = 'sawtooth'; o.frequency.value = 100 + i; lg.gain.value = 3; l.connect(lg).connect(o.frequency); o.connect(f).connect(sink)
        o.start(t); l.start(t); o.stop(t + 3); l.stop(t + 3)
      }
      const started = performance.now()
      while (MUSIC_LOAD.tier < 2 && performance.now() - started < 20000) await new Promise((ok) => setTimeout(ok, 250))
      const tier = MUSIC_LOAD.tier, after = performance.now() - started
      // Now count what's still being played, once the overload and the notes queued before the change have gone by.
      // (In audio time: the overload slows the audio clock right down while it lasts.)
      const audioSecs = async (n) => { const to = ac.currentTime + n; while (ac.currentTime < to) await new Promise((ok) => setTimeout(ok, 100)) }
      await audioSecs(5)
      const calls = {}, keep = { ...INST }
      for (const k in INST) INST[k] = function (...a) { calls[k] = (calls[k] ?? 0) + 1; return keep[k].apply(this, a) }
      await audioSecs(5)
      Object.assign(INST, keep); Sound.stopMusic()
      return { tier, after, calls, changes: MUSIC_LOAD.changes.length }
    })
    assert.equal(r.tier, 2, `the music lightened twice (after ${Math.round(r.after)} ms)`)
    assert.equal(r.changes, 2)
    assert.ok(!r.calls.violins && !r.calls.choir, `no ornaments or colour once lightened: ${JSON.stringify(r.calls)}`)
    assert.ok(r.calls.piano > 0 || r.calls.lowstrings > 0, `the melody and bass play on: ${JSON.stringify(r.calls)}`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('iPhones start the music a tier lighter (no ornaments); music at volume 0 isn\'t built at all', async () => {
  const iphone = await openGame({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1' })
  const desktop = await openGame()
  try {
    assert.deepEqual(await iphone.page.evaluate(() => [IOS, MUSIC_LOAD.tier, MUSIC_LOAD.keep]), [true, 1, 1], 'an iPhone: lighter from the start')
    assert.deepEqual(await desktop.page.evaluate(() => [IOS, MUSIC_LOAD.tier, MUSIC_LOAD.keep]), [false, 0, 2], 'a desktop: the full arrangement')
    // In the app, with the music volume at 0 (Settings): no music nodes are made.
    const made = await desktop.page.evaluate(async () => {
      RUN++; Sound.stopMusic(); Sound.setOn(true)
      let n = 0
      for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) if (/^create/.test(k)) { const f = BaseAudioContext.prototype[k]; BaseAudioContext.prototype[k] = function (...a) { n++; return f.apply(this, a) } }
      const count = async (off) => { window.__musicOff = () => off; Sound.music('gym'); const a = n; await new Promise((r) => setTimeout(r, 1500)); const b = n; Sound.stopMusic(); await new Promise((r) => setTimeout(r, 300)); return b - a }
      return { on: await count(false), off: await count(true) }
    })
    assert.ok(made.on > 50, `music on builds notes (${made.on})`); assert.equal(made.off, 0, 'music at volume 0 builds none')
    assert.deepEqual([...iphone.errors, ...desktop.errors], [])
  } finally { await iphone.close(); await desktop.close() }
})

test('memory: one room reverb per audio context, and only the most recent cries kept decoded', async () => {
  const g = await openGame()
  try {
    const r = await g.page.evaluate(async () => {
      RUN++; Sound.stopMusic(); Sound.setOn(true)
      // Long buffers made (a room impulse is 1.7 s): starting four songs in a row should build at most one.
      const long = []
      const make = BaseAudioContext.prototype.createBuffer
      BaseAudioContext.prototype.createBuffer = function (ch, n, rate) { if (n > rate) long.push(n / rate); return make.call(this, ch, n, rate) }
      for (const song of ['gymIntro', 'gym', 'victory', 'win']) { Sound.music(song); await new Promise((r) => setTimeout(r, 400)) }
      Sound.stopMusic()
      // Cries: 40 different ones heard, on a context of our own.
      const ac = new AudioContext(), ids = Object.keys(ART).filter((k) => k.startsWith('cry:')).slice(0, 40).map((k) => k.slice(4))
      for (const id of ids) await window.__playCry(ac, ac.destination, id)
      const kept = window.__cryCacheSize(ac)
      await ac.close()
      return { impulses: long.filter((s) => s > 1.5 && s < 2).length, kept, CRY_KEEP }
    })
    assert.ok(r.impulses <= 1, `the room reverb built once for four songs (${r.impulses})`)
    assert.equal(r.kept, r.CRY_KEEP, `40 cries heard, the latest ${r.CRY_KEEP} kept decoded`)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('pre-rendered music: every song has a current file, and plays as one looping buffer at its loop points', async () => {
  const g = await openGame()
  try {
    const { readFile, readdir } = await import('node:fs/promises')
    const man = JSON.parse(await readFile(new URL('../../public/rpg/music.json', import.meta.url), 'utf8')).songs
    const onDisk = new Set(await readdir(new URL('../../public/rpg/a/music/', import.meta.url)))
    const want = await g.page.evaluate(() => Object.fromEntries(RENDERED_SONGS().map((n) => [n, musicSig(n)])))
    const stale = Object.entries(want).filter(([n, sig]) => man[n]?.sig !== sig).map(([n]) => n)
    assert.deepEqual(stale, [], `songs changed since their files were rendered: run npm run music:render (${stale.join(', ')})`)
    assert.deepEqual(Object.keys(man).sort(), Object.keys(want).sort(), 'music.json lists exactly the rendered songs')
    assert.deepEqual(Object.values(man).filter((f) => !onDisk.has(f.file)).map((f) => f.file), [], 'every file is there')
    assert.equal(onDisk.size, Object.keys(man).length, 'and no old files are left behind')

    // Playing: this Chromium can't decode AAC, so a stand-in decoder returns a buffer of the file's length (and, the
    // second time, one that kept AAC's 1024-sample priming).
    const r = await g.page.evaluate(async () => {
      RUN++; Sound.stopMusic()
      HTMLMediaElement.prototype.canPlayType = () => 'probably'
      let extra = 0
      BaseAudioContext.prototype.decodeAudioData = async function () { const f = window.__decoding; return new AudioBuffer({ numberOfChannels: 2, length: f.samples + extra, sampleRate: f.rate }) }
      const man = await (await fetch('/rpg/music.json')).json()
      let n = 0
      for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) if (/^create/.test(k)) { const f0 = BaseAudioContext.prototype[k]; BaseAudioContext.prototype[k] = function (...a) { n++; return f0.apply(this, a) } }
      const play = async (name) => {
        window.__decoding = man.songs[name]; Sound.setOn(true); Sound.music(name)
        for (let i = 0; i < 50 && window.__musicFile?.name !== name; i++) await new Promise((r) => setTimeout(r, 100))
        const a = n; await new Promise((r) => setTimeout(r, 3000)); const b = n
        const m = window.__musicFile, out = m && { name: m.name, loop: m.src.loop, loopStart: m.src.loopStart, loopEnd: m.src.loopEnd, perSec: (b - a) / 3 }
        Sound.stopMusic(); await new Promise((r) => setTimeout(r, 500)); return out
      }
      const gym = await play('gym'); extra = 1024 + 300; const primed = await play('gym')
      return { gym, primed, want: man.songs.gym, rate: man.songs.gym.rate }
    })
    assert.ok(r.gym, 'the gym theme played from its file')
    assert.equal(r.gym.loop, true)
    assert.ok(Math.abs(r.gym.loopStart - r.want.loopStart) < 1e-6 && Math.abs(r.gym.loopEnd - r.want.loopEnd) < 1e-6, 'looping at the manifest\'s points')
    assert.ok(r.gym.perSec < 2, `about no audio nodes a second while it plays (${r.gym.perSec})`)
    assert.ok(Math.abs(r.primed.loopStart - (r.want.loopStart + 1024 / r.rate)) < 1e-6, 'a decoder that keeps the priming: the loop points move 1024 samples later')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a browser that never finishes decoding a song: it gives up and streams the song instead, from then on', async () => {
  const g = await openGame()
  try {
    const r = await g.page.evaluate(async () => {
      RUN++; Sound.stopMusic()
      HTMLMediaElement.prototype.canPlayType = () => 'probably'
      // Decoding hangs: never resolves, never fails. Streaming "plays" (this Chromium has no AAC).
      let decodesAsked = 0; const played = []
      BaseAudioContext.prototype.decodeAudioData = function () { decodesAsked++; return new Promise(() => {}) }
      HTMLMediaElement.prototype.play = function () { played.push(this.src); return Promise.resolve() }
      try { localStorage.removeItem('vvm-decode-hung') } catch {}
      window.__decodeMs = 400
      const until = async (f) => { for (let i = 0; i < 40 && !f(); i++) await new Promise((r) => setTimeout(r, 100)) }
      Sound.setOn(true); Sound.music('gym')
      await until(() => window.__musicFile?.name === 'gym')
      const first = { stream: !!window.__musicFile?.stream, decodesAsked, played: played.slice(), hung: localStorage.getItem('vvm-decode-hung') === navigator.userAgent, stats: window.__musicStats() }
      Sound.stopMusic(); await new Promise((r) => setTimeout(r, 300))
      Sound.music('wild')
      await until(() => window.__musicFile?.name === 'wild')
      const second = { stream: !!window.__musicFile?.stream, decodesAsked, played: played.slice() }
      Sound.stopMusic()
      return { first, second }
    })
    assert.ok(r.first.stream, 'the hung decode gave up and the song streams')
    assert.equal(r.first.decodesAsked, 1)
    assert.match(r.first.played.at(-1) ?? '', /\/rpg\/a\/music\/.+/, 'from its file')
    assert.ok(r.first.hung, 'remembered for this browser')
    assert.ok(r.first.stats.hung && r.first.stats.streams === 1, 'and in the crash note\'s stats')
    assert.ok(r.second.stream, 'the next song streams straight away')
    assert.equal(r.second.decodesAsked, 1, 'without trying to decode again')
    assert.equal(r.second.played.length, 2)
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})

test('a browser whose decode fails (Safari 27): the song streams, not the live synthesiser, and the crash note says why', async () => {
  const g = await openGame()
  try {
    const r = await g.page.evaluate(async () => {
      RUN++; Sound.stopMusic()
      HTMLMediaElement.prototype.canPlayType = () => 'probably'
      let decodesAsked = 0; const played = []
      BaseAudioContext.prototype.decodeAudioData = function () { decodesAsked++; return Promise.reject(new DOMException('Decoding failed', 'EncodingError')) }
      HTMLMediaElement.prototype.play = function () { played.push(this.src); return Promise.resolve() }
      try { localStorage.removeItem('vvm-decode-hung') } catch {}
      // Counts the audio nodes made: the live synthesiser makes hundreds a second, a stream a couple in all.
      let n = 0
      for (const k of Object.getOwnPropertyNames(BaseAudioContext.prototype)) if (/^create/.test(k)) { const f0 = BaseAudioContext.prototype[k]; BaseAudioContext.prototype[k] = function (...a) { n++; return f0.apply(this, a) } }
      const until = async (f) => { for (let i = 0; i < 40 && !f(); i++) await new Promise((r) => setTimeout(r, 100)) }
      Sound.setOn(true); Sound.music('wild')
      await until(() => window.__musicFile?.name === 'wild')
      const a = n; await new Promise((r) => setTimeout(r, 2000)); const perSec = (n - a) / 2
      const out = { stream: !!window.__musicFile?.stream, decodesAsked, played: played.length, stats: window.__musicStats(), perSec }
      Sound.stopMusic(); return out
    })
    assert.ok(r.stream, 'a failed decode streams the song')
    assert.equal(r.played, 1)
    assert.ok(r.perSec < 2, `not the live synthesiser: about no audio nodes a second (${r.perSec})`)
    assert.match(r.stats.decodeErr ?? '', /EncodingError: Decoding failed/, 'the crash note keeps the error')
    assert.deepEqual(g.errors, [])
  } finally { await g.close() }
})
