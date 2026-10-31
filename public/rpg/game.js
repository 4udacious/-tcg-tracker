'use strict'
/* ══════════════════════════════ AUDIO ══════════════════════════════
   Every sound the game makes goes through Sound.sfx(name) or
   Sound.music(name), and every name is in one of the two tables below.
   Each entry has a synthesised placeholder so the hooks are audible now;
   set `file` to a recording's URL and that is used instead, with no other
   change. The placeholders are original - nothing here is lifted from a
   game soundtrack. */

const NOTE = (n) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(n)
  const semi = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
  return 440 * Math.pow(2, (12 * (+m[3] + 1) + semi - 69) / 12)
}
function noiseBuf(ac) {
  if (ac.__noise) return ac.__noise
  const b = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return (ac.__noise = b)
}
function tone(ac, out, t, { type = 'square', f, f1, dur = 0.1, vol = 0.2, attack = 0.004 }) {
  if (t < 0) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.03)
  o.onended = () => g.disconnect()   // finished sounds leave the graph (see retire())
}
function noise(ac, out, t, { dur = 0.1, vol = 0.2, filter = 'lowpass', f = 2000, f1, q = 1 }) {
  if (t < 0) return
  const s = ac.createBufferSource(); s.buffer = noiseBuf(ac)
  const fl = ac.createBiquadFilter(); fl.type = filter; fl.Q.value = q
  fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  s.connect(fl).connect(g).connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03)
  s.onended = () => g.disconnect()
}
const arp = (ac, o, t, notes, step, vol = 0.12) => notes.forEach((n, i) => tone(ac, o, t + i * step, { f: NOTE(n), dur: step * 1.6, vol }))
const hitSynth = (ac, o, t, k = 1) => { noise(ac, o, t, { dur: .12 * k, vol: .45 * k, f: 1800 }); tone(ac, o, t, { f: 260, f1: 70, dur: .12 * k, vol: .25 }) }

const SFX = {
  move:     { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 880, dur: .05, vol: .1 }) },
  select:   { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 660, dur: .06, vol: .12 }); tone(ac, o, t + .06, { f: 1320, dur: .09, vol: .12 }) } },
  advance:  { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 990, dur: .04, vol: .07 }) },
  ball:     { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .28, vol: .18, filter: 'bandpass', f: 600, f1: 2600, q: 2 }); tone(ac, o, t + .3, { f: 320, f1: 960, dur: .12, vol: .16 }); noise(ac, o, t + .3, { dur: .05, vol: .3, filter: 'highpass', f: 4000 }) } },
  zap:      { file: null, synth: (ac, o, t) => { for (let i = 0; i < 9; i++) tone(ac, o, t + i * .05, { type: 'sawtooth', f: 700 + Math.random() * 1600, dur: .05, vol: .09 }); noise(ac, o, t, { dur: .45, vol: .12, filter: 'highpass', f: 3000 }) } },
  whoosh:   { file: null, synth: (ac, o, t) => noise(ac, o, t, { dur: .22, vol: .25, filter: 'bandpass', f: 600, f1: 3200, q: 1.5 }) },
  clang:    { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'triangle', f: 1240, dur: .32, vol: .22 }); tone(ac, o, t, { f: 1870, dur: .14, vol: .06 }); noise(ac, o, t, { dur: .05, vol: .2, filter: 'highpass', f: 5000 }) } },
  hit:      { file: null, synth: (ac, o, t) => hitSynth(ac, o, t, 1) },
  hitSuper: { file: null, synth: (ac, o, t) => { hitSynth(ac, o, t, 1.4); tone(ac, o, t + .04, { f: 520, f1: 90, dur: .22, vol: .18 }) } },
  hitWeak:  { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .09, vol: .22, f: 800 }); tone(ac, o, t, { f: 180, f1: 80, dur: .08, vol: .1 }) } },
  coin:     { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 1976, dur: .06, vol: .1 }); tone(ac, o, t + .055, { f: 2637, dur: .2, vol: .1 }) } },
  shadow:   { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'sine', f: 240, f1: 110, dur: .5, vol: .3 }); tone(ac, o, t, { type: 'triangle', f: 360, f1: 160, dur: .5, vol: .12 }) } },
  quake:    { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .95, vol: .8, f: 170 }); tone(ac, o, t, { type: 'sine', f: 58, f1: 34, dur: .95, vol: .5 }) } },
  crunch:   { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .08, vol: .5, filter: 'bandpass', f: 900, q: 2 }); noise(ac, o, t + .1, { dur: .1, vol: .5, filter: 'bandpass', f: 700, q: 2 }) } },
  thud:     { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'sine', f: 150, f1: 50, dur: .22, vol: .5 }); noise(ac, o, t, { dur: .15, vol: .35, f: 600 }) } },
  parry:    { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'triangle', f: 1760, dur: .38, vol: .3 }); tone(ac, o, t, { type: 'triangle', f: 2637, dur: .26, vol: .16 }); noise(ac, o, t, { dur: .04, vol: .2, filter: 'highpass', f: 6000 }) } },
  dodge:    { file: null, synth: (ac, o, t) => noise(ac, o, t, { dur: .2, vol: .22, filter: 'bandpass', f: 1200, f1: 4200, q: 1.2 }) },
  jump:     { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 300, f1: 900, dur: .17, vol: .14 }) },
  pp:       { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 1046, f1: 1568, dur: .1, vol: .08 }) },
  perfect:  { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 1319, dur: .08, vol: .12 }); tone(ac, o, t + .07, { f: 1976, dur: .16, vol: .12 }) } },
  counter:  { file: null, synth: (ac, o, t) => { arp(ac, o, t, ['C6', 'E6', 'G6', 'C7'], .045, .1); hitSynth(ac, o, t + .22, 1.3) } },
  flinch:   { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 220, dur: .08, vol: .14 }); tone(ac, o, t + .09, { f: 165, dur: .14, vol: .14 }) } },
  faint:    { file: null, synth: (ac, o, t) => tone(ac, o, t, { f: 700, f1: 90, dur: .65, vol: .14 }) },
  levelup:  { file: null, synth: (ac, o, t) => arp(ac, o, t, ['C5', 'E5', 'G5', 'C6', 'E6'], .075, .11) },
  tokens:   { file: null, synth: (ac, o, t) => { for (let i = 0; i < 3; i++) { tone(ac, o, t + i * .09, { f: 1976, dur: .05, vol: .08 }); tone(ac, o, t + i * .09 + .05, { f: 2637, dur: .14, vol: .08 }) } } },
}

/* Songs: one token per step. A note starts, '.' holds it, '-' rests.
   Drums: K kick, S snare, h hat, C crash. */
const SONGS = {
  vs: { file: null, loop: false, bpm: 152, div: 4,
    lead: 'E4 G4 B4 E5 G4 B4 E5 G5 B4 E5 G5 B5 E5 G5 B5 E6 . . . . . . . -'.split(' '),
    bass: 'E2 . . . . . . . E2 . . . . . . . E3 . . . . . . .'.split(' '),
    drums: 'S.S.S.S.SSSSSSSSC.......' },
  battle: { file: null, loop: true, bpm: 152, div: 2,
    lead: [
      'A4 . C5 E5 D5 C5 B4 C5', 'A4 . . F4 A4 C5 . A4', 'B4 . D5 G5 F5 E5 D5 B4', 'E5 . . D5 C5 B4 G#4 B4',
      'A5 . E5 C5 A4 C5 E5 A5', 'G5 F5 E5 . C5 . A4 C5', 'D5 . B4 D5 G5 . F5 E5', 'E5 D5 C5 B4 G#4 . E4 .',
    ].join(' ').split(' '),
    bass: [
      'A2 A3 A2 A3 A2 A3 A2 A3', 'F2 F3 F2 F3 F2 F3 F2 F3', 'G2 G3 G2 G3 G2 G3 G2 G3', 'E2 E3 E2 E3 E2 E3 E2 E3',
      'A2 A3 A2 A3 A2 A3 A2 A3', 'F2 F3 F2 F3 F2 F3 F2 F3', 'G2 G3 G2 G3 G2 G3 G2 G3', 'E2 E3 E2 E3 G#2 G#3 B2 B3',
    ].join(' ').split(' '),
    drums: 'KhShKKSh'.repeat(7) + 'KhShSSSS' },
  encounter: { file: null, loop: true, bpm: 152, div: 2,
    lead: [ 'E5 - - - G5 - F#5 -', 'E5 - - - B4 - - -', 'C5 - E5 - D5 - F#5 -', 'E5 . . . D#5 . . .' ].join(' ').split(' '),
    bass: [ 'E2 E2 E3 E2 E2 E3 E2 D3', 'E2 E2 E3 E2 E2 E3 G2 A2', 'C3 C3 C4 C3 D3 D3 D4 D3', 'E2 E2 E3 E2 B2 . B2 .' ].join(' ').split(' '),
    drums: 'KhhhShhh'.repeat(3) + 'KhhhSSSS' },
  win: { file: null, loop: true, bpm: 120, div: 2,
    lead: [ 'C5 . E5 G5 . E5 D5 .', 'F5 . A5 . G5 . E5 .', 'D5 . F5 A5 . G5 F5 .', 'E5 . . . G5 . . .' ].join(' ').split(' '),
    bass: [ 'C3 . G3 . C3 . G3 .', 'F2 . C3 . F2 . C3 .', 'G2 . D3 . G2 . D3 .', 'C3 . G3 . C3 . . .' ].join(' ').split(' '),
    drums: 'K.h.S.h.'.repeat(4) },
  victory: { file: null, loop: false, bpm: 140, div: 2,
    lead: 'G4 C5 E5 G5 . E5 G5 . C6 . . . . . . -'.split(' '),
    bass: 'C3 . C3 . E3 . G3 . C3 . . . . . . -'.split(' '),
    drums: 'K.S.K.SSC.......' },
}

function scheduleSong(ac, out, song, t0) {
  const step = 60 / song.bpm / song.div
  const play = (track, fn) => {
    for (let i = 0; i < track.length; i++) {
      const n = track[i]
      if (n === '.' || n === '-') continue
      let len = 1
      while (track[i + len] === '.') len++
      fn(t0 + i * step, n, len * step)
    }
  }
  play(song.lead, (t, n, d) => tone(ac, out, t, { f: NOTE(n), dur: d * 0.95, vol: 0.085 }))
  play(song.bass, (t, n, d) => tone(ac, out, t, { type: 'triangle', f: NOTE(n), dur: d * 0.9, vol: 0.2 }))
  ;[...song.drums].forEach((c, i) => {
    const t = t0 + i * step
    if (c === 'K') tone(ac, out, t, { type: 'sine', f: 150, f1: 45, dur: .14, vol: .5 })
    if (c === 'S') { noise(ac, out, t, { dur: .12, vol: .22, filter: 'bandpass', f: 1800 }); tone(ac, out, t, { type: 'triangle', f: 190, dur: .06, vol: .08 }) }
    if (c === 'h') noise(ac, out, t, { dur: .035, vol: .05, filter: 'highpass', f: 7500 })
    if (c === 'C') noise(ac, out, t, { dur: .9, vol: .14, filter: 'highpass', f: 5000 })
  })
  return song.lead.length * step
}

const Sound = (() => {
  let ac = null, sfxBus, musBus, on = false, current = null, loopTimer = null, musGain = null
  const log = []
  window.__audioLog = log
  const stamp = () => performance.timeOrigin + performance.now()

  function graph(ctx) {
    const master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination)
    const s = ctx.createGain(); s.gain.value = 0.9; s.connect(master)
    const m = ctx.createGain(); m.gain.value = 0.5; m.connect(master)
    return { s, m }
  }
  function ensure() {
    if (!ac) { ac = new AudioContext(); const g = graph(ac); sfxBus = g.s; musBus = g.m; window.__busReady?.(sfxBus, musBus) }
    if (ac.state === 'suspended') ac.resume()
  }
  function startMusic(name) {
    stopNodes()
    const song = SONGS[name]; if (!song || !on) return
    ensure()
    musGain = ac.createGain(); musGain.connect(musBus)
    let next = ac.currentTime + 0.15   // a short lead-in: the first pass (mixer, reverb, a song's worth of notes) is built in time
    const pass = () => { next += scheduleSong(ac, musGain, song, next) }
    pass()
    if (song.loop) loopTimer = setInterval(() => { if (ac.currentTime > next - 2.5) pass() }, 250)
  }
  function stopNodes() {
    if (loopTimer) { clearInterval(loopTimer); loopTimer = null }
    if (musGain) { const g = musGain; musGain = null; g.__stopped = true; try { g.gain.setTargetAtTime(0, ac.currentTime, 0.05); setTimeout(() => g.disconnect(), 400) } catch {} }
  }
  return {
    sfx(name) {
      log.push({ t: stamp(), kind: 'sfx', name })
      if (!on || !SFX[name]) return
      ensure(); SFX[name].synth(ac, sfxBus, ac.currentTime + 0.005)
    },
    cry(id, rate = 1) { log.push({ t: stamp(), kind: 'cry', id, rate }); if (!on) return; ensure(); window.__playCry?.(ac, sfxBus, id, rate) },
    music(name) { log.push({ t: stamp(), kind: 'music', name }); current = name; startMusic(name) },
    stopMusic() { log.push({ t: stamp(), kind: 'music', name: null }); current = null; stopNodes() },
    setOn(v) {
      on = v
      try { localStorage.setItem('vvm-sound', v ? '1' : '0') } catch {}
      if (v) { ensure(); if (current) startMusic(current) } else stopNodes()
    },
    get on() { return on },
  }
})()

/** Re-renders everything that played between two moments, offline, as WAV.
    Used to put sound on the recorded video; the page never needs it. */
window.__renderAudio = async (fromMs, toMs, rate = 22050) => {
  const dur = (toMs - fromMs) / 1000
  const ac = new OfflineAudioContext(1, Math.ceil(dur * rate), rate)
  const master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination)
  const s = ac.createGain(); s.gain.value = 0.9; s.connect(master)
  const m = ac.createGain(); m.gain.value = 0.5; m.connect(master)
  const log = window.__audioLog.filter((e) => e.t <= toMs)
  await window.__scheduleCries?.(ac, s, log, fromMs)
  log.forEach((e, i) => {
    const t = (e.t - fromMs) / 1000
    if (e.kind === 'sfx' && t >= 0 && SFX[e.name]) SFX[e.name].synth(ac, s, t)
    if (e.kind === 'music' && e.name) {
      const song = SONGS[e.name]
      const end = (log.slice(i + 1).find((x) => x.kind === 'music')?.t ?? toMs) - fromMs
      const g = ac.createGain(); g.connect(m)
      g.gain.setValueAtTime(1, Math.max(0, end / 1000)); g.gain.linearRampToValueAtTime(0, Math.max(0, end / 1000) + 0.08)
      let t0 = t + 0.06
      do { const len = scheduleSong(ac, g, song, t0); t0 += len } while (song.loop && t0 < end / 1000)
    }
  })
  const buf = await ac.startRendering()
  const d = buf.getChannelData(0), n = d.length
  const out = new DataView(new ArrayBuffer(44 + n * 2))
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 0x7fff, true)
  const bytes = new Uint8Array(out.buffer); let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}


/* ══════════════════════════════ WILD MOCKUP ══════════════════════════════ */

const DATA = {"regions":["Kanto","Johto","Hoenn","Sinnoh","Unova","Kalos","Alola","Galar","Paldea"],"starters":[{"id":1,"name":"BULBASAUR","types":["grass","poison"],"base":{"hp":45,"attack":49,"defense":49,"special-attack":65,"special-defense":65,"speed":45},"capture":45,"region":0},{"id":4,"name":"CHARMANDER","types":["fire"],"base":{"hp":39,"attack":52,"defense":43,"special-attack":60,"special-defense":50,"speed":65},"capture":45,"region":0},{"id":7,"name":"SQUIRTLE","types":["water"],"base":{"hp":44,"attack":48,"defense":65,"special-attack":50,"special-defense":64,"speed":43},"capture":45,"region":0},{"id":152,"name":"CHIKORITA","types":["grass"],"base":{"hp":45,"attack":49,"defense":65,"special-attack":49,"special-defense":65,"speed":45},"capture":45,"region":1},{"id":155,"name":"CYNDAQUIL","types":["fire"],"base":{"hp":39,"attack":52,"defense":43,"special-attack":60,"special-defense":50,"speed":65},"capture":45,"region":1},{"id":158,"name":"TOTODILE","types":["water"],"base":{"hp":50,"attack":65,"defense":64,"special-attack":44,"special-defense":48,"speed":43},"capture":45,"region":1},{"id":252,"name":"TREECKO","types":["grass"],"base":{"hp":40,"attack":45,"defense":35,"special-attack":65,"special-defense":55,"speed":70},"capture":45,"region":2},{"id":255,"name":"TORCHIC","types":["fire"],"base":{"hp":45,"attack":60,"defense":40,"special-attack":70,"special-defense":50,"speed":45},"capture":45,"region":2},{"id":258,"name":"MUDKIP","types":["water"],"base":{"hp":50,"attack":70,"defense":50,"special-attack":50,"special-defense":50,"speed":40},"capture":45,"region":2},{"id":387,"name":"TURTWIG","types":["grass"],"base":{"hp":55,"attack":68,"defense":64,"special-attack":45,"special-defense":55,"speed":31},"capture":45,"region":3},{"id":390,"name":"CHIMCHAR","types":["fire"],"base":{"hp":44,"attack":58,"defense":44,"special-attack":58,"special-defense":44,"speed":61},"capture":45,"region":3},{"id":393,"name":"PIPLUP","types":["water"],"base":{"hp":53,"attack":51,"defense":53,"special-attack":61,"special-defense":56,"speed":40},"capture":45,"region":3},{"id":495,"name":"SNIVY","types":["grass"],"base":{"hp":45,"attack":45,"defense":55,"special-attack":45,"special-defense":55,"speed":63},"capture":45,"region":4},{"id":498,"name":"TEPIG","types":["fire"],"base":{"hp":65,"attack":63,"defense":45,"special-attack":45,"special-defense":45,"speed":45},"capture":45,"region":4},{"id":501,"name":"OSHAWOTT","types":["water"],"base":{"hp":55,"attack":55,"defense":45,"special-attack":63,"special-defense":45,"speed":45},"capture":45,"region":4},{"id":650,"name":"CHESPIN","types":["grass"],"base":{"hp":56,"attack":61,"defense":65,"special-attack":48,"special-defense":45,"speed":38},"capture":45,"region":5},{"id":653,"name":"FENNEKIN","types":["fire"],"base":{"hp":40,"attack":45,"defense":40,"special-attack":62,"special-defense":60,"speed":60},"capture":45,"region":5},{"id":656,"name":"FROAKIE","types":["water"],"base":{"hp":41,"attack":56,"defense":40,"special-attack":62,"special-defense":44,"speed":71},"capture":45,"region":5},{"id":722,"name":"ROWLET","types":["grass","flying"],"base":{"hp":68,"attack":55,"defense":55,"special-attack":50,"special-defense":50,"speed":42},"capture":45,"region":6},{"id":725,"name":"LITTEN","types":["fire"],"base":{"hp":45,"attack":65,"defense":40,"special-attack":60,"special-defense":40,"speed":70},"capture":45,"region":6},{"id":728,"name":"POPPLIO","types":["water"],"base":{"hp":50,"attack":54,"defense":54,"special-attack":66,"special-defense":56,"speed":40},"capture":45,"region":6},{"id":810,"name":"GROOKEY","types":["grass"],"base":{"hp":50,"attack":65,"defense":50,"special-attack":40,"special-defense":40,"speed":65},"capture":45,"region":7},{"id":813,"name":"SCORBUNNY","types":["fire"],"base":{"hp":50,"attack":71,"defense":40,"special-attack":40,"special-defense":40,"speed":69},"capture":45,"region":7},{"id":816,"name":"SOBBLE","types":["water"],"base":{"hp":50,"attack":40,"defense":40,"special-attack":70,"special-defense":40,"speed":70},"capture":45,"region":7},{"id":906,"name":"SPRIGATITO","types":["grass"],"base":{"hp":40,"attack":61,"defense":54,"special-attack":45,"special-defense":45,"speed":65},"capture":45,"region":8},{"id":909,"name":"FUECOCO","types":["fire"],"base":{"hp":67,"attack":45,"defense":59,"special-attack":63,"special-defense":40,"speed":36},"capture":45,"region":8},{"id":912,"name":"QUAXLY","types":["water"],"base":{"hp":55,"attack":65,"defense":45,"special-attack":50,"special-defense":45,"speed":50},"capture":45,"region":8}],"wild":[{"id":133,"name":"EEVEE","types":["normal"],"base":{"hp":55,"attack":55,"defense":50,"special-attack":45,"special-defense":65,"speed":55},"capture":45,"evo":"Lv 25 (stand-in): Espeon, Umbreon, Leafeon, Glaceon or Sylveon. Stones later."},{"id":447,"name":"RIOLU","types":["fighting"],"base":{"hp":40,"attack":70,"defense":40,"special-attack":35,"special-defense":40,"speed":60},"capture":75,"evo":"Lucario at Lv 25 (stand-in)"},{"id":885,"name":"DREEPY","types":["dragon","ghost"],"base":{"hp":28,"attack":60,"defense":30,"special-attack":40,"special-defense":30,"speed":82},"capture":45,"evo":"Drakloak at Lv 50"},{"id":443,"name":"GIBLE","types":["dragon","ground"],"base":{"hp":58,"attack":70,"defense":45,"special-attack":40,"special-defense":45,"speed":42},"capture":45,"evo":"Gabite at Lv 24"},{"id":172,"name":"PICHU","types":["electric"],"base":{"hp":20,"attack":40,"defense":15,"special-attack":35,"special-defense":35,"speed":60},"capture":190,"evo":"Pikachu at Lv 15 (stand-in)"},{"id":129,"name":"MAGIKARP","types":["water"],"base":{"hp":20,"attack":10,"defense":55,"special-attack":15,"special-defense":20,"speed":80},"capture":255,"evo":"Gyarados at Lv 20"},{"id":246,"name":"LARVITAR","types":["rock","ground"],"base":{"hp":50,"attack":64,"defense":50,"special-attack":45,"special-defense":50,"speed":41},"capture":45,"evo":"Pupitar at Lv 30"},{"id":194,"name":"WOOPER","types":["water","ground"],"base":{"hp":55,"attack":45,"defense":45,"special-attack":25,"special-defense":25,"speed":15},"capture":255,"evo":"Quagsire at Lv 20"},{"id":399,"name":"BIDOOF","types":["normal"],"base":{"hp":59,"attack":45,"defense":40,"special-attack":35,"special-defense":40,"speed":31},"capture":255,"evo":"Lv 15: Bibarel"},{"id":54,"name":"PSYDUCK","types":["water"],"base":{"hp":50,"attack":52,"defense":48,"special-attack":65,"special-defense":50,"speed":55},"capture":190,"evo":"Lv 33: Golduck"},{"id":16,"name":"PIDGEY","types":["normal","flying"],"base":{"hp":40,"attack":45,"defense":40,"special-attack":35,"special-defense":35,"speed":56},"capture":255,"evo":"Lv 18: Pidgeotto"},{"id":163,"name":"HOOTHOOT","types":["normal","flying"],"base":{"hp":60,"attack":30,"defense":30,"special-attack":36,"special-defense":56,"speed":50},"capture":255,"evo":"Lv 20: Noctowl"},{"id":190,"name":"AIPOM","types":["normal"],"base":{"hp":55,"attack":70,"defense":55,"special-attack":40,"special-defense":55,"speed":85},"capture":45,"evo":"Lv 32 (stand-in): Ambipom"},{"id":108,"name":"LICKITUNG","types":["normal"],"base":{"hp":90,"attack":55,"defense":75,"special-attack":60,"special-defense":75,"speed":30},"capture":45,"evo":"Lv 33 (stand-in): Lickilicky"},{"id":92,"name":"GASTLY","types":["ghost","poison"],"base":{"hp":30,"attack":35,"defense":30,"special-attack":100,"special-defense":35,"speed":80},"capture":190,"evo":"Lv 25: Haunter"},{"id":81,"name":"MAGNEMITE","types":["electric","steel"],"base":{"hp":25,"attack":35,"defense":70,"special-attack":95,"special-defense":55,"speed":45},"capture":190,"evo":"Lv 30: Magneton"},{"id":86,"name":"SEEL","types":["water"],"base":{"hp":65,"attack":45,"defense":55,"special-attack":45,"special-defense":70,"speed":45},"capture":190,"evo":"Lv 34: Dewgong"},{"id":220,"name":"SWINUB","types":["ice","ground"],"base":{"hp":50,"attack":50,"defense":40,"special-attack":30,"special-defense":30,"speed":50},"capture":225,"evo":"Lv 33: Piloswine"},{"id":116,"name":"HORSEA","types":["water"],"base":{"hp":30,"attack":40,"defense":70,"special-attack":70,"special-defense":25,"speed":60},"capture":225,"evo":"Lv 32: Seadra"}],"trainer":[{"id":1000,"name":"GHOLDENGO","types":["steel","ghost"],"base":{"hp":87,"attack":60,"defense":95,"special-attack":133,"special-defense":91,"speed":84},"capture":45},{"id":450,"name":"HIPPOWDON","types":["ground"],"base":{"hp":108,"attack":112,"defense":118,"special-attack":68,"special-defense":72,"speed":47},"capture":60},{"id":53,"name":"PERSIAN","types":["normal"],"base":{"hp":65,"attack":70,"defense":60,"special-attack":65,"special-defense":65,"speed":115},"capture":90},{"id":302,"name":"SABLEYE","types":["dark","ghost"],"base":{"hp":50,"attack":75,"defense":75,"special-attack":65,"special-defense":65,"speed":50},"capture":45},{"id":303,"name":"MAWILE","types":["steel","fairy"],"base":{"hp":50,"attack":85,"defense":85,"special-attack":55,"special-defense":55,"speed":50},"capture":45},{"id":820,"name":"GREEDENT","types":["normal"],"base":{"hp":120,"attack":95,"defense":95,"special-attack":55,"special-defense":75,"speed":20},"capture":90},{"id":143,"name":"SNORLAX","types":["normal"],"base":{"hp":160,"attack":110,"defense":65,"special-attack":65,"special-defense":110,"speed":30},"capture":25},{"id":569,"name":"GARBODOR","types":["poison"],"base":{"hp":80,"attack":95,"defense":82,"special-attack":60,"special-defense":82,"speed":75},"capture":60},{"id":399,"name":"BIDOOF","types":["normal"],"base":{"hp":59,"attack":45,"defense":40,"special-attack":35,"special-defense":40,"speed":31},"capture":255},{"id":191,"name":"SUNKERN","types":["grass"],"base":{"hp":30,"attack":30,"defense":30,"special-attack":30,"special-defense":30,"speed":30},"capture":235},{"id":54,"name":"PSYDUCK","types":["water"],"base":{"hp":50,"attack":52,"defense":48,"special-attack":65,"special-defense":50,"speed":55},"capture":190},{"id":129,"name":"MAGIKARP","types":["water"],"base":{"hp":20,"attack":10,"defense":55,"special-attack":15,"special-defense":20,"speed":80},"capture":255},{"id":137,"name":"PORYGON","types":["normal"],"base":{"hp":65,"attack":60,"defense":70,"special-attack":85,"special-defense":75,"speed":40},"capture":45},{"id":16,"name":"PIDGEY","types":["normal","flying"],"base":{"hp":40,"attack":45,"defense":40,"special-attack":35,"special-defense":35,"speed":56},"capture":255},{"id":163,"name":"HOOTHOOT","types":["normal","flying"],"base":{"hp":60,"attack":30,"defense":30,"special-attack":36,"special-defense":56,"speed":50},"capture":255},{"id":17,"name":"PIDGEOTTO","types":["normal","flying"],"base":{"hp":63,"attack":60,"defense":55,"special-attack":50,"special-defense":50,"speed":71},"capture":120},{"id":11,"name":"METAPOD","types":["bug"],"base":{"hp":50,"attack":20,"defense":55,"special-attack":25,"special-defense":25,"speed":30},"capture":120},{"id":14,"name":"KAKUNA","types":["bug","poison"],"base":{"hp":45,"attack":25,"defense":50,"special-attack":25,"special-defense":25,"speed":35},"capture":120},{"id":123,"name":"SCYTHER","types":["bug","flying"],"base":{"hp":70,"attack":110,"defense":80,"special-attack":55,"special-defense":80,"speed":105},"capture":45},{"id":35,"name":"CLEFAIRY","types":["fairy"],"base":{"hp":70,"attack":45,"defense":48,"special-attack":60,"special-defense":65,"speed":35},"capture":150},{"id":190,"name":"AIPOM","types":["normal"],"base":{"hp":55,"attack":70,"defense":55,"special-attack":40,"special-defense":55,"speed":85},"capture":45},{"id":108,"name":"LICKITUNG","types":["normal"],"base":{"hp":90,"attack":55,"defense":75,"special-attack":60,"special-defense":75,"speed":30},"capture":45},{"id":241,"name":"MILTANK","types":["normal"],"base":{"hp":95,"attack":80,"defense":105,"special-attack":40,"special-defense":70,"speed":100},"capture":45},{"id":92,"name":"GASTLY","types":["ghost","poison"],"base":{"hp":30,"attack":35,"defense":30,"special-attack":100,"special-defense":35,"speed":80},"capture":190},{"id":93,"name":"HAUNTER","types":["ghost","poison"],"base":{"hp":45,"attack":50,"defense":45,"special-attack":115,"special-defense":55,"speed":95},"capture":90},{"id":200,"name":"MISDREAVUS","types":["ghost"],"base":{"hp":60,"attack":60,"defense":60,"special-attack":85,"special-defense":85,"speed":85},"capture":45},{"id":94,"name":"GENGAR","types":["ghost","poison"],"base":{"hp":60,"attack":65,"defense":60,"special-attack":130,"special-defense":75,"speed":110},"capture":45},{"id":57,"name":"PRIMEAPE","types":["fighting"],"base":{"hp":65,"attack":105,"defense":60,"special-attack":60,"special-defense":70,"speed":95},"capture":75},{"id":67,"name":"MACHOKE","types":["fighting"],"base":{"hp":80,"attack":100,"defense":70,"special-attack":50,"special-defense":60,"speed":45},"capture":90},{"id":106,"name":"HITMONLEE","types":["fighting"],"base":{"hp":50,"attack":120,"defense":53,"special-attack":35,"special-defense":110,"speed":87},"capture":45},{"id":107,"name":"HITMONCHAN","types":["fighting"],"base":{"hp":50,"attack":105,"defense":79,"special-attack":35,"special-defense":110,"speed":76},"capture":45},{"id":62,"name":"POLIWRATH","types":["water","fighting"],"base":{"hp":90,"attack":95,"defense":95,"special-attack":70,"special-defense":90,"speed":70},"capture":45},{"id":81,"name":"MAGNEMITE","types":["electric","steel"],"base":{"hp":25,"attack":35,"defense":70,"special-attack":95,"special-defense":55,"speed":45},"capture":190},{"id":227,"name":"SKARMORY","types":["steel","flying"],"base":{"hp":65,"attack":80,"defense":140,"special-attack":40,"special-defense":70,"speed":70},"capture":25},{"id":205,"name":"FORRETRESS","types":["bug","steel"],"base":{"hp":75,"attack":90,"defense":140,"special-attack":60,"special-defense":60,"speed":40},"capture":75},{"id":208,"name":"STEELIX","types":["steel","ground"],"base":{"hp":75,"attack":85,"defense":200,"special-attack":55,"special-defense":65,"speed":30},"capture":25},{"id":86,"name":"SEEL","types":["water"],"base":{"hp":65,"attack":45,"defense":55,"special-attack":45,"special-defense":70,"speed":45},"capture":190},{"id":87,"name":"DEWGONG","types":["water","ice"],"base":{"hp":90,"attack":70,"defense":80,"special-attack":70,"special-defense":95,"speed":70},"capture":75},{"id":220,"name":"SWINUB","types":["ice","ground"],"base":{"hp":50,"attack":50,"defense":40,"special-attack":30,"special-defense":30,"speed":50},"capture":225},{"id":124,"name":"JYNX","types":["ice","psychic"],"base":{"hp":65,"attack":50,"defense":35,"special-attack":115,"special-defense":95,"speed":95},"capture":45},{"id":131,"name":"LAPRAS","types":["water","ice"],"base":{"hp":130,"attack":85,"defense":80,"special-attack":85,"special-defense":95,"speed":60},"capture":45},{"id":221,"name":"PILOSWINE","types":["ice","ground"],"base":{"hp":100,"attack":100,"defense":80,"special-attack":60,"special-defense":60,"speed":50},"capture":75},{"id":116,"name":"HORSEA","types":["water"],"base":{"hp":30,"attack":40,"defense":70,"special-attack":70,"special-defense":25,"speed":60},"capture":225},{"id":117,"name":"SEADRA","types":["water"],"base":{"hp":55,"attack":65,"defense":95,"special-attack":95,"special-defense":45,"speed":85},"capture":75},{"id":130,"name":"GYARADOS","types":["water","flying"],"base":{"hp":95,"attack":125,"defense":79,"special-attack":60,"special-defense":100,"speed":81},"capture":45},{"id":148,"name":"DRAGONAIR","types":["dragon"],"base":{"hp":61,"attack":84,"defense":65,"special-attack":70,"special-defense":70,"speed":70},"capture":45},{"id":230,"name":"KINGDRA","types":["water","dragon"],"base":{"hp":75,"attack":95,"defense":95,"special-attack":95,"special-defense":95,"speed":85},"capture":45},{"id":300,"name":"SKITTY","types":["normal"],"base":{"hp":50,"attack":45,"defense":45,"special-attack":35,"special-defense":35,"speed":50},"capture":255},{"id":113,"name":"CHANSEY","types":["normal"],"base":{"hp":250,"attack":5,"defense":5,"special-attack":35,"special-defense":105,"speed":50},"capture":30},{"id":242,"name":"BLISSEY","types":["normal"],"base":{"hp":255,"attack":10,"defense":10,"special-attack":75,"special-defense":135,"speed":55},"capture":30},{"id":504,"name":"PATRAT","types":["normal"],"base":{"hp":45,"attack":55,"defense":39,"special-attack":35,"special-defense":39,"speed":42},"capture":255},{"id":505,"name":"WATCHOG","types":["normal"],"base":{"hp":60,"attack":85,"defense":69,"special-attack":60,"special-defense":69,"speed":77},"capture":255},{"id":287,"name":"SLAKOTH","types":["normal"],"base":{"hp":60,"attack":60,"defense":60,"special-attack":35,"special-defense":35,"speed":30},"capture":255},{"id":96,"name":"DROWZEE","types":["psychic"],"base":{"hp":60,"attack":48,"defense":45,"special-attack":43,"special-defense":90,"speed":42},"capture":190},{"id":39,"name":"JIGGLYPUFF","types":["normal","fairy"],"base":{"hp":115,"attack":45,"defense":20,"special-attack":45,"special-defense":25,"speed":20},"capture":170},{"id":311,"name":"PLUSLE","types":["electric"],"base":{"hp":60,"attack":50,"defense":40,"special-attack":85,"special-defense":75,"speed":95},"capture":200},{"id":312,"name":"MINUN","types":["electric"],"base":{"hp":60,"attack":40,"defense":50,"special-attack":75,"special-defense":85,"speed":95},"capture":200},{"id":25,"name":"PIKACHU","types":["electric"],"base":{"hp":35,"attack":55,"defense":40,"special-attack":50,"special-defense":50,"speed":90},"capture":190},{"id":441,"name":"CHATOT","types":["normal","flying"],"base":{"hp":76,"attack":65,"defense":45,"special-attack":92,"special-defense":42,"speed":91},"capture":30},{"id":479,"name":"ROTOM","types":["electric","ghost"],"base":{"hp":50,"attack":50,"defense":77,"special-attack":95,"special-defense":77,"speed":91},"capture":45},{"id":819,"name":"SKWOVET","types":["normal"],"base":{"hp":70,"attack":55,"defense":55,"special-attack":35,"special-defense":35,"speed":25},"capture":255},{"id":357,"name":"TROPIUS","types":["grass","flying"],"base":{"hp":99,"attack":68,"defense":83,"special-attack":72,"special-defense":87,"speed":51},"capture":200},{"id":58,"name":"GROWLITHE","types":["fire"],"base":{"hp":55,"attack":70,"defense":45,"special-attack":70,"special-defense":50,"speed":60},"capture":190},{"id":59,"name":"ARCANINE","types":["fire"],"base":{"hp":90,"attack":110,"defense":80,"special-attack":100,"special-defense":80,"speed":95},"capture":75},{"id":79,"name":"SLOWPOKE","types":["water","psychic"],"base":{"hp":90,"attack":65,"defense":65,"special-attack":40,"special-defense":40,"speed":15},"capture":190},{"id":177,"name":"NATU","types":["psychic","flying"],"base":{"hp":40,"attack":50,"defense":45,"special-attack":70,"special-defense":45,"speed":70},"capture":190},{"id":64,"name":"KADABRA","types":["psychic"],"base":{"hp":40,"attack":35,"defense":30,"special-attack":120,"special-defense":70,"speed":105},"capture":100},{"id":509,"name":"PURRLOIN","types":["dark"],"base":{"hp":41,"attack":50,"defense":37,"special-attack":50,"special-defense":37,"speed":66},"capture":255},{"id":453,"name":"CROAGUNK","types":["poison","fighting"],"base":{"hp":48,"attack":61,"defense":40,"special-attack":61,"special-defense":40,"speed":50},"capture":140},{"id":510,"name":"LIEPARD","types":["dark"],"base":{"hp":64,"attack":88,"defense":50,"special-attack":88,"special-defense":50,"speed":106},"capture":90},{"id":132,"name":"DITTO","types":["normal"],"base":{"hp":48,"attack":48,"defense":48,"special-attack":48,"special-defense":48,"speed":48},"capture":35},{"id":235,"name":"SMEARGLE","types":["normal"],"base":{"hp":55,"attack":20,"defense":35,"special-attack":20,"special-defense":45,"speed":75},"capture":45},{"id":778,"name":"MIMIKYU","types":["ghost","fairy"],"base":{"hp":55,"attack":90,"defense":80,"special-attack":50,"special-defense":105,"speed":96},"capture":45},{"id":178,"name":"XATU","types":["psychic","flying"],"base":{"hp":65,"attack":75,"defense":70,"special-attack":95,"special-defense":70,"speed":95},"capture":75},{"id":103,"name":"EXEGGUTOR","types":["grass","psychic"],"base":{"hp":95,"attack":95,"defense":85,"special-attack":125,"special-defense":75,"speed":55},"capture":45},{"id":80,"name":"SLOWBRO","types":["water","psychic"],"base":{"hp":95,"attack":75,"defense":110,"special-attack":100,"special-defense":80,"speed":30},"capture":75},{"id":168,"name":"ARIADOS","types":["bug","poison"],"base":{"hp":70,"attack":90,"defense":70,"special-attack":60,"special-defense":70,"speed":40},"capture":90},{"id":49,"name":"VENOMOTH","types":["bug","poison"],"base":{"hp":70,"attack":65,"defense":60,"special-attack":90,"special-defense":75,"speed":90},"capture":75},{"id":89,"name":"MUK","types":["poison"],"base":{"hp":105,"attack":105,"defense":75,"special-attack":65,"special-defense":100,"speed":50},"capture":75},{"id":169,"name":"CROBAT","types":["poison","flying"],"base":{"hp":85,"attack":90,"defense":80,"special-attack":70,"special-defense":80,"speed":130},"capture":90},{"id":237,"name":"HITMONTOP","types":["fighting"],"base":{"hp":50,"attack":95,"defense":95,"special-attack":35,"special-defense":110,"speed":70},"capture":45},{"id":95,"name":"ONIX","types":["rock","ground"],"base":{"hp":35,"attack":45,"defense":160,"special-attack":30,"special-defense":45,"speed":70},"capture":45},{"id":68,"name":"MACHAMP","types":["fighting"],"base":{"hp":90,"attack":130,"defense":80,"special-attack":65,"special-defense":85,"speed":55},"capture":45},{"id":197,"name":"UMBREON","types":["dark"],"base":{"hp":95,"attack":65,"defense":110,"special-attack":60,"special-defense":130,"speed":65},"capture":45},{"id":45,"name":"VILEPLUME","types":["grass","poison"],"base":{"hp":75,"attack":80,"defense":85,"special-attack":110,"special-defense":90,"speed":50},"capture":45},{"id":198,"name":"MURKROW","types":["dark","flying"],"base":{"hp":60,"attack":85,"defense":42,"special-attack":85,"special-defense":42,"speed":91},"capture":30},{"id":229,"name":"HOUNDOOM","types":["dark","fire"],"base":{"hp":75,"attack":90,"defense":50,"special-attack":110,"special-defense":80,"speed":95},"capture":45},{"id":149,"name":"DRAGONITE","types":["dragon","flying"],"base":{"hp":91,"attack":134,"defense":95,"special-attack":100,"special-defense":100,"speed":80},"capture":45},{"id":6,"name":"CHARIZARD","types":["fire","flying"],"base":{"hp":78,"attack":84,"defense":78,"special-attack":109,"special-defense":85,"speed":100},"capture":45},{"id":142,"name":"AERODACTYL","types":["rock","flying"],"base":{"hp":80,"attack":105,"defense":65,"special-attack":60,"special-defense":75,"speed":130},"capture":45},{"id":75,"name":"GRAVELER","types":["rock","ground"],"base":{"hp":55,"attack":95,"defense":115,"special-attack":45,"special-defense":45,"speed":35},"capture":120},{"id":111,"name":"RHYHORN","types":["ground","rock"],"base":{"hp":80,"attack":85,"defense":95,"special-attack":30,"special-defense":30,"speed":25},"capture":120},{"id":139,"name":"OMASTAR","types":["rock","water"],"base":{"hp":70,"attack":60,"defense":125,"special-attack":115,"special-defense":70,"speed":55},"capture":45},{"id":141,"name":"KABUTOPS","types":["rock","water"],"base":{"hp":60,"attack":115,"defense":105,"special-attack":65,"special-defense":70,"speed":80},"capture":45},{"id":55,"name":"GOLDUCK","types":["water"],"base":{"hp":80,"attack":82,"defense":78,"special-attack":95,"special-defense":80,"speed":85},"capture":75},{"id":195,"name":"QUAGSIRE","types":["water","ground"],"base":{"hp":95,"attack":85,"defense":85,"special-attack":65,"special-defense":65,"speed":35},"capture":90},{"id":121,"name":"STARMIE","types":["water","psychic"],"base":{"hp":60,"attack":75,"defense":85,"special-attack":100,"special-defense":85,"speed":115},"capture":60},{"id":119,"name":"SEAKING","types":["water"],"base":{"hp":80,"attack":92,"defense":65,"special-attack":65,"special-defense":80,"speed":68},"capture":60},{"id":26,"name":"RAICHU","types":["electric"],"base":{"hp":60,"attack":90,"defense":55,"special-attack":90,"special-defense":80,"speed":110},"capture":75},{"id":101,"name":"ELECTRODE","types":["electric"],"base":{"hp":60,"attack":50,"defense":70,"special-attack":80,"special-defense":80,"speed":150},"capture":60},{"id":82,"name":"MAGNETON","types":["electric","steel"],"base":{"hp":50,"attack":60,"defense":95,"special-attack":120,"special-defense":70,"speed":70},"capture":60},{"id":125,"name":"ELECTABUZZ","types":["electric"],"base":{"hp":65,"attack":83,"defense":57,"special-attack":95,"special-defense":85,"speed":105},"capture":45},{"id":114,"name":"TANGELA","types":["grass"],"base":{"hp":65,"attack":55,"defense":115,"special-attack":100,"special-defense":40,"speed":60},"capture":45},{"id":189,"name":"JUMPLUFF","types":["grass","flying"],"base":{"hp":75,"attack":55,"defense":70,"special-attack":55,"special-defense":95,"speed":110},"capture":45},{"id":71,"name":"VICTREEBEL","types":["grass","poison"],"base":{"hp":80,"attack":105,"defense":65,"special-attack":100,"special-defense":70,"speed":70},"capture":45},{"id":182,"name":"BELLOSSOM","types":["grass"],"base":{"hp":75,"attack":80,"defense":95,"special-attack":90,"special-defense":100,"speed":50},"capture":45},{"id":110,"name":"WEEZING","types":["poison"],"base":{"hp":65,"attack":90,"defense":120,"special-attack":85,"special-defense":70,"speed":60},"capture":60},{"id":196,"name":"ESPEON","types":["psychic"],"base":{"hp":65,"attack":65,"defense":60,"special-attack":130,"special-defense":95,"speed":110},"capture":45},{"id":122,"name":"MR. MIME","types":["psychic","fairy"],"base":{"hp":40,"attack":45,"defense":65,"special-attack":100,"special-defense":120,"speed":90},"capture":45},{"id":65,"name":"ALAKAZAM","types":["psychic"],"base":{"hp":55,"attack":50,"defense":45,"special-attack":135,"special-defense":95,"speed":120},"capture":50},{"id":219,"name":"MAGCARGO","types":["fire","rock"],"base":{"hp":60,"attack":50,"defense":120,"special-attack":90,"special-defense":80,"speed":30},"capture":75},{"id":38,"name":"NINETALES","types":["fire"],"base":{"hp":73,"attack":76,"defense":75,"special-attack":81,"special-defense":100,"speed":100},"capture":75},{"id":126,"name":"MAGMAR","types":["fire"],"base":{"hp":65,"attack":95,"defense":57,"special-attack":100,"special-defense":85,"speed":93},"capture":45},{"id":78,"name":"RAPIDASH","types":["fire"],"base":{"hp":65,"attack":100,"defense":70,"special-attack":80,"special-defense":80,"speed":105},"capture":60},{"id":18,"name":"PIDGEOT","types":["normal","flying"],"base":{"hp":83,"attack":80,"defense":75,"special-attack":70,"special-defense":70,"speed":101},"capture":45},{"id":112,"name":"RHYDON","types":["ground","rock"],"base":{"hp":105,"attack":130,"defense":120,"special-attack":45,"special-defense":45,"speed":40},"capture":60},{"id":243,"name":"RAIKOU","types":["electric"],"base":{"hp":90,"attack":85,"defense":75,"special-attack":115,"special-defense":100,"speed":115},"capture":3},{"id":244,"name":"ENTEI","types":["fire"],"base":{"hp":115,"attack":115,"defense":85,"special-attack":90,"special-defense":75,"speed":100},"capture":3},{"id":245,"name":"SUICUNE","types":["water"],"base":{"hp":100,"attack":75,"defense":115,"special-attack":90,"special-defense":115,"speed":85},"capture":3},{"id":76,"name":"GOLEM","types":["rock","ground"],"base":{"hp":80,"attack":120,"defense":130,"special-attack":55,"special-defense":65,"speed":45},"capture":45}],"forms":[{"id":2,"name":"IVYSAUR","types":["grass","poison"],"base":{"hp":60,"attack":62,"defense":63,"special-attack":80,"special-defense":80,"speed":60},"capture":45},{"id":3,"name":"VENUSAUR","types":["grass","poison"],"base":{"hp":80,"attack":82,"defense":83,"special-attack":100,"special-defense":100,"speed":80},"capture":45},{"id":5,"name":"CHARMELEON","types":["fire"],"base":{"hp":58,"attack":64,"defense":58,"special-attack":80,"special-defense":65,"speed":80},"capture":45},{"id":8,"name":"WARTORTLE","types":["water"],"base":{"hp":59,"attack":63,"defense":80,"special-attack":65,"special-defense":80,"speed":58},"capture":45},{"id":9,"name":"BLASTOISE","types":["water"],"base":{"hp":79,"attack":83,"defense":100,"special-attack":85,"special-defense":105,"speed":78},"capture":45},{"id":153,"name":"BAYLEEF","types":["grass"],"base":{"hp":60,"attack":62,"defense":80,"special-attack":63,"special-defense":80,"speed":60},"capture":45},{"id":154,"name":"MEGANIUM","types":["grass"],"base":{"hp":80,"attack":82,"defense":100,"special-attack":83,"special-defense":100,"speed":80},"capture":45},{"id":156,"name":"QUILAVA","types":["fire"],"base":{"hp":58,"attack":64,"defense":58,"special-attack":80,"special-defense":65,"speed":80},"capture":45},{"id":157,"name":"TYPHLOSION","types":["fire"],"base":{"hp":78,"attack":84,"defense":78,"special-attack":109,"special-defense":85,"speed":100},"capture":45},{"id":159,"name":"CROCONAW","types":["water"],"base":{"hp":65,"attack":80,"defense":80,"special-attack":59,"special-defense":63,"speed":58},"capture":45},{"id":160,"name":"FERALIGATR","types":["water"],"base":{"hp":85,"attack":105,"defense":100,"special-attack":79,"special-defense":83,"speed":78},"capture":45},{"id":253,"name":"GROVYLE","types":["grass"],"base":{"hp":50,"attack":65,"defense":45,"special-attack":85,"special-defense":65,"speed":95},"capture":45},{"id":254,"name":"SCEPTILE","types":["grass"],"base":{"hp":70,"attack":85,"defense":65,"special-attack":105,"special-defense":85,"speed":120},"capture":45},{"id":256,"name":"COMBUSKEN","types":["fire","fighting"],"base":{"hp":60,"attack":85,"defense":60,"special-attack":85,"special-defense":60,"speed":55},"capture":45},{"id":257,"name":"BLAZIKEN","types":["fire","fighting"],"base":{"hp":80,"attack":120,"defense":70,"special-attack":110,"special-defense":70,"speed":80},"capture":45},{"id":259,"name":"MARSHTOMP","types":["water","ground"],"base":{"hp":70,"attack":85,"defense":70,"special-attack":60,"special-defense":70,"speed":50},"capture":45},{"id":260,"name":"SWAMPERT","types":["water","ground"],"base":{"hp":100,"attack":110,"defense":90,"special-attack":85,"special-defense":90,"speed":60},"capture":45},{"id":388,"name":"GROTLE","types":["grass"],"base":{"hp":75,"attack":89,"defense":85,"special-attack":55,"special-defense":65,"speed":36},"capture":45},{"id":389,"name":"TORTERRA","types":["grass","ground"],"base":{"hp":95,"attack":109,"defense":105,"special-attack":75,"special-defense":85,"speed":56},"capture":45},{"id":391,"name":"MONFERNO","types":["fire","fighting"],"base":{"hp":64,"attack":78,"defense":52,"special-attack":78,"special-defense":52,"speed":81},"capture":45},{"id":392,"name":"INFERNAPE","types":["fire","fighting"],"base":{"hp":76,"attack":104,"defense":71,"special-attack":104,"special-defense":71,"speed":108},"capture":45},{"id":394,"name":"PRINPLUP","types":["water"],"base":{"hp":64,"attack":66,"defense":68,"special-attack":81,"special-defense":76,"speed":50},"capture":45},{"id":395,"name":"EMPOLEON","types":["water","steel"],"base":{"hp":84,"attack":86,"defense":88,"special-attack":111,"special-defense":101,"speed":60},"capture":45},{"id":496,"name":"SERVINE","types":["grass"],"base":{"hp":60,"attack":60,"defense":75,"special-attack":60,"special-defense":75,"speed":83},"capture":45},{"id":497,"name":"SERPERIOR","types":["grass"],"base":{"hp":75,"attack":75,"defense":95,"special-attack":75,"special-defense":95,"speed":113},"capture":45},{"id":499,"name":"PIGNITE","types":["fire","fighting"],"base":{"hp":90,"attack":93,"defense":55,"special-attack":70,"special-defense":55,"speed":55},"capture":45},{"id":500,"name":"EMBOAR","types":["fire","fighting"],"base":{"hp":110,"attack":123,"defense":65,"special-attack":100,"special-defense":65,"speed":65},"capture":45},{"id":502,"name":"DEWOTT","types":["water"],"base":{"hp":75,"attack":75,"defense":60,"special-attack":83,"special-defense":60,"speed":60},"capture":45},{"id":503,"name":"SAMUROTT","types":["water"],"base":{"hp":95,"attack":100,"defense":85,"special-attack":108,"special-defense":70,"speed":70},"capture":45},{"id":651,"name":"QUILLADIN","types":["grass"],"base":{"hp":61,"attack":78,"defense":95,"special-attack":56,"special-defense":58,"speed":57},"capture":45},{"id":652,"name":"CHESNAUGHT","types":["grass","fighting"],"base":{"hp":88,"attack":107,"defense":122,"special-attack":74,"special-defense":75,"speed":64},"capture":45},{"id":654,"name":"BRAIXEN","types":["fire"],"base":{"hp":59,"attack":59,"defense":58,"special-attack":90,"special-defense":70,"speed":73},"capture":45},{"id":655,"name":"DELPHOX","types":["fire","psychic"],"base":{"hp":75,"attack":69,"defense":72,"special-attack":114,"special-defense":100,"speed":104},"capture":45},{"id":657,"name":"FROGADIER","types":["water"],"base":{"hp":54,"attack":63,"defense":52,"special-attack":83,"special-defense":56,"speed":97},"capture":45},{"id":658,"name":"GRENINJA","types":["water","dark"],"base":{"hp":72,"attack":95,"defense":67,"special-attack":103,"special-defense":71,"speed":122},"capture":45},{"id":723,"name":"DARTRIX","types":["grass","flying"],"base":{"hp":78,"attack":75,"defense":75,"special-attack":70,"special-defense":70,"speed":52},"capture":45},{"id":724,"name":"DECIDUEYE","types":["grass","ghost"],"base":{"hp":78,"attack":107,"defense":75,"special-attack":100,"special-defense":100,"speed":70},"capture":45},{"id":726,"name":"TORRACAT","types":["fire"],"base":{"hp":65,"attack":85,"defense":50,"special-attack":80,"special-defense":50,"speed":90},"capture":45},{"id":727,"name":"INCINEROAR","types":["fire","dark"],"base":{"hp":95,"attack":115,"defense":90,"special-attack":80,"special-defense":90,"speed":60},"capture":45},{"id":729,"name":"BRIONNE","types":["water"],"base":{"hp":60,"attack":69,"defense":69,"special-attack":91,"special-defense":81,"speed":50},"capture":45},{"id":730,"name":"PRIMARINA","types":["water","fairy"],"base":{"hp":80,"attack":74,"defense":74,"special-attack":126,"special-defense":116,"speed":60},"capture":45},{"id":811,"name":"THWACKEY","types":["grass"],"base":{"hp":70,"attack":85,"defense":70,"special-attack":55,"special-defense":60,"speed":80},"capture":45},{"id":812,"name":"RILLABOOM","types":["grass"],"base":{"hp":100,"attack":125,"defense":90,"special-attack":60,"special-defense":70,"speed":85},"capture":45},{"id":814,"name":"RABOOT","types":["fire"],"base":{"hp":65,"attack":86,"defense":60,"special-attack":55,"special-defense":60,"speed":94},"capture":45},{"id":815,"name":"CINDERACE","types":["fire"],"base":{"hp":80,"attack":116,"defense":75,"special-attack":65,"special-defense":75,"speed":119},"capture":45},{"id":817,"name":"DRIZZILE","types":["water"],"base":{"hp":65,"attack":60,"defense":55,"special-attack":95,"special-defense":55,"speed":90},"capture":45},{"id":818,"name":"INTELEON","types":["water"],"base":{"hp":70,"attack":85,"defense":65,"special-attack":125,"special-defense":65,"speed":120},"capture":45},{"id":907,"name":"FLORAGATO","types":["grass"],"base":{"hp":61,"attack":80,"defense":63,"special-attack":60,"special-defense":63,"speed":83},"capture":45},{"id":908,"name":"MEOWSCARADA","types":["grass","dark"],"base":{"hp":76,"attack":110,"defense":70,"special-attack":81,"special-defense":70,"speed":123},"capture":45},{"id":910,"name":"CROCALOR","types":["fire"],"base":{"hp":81,"attack":55,"defense":78,"special-attack":90,"special-defense":58,"speed":49},"capture":45},{"id":911,"name":"SKELEDIRGE","types":["fire","ghost"],"base":{"hp":104,"attack":75,"defense":100,"special-attack":110,"special-defense":75,"speed":66},"capture":45},{"id":913,"name":"QUAXWELL","types":["water"],"base":{"hp":70,"attack":85,"defense":65,"special-attack":65,"special-defense":60,"speed":65},"capture":45},{"id":914,"name":"QUAQUAVAL","types":["water","fighting"],"base":{"hp":85,"attack":120,"defense":80,"special-attack":85,"special-defense":75,"speed":85},"capture":45},{"id":134,"name":"VAPOREON","types":["water"],"base":{"hp":130,"attack":65,"defense":60,"special-attack":110,"special-defense":95,"speed":65},"capture":45},{"id":135,"name":"JOLTEON","types":["electric"],"base":{"hp":65,"attack":65,"defense":60,"special-attack":110,"special-defense":95,"speed":130},"capture":45},{"id":136,"name":"FLAREON","types":["fire"],"base":{"hp":65,"attack":130,"defense":60,"special-attack":95,"special-defense":110,"speed":65},"capture":45},{"id":470,"name":"LEAFEON","types":["grass"],"base":{"hp":65,"attack":110,"defense":130,"special-attack":60,"special-defense":65,"speed":95},"capture":45},{"id":471,"name":"GLACEON","types":["ice"],"base":{"hp":65,"attack":60,"defense":110,"special-attack":130,"special-defense":95,"speed":65},"capture":45},{"id":700,"name":"SYLVEON","types":["fairy"],"base":{"hp":95,"attack":65,"defense":65,"special-attack":110,"special-defense":130,"speed":60},"capture":45},{"id":448,"name":"LUCARIO","types":["fighting","steel"],"base":{"hp":70,"attack":110,"defense":70,"special-attack":115,"special-defense":70,"speed":90},"capture":45},{"id":886,"name":"DRAKLOAK","types":["dragon","ghost"],"base":{"hp":68,"attack":80,"defense":50,"special-attack":60,"special-defense":50,"speed":102},"capture":45},{"id":887,"name":"DRAGAPULT","types":["dragon","ghost"],"base":{"hp":88,"attack":120,"defense":75,"special-attack":100,"special-defense":75,"speed":142},"capture":45},{"id":444,"name":"GABITE","types":["dragon","ground"],"base":{"hp":68,"attack":90,"defense":65,"special-attack":50,"special-defense":55,"speed":82},"capture":45},{"id":445,"name":"GARCHOMP","types":["dragon","ground"],"base":{"hp":108,"attack":130,"defense":95,"special-attack":80,"special-defense":85,"speed":102},"capture":45},{"id":247,"name":"PUPITAR","types":["rock","ground"],"base":{"hp":70,"attack":84,"defense":70,"special-attack":65,"special-defense":70,"speed":51},"capture":45},{"id":248,"name":"TYRANITAR","types":["rock","dark"],"base":{"hp":100,"attack":134,"defense":110,"special-attack":95,"special-defense":100,"speed":61},"capture":45},{"id":400,"name":"BIBAREL","types":["normal","water"],"base":{"hp":79,"attack":85,"defense":60,"special-attack":55,"special-defense":60,"speed":71},"capture":127},{"id":164,"name":"NOCTOWL","types":["normal","flying"],"base":{"hp":100,"attack":50,"defense":50,"special-attack":86,"special-defense":96,"speed":70},"capture":90},{"id":424,"name":"AMBIPOM","types":["normal"],"base":{"hp":75,"attack":100,"defense":66,"special-attack":60,"special-defense":66,"speed":115},"capture":45},{"id":463,"name":"LICKILICKY","types":["normal"],"base":{"hp":110,"attack":85,"defense":95,"special-attack":80,"special-defense":95,"speed":50},"capture":30},{"id":462,"name":"MAGNEZONE","types":["electric","steel"],"base":{"hp":70,"attack":70,"defense":115,"special-attack":130,"special-defense":90,"speed":60},"capture":30},{"id":473,"name":"MAMOSWINE","types":["ice","ground"],"base":{"hp":110,"attack":130,"defense":80,"special-attack":70,"special-defense":60,"speed":80},"capture":50}],"evos":{"BULBASAUR":[{"to":"IVYSAUR","level":16}],"IVYSAUR":[{"to":"VENUSAUR","level":32}],"CHARMANDER":[{"to":"CHARMELEON","level":16}],"CHARMELEON":[{"to":"CHARIZARD","level":36}],"SQUIRTLE":[{"to":"WARTORTLE","level":16}],"WARTORTLE":[{"to":"BLASTOISE","level":36}],"CHIKORITA":[{"to":"BAYLEEF","level":16}],"BAYLEEF":[{"to":"MEGANIUM","level":32}],"CYNDAQUIL":[{"to":"QUILAVA","level":14}],"QUILAVA":[{"to":"TYPHLOSION","level":36}],"TOTODILE":[{"to":"CROCONAW","level":18}],"CROCONAW":[{"to":"FERALIGATR","level":30}],"TREECKO":[{"to":"GROVYLE","level":16}],"GROVYLE":[{"to":"SCEPTILE","level":36}],"TORCHIC":[{"to":"COMBUSKEN","level":16}],"COMBUSKEN":[{"to":"BLAZIKEN","level":36}],"MUDKIP":[{"to":"MARSHTOMP","level":16}],"MARSHTOMP":[{"to":"SWAMPERT","level":36}],"TURTWIG":[{"to":"GROTLE","level":18}],"GROTLE":[{"to":"TORTERRA","level":32}],"CHIMCHAR":[{"to":"MONFERNO","level":14}],"MONFERNO":[{"to":"INFERNAPE","level":36}],"PIPLUP":[{"to":"PRINPLUP","level":16}],"PRINPLUP":[{"to":"EMPOLEON","level":36}],"SNIVY":[{"to":"SERVINE","level":17}],"SERVINE":[{"to":"SERPERIOR","level":36}],"TEPIG":[{"to":"PIGNITE","level":17}],"PIGNITE":[{"to":"EMBOAR","level":36}],"OSHAWOTT":[{"to":"DEWOTT","level":17}],"DEWOTT":[{"to":"SAMUROTT","level":36}],"CHESPIN":[{"to":"QUILLADIN","level":16}],"QUILLADIN":[{"to":"CHESNAUGHT","level":36}],"FENNEKIN":[{"to":"BRAIXEN","level":16}],"BRAIXEN":[{"to":"DELPHOX","level":36}],"FROAKIE":[{"to":"FROGADIER","level":16}],"FROGADIER":[{"to":"GRENINJA","level":36}],"ROWLET":[{"to":"DARTRIX","level":17}],"DARTRIX":[{"to":"DECIDUEYE","level":34}],"LITTEN":[{"to":"TORRACAT","level":17}],"TORRACAT":[{"to":"INCINEROAR","level":34}],"POPPLIO":[{"to":"BRIONNE","level":17}],"BRIONNE":[{"to":"PRIMARINA","level":34}],"GROOKEY":[{"to":"THWACKEY","level":16}],"THWACKEY":[{"to":"RILLABOOM","level":35}],"SCORBUNNY":[{"to":"RABOOT","level":16}],"RABOOT":[{"to":"CINDERACE","level":35}],"SOBBLE":[{"to":"DRIZZILE","level":16}],"DRIZZILE":[{"to":"INTELEON","level":35}],"SPRIGATITO":[{"to":"FLORAGATO","level":16}],"FLORAGATO":[{"to":"MEOWSCARADA","level":36}],"FUECOCO":[{"to":"CROCALOR","level":16}],"CROCALOR":[{"to":"SKELEDIRGE","level":36}],"QUAXLY":[{"to":"QUAXWELL","level":16}],"QUAXWELL":[{"to":"QUAQUAVAL","level":36}],"EEVEE":[{"to":"VAPOREON","level":25,"standIn":true},{"to":"JOLTEON","level":25,"standIn":true},{"to":"FLAREON","level":25,"standIn":true},{"to":"ESPEON","level":25,"standIn":true},{"to":"UMBREON","level":25,"standIn":true},{"to":"LEAFEON","level":25,"standIn":true},{"to":"GLACEON","level":25,"standIn":true},{"to":"SYLVEON","level":25,"standIn":true}],"RIOLU":[{"to":"LUCARIO","level":25,"standIn":true}],"DREEPY":[{"to":"DRAKLOAK","level":50}],"DRAKLOAK":[{"to":"DRAGAPULT","level":60}],"GIBLE":[{"to":"GABITE","level":24}],"GABITE":[{"to":"GARCHOMP","level":48}],"PICHU":[{"to":"PIKACHU","level":15,"standIn":true}],"PIKACHU":[{"to":"RAICHU","level":40,"standIn":true}],"MAGIKARP":[{"to":"GYARADOS","level":20}],"LARVITAR":[{"to":"PUPITAR","level":30}],"PUPITAR":[{"to":"TYRANITAR","level":55}],"WOOPER":[{"to":"QUAGSIRE","level":20}],"BIDOOF":[{"to":"BIBAREL","level":15}],"PSYDUCK":[{"to":"GOLDUCK","level":33}],"PIDGEY":[{"to":"PIDGEOTTO","level":18}],"PIDGEOTTO":[{"to":"PIDGEOT","level":36}],"HOOTHOOT":[{"to":"NOCTOWL","level":20}],"AIPOM":[{"to":"AMBIPOM","level":32,"standIn":true}],"LICKITUNG":[{"to":"LICKILICKY","level":33,"standIn":true}],"GASTLY":[{"to":"HAUNTER","level":25}],"HAUNTER":[{"to":"GENGAR","level":40,"standIn":true}],"MAGNEMITE":[{"to":"MAGNETON","level":30}],"MAGNETON":[{"to":"MAGNEZONE","level":40,"standIn":true}],"SEEL":[{"to":"DEWGONG","level":34}],"SWINUB":[{"to":"PILOSWINE","level":33}],"PILOSWINE":[{"to":"MAMOSWINE","level":40,"standIn":true}],"HORSEA":[{"to":"SEADRA","level":32}],"SEADRA":[{"to":"KINGDRA","level":40,"standIn":true}]}}
const ART = {"1":"/rpg/a/1.gif","2":"/rpg/a/2.gif","3":"/rpg/a/3.gif","4":"/rpg/a/4.gif","5":"/rpg/a/5.gif","6":"/rpg/a/6.gif","7":"/rpg/a/7.gif","8":"/rpg/a/8.gif","9":"/rpg/a/9.gif","11":"/rpg/a/11.gif","14":"/rpg/a/14.gif","16":"/rpg/a/16.gif","17":"/rpg/a/17.gif","18":"/rpg/a/18.gif","25":"/rpg/a/25.gif","26":"/rpg/a/26.gif","35":"/rpg/a/35.gif","38":"/rpg/a/38.gif","39":"/rpg/a/39.gif","45":"/rpg/a/45.gif","49":"/rpg/a/49.gif","53":"/rpg/a/53.gif","54":"/rpg/a/54.gif","55":"/rpg/a/55.gif","57":"/rpg/a/57.gif","58":"/rpg/a/58.gif","59":"/rpg/a/59.gif","62":"/rpg/a/62.gif","64":"/rpg/a/64.gif","65":"/rpg/a/65.gif","67":"/rpg/a/67.gif","68":"/rpg/a/68.gif","71":"/rpg/a/71.gif","75":"/rpg/a/75.gif","76":"/rpg/a/76.gif","78":"/rpg/a/78.gif","79":"/rpg/a/79.gif","80":"/rpg/a/80.gif","81":"/rpg/a/81.gif","82":"/rpg/a/82.gif","86":"/rpg/a/86.gif","87":"/rpg/a/87.gif","89":"/rpg/a/89.gif","92":"/rpg/a/92.gif","93":"/rpg/a/93.gif","94":"/rpg/a/94.gif","95":"/rpg/a/95.gif","96":"/rpg/a/96.gif","101":"/rpg/a/101.gif","103":"/rpg/a/103.gif","106":"/rpg/a/106.gif","107":"/rpg/a/107.gif","108":"/rpg/a/108.gif","110":"/rpg/a/110.gif","111":"/rpg/a/111.gif","112":"/rpg/a/112.gif","113":"/rpg/a/113.gif","114":"/rpg/a/114.gif","116":"/rpg/a/116.gif","117":"/rpg/a/117.gif","119":"/rpg/a/119.gif","121":"/rpg/a/121.gif","122":"/rpg/a/122.gif","123":"/rpg/a/123.gif","124":"/rpg/a/124.gif","125":"/rpg/a/125.gif","126":"/rpg/a/126.gif","129":"/rpg/a/129.gif","130":"/rpg/a/130.gif","131":"/rpg/a/131.gif","132":"/rpg/a/132.gif","133":"/rpg/a/133.gif","134":"/rpg/a/134.gif","135":"/rpg/a/135.gif","136":"/rpg/a/136.gif","137":"/rpg/a/137.gif","139":"/rpg/a/139.gif","141":"/rpg/a/141.gif","142":"/rpg/a/142.gif","143":"/rpg/a/143.gif","148":"/rpg/a/148.gif","149":"/rpg/a/149.gif","152":"/rpg/a/152.gif","153":"/rpg/a/153.gif","154":"/rpg/a/154.gif","155":"/rpg/a/155.gif","156":"/rpg/a/156.gif","157":"/rpg/a/157.gif","158":"/rpg/a/158.gif","159":"/rpg/a/159.gif","160":"/rpg/a/160.gif","163":"/rpg/a/163.gif","164":"/rpg/a/164.gif","168":"/rpg/a/168.gif","169":"/rpg/a/169.gif","172":"/rpg/a/172.gif","177":"/rpg/a/177.gif","178":"/rpg/a/178.gif","182":"/rpg/a/182.gif","189":"/rpg/a/189.gif","190":"/rpg/a/190.gif","191":"/rpg/a/191.gif","194":"/rpg/a/194.gif","195":"/rpg/a/195.gif","196":"/rpg/a/196.gif","197":"/rpg/a/197.gif","198":"/rpg/a/198.gif","200":"/rpg/a/200.gif","205":"/rpg/a/205.gif","208":"/rpg/a/208.gif","219":"/rpg/a/219.gif","220":"/rpg/a/220.gif","221":"/rpg/a/221.gif","227":"/rpg/a/227.gif","229":"/rpg/a/229.gif","230":"/rpg/a/230.gif","235":"/rpg/a/235.gif","237":"/rpg/a/237.gif","241":"/rpg/a/241.gif","242":"/rpg/a/242.gif","243":"/rpg/a/243.gif","244":"/rpg/a/244.gif","245":"/rpg/a/245.gif","246":"/rpg/a/246.gif","247":"/rpg/a/247.gif","248":"/rpg/a/248.gif","252":"/rpg/a/252.gif","253":"/rpg/a/253.gif","254":"/rpg/a/254.gif","255":"/rpg/a/255.gif","256":"/rpg/a/256.gif","257":"/rpg/a/257.gif","258":"/rpg/a/258.gif","259":"/rpg/a/259.gif","260":"/rpg/a/260.gif","287":"/rpg/a/287.gif","300":"/rpg/a/300.gif","302":"/rpg/a/302.gif","303":"/rpg/a/303.gif","311":"/rpg/a/311.gif","312":"/rpg/a/312.gif","357":"/rpg/a/357.gif","387":"/rpg/a/387.gif","388":"/rpg/a/388.gif","389":"/rpg/a/389.gif","390":"/rpg/a/390.gif","391":"/rpg/a/391.gif","392":"/rpg/a/392.gif","393":"/rpg/a/393.gif","394":"/rpg/a/394.gif","395":"/rpg/a/395.gif","399":"/rpg/a/399.gif","400":"/rpg/a/400.gif","424":"/rpg/a/424.gif","441":"/rpg/a/441.gif","443":"/rpg/a/443.gif","444":"/rpg/a/444.gif","445":"/rpg/a/445.gif","447":"/rpg/a/447.gif","448":"/rpg/a/448.gif","450":"/rpg/a/450.gif","453":"/rpg/a/453.gif","462":"/rpg/a/462.gif","463":"/rpg/a/463.gif","470":"/rpg/a/470.gif","471":"/rpg/a/471.gif","473":"/rpg/a/473.gif","479":"/rpg/a/479.gif","495":"/rpg/a/495.gif","496":"/rpg/a/496.gif","497":"/rpg/a/497.gif","498":"/rpg/a/498.gif","499":"/rpg/a/499.gif","500":"/rpg/a/500.gif","501":"/rpg/a/501.gif","502":"/rpg/a/502.gif","503":"/rpg/a/503.gif","504":"/rpg/a/504.gif","505":"/rpg/a/505.gif","509":"/rpg/a/509.gif","510":"/rpg/a/510.gif","569":"/rpg/a/569.gif","650":"/rpg/a/650.gif","651":"/rpg/a/651.gif","652":"/rpg/a/652.gif","653":"/rpg/a/653.gif","654":"/rpg/a/654.gif","655":"/rpg/a/655.gif","656":"/rpg/a/656.gif","657":"/rpg/a/657.gif","658":"/rpg/a/658.gif","700":"/rpg/a/700.gif","722":"/rpg/a/722.gif","723":"/rpg/a/723.gif","724":"/rpg/a/724.gif","725":"/rpg/a/725.gif","726":"/rpg/a/726.gif","727":"/rpg/a/727.gif","728":"/rpg/a/728.gif","729":"/rpg/a/729.gif","730":"/rpg/a/730.gif","778":"/rpg/a/778.gif","810":"/rpg/a/810.gif","811":"/rpg/a/811.gif","812":"/rpg/a/812.gif","813":"/rpg/a/813.gif","814":"/rpg/a/814.gif","815":"/rpg/a/815.gif","816":"/rpg/a/816.gif","817":"/rpg/a/817.gif","818":"/rpg/a/818.gif","819":"/rpg/a/819.gif","820":"/rpg/a/820.gif","885":"/rpg/a/885.gif","886":"/rpg/a/886.gif","887":"/rpg/a/887.gif","906":"/rpg/a/906.gif","907":"/rpg/a/907.gif","908":"/rpg/a/908.gif","909":"/rpg/a/909.gif","910":"/rpg/a/910.gif","911":"/rpg/a/911.gif","912":"/rpg/a/912.gif","913":"/rpg/a/913.gif","914":"/rpg/a/914.gif","1000":"/rpg/a/1000.gif","1b":"/rpg/a/1-back.gif","4b":"/rpg/a/4-back.gif","7b":"/rpg/a/7-back.gif","152b":"/rpg/a/152-back.gif","155b":"/rpg/a/155-back.gif","158b":"/rpg/a/158-back.gif","252b":"/rpg/a/252-back.gif","255b":"/rpg/a/255-back.gif","258b":"/rpg/a/258-back.gif","387b":"/rpg/a/387-back.gif","390b":"/rpg/a/390-back.gif","393b":"/rpg/a/393-back.gif","495b":"/rpg/a/495-back.gif","498b":"/rpg/a/498-back.gif","501b":"/rpg/a/501-back.gif","650b":"/rpg/a/650-back.gif","653b":"/rpg/a/653-back.gif","656b":"/rpg/a/656-back.gif","722b":"/rpg/a/722-back.gif","725b":"/rpg/a/725-back.gif","728b":"/rpg/a/728-back.gif","810b":"/rpg/a/810-back.gif","813b":"/rpg/a/813-back.gif","816b":"/rpg/a/816-back.gif","906b":"/rpg/a/906-back.gif","909b":"/rpg/a/909-back.gif","912b":"/rpg/a/912-back.gif","133b":"/rpg/a/133-back.gif","447b":"/rpg/a/447-back.gif","885b":"/rpg/a/885-back.gif","443b":"/rpg/a/443-back.gif","172b":"/rpg/a/172-back.gif","129b":"/rpg/a/129-back.gif","246b":"/rpg/a/246-back.gif","194b":"/rpg/a/194-back.gif","399b":"/rpg/a/399-back.gif","54b":"/rpg/a/54-back.gif","16b":"/rpg/a/16-back.gif","163b":"/rpg/a/163-back.gif","190b":"/rpg/a/190-back.gif","108b":"/rpg/a/108-back.gif","92b":"/rpg/a/92-back.gif","81b":"/rpg/a/81-back.gif","86b":"/rpg/a/86-back.gif","220b":"/rpg/a/220-back.gif","116b":"/rpg/a/116-back.gif","1000b":"/rpg/a/1000-back.gif","450b":"/rpg/a/450-back.gif","53b":"/rpg/a/53-back.gif","302b":"/rpg/a/302-back.gif","303b":"/rpg/a/303-back.gif","820b":"/rpg/a/820-back.gif","143b":"/rpg/a/143-back.gif","569b":"/rpg/a/569-back.gif","191b":"/rpg/a/191-back.gif","137b":"/rpg/a/137-back.gif","17b":"/rpg/a/17-back.gif","11b":"/rpg/a/11-back.gif","14b":"/rpg/a/14-back.gif","123b":"/rpg/a/123-back.gif","35b":"/rpg/a/35-back.gif","241b":"/rpg/a/241-back.gif","93b":"/rpg/a/93-back.gif","200b":"/rpg/a/200-back.gif","94b":"/rpg/a/94-back.gif","57b":"/rpg/a/57-back.gif","67b":"/rpg/a/67-back.gif","106b":"/rpg/a/106-back.gif","107b":"/rpg/a/107-back.gif","62b":"/rpg/a/62-back.gif","227b":"/rpg/a/227-back.gif","205b":"/rpg/a/205-back.gif","208b":"/rpg/a/208-back.gif","87b":"/rpg/a/87-back.gif","124b":"/rpg/a/124-back.gif","131b":"/rpg/a/131-back.gif","221b":"/rpg/a/221-back.gif","117b":"/rpg/a/117-back.gif","130b":"/rpg/a/130-back.gif","148b":"/rpg/a/148-back.gif","230b":"/rpg/a/230-back.gif","300b":"/rpg/a/300-back.gif","113b":"/rpg/a/113-back.gif","242b":"/rpg/a/242-back.gif","504b":"/rpg/a/504-back.gif","505b":"/rpg/a/505-back.gif","287b":"/rpg/a/287-back.gif","96b":"/rpg/a/96-back.gif","39b":"/rpg/a/39-back.gif","311b":"/rpg/a/311-back.gif","312b":"/rpg/a/312-back.gif","25b":"/rpg/a/25-back.gif","441b":"/rpg/a/441-back.gif","479b":"/rpg/a/479-back.gif","819b":"/rpg/a/819-back.gif","357b":"/rpg/a/357-back.gif","58b":"/rpg/a/58-back.gif","59b":"/rpg/a/59-back.gif","79b":"/rpg/a/79-back.gif","177b":"/rpg/a/177-back.gif","64b":"/rpg/a/64-back.gif","509b":"/rpg/a/509-back.gif","453b":"/rpg/a/453-back.gif","510b":"/rpg/a/510-back.gif","132b":"/rpg/a/132-back.gif","235b":"/rpg/a/235-back.gif","778b":"/rpg/a/778-back.gif","178b":"/rpg/a/178-back.gif","103b":"/rpg/a/103-back.gif","80b":"/rpg/a/80-back.gif","168b":"/rpg/a/168-back.gif","49b":"/rpg/a/49-back.gif","89b":"/rpg/a/89-back.gif","169b":"/rpg/a/169-back.gif","237b":"/rpg/a/237-back.gif","95b":"/rpg/a/95-back.gif","68b":"/rpg/a/68-back.gif","197b":"/rpg/a/197-back.gif","45b":"/rpg/a/45-back.gif","198b":"/rpg/a/198-back.gif","229b":"/rpg/a/229-back.gif","149b":"/rpg/a/149-back.gif","6b":"/rpg/a/6-back.gif","142b":"/rpg/a/142-back.gif","75b":"/rpg/a/75-back.gif","111b":"/rpg/a/111-back.gif","139b":"/rpg/a/139-back.gif","141b":"/rpg/a/141-back.gif","55b":"/rpg/a/55-back.gif","195b":"/rpg/a/195-back.gif","121b":"/rpg/a/121-back.gif","119b":"/rpg/a/119-back.gif","26b":"/rpg/a/26-back.gif","101b":"/rpg/a/101-back.gif","82b":"/rpg/a/82-back.gif","125b":"/rpg/a/125-back.gif","114b":"/rpg/a/114-back.gif","189b":"/rpg/a/189-back.gif","71b":"/rpg/a/71-back.gif","182b":"/rpg/a/182-back.gif","110b":"/rpg/a/110-back.gif","196b":"/rpg/a/196-back.gif","122b":"/rpg/a/122-back.gif","65b":"/rpg/a/65-back.gif","219b":"/rpg/a/219-back.gif","38b":"/rpg/a/38-back.gif","126b":"/rpg/a/126-back.gif","78b":"/rpg/a/78-back.gif","18b":"/rpg/a/18-back.gif","112b":"/rpg/a/112-back.gif","243b":"/rpg/a/243-back.gif","244b":"/rpg/a/244-back.gif","245b":"/rpg/a/245-back.gif","76b":"/rpg/a/76-back.gif","2b":"/rpg/a/2-back.gif","3b":"/rpg/a/3-back.gif","5b":"/rpg/a/5-back.gif","8b":"/rpg/a/8-back.gif","9b":"/rpg/a/9-back.gif","153b":"/rpg/a/153-back.gif","154b":"/rpg/a/154-back.gif","156b":"/rpg/a/156-back.gif","157b":"/rpg/a/157-back.gif","159b":"/rpg/a/159-back.gif","160b":"/rpg/a/160-back.gif","253b":"/rpg/a/253-back.gif","254b":"/rpg/a/254-back.gif","256b":"/rpg/a/256-back.gif","257b":"/rpg/a/257-back.gif","259b":"/rpg/a/259-back.gif","260b":"/rpg/a/260-back.gif","388b":"/rpg/a/388-back.gif","389b":"/rpg/a/389-back.gif","391b":"/rpg/a/391-back.gif","392b":"/rpg/a/392-back.gif","394b":"/rpg/a/394-back.gif","395b":"/rpg/a/395-back.gif","496b":"/rpg/a/496-back.gif","497b":"/rpg/a/497-back.gif","499b":"/rpg/a/499-back.gif","500b":"/rpg/a/500-back.gif","502b":"/rpg/a/502-back.gif","503b":"/rpg/a/503-back.gif","651b":"/rpg/a/651-back.gif","652b":"/rpg/a/652-back.gif","654b":"/rpg/a/654-back.gif","655b":"/rpg/a/655-back.gif","657b":"/rpg/a/657-back.gif","658b":"/rpg/a/658-back.gif","723b":"/rpg/a/723-back.gif","724b":"/rpg/a/724-back.gif","726b":"/rpg/a/726-back.gif","727b":"/rpg/a/727-back.gif","729b":"/rpg/a/729-back.gif","730b":"/rpg/a/730-back.gif","811b":"/rpg/a/811-back.gif","812b":"/rpg/a/812-back.gif","814b":"/rpg/a/814-back.gif","815b":"/rpg/a/815-back.gif","817b":"/rpg/a/817-back.gif","818b":"/rpg/a/818-back.gif","907b":"/rpg/a/907-back.gif","908b":"/rpg/a/908-back.gif","910b":"/rpg/a/910-back.gif","911b":"/rpg/a/911-back.gif","913b":"/rpg/a/913-back.gif","914b":"/rpg/a/914-back.gif","134b":"/rpg/a/134-back.gif","135b":"/rpg/a/135-back.gif","136b":"/rpg/a/136-back.gif","470b":"/rpg/a/470-back.gif","471b":"/rpg/a/471-back.gif","700b":"/rpg/a/700-back.gif","448b":"/rpg/a/448-back.gif","886b":"/rpg/a/886-back.gif","887b":"/rpg/a/887-back.gif","444b":"/rpg/a/444-back.gif","445b":"/rpg/a/445-back.gif","247b":"/rpg/a/247-back.gif","248b":"/rpg/a/248-back.gif","400b":"/rpg/a/400-back.gif","164b":"/rpg/a/164-back.gif","424b":"/rpg/a/424-back.gif","463b":"/rpg/a/463-back.gif","462b":"/rpg/a/462-back.gif","473b":"/rpg/a/473-back.gif","herbVs":"/rpg/a/herb-vs.jpg","herbFace":"/rpg/a/herb-face.jpg","herbBody":"/rpg/a/herb-body.png","herbDown":"/rpg/a/herb-defeated.png","herbFaceDown":"/rpg/a/herb-face-down.jpg","brianVs":"/rpg/a/brian-vs.jpg","brianFace":"/rpg/a/brian-face.jpg","brianBody":"/rpg/a/brian-body.png","brianDown":"/rpg/a/brian-defeated.png","brianFaceDown":"/rpg/a/brian-face-down.jpg","alexVs":"/rpg/a/alex-vs.jpg","alexFace":"/rpg/a/alex-face.jpg","alexBody":"/rpg/a/alex-body.png","gymBody:falkner":"/rpg/a/gym-falkner-body.png","gymFace:falkner":"/rpg/a/gym-falkner-face.jpg","gymVs:falkner":"/rpg/a/gym-falkner-vs.jpg","gymBody:bugsy":"/rpg/a/gym-bugsy-body.png","gymFace:bugsy":"/rpg/a/gym-bugsy-face.jpg","gymVs:bugsy":"/rpg/a/gym-bugsy-vs.jpg","gymBody:whitney":"/rpg/a/gym-whitney-body.png","gymFace:whitney":"/rpg/a/gym-whitney-face.jpg","gymVs:whitney":"/rpg/a/gym-whitney-vs.jpg","gymBody:morty":"/rpg/a/gym-morty-body.png","gymFace:morty":"/rpg/a/gym-morty-face.jpg","gymVs:morty":"/rpg/a/gym-morty-vs.jpg","gymBody:chuck":"/rpg/a/gym-chuck-body.png","gymFace:chuck":"/rpg/a/gym-chuck-face.jpg","gymVs:chuck":"/rpg/a/gym-chuck-vs.jpg","gymBody:jasmine":"/rpg/a/gym-jasmine-body.png","gymFace:jasmine":"/rpg/a/gym-jasmine-face.jpg","gymVs:jasmine":"/rpg/a/gym-jasmine-vs.jpg","gymBody:pryce":"/rpg/a/gym-pryce-body.png","gymFace:pryce":"/rpg/a/gym-pryce-face.jpg","gymVs:pryce":"/rpg/a/gym-pryce-vs.jpg","gymBody:clair":"/rpg/a/gym-clair-body.png","gymFace:clair":"/rpg/a/gym-clair-face.jpg","gymVs:clair":"/rpg/a/gym-clair-vs.jpg","gymBody:will":"/rpg/a/gym-will-body.png","gymFace:will":"/rpg/a/gym-will-face.jpg","gymVs:will":"/rpg/a/gym-will-vs.jpg","gymBody:koga":"/rpg/a/gym-koga-body.png","gymFace:koga":"/rpg/a/gym-koga-face.jpg","gymVs:koga":"/rpg/a/gym-koga-vs.jpg","gymBody:bruno":"/rpg/a/gym-bruno-body.png","gymFace:bruno":"/rpg/a/gym-bruno-face.jpg","gymVs:bruno":"/rpg/a/gym-bruno-vs.jpg","gymBody:karen":"/rpg/a/gym-karen-body.png","gymFace:karen":"/rpg/a/gym-karen-face.jpg","gymVs:karen":"/rpg/a/gym-karen-vs.jpg","gymBody:lance":"/rpg/a/gym-lance-body.png","gymFace:lance":"/rpg/a/gym-lance-face.jpg","gymVs:lance":"/rpg/a/gym-lance-vs.jpg","gymBody:brock":"/rpg/a/gym-brock-body.png","gymFace:brock":"/rpg/a/gym-brock-face.jpg","gymVs:brock":"/rpg/a/gym-brock-vs.jpg","gymBody:misty":"/rpg/a/gym-misty-body.png","gymFace:misty":"/rpg/a/gym-misty-face.jpg","gymVs:misty":"/rpg/a/gym-misty-vs.jpg","gymBody:lt_surge":"/rpg/a/gym-lt_surge-body.png","gymFace:lt_surge":"/rpg/a/gym-lt_surge-face.jpg","gymVs:lt_surge":"/rpg/a/gym-lt_surge-vs.jpg","gymBody:erika":"/rpg/a/gym-erika-body.png","gymFace:erika":"/rpg/a/gym-erika-face.jpg","gymVs:erika":"/rpg/a/gym-erika-vs.jpg","gymBody:janine":"/rpg/a/gym-janine-body.png","gymFace:janine":"/rpg/a/gym-janine-face.jpg","gymVs:janine":"/rpg/a/gym-janine-vs.jpg","gymBody:sabrina":"/rpg/a/gym-sabrina-body.png","gymFace:sabrina":"/rpg/a/gym-sabrina-face.jpg","gymVs:sabrina":"/rpg/a/gym-sabrina-vs.jpg","gymBody:blaine":"/rpg/a/gym-blaine-body.png","gymFace:blaine":"/rpg/a/gym-blaine-face.jpg","gymVs:blaine":"/rpg/a/gym-blaine-vs.jpg","gymBody:blue":"/rpg/a/gym-blue-body.png","gymFace:blue":"/rpg/a/gym-blue-face.jpg","gymVs:blue":"/rpg/a/gym-blue-vs.jpg","roseVs":"/rpg/a/crew-rose-vs.jpg","roseFace":"/rpg/a/crew-rose-face.jpg","roseBody":"/rpg/a/crew-rose-body.webp","roseDown":"/rpg/a/crew-rose-down.webp","roseFaceDown":"/rpg/a/crew-rose-facedown.jpg","derekVs":"/rpg/a/crew-derek-vs.jpg","derekFace":"/rpg/a/crew-derek-face.jpg","derekBody":"/rpg/a/crew-derek-body.webp","derekDown":"/rpg/a/crew-derek-down.webp","derekFaceDown":"/rpg/a/crew-derek-facedown.jpg","nateVs":"/rpg/a/crew-nate-vs.jpg","nateFace":"/rpg/a/crew-nate-face.jpg","nateBody":"/rpg/a/crew-nate-body.webp","nateDown":"/rpg/a/crew-nate-down.webp","nateFaceDown":"/rpg/a/crew-nate-facedown.jpg","hanaVs":"/rpg/a/crew-hana-vs.jpg","hanaFace":"/rpg/a/crew-hana-face.jpg","hanaBody":"/rpg/a/crew-hana-body.webp","hanaDown":"/rpg/a/crew-hana-down.webp","hanaFaceDown":"/rpg/a/crew-hana-facedown.jpg","tylerVs":"/rpg/a/crew-tyler-vs.jpg","tylerFace":"/rpg/a/crew-tyler-face.jpg","tylerBody":"/rpg/a/crew-tyler-body.webp","tylerDown":"/rpg/a/crew-tyler-down.webp","tylerFaceDown":"/rpg/a/crew-tyler-facedown.jpg","danaVs":"/rpg/a/crew-dana-vs.jpg","danaFace":"/rpg/a/crew-dana-face.jpg","danaBody":"/rpg/a/crew-dana-body.webp","danaDown":"/rpg/a/crew-dana-down.webp","danaFaceDown":"/rpg/a/crew-dana-facedown.jpg","marcusVs":"/rpg/a/crew-marcus-vs.jpg","marcusFace":"/rpg/a/crew-marcus-face.jpg","marcusBody":"/rpg/a/crew-marcus-body.webp","marcusDown":"/rpg/a/crew-marcus-down.webp","marcusFaceDown":"/rpg/a/crew-marcus-facedown.jpg","grantVs":"/rpg/a/crew-grant-vs.jpg","grantFace":"/rpg/a/crew-grant-face.jpg","grantBody":"/rpg/a/crew-grant-body.webp","grantDown":"/rpg/a/crew-grant-down.webp","grantFaceDown":"/rpg/a/crew-grant-facedown.jpg","kyleVs":"/rpg/a/crew-kyle-vs.jpg","kyleFace":"/rpg/a/crew-kyle-face.jpg","kyleBody":"/rpg/a/crew-kyle-body.webp","kyleDown":"/rpg/a/crew-kyle-down.webp","kyleFaceDown":"/rpg/a/crew-kyle-facedown.jpg","mikaVs":"/rpg/a/crew-mika-vs.jpg","mikaFace":"/rpg/a/crew-mika-face.jpg","mikaBody":"/rpg/a/crew-mika-body.webp","mikaDown":"/rpg/a/crew-mika-down.webp","mikaFaceDown":"/rpg/a/crew-mika-facedown.jpg","paulVs":"/rpg/a/paul-vs.jpg","paulFace":"/rpg/a/paul-face.jpg","paulBody":"/rpg/a/paul-body.png","paulDown":"/rpg/a/paul-defeated.png","paulFaceDown":"/rpg/a/paul-face-down.jpg","jungle-scyther":"/rpg/a/jungle-scyther.webp","fossil-lapras":"/rpg/a/fossil-lapras.webp","team-rocket-giovanni":"/rpg/a/team-rocket-giovanni.webp","gym-heroes-brock":"/rpg/a/gym-heroes-brock.webp","pack:fossil-aerodactyl":"/rpg/a/attract/fossil-aerodactyl.webp","pack:fossil-lapras":"/rpg/a/attract/fossil-lapras.webp","pack:fossil-zapdos":"/rpg/a/attract/fossil-zapdos.webp","pack:gym-challenge-blaine":"/rpg/a/attract/gym-challenge-blaine.webp","pack:gym-challenge-giovanni":"/rpg/a/attract/gym-challenge-giovanni.webp","pack:gym-challenge-koga":"/rpg/a/attract/gym-challenge-koga.webp","pack:gym-challenge-sabrina":"/rpg/a/attract/gym-challenge-sabrina.webp","pack:gym-heroes-brock":"/rpg/a/attract/gym-heroes-brock.webp","pack:gym-heroes-erika":"/rpg/a/attract/gym-heroes-erika.webp","pack:gym-heroes-lt-surge":"/rpg/a/attract/gym-heroes-lt-surge.webp","pack:gym-heroes-misty":"/rpg/a/attract/gym-heroes-misty.webp","pack:jungle-flareon":"/rpg/a/attract/jungle-flareon.webp","pack:jungle-scyther":"/rpg/a/attract/jungle-scyther.webp","pack:jungle-wigglytuff":"/rpg/a/attract/jungle-wigglytuff.webp","pack:team-rocket-dark-gyarados":"/rpg/a/attract/team-rocket-dark-gyarados.webp","pack:team-rocket-giovanni":"/rpg/a/attract/team-rocket-giovanni.webp","pack:team-rocket-jessie-james":"/rpg/a/attract/team-rocket-jessie-james.webp","pack:team-rocket-rocket-gang":"/rpg/a/attract/team-rocket-rocket-gang.webp","maint:art":"/rpg/a/maint/art.webp","maint:logo":"/rpg/a/maint/logo.webp","maint:qr":"/rpg/a/maint/qr.webp","item:antidote":"/rpg/a/items/antidote.png","item:ball":"/rpg/a/items/ball.png","item:burnheal":"/rpg/a/items/burnheal.png","item:dragonscale":"/rpg/a/items/dragonscale.png","item:expshare":"/rpg/a/items/expshare.png","item:firestone":"/rpg/a/items/firestone.png","item:fullheal":"/rpg/a/items/fullheal.png","item:great":"/rpg/a/items/great.png","item:iceheal":"/rpg/a/items/iceheal.png","item:icestone":"/rpg/a/items/icestone.png","item:leafstone":"/rpg/a/items/leafstone.png","item:linkcable":"/rpg/a/items/linkcable.png","item:parlyz":"/rpg/a/items/parlyz.png","item:potion":"/rpg/a/items/potion.png","item:revive":"/rpg/a/items/revive.png","item:super":"/rpg/a/items/super.png","item:thunderstone":"/rpg/a/items/thunderstone.png","item:waterstone":"/rpg/a/items/waterstone.png","badge:boulder":"/rpg/a/badges/boulder.png","badge:cascade":"/rpg/a/badges/cascade.png","badge:earth":"/rpg/a/badges/earth.png","badge:fog":"/rpg/a/badges/fog.png","badge:glacier":"/rpg/a/badges/glacier.png","badge:hive":"/rpg/a/badges/hive.png","badge:marsh":"/rpg/a/badges/marsh.png","badge:mineral":"/rpg/a/badges/mineral.png","badge:plain":"/rpg/a/badges/plain.png","badge:rainbow":"/rpg/a/badges/rainbow.png","badge:rising":"/rpg/a/badges/rising.png","badge:soul":"/rpg/a/badges/soul.png","badge:storm":"/rpg/a/badges/storm.png","badge:thunder":"/rpg/a/badges/thunder.png","badge:volcano":"/rpg/a/badges/volcano.png","badge:zephyr":"/rpg/a/badges/zephyr.png","cry:1":"/rpg/a/cries/1.ogg","cry:1000":"/rpg/a/cries/1000.ogg","cry:106":"/rpg/a/cries/106.ogg","cry:107":"/rpg/a/cries/107.ogg","cry:108":"/rpg/a/cries/108.ogg","cry:11":"/rpg/a/cries/11.ogg","cry:113":"/rpg/a/cries/113.ogg","cry:116":"/rpg/a/cries/116.ogg","cry:117":"/rpg/a/cries/117.ogg","cry:123":"/rpg/a/cries/123.ogg","cry:124":"/rpg/a/cries/124.ogg","cry:129":"/rpg/a/cries/129.ogg","cry:130":"/rpg/a/cries/130.ogg","cry:131":"/rpg/a/cries/131.ogg","cry:132":"/rpg/a/cries/132.ogg","cry:133":"/rpg/a/cries/133.ogg","cry:134":"/rpg/a/cries/134.ogg","cry:135":"/rpg/a/cries/135.ogg","cry:136":"/rpg/a/cries/136.ogg","cry:137":"/rpg/a/cries/137.ogg","cry:14":"/rpg/a/cries/14.ogg","cry:143":"/rpg/a/cries/143.ogg","cry:148":"/rpg/a/cries/148.ogg","cry:152":"/rpg/a/cries/152.ogg","cry:153":"/rpg/a/cries/153.ogg","cry:154":"/rpg/a/cries/154.ogg","cry:155":"/rpg/a/cries/155.ogg","cry:156":"/rpg/a/cries/156.ogg","cry:157":"/rpg/a/cries/157.ogg","cry:158":"/rpg/a/cries/158.ogg","cry:159":"/rpg/a/cries/159.ogg","cry:16":"/rpg/a/cries/16.ogg","cry:160":"/rpg/a/cries/160.ogg","cry:163":"/rpg/a/cries/163.ogg","cry:164":"/rpg/a/cries/164.ogg","cry:17":"/rpg/a/cries/17.ogg","cry:172":"/rpg/a/cries/172.ogg","cry:177":"/rpg/a/cries/177.ogg","cry:190":"/rpg/a/cries/190.ogg","cry:191":"/rpg/a/cries/191.ogg","cry:194":"/rpg/a/cries/194.ogg","cry:2":"/rpg/a/cries/2.ogg","cry:200":"/rpg/a/cries/200.ogg","cry:205":"/rpg/a/cries/205.ogg","cry:208":"/rpg/a/cries/208.ogg","cry:220":"/rpg/a/cries/220.ogg","cry:221":"/rpg/a/cries/221.ogg","cry:227":"/rpg/a/cries/227.ogg","cry:230":"/rpg/a/cries/230.ogg","cry:235":"/rpg/a/cries/235.ogg","cry:241":"/rpg/a/cries/241.ogg","cry:242":"/rpg/a/cries/242.ogg","cry:243":"/rpg/a/cries/243.ogg","cry:244":"/rpg/a/cries/244.ogg","cry:245":"/rpg/a/cries/245.ogg","cry:246":"/rpg/a/cries/246.ogg","cry:247":"/rpg/a/cries/247.ogg","cry:248":"/rpg/a/cries/248.ogg","cry:25":"/rpg/a/cries/25.ogg","cry:252":"/rpg/a/cries/252.ogg","cry:253":"/rpg/a/cries/253.ogg","cry:254":"/rpg/a/cries/254.ogg","cry:255":"/rpg/a/cries/255.ogg","cry:256":"/rpg/a/cries/256.ogg","cry:257":"/rpg/a/cries/257.ogg","cry:258":"/rpg/a/cries/258.ogg","cry:259":"/rpg/a/cries/259.ogg","cry:260":"/rpg/a/cries/260.ogg","cry:287":"/rpg/a/cries/287.ogg","cry:3":"/rpg/a/cries/3.ogg","cry:300":"/rpg/a/cries/300.ogg","cry:302":"/rpg/a/cries/302.ogg","cry:303":"/rpg/a/cries/303.ogg","cry:311":"/rpg/a/cries/311.ogg","cry:312":"/rpg/a/cries/312.ogg","cry:35":"/rpg/a/cries/35.ogg","cry:357":"/rpg/a/cries/357.ogg","cry:387":"/rpg/a/cries/387.ogg","cry:388":"/rpg/a/cries/388.ogg","cry:389":"/rpg/a/cries/389.ogg","cry:39":"/rpg/a/cries/39.ogg","cry:390":"/rpg/a/cries/390.ogg","cry:391":"/rpg/a/cries/391.ogg","cry:392":"/rpg/a/cries/392.ogg","cry:393":"/rpg/a/cries/393.ogg","cry:394":"/rpg/a/cries/394.ogg","cry:395":"/rpg/a/cries/395.ogg","cry:399":"/rpg/a/cries/399.ogg","cry:4":"/rpg/a/cries/4.ogg","cry:400":"/rpg/a/cries/400.ogg","cry:424":"/rpg/a/cries/424.ogg","cry:441":"/rpg/a/cries/441.ogg","cry:443":"/rpg/a/cries/443.ogg","cry:444":"/rpg/a/cries/444.ogg","cry:445":"/rpg/a/cries/445.ogg","cry:447":"/rpg/a/cries/447.ogg","cry:448":"/rpg/a/cries/448.ogg","cry:450":"/rpg/a/cries/450.ogg","cry:453":"/rpg/a/cries/453.ogg","cry:462":"/rpg/a/cries/462.ogg","cry:463":"/rpg/a/cries/463.ogg","cry:470":"/rpg/a/cries/470.ogg","cry:471":"/rpg/a/cries/471.ogg","cry:473":"/rpg/a/cries/473.ogg","cry:479":"/rpg/a/cries/479.ogg","cry:495":"/rpg/a/cries/495.ogg","cry:496":"/rpg/a/cries/496.ogg","cry:497":"/rpg/a/cries/497.ogg","cry:498":"/rpg/a/cries/498.ogg","cry:499":"/rpg/a/cries/499.ogg","cry:5":"/rpg/a/cries/5.ogg","cry:500":"/rpg/a/cries/500.ogg","cry:501":"/rpg/a/cries/501.ogg","cry:502":"/rpg/a/cries/502.ogg","cry:503":"/rpg/a/cries/503.ogg","cry:504":"/rpg/a/cries/504.ogg","cry:505":"/rpg/a/cries/505.ogg","cry:509":"/rpg/a/cries/509.ogg","cry:510":"/rpg/a/cries/510.ogg","cry:53":"/rpg/a/cries/53.ogg","cry:54":"/rpg/a/cries/54.ogg","cry:569":"/rpg/a/cries/569.ogg","cry:57":"/rpg/a/cries/57.ogg","cry:58":"/rpg/a/cries/58.ogg","cry:59":"/rpg/a/cries/59.ogg","cry:62":"/rpg/a/cries/62.ogg","cry:64":"/rpg/a/cries/64.ogg","cry:650":"/rpg/a/cries/650.ogg","cry:651":"/rpg/a/cries/651.ogg","cry:652":"/rpg/a/cries/652.ogg","cry:653":"/rpg/a/cries/653.ogg","cry:654":"/rpg/a/cries/654.ogg","cry:655":"/rpg/a/cries/655.ogg","cry:656":"/rpg/a/cries/656.ogg","cry:657":"/rpg/a/cries/657.ogg","cry:658":"/rpg/a/cries/658.ogg","cry:67":"/rpg/a/cries/67.ogg","cry:7":"/rpg/a/cries/7.ogg","cry:700":"/rpg/a/cries/700.ogg","cry:722":"/rpg/a/cries/722.ogg","cry:723":"/rpg/a/cries/723.ogg","cry:724":"/rpg/a/cries/724.ogg","cry:725":"/rpg/a/cries/725.ogg","cry:726":"/rpg/a/cries/726.ogg","cry:727":"/rpg/a/cries/727.ogg","cry:728":"/rpg/a/cries/728.ogg","cry:729":"/rpg/a/cries/729.ogg","cry:730":"/rpg/a/cries/730.ogg","cry:76":"/rpg/a/cries/76.ogg","cry:778":"/rpg/a/cries/778.ogg","cry:79":"/rpg/a/cries/79.ogg","cry:8":"/rpg/a/cries/8.ogg","cry:81":"/rpg/a/cries/81.ogg","cry:810":"/rpg/a/cries/810.ogg","cry:811":"/rpg/a/cries/811.ogg","cry:812":"/rpg/a/cries/812.ogg","cry:813":"/rpg/a/cries/813.ogg","cry:814":"/rpg/a/cries/814.ogg","cry:815":"/rpg/a/cries/815.ogg","cry:816":"/rpg/a/cries/816.ogg","cry:817":"/rpg/a/cries/817.ogg","cry:818":"/rpg/a/cries/818.ogg","cry:819":"/rpg/a/cries/819.ogg","cry:820":"/rpg/a/cries/820.ogg","cry:86":"/rpg/a/cries/86.ogg","cry:87":"/rpg/a/cries/87.ogg","cry:885":"/rpg/a/cries/885.ogg","cry:886":"/rpg/a/cries/886.ogg","cry:887":"/rpg/a/cries/887.ogg","cry:9":"/rpg/a/cries/9.ogg","cry:906":"/rpg/a/cries/906.ogg","cry:907":"/rpg/a/cries/907.ogg","cry:908":"/rpg/a/cries/908.ogg","cry:909":"/rpg/a/cries/909.ogg","cry:910":"/rpg/a/cries/910.ogg","cry:911":"/rpg/a/cries/911.ogg","cry:912":"/rpg/a/cries/912.ogg","cry:913":"/rpg/a/cries/913.ogg","cry:914":"/rpg/a/cries/914.ogg","cry:92":"/rpg/a/cries/92.ogg","cry:93":"/rpg/a/cries/93.ogg","cry:94":"/rpg/a/cries/94.ogg","cry:96":"/rpg/a/cries/96.ogg","cry:980":"/rpg/a/cries/980.ogg","bg:aaron_day":"/rpg/a/bg/aaron_day.webp","bg:aaron_evening":"/rpg/a/bg/aaron_evening.webp","bg:aaron_night":"/rpg/a/bg/aaron_night.webp","bg:arcade_day":"/rpg/a/bg/arcade_day.webp","bg:arcade_evening":"/rpg/a/bg/arcade_evening.webp","bg:arcade_night":"/rpg/a/bg/arcade_night.webp","bg:beach_day":"/rpg/a/bg/beach_day.webp","bg:beach_evening":"/rpg/a/bg/beach_evening.webp","bg:beach_night":"/rpg/a/bg/beach_night.webp","bg:bertha_day":"/rpg/a/bg/bertha_day.webp","bg:bertha_evening":"/rpg/a/bg/bertha_evening.webp","bg:bertha_night":"/rpg/a/bg/bertha_night.webp","bg:castle_day":"/rpg/a/bg/castle_day.webp","bg:castle_evening":"/rpg/a/bg/castle_evening.webp","bg:castle_night":"/rpg/a/bg/castle_night.webp","bg:cave_1_day":"/rpg/a/bg/cave_1_day.webp","bg:cave_1_evening":"/rpg/a/bg/cave_1_evening.webp","bg:cave_1_night":"/rpg/a/bg/cave_1_night.webp","bg:cave_2_day":"/rpg/a/bg/cave_2_day.webp","bg:cave_2_evening":"/rpg/a/bg/cave_2_evening.webp","bg:cave_2_night":"/rpg/a/bg/cave_2_night.webp","bg:cave_3_day":"/rpg/a/bg/cave_3_day.webp","bg:cave_3_evening":"/rpg/a/bg/cave_3_evening.webp","bg:cave_3_night":"/rpg/a/bg/cave_3_night.webp","bg:city_day":"/rpg/a/bg/city_day.webp","bg:city_evening":"/rpg/a/bg/city_evening.webp","bg:city_night":"/rpg/a/bg/city_night.webp","bg:cynthia_day":"/rpg/a/bg/cynthia_day.webp","bg:cynthia_evening":"/rpg/a/bg/cynthia_evening.webp","bg:cynthia_night":"/rpg/a/bg/cynthia_night.webp","bg:distortion_day":"/rpg/a/bg/distortion_day.webp","bg:distortion_evening":"/rpg/a/bg/distortion_evening.webp","bg:distortion_night":"/rpg/a/bg/distortion_night.webp","bg:factory_day":"/rpg/a/bg/factory_day.webp","bg:factory_evening":"/rpg/a/bg/factory_evening.webp","bg:factory_night":"/rpg/a/bg/factory_night.webp","bg:flint_day":"/rpg/a/bg/flint_day.webp","bg:flint_evening":"/rpg/a/bg/flint_evening.webp","bg:flint_night":"/rpg/a/bg/flint_night.webp","bg:forest_day":"/rpg/a/bg/forest_day.webp","bg:forest_evening":"/rpg/a/bg/forest_evening.webp","bg:forest_night":"/rpg/a/bg/forest_night.webp","bg:hall_day":"/rpg/a/bg/hall_day.webp","bg:hall_evening":"/rpg/a/bg/hall_evening.webp","bg:hall_night":"/rpg/a/bg/hall_night.webp","bg:ice_day":"/rpg/a/bg/ice_day.webp","bg:ice_evening":"/rpg/a/bg/ice_evening.webp","bg:ice_night":"/rpg/a/bg/ice_night.webp","bg:indoors_1_day":"/rpg/a/bg/indoors_1_day.webp","bg:indoors_1_evening":"/rpg/a/bg/indoors_1_evening.webp","bg:indoors_1_night":"/rpg/a/bg/indoors_1_night.webp","bg:indoors_2_day":"/rpg/a/bg/indoors_2_day.webp","bg:indoors_2_evening":"/rpg/a/bg/indoors_2_evening.webp","bg:indoors_2_night":"/rpg/a/bg/indoors_2_night.webp","bg:indoors_3_day":"/rpg/a/bg/indoors_3_day.webp","bg:indoors_3_evening":"/rpg/a/bg/indoors_3_evening.webp","bg:indoors_3_night":"/rpg/a/bg/indoors_3_night.webp","bg:lucian_day":"/rpg/a/bg/lucian_day.webp","bg:lucian_evening":"/rpg/a/bg/lucian_evening.webp","bg:lucian_night":"/rpg/a/bg/lucian_night.webp","bg:marsh_day":"/rpg/a/bg/marsh_day.webp","bg:marsh_evening":"/rpg/a/bg/marsh_evening.webp","bg:marsh_night":"/rpg/a/bg/marsh_night.webp","bg:meadow_day":"/rpg/a/bg/meadow_day.webp","bg:meadow_evening":"/rpg/a/bg/meadow_evening.webp","bg:meadow_night":"/rpg/a/bg/meadow_night.webp","bg:mountain_day":"/rpg/a/bg/mountain_day.webp","bg:mountain_evening":"/rpg/a/bg/mountain_evening.webp","bg:mountain_night":"/rpg/a/bg/mountain_night.webp","bg:plain_day":"/rpg/a/bg/plain_day.webp","bg:plain_evening":"/rpg/a/bg/plain_evening.webp","bg:plain_night":"/rpg/a/bg/plain_night.webp","bg:puddles_day":"/rpg/a/bg/puddles_day.webp","bg:puddles_evening":"/rpg/a/bg/puddles_evening.webp","bg:puddles_night":"/rpg/a/bg/puddles_night.webp","bg:snow_day":"/rpg/a/bg/snow_day.webp","bg:snow_evening":"/rpg/a/bg/snow_evening.webp","bg:snow_night":"/rpg/a/bg/snow_night.webp","bg:tower_day":"/rpg/a/bg/tower_day.webp","bg:tower_evening":"/rpg/a/bg/tower_evening.webp","bg:tower_night":"/rpg/a/bg/tower_night.webp","bg:water_day":"/rpg/a/bg/water_day.webp","bg:water_evening":"/rpg/a/bg/water_evening.webp","bg:water_night":"/rpg/a/bg/water_night.webp"}   // id -> front GIF, `${id}b` -> back GIF
/*
 * More species: the first stages (and missing middles and ends) of families
 * that were only in the game as trainers' Pokémon, so Abra, Machop, Zubat,
 * Dratini and the rest can be caught and raised into them. Drowzee and
 * Slakoth, trainer-only before, turn up wild too. Sprites and cries are the
 * same sets as the rest (PokéAPI's Showdown sprites and its cries).
 */
DATA.wild.push(...[{"id":10,"name":"CATERPIE","types":["bug"],"base":{"hp":45,"attack":30,"defense":35,"special-attack":20,"special-defense":20,"speed":45},"capture":255},{"id":13,"name":"WEEDLE","types":["bug","poison"],"base":{"hp":40,"attack":35,"defense":30,"special-attack":20,"special-defense":20,"speed":50},"capture":255},{"id":37,"name":"VULPIX","types":["fire"],"base":{"hp":38,"attack":41,"defense":40,"special-attack":50,"special-defense":65,"speed":65},"capture":190},{"id":41,"name":"ZUBAT","types":["poison","flying"],"base":{"hp":40,"attack":45,"defense":35,"special-attack":30,"special-defense":40,"speed":55},"capture":255},{"id":43,"name":"ODDISH","types":["grass","poison"],"base":{"hp":45,"attack":50,"defense":55,"special-attack":75,"special-defense":65,"speed":30},"capture":255},{"id":48,"name":"VENONAT","types":["bug","poison"],"base":{"hp":60,"attack":55,"defense":50,"special-attack":40,"special-defense":55,"speed":45},"capture":190},{"id":56,"name":"MANKEY","types":["fighting"],"base":{"hp":40,"attack":80,"defense":35,"special-attack":35,"special-defense":45,"speed":70},"capture":190},{"id":60,"name":"POLIWAG","types":["water"],"base":{"hp":40,"attack":50,"defense":40,"special-attack":40,"special-defense":40,"speed":90},"capture":255},{"id":63,"name":"ABRA","types":["psychic"],"base":{"hp":25,"attack":20,"defense":15,"special-attack":105,"special-defense":55,"speed":90},"capture":200},{"id":66,"name":"MACHOP","types":["fighting"],"base":{"hp":70,"attack":80,"defense":50,"special-attack":35,"special-defense":35,"speed":35},"capture":180},{"id":69,"name":"BELLSPROUT","types":["grass","poison"],"base":{"hp":50,"attack":75,"defense":35,"special-attack":70,"special-defense":30,"speed":40},"capture":255},{"id":74,"name":"GEODUDE","types":["rock","ground"],"base":{"hp":40,"attack":80,"defense":100,"special-attack":30,"special-defense":30,"speed":20},"capture":255},{"id":77,"name":"PONYTA","types":["fire"],"base":{"hp":50,"attack":85,"defense":55,"special-attack":65,"special-defense":65,"speed":90},"capture":190},{"id":88,"name":"GRIMER","types":["poison"],"base":{"hp":80,"attack":80,"defense":50,"special-attack":40,"special-defense":50,"speed":25},"capture":190},{"id":100,"name":"VOLTORB","types":["electric"],"base":{"hp":40,"attack":30,"defense":50,"special-attack":55,"special-defense":55,"speed":100},"capture":190},{"id":102,"name":"EXEGGCUTE","types":["grass","psychic"],"base":{"hp":60,"attack":40,"defense":80,"special-attack":60,"special-defense":45,"speed":40},"capture":90},{"id":109,"name":"KOFFING","types":["poison"],"base":{"hp":40,"attack":65,"defense":95,"special-attack":60,"special-defense":45,"speed":35},"capture":190},{"id":118,"name":"GOLDEEN","types":["water"],"base":{"hp":45,"attack":67,"defense":60,"special-attack":35,"special-defense":50,"speed":63},"capture":225},{"id":120,"name":"STARYU","types":["water"],"base":{"hp":30,"attack":45,"defense":55,"special-attack":70,"special-defense":55,"speed":85},"capture":225},{"id":147,"name":"DRATINI","types":["dragon"],"base":{"hp":41,"attack":64,"defense":45,"special-attack":50,"special-defense":50,"speed":50},"capture":45},{"id":167,"name":"SPINARAK","types":["bug","poison"],"base":{"hp":40,"attack":60,"defense":40,"special-attack":40,"special-defense":40,"speed":30},"capture":255},{"id":187,"name":"HOPPIP","types":["grass","flying"],"base":{"hp":35,"attack":35,"defense":40,"special-attack":35,"special-defense":55,"speed":50},"capture":255},{"id":204,"name":"PINECO","types":["bug"],"base":{"hp":50,"attack":65,"defense":90,"special-attack":35,"special-defense":35,"speed":15},"capture":190},{"id":218,"name":"SLUGMA","types":["fire"],"base":{"hp":40,"attack":40,"defense":40,"special-attack":70,"special-defense":40,"speed":20},"capture":190},{"id":228,"name":"HOUNDOUR","types":["dark","fire"],"base":{"hp":45,"attack":60,"defense":30,"special-attack":80,"special-defense":50,"speed":65},"capture":120},{"id":449,"name":"HIPPOPOTAS","types":["ground"],"base":{"hp":68,"attack":72,"defense":78,"special-attack":38,"special-defense":42,"speed":32},"capture":140},{"id":568,"name":"TRUBBISH","types":["poison"],"base":{"hp":50,"attack":50,"defense":62,"special-attack":40,"special-defense":62,"speed":65},"capture":190}], ...["DROWZEE","SLAKOTH"].map((n) => DATA.trainer.find((t) => t.name === n)))
DATA.forms.push(...[{"id":12,"name":"BUTTERFREE","types":["bug","flying"],"base":{"hp":60,"attack":45,"defense":50,"special-attack":90,"special-defense":80,"speed":70},"capture":45},{"id":15,"name":"BEEDRILL","types":["bug","poison"],"base":{"hp":65,"attack":90,"defense":40,"special-attack":45,"special-defense":80,"speed":75},"capture":45},{"id":42,"name":"GOLBAT","types":["poison","flying"],"base":{"hp":75,"attack":80,"defense":70,"special-attack":65,"special-defense":75,"speed":90},"capture":90},{"id":44,"name":"GLOOM","types":["grass","poison"],"base":{"hp":60,"attack":65,"defense":70,"special-attack":85,"special-defense":75,"speed":40},"capture":120},{"id":61,"name":"POLIWHIRL","types":["water"],"base":{"hp":65,"attack":65,"defense":65,"special-attack":50,"special-defense":50,"speed":90},"capture":120},{"id":70,"name":"WEEPINBELL","types":["grass","poison"],"base":{"hp":65,"attack":90,"defense":50,"special-attack":85,"special-defense":45,"speed":55},"capture":120},{"id":97,"name":"HYPNO","types":["psychic"],"base":{"hp":85,"attack":73,"defense":70,"special-attack":73,"special-defense":115,"speed":67},"capture":75},{"id":188,"name":"SKIPLOOM","types":["grass","flying"],"base":{"hp":55,"attack":45,"defense":50,"special-attack":45,"special-defense":65,"speed":80},"capture":120},{"id":288,"name":"VIGOROTH","types":["normal"],"base":{"hp":80,"attack":80,"defense":80,"special-attack":55,"special-defense":55,"speed":90},"capture":120},{"id":289,"name":"SLAKING","types":["normal"],"base":{"hp":150,"attack":160,"defense":100,"special-attack":95,"special-defense":65,"speed":100},"capture":45}])
/*
 * How often each wild species turns up, in a machine's weekly pool and then
 * among the pool: by catch rate, as in the games (easy to catch is common),
 * except that rare is a short list set by hand: the pseudo-legendary lines,
 * the fossils, Porygon, Lapras and Unown. Otherwise hard to catch is uncommon.
 */
const RARITY_WEIGHT = { common: 4, uncommon: 2, rare: 1 }
const RARITY_SET = { EEVEE: 'uncommon', AIPOM: 'uncommon', LICKITUNG: 'uncommon', SMOOCHUM: 'uncommon', ELEKID: 'uncommon', MAGBY: 'uncommon', SCYTHER: 'uncommon',
  TANGELA: 'uncommon', MURKROW: 'uncommon', MISDREAVUS: 'uncommon' }
for (const n of ['DRATINI', 'GIBLE', 'LARVITAR', 'DREEPY', 'KABUTO', 'OMANYTE', 'AERODACTYL', 'PORYGON', 'LAPRAS', 'UNOWN']) RARITY_SET[n] = 'rare'
const rarityOf = (w) => RARITY_SET[w.name] ?? (w.capture >= 120 ? 'common' : 'uncommon')
/*
 * Shiny Pokémon: now and then a wild one is shiny, in its alternate colours,
 * with a sparkle as it appears (1 in SHINY_ODDS). It stays shiny when caught,
 * through evolution, and in the save. Shiny sprites (public/rpg/a/shiny/, from
 * the same PokeAPI Showdown set as the rest) exist for every species you can
 * meet wild and everything they evolve into; anything else just shows as usual.
 */
const SHINY_ODDS = 500
const SHINY_IDS = new Set([10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,32,33,37,41,42,43,44,46,47,48,49,50,51,52,53,54,55,56,57,58,60,61,63,64,66,67,69,70,72,73,74,75,77,78,79,80,81,82,83,84,85,86,87,88,89,90,92,93,94,95,96,97,98,99,100,101,102,104,105,106,107,108,109,110,111,112,114,115,116,117,118,119,120,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,147,148,149,161,162,163,164,165,166,167,168,170,171,172,173,174,175,177,178,179,180,181,183,184,185,187,188,189,190,191,193,194,195,196,197,198,200,201,202,203,204,205,206,207,209,210,211,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,234,235,236,237,238,239,240,241,246,247,248,287,288,289,300,399,400,406,424,439,440,443,444,445,446,447,448,449,450,453,454,462,463,470,471,473,568,569,572,669,670,700,885,886,887])
for (const id of SHINY_IDS) Object.assign(ART, { ['s' + id]: `/rpg/a/shiny/${id}.gif`, ['s' + id + 'b']: `/rpg/a/shiny/${id}-back.gif` })
/** A Pokémon's sprite: its shiny one if it's shiny and there is one. `back` for the one facing away. */
const spr = (m, back = false) => (m?.shiny && SHINY_IDS.has(m.id) ? ART[`s${m.id}${back ? 'b' : ''}`] : ART[back ? m.id + 'b' : m.id])
const rarityWeight = (w) => RARITY_WEIGHT[rarityOf(w)]
/** One of `list`, each as likely as its weight. */
function weightedPick(list, weightOf, r) {
  let t = list.reduce((n, x) => n + weightOf(x), 0) * r()
  for (const x of list) { t -= weightOf(x); if (t < 0) return x }
  return list[list.length - 1]
}
Object.assign(DATA.evos, {"CATERPIE":[{"to":"METAPOD","level":7}],"METAPOD":[{"to":"BUTTERFREE","level":10}],"WEEDLE":[{"to":"KAKUNA","level":7}],"KAKUNA":[{"to":"BEEDRILL","level":10}],"ZUBAT":[{"to":"GOLBAT","level":22}],"ODDISH":[{"to":"GLOOM","level":21}],"VENONAT":[{"to":"VENOMOTH","level":31}],"MANKEY":[{"to":"PRIMEAPE","level":28}],"POLIWAG":[{"to":"POLIWHIRL","level":25}],"ABRA":[{"to":"KADABRA","level":16}],"MACHOP":[{"to":"MACHOKE","level":28}],"BELLSPROUT":[{"to":"WEEPINBELL","level":21}],"GEODUDE":[{"to":"GRAVELER","level":25}],"PONYTA":[{"to":"RAPIDASH","level":40}],"GRIMER":[{"to":"MUK","level":38}],"DROWZEE":[{"to":"HYPNO","level":26}],"VOLTORB":[{"to":"ELECTRODE","level":30}],"KOFFING":[{"to":"WEEZING","level":35}],"GOLDEEN":[{"to":"SEAKING","level":33}],"DRATINI":[{"to":"DRAGONAIR","level":30}],"DRAGONAIR":[{"to":"DRAGONITE","level":55}],"SPINARAK":[{"to":"ARIADOS","level":22}],"HOPPIP":[{"to":"SKIPLOOM","level":18}],"SKIPLOOM":[{"to":"JUMPLUFF","level":27}],"PINECO":[{"to":"FORRETRESS","level":31}],"SLUGMA":[{"to":"MAGCARGO","level":38}],"HOUNDOUR":[{"to":"HOUNDOOM","level":24}],"SLAKOTH":[{"to":"VIGOROTH","level":18}],"VIGOROTH":[{"to":"SLAKING","level":36}],"HIPPOPOTAS":[{"to":"HIPPOWDON","level":34}],"TRUBBISH":[{"to":"GARBODOR","level":36}]})
for (const id of [10,13,37,41,43,48,56,60,63,66,69,74,77,88,100,102,109,118,120,147,167,187,204,218,228,449,568,12,15,42,44,61,70,97,188,288,289]) Object.assign(ART, { [id]: `/rpg/a/${id}.gif`, [id + 'b']: `/rpg/a/${id}-back.gif`, ['cry:' + id]: `/rpg/a/cries/${id}.ogg` })
/*
 * The second batch: babies (Cleffa, Igglybuff, Happiny, Munchlax, Smoochum,
 * Elekid, Magby, Tyrogue, Mime Jr.), Meowth, the Kabuto and Omanyte fossils,
 * and the stone and trade evolutions the trainers' Pokémon were missing
 * (Clefable, Wigglytuff, Delcatty, Sunflora, Honchkrow, Mismagius,
 * Rhyperior, Scizor, Porygon2, Porygon-Z, Electivire, Magmortar, Tangrowth,
 * Toxicroak). Skitty, Sunkern, Murkrow, Misdreavus, Rhyhorn, Scyther,
 * Porygon, Tangela and Croagunk, trainer-only before, turn up wild too.
 */
DATA.wild.push(...[{"id":52,"name":"MEOWTH","types":["normal"],"base":{"hp":40,"attack":45,"defense":35,"special-attack":40,"special-defense":40,"speed":90},"capture":255},{"id":140,"name":"KABUTO","types":["rock","water"],"base":{"hp":30,"attack":80,"defense":90,"special-attack":55,"special-defense":45,"speed":55},"capture":45},{"id":138,"name":"OMANYTE","types":["rock","water"],"base":{"hp":35,"attack":40,"defense":100,"special-attack":90,"special-defense":55,"speed":35},"capture":45},{"id":173,"name":"CLEFFA","types":["fairy"],"base":{"hp":50,"attack":25,"defense":28,"special-attack":45,"special-defense":55,"speed":15},"capture":150},{"id":174,"name":"IGGLYBUFF","types":["normal","fairy"],"base":{"hp":90,"attack":30,"defense":15,"special-attack":40,"special-defense":20,"speed":15},"capture":170},{"id":440,"name":"HAPPINY","types":["normal"],"base":{"hp":100,"attack":5,"defense":5,"special-attack":15,"special-defense":65,"speed":30},"capture":130},{"id":446,"name":"MUNCHLAX","types":["normal"],"base":{"hp":135,"attack":85,"defense":40,"special-attack":40,"special-defense":85,"speed":5},"capture":50},{"id":238,"name":"SMOOCHUM","types":["ice","psychic"],"base":{"hp":45,"attack":30,"defense":15,"special-attack":85,"special-defense":65,"speed":65},"capture":45},{"id":239,"name":"ELEKID","types":["electric"],"base":{"hp":45,"attack":63,"defense":37,"special-attack":65,"special-defense":55,"speed":95},"capture":45},{"id":240,"name":"MAGBY","types":["fire"],"base":{"hp":45,"attack":75,"defense":37,"special-attack":70,"special-defense":55,"speed":83},"capture":45},{"id":236,"name":"TYROGUE","types":["fighting"],"base":{"hp":35,"attack":35,"defense":35,"special-attack":35,"special-defense":35,"speed":35},"capture":75},{"id":439,"name":"MIME JR.","types":["psychic","fairy"],"base":{"hp":20,"attack":25,"defense":45,"special-attack":70,"special-defense":90,"speed":60},"capture":145}], ...["SKITTY","SUNKERN","MURKROW","MISDREAVUS","RHYHORN","SCYTHER","PORYGON","TANGELA","CROAGUNK"].map((n) => DATA.trainer.find((t) => t.name === n)))
DATA.forms.push(...[{"id":36,"name":"CLEFABLE","types":["fairy"],"base":{"hp":95,"attack":70,"defense":73,"special-attack":95,"special-defense":90,"speed":60},"capture":25},{"id":40,"name":"WIGGLYTUFF","types":["normal","fairy"],"base":{"hp":140,"attack":70,"defense":45,"special-attack":85,"special-defense":50,"speed":45},"capture":50},{"id":301,"name":"DELCATTY","types":["normal"],"base":{"hp":70,"attack":65,"defense":65,"special-attack":55,"special-defense":55,"speed":90},"capture":60},{"id":192,"name":"SUNFLORA","types":["grass"],"base":{"hp":75,"attack":75,"defense":55,"special-attack":105,"special-defense":85,"speed":30},"capture":120},{"id":430,"name":"HONCHKROW","types":["dark","flying"],"base":{"hp":100,"attack":125,"defense":52,"special-attack":105,"special-defense":52,"speed":71},"capture":30},{"id":429,"name":"MISMAGIUS","types":["ghost"],"base":{"hp":60,"attack":60,"defense":60,"special-attack":105,"special-defense":105,"speed":105},"capture":45},{"id":464,"name":"RHYPERIOR","types":["ground","rock"],"base":{"hp":115,"attack":140,"defense":130,"special-attack":55,"special-defense":55,"speed":40},"capture":30},{"id":212,"name":"SCIZOR","types":["bug","steel"],"base":{"hp":70,"attack":130,"defense":100,"special-attack":55,"special-defense":80,"speed":65},"capture":25},{"id":233,"name":"PORYGON2","types":["normal"],"base":{"hp":85,"attack":80,"defense":90,"special-attack":105,"special-defense":95,"speed":60},"capture":45},{"id":474,"name":"PORYGON-Z","types":["normal"],"base":{"hp":85,"attack":80,"defense":70,"special-attack":135,"special-defense":75,"speed":90},"capture":30},{"id":466,"name":"ELECTIVIRE","types":["electric"],"base":{"hp":75,"attack":123,"defense":67,"special-attack":95,"special-defense":85,"speed":95},"capture":30},{"id":467,"name":"MAGMORTAR","types":["fire"],"base":{"hp":75,"attack":95,"defense":67,"special-attack":125,"special-defense":95,"speed":83},"capture":30},{"id":465,"name":"TANGROWTH","types":["grass"],"base":{"hp":100,"attack":100,"defense":125,"special-attack":110,"special-defense":50,"speed":50},"capture":30},{"id":454,"name":"TOXICROAK","types":["poison","fighting"],"base":{"hp":83,"attack":106,"defense":65,"special-attack":86,"special-defense":65,"speed":85},"capture":75}])
Object.assign(DATA.evos, {"MEOWTH":[{"to":"PERSIAN","level":28}],"KABUTO":[{"to":"KABUTOPS","level":40}],"OMANYTE":[{"to":"OMASTAR","level":40}],"SMOOCHUM":[{"to":"JYNX","level":30}],"ELEKID":[{"to":"ELECTABUZZ","level":30}],"MAGBY":[{"to":"MAGMAR","level":30}],"TYROGUE":[{"to":"HITMONLEE","level":20},{"to":"HITMONCHAN","level":20},{"to":"HITMONTOP","level":20}],"CROAGUNK":[{"to":"TOXICROAK","level":37}],"RHYHORN":[{"to":"RHYDON","level":42}]})
for (const id of [52,140,138,173,174,440,446,238,239,240,236,439,36,40,301,192,430,429,464,212,233,474,466,467,465,454]) Object.assign(ART, { [id]: `/rpg/a/${id}.gif`, [id + 'b']: `/rpg/a/${id}-back.gif`, ['cry:' + id]: `/rpg/a/cries/${id}.ogg` })
Object.assign(ART, { 'item:moonstone': '/rpg/a/items/moonstone.png', 'item:sunstone': '/rpg/a/items/sunstone.png', 'item:duskstone': '/rpg/a/items/duskstone.png' })
/*
 * Gen 1 and 2, finished: every non-legendary Kanto and Johto Pokémon is in
 * the game. The 42 first stages here are wild, and so are ten that were
 * only trainers' until now (Growlithe, Slowpoke, Onix, Lapras, Ditto,
 * Aerodactyl, Natu, Smeargle, Miltank, Skarmory). Their evolutions are in
 * DATA.forms, by level, stone, Linking Cord or Bond.
 */
DATA.wild.push(...[{"id":19,"name":"RATTATA","types":["normal"],"base":{"hp":30,"attack":56,"defense":35,"special-attack":25,"special-defense":35,"speed":72},"capture":255},{"id":21,"name":"SPEAROW","types":["normal","flying"],"base":{"hp":40,"attack":60,"defense":30,"special-attack":31,"special-defense":31,"speed":70},"capture":255},{"id":23,"name":"EKANS","types":["poison"],"base":{"hp":35,"attack":60,"defense":44,"special-attack":40,"special-defense":54,"speed":55},"capture":255},{"id":27,"name":"SANDSHREW","types":["ground"],"base":{"hp":50,"attack":75,"defense":85,"special-attack":20,"special-defense":30,"speed":40},"capture":255},{"id":29,"name":"NIDORAN♀","types":["poison"],"base":{"hp":55,"attack":47,"defense":52,"special-attack":40,"special-defense":40,"speed":41},"capture":235},{"id":32,"name":"NIDORAN♂","types":["poison"],"base":{"hp":46,"attack":57,"defense":40,"special-attack":40,"special-defense":40,"speed":50},"capture":235},{"id":46,"name":"PARAS","types":["bug","grass"],"base":{"hp":35,"attack":70,"defense":55,"special-attack":45,"special-defense":55,"speed":25},"capture":190},{"id":50,"name":"DIGLETT","types":["ground"],"base":{"hp":10,"attack":55,"defense":25,"special-attack":35,"special-defense":45,"speed":95},"capture":255},{"id":72,"name":"TENTACOOL","types":["water","poison"],"base":{"hp":40,"attack":40,"defense":35,"special-attack":50,"special-defense":100,"speed":70},"capture":190},{"id":83,"name":"FARFETCH'D","types":["normal","flying"],"base":{"hp":52,"attack":90,"defense":55,"special-attack":58,"special-defense":62,"speed":60},"capture":45},{"id":84,"name":"DODUO","types":["normal","flying"],"base":{"hp":35,"attack":85,"defense":45,"special-attack":35,"special-defense":35,"speed":75},"capture":190},{"id":90,"name":"SHELLDER","types":["water"],"base":{"hp":30,"attack":65,"defense":100,"special-attack":45,"special-defense":25,"speed":40},"capture":190},{"id":98,"name":"KRABBY","types":["water"],"base":{"hp":30,"attack":105,"defense":90,"special-attack":25,"special-defense":25,"speed":50},"capture":225},{"id":104,"name":"CUBONE","types":["ground"],"base":{"hp":50,"attack":50,"defense":95,"special-attack":40,"special-defense":50,"speed":35},"capture":190},{"id":115,"name":"KANGASKHAN","types":["normal"],"base":{"hp":105,"attack":95,"defense":80,"special-attack":40,"special-defense":80,"speed":90},"capture":45},{"id":127,"name":"PINSIR","types":["bug"],"base":{"hp":65,"attack":125,"defense":100,"special-attack":55,"special-defense":70,"speed":85},"capture":45},{"id":128,"name":"TAUROS","types":["normal"],"base":{"hp":75,"attack":100,"defense":95,"special-attack":40,"special-defense":70,"speed":110},"capture":45},{"id":161,"name":"SENTRET","types":["normal"],"base":{"hp":35,"attack":46,"defense":34,"special-attack":35,"special-defense":45,"speed":20},"capture":255},{"id":165,"name":"LEDYBA","types":["bug","flying"],"base":{"hp":40,"attack":20,"defense":30,"special-attack":40,"special-defense":80,"speed":55},"capture":255},{"id":170,"name":"CHINCHOU","types":["water","electric"],"base":{"hp":75,"attack":38,"defense":38,"special-attack":56,"special-defense":56,"speed":67},"capture":190},{"id":175,"name":"TOGEPI","types":["fairy"],"base":{"hp":35,"attack":20,"defense":65,"special-attack":40,"special-defense":65,"speed":20},"capture":190},{"id":179,"name":"MAREEP","types":["electric"],"base":{"hp":55,"attack":40,"defense":40,"special-attack":65,"special-defense":45,"speed":35},"capture":235},{"id":183,"name":"MARILL","types":["water","fairy"],"base":{"hp":70,"attack":20,"defense":50,"special-attack":20,"special-defense":50,"speed":40},"capture":190},{"id":185,"name":"SUDOWOODO","types":["rock"],"base":{"hp":70,"attack":100,"defense":115,"special-attack":30,"special-defense":65,"speed":30},"capture":65},{"id":193,"name":"YANMA","types":["bug","flying"],"base":{"hp":65,"attack":65,"defense":45,"special-attack":75,"special-defense":45,"speed":95},"capture":75},{"id":201,"name":"UNOWN","types":["psychic"],"base":{"hp":48,"attack":72,"defense":48,"special-attack":72,"special-defense":48,"speed":48},"capture":225},{"id":202,"name":"WOBBUFFET","types":["psychic"],"base":{"hp":190,"attack":33,"defense":58,"special-attack":33,"special-defense":58,"speed":33},"capture":45},{"id":203,"name":"GIRAFARIG","types":["normal","psychic"],"base":{"hp":70,"attack":80,"defense":65,"special-attack":90,"special-defense":65,"speed":85},"capture":60},{"id":206,"name":"DUNSPARCE","types":["normal"],"base":{"hp":100,"attack":70,"defense":70,"special-attack":65,"special-defense":65,"speed":45},"capture":190},{"id":207,"name":"GLIGAR","types":["ground","flying"],"base":{"hp":65,"attack":75,"defense":105,"special-attack":35,"special-defense":65,"speed":85},"capture":60},{"id":209,"name":"SNUBBULL","types":["fairy"],"base":{"hp":60,"attack":80,"defense":50,"special-attack":40,"special-defense":40,"speed":30},"capture":190},{"id":211,"name":"QWILFISH","types":["water","poison"],"base":{"hp":65,"attack":95,"defense":85,"special-attack":55,"special-defense":55,"speed":85},"capture":45},{"id":213,"name":"SHUCKLE","types":["bug","rock"],"base":{"hp":20,"attack":10,"defense":230,"special-attack":10,"special-defense":230,"speed":5},"capture":190},{"id":214,"name":"HERACROSS","types":["bug","fighting"],"base":{"hp":80,"attack":125,"defense":75,"special-attack":40,"special-defense":95,"speed":85},"capture":45},{"id":215,"name":"SNEASEL","types":["dark","ice"],"base":{"hp":55,"attack":95,"defense":55,"special-attack":35,"special-defense":75,"speed":115},"capture":60},{"id":216,"name":"TEDDIURSA","types":["normal"],"base":{"hp":60,"attack":80,"defense":50,"special-attack":50,"special-defense":50,"speed":40},"capture":120},{"id":222,"name":"CORSOLA","types":["water","rock"],"base":{"hp":65,"attack":55,"defense":95,"special-attack":65,"special-defense":95,"speed":35},"capture":60},{"id":223,"name":"REMORAID","types":["water"],"base":{"hp":35,"attack":65,"defense":35,"special-attack":65,"special-defense":35,"speed":65},"capture":190},{"id":225,"name":"DELIBIRD","types":["ice","flying"],"base":{"hp":45,"attack":55,"defense":45,"special-attack":65,"special-defense":45,"speed":75},"capture":45},{"id":226,"name":"MANTINE","types":["water","flying"],"base":{"hp":85,"attack":40,"defense":70,"special-attack":80,"special-defense":140,"speed":70},"capture":25},{"id":231,"name":"PHANPY","types":["ground"],"base":{"hp":90,"attack":60,"defense":60,"special-attack":40,"special-defense":40,"speed":40},"capture":120},{"id":234,"name":"STANTLER","types":["normal"],"base":{"hp":73,"attack":95,"defense":62,"special-attack":85,"special-defense":65,"speed":85},"capture":45}], ...['GROWLITHE', 'SLOWPOKE', 'ONIX', 'LAPRAS', 'DITTO', 'AERODACTYL', 'NATU', 'SMEARGLE', 'MILTANK', 'SKARMORY'].map((n) => DATA.trainer.find((t) => t.name === n)))
DATA.forms.push(...[{"id":20,"name":"RATICATE","types":["normal"],"base":{"hp":55,"attack":81,"defense":60,"special-attack":50,"special-defense":70,"speed":97},"capture":127},{"id":22,"name":"FEAROW","types":["normal","flying"],"base":{"hp":65,"attack":90,"defense":65,"special-attack":61,"special-defense":61,"speed":100},"capture":90},{"id":24,"name":"ARBOK","types":["poison"],"base":{"hp":60,"attack":95,"defense":69,"special-attack":65,"special-defense":79,"speed":80},"capture":90},{"id":28,"name":"SANDSLASH","types":["ground"],"base":{"hp":75,"attack":100,"defense":110,"special-attack":45,"special-defense":55,"speed":65},"capture":90},{"id":30,"name":"NIDORINA","types":["poison"],"base":{"hp":70,"attack":62,"defense":67,"special-attack":55,"special-defense":55,"speed":56},"capture":120},{"id":31,"name":"NIDOQUEEN","types":["poison","ground"],"base":{"hp":90,"attack":92,"defense":87,"special-attack":75,"special-defense":85,"speed":76},"capture":45},{"id":33,"name":"NIDORINO","types":["poison"],"base":{"hp":61,"attack":72,"defense":57,"special-attack":55,"special-defense":55,"speed":65},"capture":120},{"id":34,"name":"NIDOKING","types":["poison","ground"],"base":{"hp":81,"attack":102,"defense":77,"special-attack":85,"special-defense":75,"speed":85},"capture":45},{"id":47,"name":"PARASECT","types":["bug","grass"],"base":{"hp":60,"attack":95,"defense":80,"special-attack":60,"special-defense":80,"speed":30},"capture":75},{"id":51,"name":"DUGTRIO","types":["ground"],"base":{"hp":35,"attack":100,"defense":50,"special-attack":50,"special-defense":70,"speed":120},"capture":50},{"id":73,"name":"TENTACRUEL","types":["water","poison"],"base":{"hp":80,"attack":70,"defense":65,"special-attack":80,"special-defense":120,"speed":100},"capture":60},{"id":85,"name":"DODRIO","types":["normal","flying"],"base":{"hp":60,"attack":110,"defense":70,"special-attack":60,"special-defense":60,"speed":110},"capture":45},{"id":91,"name":"CLOYSTER","types":["water","ice"],"base":{"hp":50,"attack":95,"defense":180,"special-attack":85,"special-defense":45,"speed":70},"capture":60},{"id":99,"name":"KINGLER","types":["water"],"base":{"hp":55,"attack":130,"defense":115,"special-attack":50,"special-defense":50,"speed":75},"capture":60},{"id":105,"name":"MAROWAK","types":["ground"],"base":{"hp":60,"attack":80,"defense":110,"special-attack":50,"special-defense":80,"speed":45},"capture":75},{"id":162,"name":"FURRET","types":["normal"],"base":{"hp":85,"attack":76,"defense":64,"special-attack":45,"special-defense":55,"speed":90},"capture":90},{"id":166,"name":"LEDIAN","types":["bug","flying"],"base":{"hp":55,"attack":35,"defense":50,"special-attack":55,"special-defense":110,"speed":85},"capture":90},{"id":171,"name":"LANTURN","types":["water","electric"],"base":{"hp":125,"attack":58,"defense":58,"special-attack":76,"special-defense":76,"speed":67},"capture":75},{"id":176,"name":"TOGETIC","types":["fairy","flying"],"base":{"hp":55,"attack":40,"defense":85,"special-attack":80,"special-defense":105,"speed":40},"capture":75},{"id":180,"name":"FLAAFFY","types":["electric"],"base":{"hp":70,"attack":55,"defense":55,"special-attack":80,"special-defense":60,"speed":45},"capture":120},{"id":181,"name":"AMPHAROS","types":["electric"],"base":{"hp":90,"attack":75,"defense":85,"special-attack":115,"special-defense":90,"speed":55},"capture":45},{"id":184,"name":"AZUMARILL","types":["water","fairy"],"base":{"hp":100,"attack":50,"defense":80,"special-attack":60,"special-defense":80,"speed":50},"capture":75},{"id":186,"name":"POLITOED","types":["water"],"base":{"hp":90,"attack":75,"defense":75,"special-attack":90,"special-defense":100,"speed":70},"capture":45},{"id":199,"name":"SLOWKING","types":["water","psychic"],"base":{"hp":95,"attack":75,"defense":80,"special-attack":100,"special-defense":110,"speed":30},"capture":70},{"id":210,"name":"GRANBULL","types":["fairy"],"base":{"hp":90,"attack":120,"defense":75,"special-attack":60,"special-defense":60,"speed":45},"capture":75},{"id":217,"name":"URSARING","types":["normal"],"base":{"hp":90,"attack":130,"defense":75,"special-attack":75,"special-defense":75,"speed":55},"capture":60},{"id":224,"name":"OCTILLERY","types":["water"],"base":{"hp":75,"attack":105,"defense":75,"special-attack":105,"special-defense":75,"speed":45},"capture":75},{"id":232,"name":"DONPHAN","types":["ground"],"base":{"hp":90,"attack":120,"defense":120,"special-attack":60,"special-defense":60,"speed":50},"capture":60}])
Object.assign(DATA.evos, {"RATTATA":[{"to":"RATICATE","level":20}],"SPEAROW":[{"to":"FEAROW","level":20}],"EKANS":[{"to":"ARBOK","level":22}],"SANDSHREW":[{"to":"SANDSLASH","level":22}],"NIDORAN♀":[{"to":"NIDORINA","level":16}],"NIDORAN♂":[{"to":"NIDORINO","level":16}],"PARAS":[{"to":"PARASECT","level":24}],"DIGLETT":[{"to":"DUGTRIO","level":26}],"TENTACOOL":[{"to":"TENTACRUEL","level":30}],"DODUO":[{"to":"DODRIO","level":31}],"KRABBY":[{"to":"KINGLER","level":28}],"CUBONE":[{"to":"MAROWAK","level":28}],"SENTRET":[{"to":"FURRET","level":15}],"LEDYBA":[{"to":"LEDIAN","level":18}],"CHINCHOU":[{"to":"LANTURN","level":27}],"MAREEP":[{"to":"FLAAFFY","level":15}],"FLAAFFY":[{"to":"AMPHAROS","level":30}],"MARILL":[{"to":"AZUMARILL","level":18}],"SNUBBULL":[{"to":"GRANBULL","level":23}],"TEDDIURSA":[{"to":"URSARING","level":30}],"REMORAID":[{"to":"OCTILLERY","level":25}],"PHANPY":[{"to":"DONPHAN","level":25}],"SLOWPOKE":[{"to":"SLOWBRO","level":37}],"NATU":[{"to":"XATU","level":25}],"PATRAT":[{"to":"WATCHOG","level":20}],"PURRLOIN":[{"to":"LIEPARD","level":20}],"SKWOVET":[{"to":"GREEDENT","level":24}]})
for (const id of [19,21,23,27,29,32,46,50,72,83,84,90,98,104,115,127,128,161,165,170,175,179,183,185,193,201,202,203,206,207,209,211,213,214,215,216,222,223,225,226,231,234,20,22,24,28,30,31,33,34,47,51,73,85,91,99,105,162,166,171,176,180,181,184,186,199,210,217,224,232]) Object.assign(ART, { [id]: `/rpg/a/${id}.gif`, [id + 'b']: `/rpg/a/${id}-back.gif`, ['cry:' + id]: `/rpg/a/cries/${id}.ogg` })
/*
 * The Shiny Stone's Pokémon: Togetic → Togekiss, and the Budew, Minccino
 * and Flabébé families it finishes (Roselia → Roserade, Minccino →
 * Cinccino, Floette → Florges). Budew evolves at full Bond by day.
 */
DATA.wild.push(...[{"id":406,"name":"BUDEW","types":["grass","poison"],"base":{"hp":40,"attack":30,"defense":35,"special-attack":50,"special-defense":70,"speed":55},"capture":255},{"id":572,"name":"MINCCINO","types":["normal"],"base":{"hp":55,"attack":50,"defense":40,"special-attack":40,"special-defense":40,"speed":75},"capture":255},{"id":669,"name":"FLABÉBÉ","types":["fairy"],"base":{"hp":44,"attack":38,"defense":39,"special-attack":61,"special-defense":79,"speed":42},"capture":225}])
DATA.forms.push(...[{"id":315,"name":"ROSELIA","types":["grass","poison"],"base":{"hp":50,"attack":60,"defense":45,"special-attack":100,"special-defense":80,"speed":65},"capture":150},{"id":407,"name":"ROSERADE","types":["grass","poison"],"base":{"hp":60,"attack":70,"defense":65,"special-attack":125,"special-defense":105,"speed":90},"capture":75},{"id":573,"name":"CINCCINO","types":["normal"],"base":{"hp":75,"attack":95,"defense":60,"special-attack":65,"special-defense":60,"speed":115},"capture":60},{"id":670,"name":"FLOETTE","types":["fairy"],"base":{"hp":54,"attack":45,"defense":47,"special-attack":75,"special-defense":98,"speed":52},"capture":120},{"id":671,"name":"FLORGES","types":["fairy"],"base":{"hp":78,"attack":65,"defense":68,"special-attack":112,"special-defense":154,"speed":75},"capture":45},{"id":468,"name":"TOGEKISS","types":["fairy","flying"],"base":{"hp":85,"attack":50,"defense":95,"special-attack":120,"special-defense":115,"speed":80},"capture":30}])
Object.assign(DATA.evos, {"FLABÉBÉ":[{"to":"FLOETTE","level":19}]})
for (const id of [406,572,669,315,407,573,670,671,468]) Object.assign(ART, { [id]: `/rpg/a/${id}.gif`, [id + 'b']: `/rpg/a/${id}-back.gif`, ['cry:' + id]: `/rpg/a/cries/${id}.ogg` })
ART['item:shinystone'] = '/rpg/a/items/shinystone.png'
// Every species has its cry (a few of the trainers' evolved Pokémon didn't, so they came out silent).
for (const s of [...DATA.starters, ...DATA.wild, ...DATA.trainer, ...DATA.forms]) ART['cry:' + s.id] ??= `/rpg/a/cries/${s.id}.ogg`

Object.assign(SFX, {
  rustle:  { file: null, synth: (ac, o, t) => { for (let i = 0; i < 3; i++) noise(ac, o, t + i * .11, { dur: .09, vol: .22, filter: 'bandpass', f: 2400, q: 1.2 }) } },
  bang:    { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 880, dur: .07, vol: .14 }); tone(ac, o, t + .08, { f: 1320, dur: .12, vol: .14 }) } },
  throw:   { file: null, synth: (ac, o, t) => noise(ac, o, t, { dur: .32, vol: .22, filter: 'bandpass', f: 500, f1: 2600, q: 1.4 }) },
  absorb:  { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'triangle', f: 400, f1: 1600, dur: .35, vol: .16 }); noise(ac, o, t, { dur: .3, vol: .08, filter: 'highpass', f: 4000 }) } },
  wobble:  { file: null, synth: (ac, o, t) => { tone(ac, o, t, { type: 'sine', f: 160, f1: 110, dur: .12, vol: .35 }); noise(ac, o, t, { dur: .05, vol: .15, filter: 'bandpass', f: 1200 }) } },
  click:   { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .03, vol: .35, filter: 'highpass', f: 3000 }); noise(ac, o, t + .07, { dur: .03, vol: .35, filter: 'highpass', f: 3000 }) } },
  breakout:{ file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .18, vol: .4, filter: 'bandpass', f: 1600, f1: 400, q: 1 }); tone(ac, o, t, { f: 900, f1: 300, dur: .2, vol: .14 }) } },
  heal:    { file: null, synth: (ac, o, t) => arp(ac, o, t, ['G5', 'C6', 'E6', 'G6', 'C7'], .07, .09) },
  run:     { file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 900, f1: 300, dur: .25, vol: .1 }); noise(ac, o, t, { dur: .25, vol: .15, filter: 'bandpass', f: 2000, f1: 600 }) } },
})
SONGS.caught = { file: null, loop: false, bpm: 150, div: 2,
  lead: 'C5 E5 G5 C6 . B5 . G5 A5 . F5 . G5 . . . . . -'.split(' '),
  bass: 'C3 . G3 . C3 . E3 . F3 . A3 . G3 . . . . . -'.split(' '),
  drums: 'K.h.S.h.K.h.S.SSC.......'.slice(0, 19) }

/* The modern type chart, in full: attacking type -> defending type -> multiplier. */
const CHART = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon: { dragon: 2, steel: .5, fairy: 0 },
  dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
}
const gameMult = (type, def) => def.reduce((m, t) => m * (CHART[type]?.[t] ?? 1), 1)
function soften(m) {
  if (m === 0) return 0.5
  if (m >= 4) return 2
  if (m >= 2) return 1.5
  if (m <= 0.25) return 0.5
  if (m < 1) return 0.67
  return 1
}
const TYPE_COL = { normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', grass: '#7ac74c', electric: '#f7d02c', ice: '#96d9d6',
  fighting: '#c22e28', poison: '#a33ea1', ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746', steel: '#b7b7ce', fairy: '#d685ad' }

/* ── individual stats ── */
const NATURES = [['Hardy'], ['Lonely', 'atk', 'def'], ['Brave', 'atk', 'spe'], ['Adamant', 'atk', 'spa'], ['Naughty', 'atk', 'spd'],
  ['Bold', 'def', 'atk'], ['Docile'], ['Relaxed', 'def', 'spe'], ['Impish', 'def', 'spa'], ['Lax', 'def', 'spd'],
  ['Timid', 'spe', 'atk'], ['Hasty', 'spe', 'def'], ['Serious'], ['Jolly', 'spe', 'spa'], ['Naive', 'spe', 'spd'],
  ['Modest', 'spa', 'atk'], ['Mild', 'spa', 'def'], ['Quiet', 'spa', 'spe'], ['Bashful'], ['Rash', 'spa', 'spd'],
  ['Calm', 'spd', 'atk'], ['Gentle', 'spd', 'def'], ['Sassy', 'spd', 'spe'], ['Careful', 'spd', 'spa'], ['Quirky']]
const STAT_KEYS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
const STAT_LABEL = { hp: 'HP', atk: 'ATK', def: 'DEF', spa: 'SP.A', spd: 'SP.D', spe: 'SPE' }
const BASE_KEY = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', spe: 'speed' }

/** A small seeded generator, so the demo rolls the same Pokémon every time. In
    the app this roll happens on the server, once, when the Pokémon appears. */
function rng(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
/** One individual: its own IVs and nature, and the stats they give at a level. */
function individual(species, level, rand) {
  const ivs = Object.fromEntries(STAT_KEYS.map((k) => [k, Math.floor(rand() * 32)]))
  const nature = NATURES[Math.floor(rand() * NATURES.length)]
  const stats = {}
  for (const k of STAT_KEYS) {
    const b = species.base[BASE_KEY[k]], core = Math.floor((2 * b + ivs[k]) * level / 100)
    stats[k] = k === 'hp' ? core + level + 10
      : Math.floor((core + 5) * (nature[1] === k ? 1.1 : nature[2] === k ? 0.9 : 1))
  }
  return { ...species, level, ivs, nature, stats, hp: stats.hp }
}

/* Starter moves: a Normal move, and a first move of its own type. */
const OWN_MOVE = { fire: 'EMBER', water: 'WATER GUN', grass: 'VINE WHIP' }
const NORMAL_MOVE = { CHARMANDER: 'SCRATCH', TORCHIC: 'SCRATCH', CHIMCHAR: 'SCRATCH', FENNEKIN: 'SCRATCH', LITTEN: 'SCRATCH', SPRIGATITO: 'SCRATCH',
  GROOKEY: 'SCRATCH', TREECKO: 'POUND', FROAKIE: 'POUND', QUAXLY: 'POUND', SNIVY: 'TACKLE' }
const MOVEDEX = {
  TACKLE: { type: 'normal', power: 40, cat: 'phys', cost: 0, fx: 'dash', snd: 'whoosh' },
  SCRATCH: { type: 'normal', power: 40, cat: 'phys', cost: 0, fx: 'slash', snd: 'whoosh' },
  POUND: { type: 'normal', power: 40, cat: 'phys', cost: 0, fx: 'dash', snd: 'thud' },
  EMBER: { type: 'fire', power: 40, cat: 'spec', cost: 1, fx: 'ember', snd: 'whoosh' },
  'WATER GUN': { type: 'water', power: 40, cat: 'spec', cost: 1, fx: 'water', snd: 'whoosh' },
  'VINE WHIP': { type: 'grass', power: 45, cat: 'phys', cost: 1, fx: 'slash', snd: 'whoosh' },
}
/*
 * What the wild ones use, by their first type. Moves of kind 'low' travel
 * along the ground: they can't be parried or dodged, only jumped (+1 PP).
 * `fx` picks the animation: quake, roll, sweep, wave, current, shadow, vines.
 * Flying, Bug, Dark and Fairy have no ground attack that fits, so none here.
 */
const S_ = (name, type, power, cat, snd, more = {}) => ({ name, type, power, cat, hits: 1, kind: 'strike', snd, ...more })
const L_ = (name, type, power, cat, fx, snd, more = {}) => ({ name, type, power, cat, hits: 1, kind: 'low', fx, snd, ...more })
const WILD_MOVES = {
  normal:   [S_('TACKLE', 'normal', 40, 'phys', 'thud'), L_('RAPID SPIN', 'normal', 40, 'phys', 'roll', 'thud'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
  fighting: [S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), L_('LOW SWEEP', 'fighting', 40, 'phys', 'sweep', 'thud'), S_('DOUBLE KICK', 'fighting', 25, 'phys', 'thud', { hits: 2 })],
  dragon:   [S_('DRAGON BREATH', 'dragon', 40, 'spec', 'shadow', { ranged: true }), L_('DRAGON TAIL', 'dragon', 45, 'phys', 'sweep', 'thud'), S_('BITE', 'dark', 40, 'phys', 'crunch')],
  electric: [S_('THUNDER SHOCK', 'electric', 40, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 40, 'spec', 'current', 'zap'), S_('NUZZLE', 'electric', 20, 'phys', 'zap', { hits: 2 })],
  water:    [S_('WATER GUN', 'water', 40, 'spec', 'whoosh', { ranged: true }), L_('SURF', 'water', 45, 'spec', 'wave', 'whoosh'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  rock:     [S_('ROCK THROW', 'rock', 50, 'phys', 'thud', { ranged: true }), L_('ROLLOUT', 'rock', 25, 'phys', 'roll', 'thud', { hits: 2 }), L_('BULLDOZE', 'ground', 40, 'phys', 'quake', 'quake')],
  ground:   [S_('MUD-SLAP', 'ground', 25, 'spec', 'thud', { ranged: true }), L_('BULLDOZE', 'ground', 40, 'phys', 'quake', 'quake'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  fire:     [S_('EMBER', 'fire', 40, 'spec', 'whoosh', { ranged: true }), L_('FLAME WHEEL', 'fire', 40, 'phys', 'roll', 'whoosh'), S_('SCRATCH', 'normal', 40, 'phys', 'whoosh')],
  grass:    [S_('RAZOR LEAF', 'grass', 40, 'phys', 'whoosh', { ranged: true }), L_('GRASS KNOT', 'grass', 40, 'spec', 'vines', 'thud'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  ice:      [S_('POWDER SNOW', 'ice', 40, 'spec', 'whoosh', { ranged: true }), L_('ICE BALL', 'ice', 25, 'phys', 'roll', 'thud', { hits: 2 }), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  poison:   [S_('POISON STING', 'poison', 30, 'phys', 'whoosh', { ranged: true }), L_('SLUDGE WAVE', 'poison', 45, 'spec', 'wave', 'whoosh'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  psychic:  [S_('CONFUSION', 'psychic', 40, 'spec', 'shadow', { ranged: true }), L_('PSYWAVE', 'psychic', 40, 'spec', 'wave', 'shadow'), S_('POUND', 'normal', 40, 'phys', 'thud')],
  ghost:    [S_('ASTONISH', 'ghost', 30, 'phys', 'shadow'), L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('LICK', 'ghost', 30, 'phys', 'crunch')],
  steel:    [S_('METAL CLAW', 'steel', 50, 'phys', 'crunch'), L_('STEEL ROLLER', 'steel', 45, 'phys', 'roll', 'thud'), S_('TACKLE', 'normal', 40, 'phys', 'thud')],
  flying:   [S_('GUST', 'flying', 40, 'spec', 'whoosh', { ranged: true }), S_('WING ATTACK', 'flying', 50, 'phys', 'whoosh')],
  bug:      [S_('BUG BITE', 'bug', 50, 'phys', 'crunch'), S_('STRUGGLE BUG', 'bug', 40, 'spec', 'whoosh', { ranged: true })],
  dark:     [S_('BITE', 'dark', 40, 'phys', 'crunch'), S_('SNARL', 'dark', 40, 'spec', 'shadow', { ranged: true })],
  fairy:    [S_('FAIRY WIND', 'fairy', 40, 'spec', 'whoosh', { ranged: true }), S_('DRAINING KISS', 'fairy', 40, 'spec', 'whoosh', { drain: 0.75 })],
}
const MAGIKARP = [{ name: 'SPLASH', splash: true }, S_('TACKLE', 'normal', 40, 'phys', 'thud')]

/* ── music, fuller ──
   The same melodies, now with company. Each song names its chords, and from
   them come: a soft pad holding the chord, the melody harmonised a third or
   sixth below (always from the chord's own notes, so it stays in key), an
   arpeggio ticking through the chord on the faster songs, the bass, and the
   drums. The lead gets a second, slightly detuned voice and a short echo. */
const MIDI = (n) => { const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); return 12 * (+m[3] + 1) + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) }
const HZ = (m) => 440 * Math.pow(2, (m - 69) / 12)
/** 'Am', 'G7', 'F#m', 'B', 'F#mmaj7', 'D#dim' -> pitch classes, root first. */
function chordPcs(name) {
  const m = /^([A-G][#b]?)(m|dim|aug)?(maj7|7)?$/.exec(name), root = MIDI(m[1] + '4') % 12
  const triad = { m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8] }[m[2]] ?? [0, 4, 7]
  const seventh = m[3] === 'maj7' ? [11] : m[3] ? [m[2] === 'dim' ? 9 : 10] : []
  return [...triad, ...seventh].map((i) => (root + i) % 12)
}
const PC_NAME = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
/** A whole passage moved by some semitones (notes keep their articulation marks; chords keep their quality). */
const transpose = (track, k) => track.map((n) => { if (n === '.' || n === '-') return n; const [, b, art] = /^(.+?)([~^v!]?)$/.exec(n), m = MIDI(b) + k; return PC_NAME[m % 12] + (Math.floor(m / 12) - 1) + art })
const transposeChords = (cs, k) => cs.map((c) => { const [, r, q] = /^([A-G][#b]?)(.*)$/.exec(c); return PC_NAME[(MIDI(r + '4') + k) % 12] + q })
Object.assign(SONGS.vs, { chordLen: 8, chords: 'Em Em Em'.split(' ') })
Object.assign(SONGS.battle, { chordLen: 8, chords: 'Am F G E Am F G E'.split(' '), arp: true })
Object.assign(SONGS.encounter, { chordLen: 4, chords: 'Em Em Em Em C D Em B'.split(' '), arp: true })
Object.assign(SONGS.win, { chordLen: 8, chords: 'C F G7 C'.split(' '), arp: true })
Object.assign(SONGS.victory, { chordLen: 4, chords: 'C C C C'.split(' ') })
Object.assign(SONGS.caught, { chordLen: 4, chords: 'C C F G G'.split(' ') })

/** A held note: soft attack, sustain, gentle release (tone() is for plucks). */
function held(ac, out, t, { type = 'triangle', f, dur, vol, attack = 0.05, release = 0.12, detune = 0 }) {
  if (t < 0) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.frequency.value = f; o.detune.value = detune
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack)
  g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release)); g.gain.linearRampToValueAtTime(0, t + dur)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05)
}
/** One echo and one warm filter per music output, made the first time it's used. */
function musicBuses(ac, out, step) {
  if (out.__buses) return out.__buses
  const echoIn = ac.createGain(), d = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain()
  d.delayTime.value = Math.min(0.9, step * 3); fb.gain.value = 0.28; wet.gain.value = 0.22
  echoIn.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(out)
  const padIn = ac.createBiquadFilter(); padIn.type = 'lowpass'; padIn.frequency.value = 1100; padIn.Q.value = 0.4; padIn.connect(out)
  return (out.__buses = { echoIn, padIn })
}

scheduleSong = function scheduleSong(ac, out, song, t0) {
  const step = 60 / song.bpm / song.div
  const { echoIn, padIn } = musicBuses(ac, out, step)
  const each = (track, fn) => {
    for (let i = 0; i < track.length; i++) {
      const n = track[i]; if (n === '.' || n === '-') continue
      let len = 1; while (track[i + len] === '.') len++
      fn(t0 + i * step, n, len * step, i)
    }
  }
  const chordAt = (i) => song.chords ? chordPcs(song.chords[Math.min(song.chords.length - 1, Math.floor(i / song.chordLen))]) : null

  // Lead: two square voices a few cents apart, the pair also feeding the echo.
  each(song.lead, (t, n, d) => {
    const f = NOTE(n)
    tone(ac, out, t, { f, dur: d * 0.95, vol: 0.062 })
    tone(ac, out, t, { f: f * 1.0045, dur: d * 0.95, vol: 0.028 })
    tone(ac, echoIn, t, { f, dur: d * 0.9, vol: 0.05 })
  })
  // Harmony: under each melody note, the nearest chord tone 3-9 semitones down.
  if (song.chords) each(song.lead, (t, n, d, i) => {
    const lead = MIDI(n), pcs = chordAt(i)
    let h = null
    for (let k = 3; k <= 9; k++) if (pcs.includes(((lead - k) % 12 + 12) % 12)) { h = lead - k; break }
    if (h != null) held(ac, out, t, { type: 'triangle', f: HZ(h), dur: d * 0.92, vol: 0.05, attack: 0.012, release: 0.06 })
  })
  // Pad: the chord voiced around middle C, two detuned saws per note, filtered soft.
  if (song.chords) song.chords.forEach((c, k) => {
    const t = t0 + k * song.chordLen * step, dur = Math.min(song.chordLen, song.lead.length - k * song.chordLen) * step
    for (const pc of chordPcs(c).slice(0, 3)) {
      const m = 55 + ((pc - 55) % 12 + 12) % 12   // G3..F#4
      for (const det of [-7, 7]) held(ac, padIn, t, { type: 'sawtooth', f: HZ(m), dur, vol: 0.016, attack: 0.08, release: 0.15, detune: det })
    }
  })
  // Arpeggio: up and back through the chord, an octave above the pad.
  if (song.arp) for (let i = 0; i < song.lead.length; i++) {
    const pcs = chordAt(i).slice(0, 3), notes = pcs.map((pc) => 67 + ((pc - 67) % 12 + 12) % 12).sort((a, b) => a - b)
    const seq = [notes[0], notes[1], notes[2], notes[0] + 12, notes[2], notes[1]]
    tone(ac, out, t0 + i * step, { type: 'square', f: HZ(seq[i % seq.length]), dur: step * 0.7, vol: 0.018 })
  }
  // Bass, as before, with a quiet octave-up square for bite.
  each(song.bass, (t, n, d) => {
    tone(ac, out, t, { type: 'triangle', f: NOTE(n), dur: d * 0.9, vol: 0.2 })
    tone(ac, out, t, { type: 'square', f: NOTE(n) * 2, dur: Math.min(d, step) * 0.6, vol: 0.022 })
  })
  ;[...song.drums].forEach((c, i) => {
    const t = t0 + i * step
    if (c === 'K') tone(ac, out, t, { type: 'sine', f: 150, f1: 45, dur: .14, vol: .5 })
    if (c === 'S') { noise(ac, out, t, { dur: .12, vol: .22, filter: 'bandpass', f: 1800 }); tone(ac, out, t, { type: 'triangle', f: 190, dur: .06, vol: .08 }) }
    if (c === 'h') noise(ac, out, t, { dur: .035, vol: .05, filter: 'highpass', f: 7500 })
    if (c === 'C') noise(ac, out, t, { dur: .9, vol: .14, filter: 'highpass', f: 5000 })
  })
  return song.lead.length * step
}

/* ── Pokémon cries ──
   The real cries (OGG, from PokeAPI), decoded once per audio context and
   played through the effects bus a little under full volume. Sound.cry(id)
   logs each one, so the offline render for videos can place it too. */
const CRY_VOL = 0.4   // 20% quieter than it was (0.5)
const cryCache = new WeakMap()
async function cryBuffer(ac, id) {
  const src = ART['cry:' + id]; if (!src) return null
  if (!cryCache.has(ac)) cryCache.set(ac, new Map())
  const m = cryCache.get(ac)
  if (!m.has(id)) m.set(id, fetch(src).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).catch(() => null))
  return m.get(id)
}
function playBuffer(ac, out, buf, t, rate) {
  const s = ac.createBufferSource(), g = ac.createGain()
  s.buffer = buf; s.playbackRate.value = rate; g.gain.value = CRY_VOL
  s.connect(g).connect(out); s.start(t)
  s.onended = () => g.disconnect()
}
window.__playCry = async (ac, out, id, rate = 1) => { const buf = await cryBuffer(ac, id); if (buf) playBuffer(ac, out, buf, ac.currentTime + 0.01, rate) }
window.__scheduleCries = async (ac, out, log, fromMs) => {
  for (const e of log) {
    const t = (e.t - fromMs) / 1000
    if (e.kind !== 'cry' || t < 0) continue
    const buf = await cryBuffer(ac, e.id); if (buf) playBuffer(ac, out, buf, t, e.rate ?? 1)
  }
}
/* ══════════════ music engine, second generation ══════════════
   The chiptune voices (square, triangle, noise) give way to synthesised
   instruments in the spirit of the DS era: brass leads, string pads, FM
   electric piano and glockenspiel, a filtered synth bass and a full drum kit.
   Still clearly digital, but a step closer to real instruments. Every voice
   sits on its own mixer channel with a stereo position and a reverb send,
   and the mix runs through a room reverb and a compressor. The melodies,
   chords and bass lines are the same as before; the arrangement around them
   is new. */

/* ── mixer: channels, reverb, glue compressor (one set per music output) ── */
function roomIR(ac, secs = 1.7) {
  const n = Math.floor(ac.sampleRate * secs), ir = ac.createBuffer(2, n, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch); let lp = 0
    for (let i = 0; i < n; i++) {
      // Decaying noise, smoothed a little so the tail is warm rather than hissy.
      lp += 0.35 * ((Math.random() * 2 - 1) - lp)
      d[i] = lp * Math.pow(1 - i / n, 2.4) * (i < ac.sampleRate * 0.008 ? i / (ac.sampleRate * 0.008) : 1)
    }
  }
  return ir
}
const CHANNELS = {   // gain, stereo position, reverb send
  lead:  { g: 0.55, pan: 0,     rev: 0.22 },
  harm:  { g: 0.30, pan: -0.32, rev: 0.30 },
  pad:   { g: 0.26, pan: 0.3,   rev: 0.45 },
  keys:  { g: 0.36, pan: 0.45,  rev: 0.25 },
  glock: { g: 0.20, pan: -0.5,  rev: 0.35 },
  bass:  { g: 0.62, pan: 0,     rev: 0.04 },
  kick:  { g: 0.80, pan: 0,     rev: 0.03 },
  snare: { g: 0.50, pan: 0.06,  rev: 0.18 },
  hat:   { g: 0.20, pan: 0.30,  rev: 0.06 },
  cym:   { g: 0.22, pan: -0.15, rev: 0.25 },
  tom:   { g: 0.45, pan: -0.2,  rev: 0.15 },
  gtr:   { g: 0.30, pan: 0.38,  rev: 0.10 },
}
function mixer(ac, out, vol = 1) {
  if (out.__mix) return out.__mix
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.16
  // A trim after the glue, so the fuller arrangement sits at the old music's level under effects and cries.
  const trim = ac.createGain(); trim.gain.value = 0.3 * vol
  comp.connect(trim).connect(out)
  const conv = ac.createConvolver(); conv.buffer = roomIR(ac)
  const ret = ac.createGain(); ret.gain.value = 0.32
  conv.connect(ret).connect(comp)
  const ch = {}
  for (const [name, c] of Object.entries(CHANNELS)) {
    const g = ac.createGain(); g.gain.value = c.g
    const p = ac.createStereoPanner(); p.pan.value = c.pan
    const s = ac.createGain(); s.gain.value = c.rev
    g.connect(p).connect(comp); g.connect(s).connect(conv)
    ch[name] = g
  }
  return (out.__mix = ch)
}

/* ── instruments ── each plays one note: (ac, channel, time, hz, seconds, velocity 0..1) */
const oscAt = (ac, type, f, t, end, detune = 0) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune; o.start(t); o.stop(end); voiceEnd = Math.max(voiceEnd, end); return o }
/** The latest moment any part of the note being built sounds (oscAt and noiseHit push it on), so it can be retired after. */
let voiceEnd = 0
/**
 * Delayed vibrato, for notes held long enough to hear it: an LFO into each
 * oscillator's pitch. It's the costliest thing a voice can do (it puts the
 * oscillator on its slow path, about five times the work), and a short note
 * ends before the vibrato would have faded in, so short notes go without.
 * Returns the gain to connect to each oscillator's frequency, or null.
 */
const VIBRATO_MIN = 0.32
function vibrato(ac, t, end, dur, rate, depth, type = 'sine', delay = 0) {
  if (dur < VIBRATO_MIN) return null
  const lfo = oscAt(ac, type, rate, t, end), lg = ac.createGain()
  lg.gain.setValueAtTime(0, t); if (delay) lg.gain.setValueAtTime(0, t + delay)
  lg.gain.linearRampToValueAtTime(depth, t + delay + Math.min(0.35, dur * 0.8)); lfo.connect(lg)
  return lg
}
/** Attack, decay to a sustain level, release from the note's end. */
function adsr(param, t, dur, peak, a, d, s, r) {
  param.setValueAtTime(0, t); param.linearRampToValueAtTime(peak, t + a)
  param.setTargetAtTime(peak * s, t + a, d / 3)
  const off = t + Math.max(dur, a + 0.01)
  param.setTargetAtTime(0, off, r / 3)
  return off + r * 2
}
/**
 * Lead articulations, on an oscillator playing `f`: a scoop '^' (it starts a
 * whole step flat and slides up, as brass players do into a big note), a
 * trill '~' (it alternates with the whole step above, then settles) or a
 * fall 'v' (it drops away at the end).
 */
function articulate(o, f, t, dur, art) {
  if (art === '^') { o.frequency.setValueAtTime(f * 0.89, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.085) }
  // A fall: the note drops off at its end, as a sax or a trumpet does.
  if (art === 'v') { const from = t + Math.max(0.06, dur * 0.6); o.frequency.setValueAtTime(f, from); o.frequency.exponentialRampToValueAtTime(f * 0.7, t + dur + 0.04) }
  if (art === '~') {
    const up = f * 1.1225, end = t + dur - 0.05
    for (let k = 0, x = t + 0.07; x < end; k++, x += 0.058) o.frequency.setValueAtTime(k % 2 ? f : up, x)
    o.frequency.setValueAtTime(f, Math.max(t, end))
  }
}
/** A soft-clipping curve for the guitar's overdrive, made once per context. */
function driveCurve(ac) {
  if (ac.__drive) return ac.__drive
  const n = 1024, c = new Float32Array(n)
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * 5.5) / Math.tanh(5.5) }
  return (ac.__drive = c)
}
const INST = {
  /** Brass: two detuned saws and a quiet sub, through a filter that opens with a bite, plus delayed vibrato. */
  brass(ac, ch, t, f, dur, v, art) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 1.4
    const end = adsr(g.gain, t, dur, 0.22 * v, 0.018, 0.14, 0.72, 0.09)
    flt.frequency.setValueAtTime(f * 1.3, t); flt.frequency.linearRampToValueAtTime(Math.min(9000, f * 9), t + 0.045)
    flt.frequency.setTargetAtTime(Math.min(6000, f * 4.2), t + 0.05, 0.08)
    const lg = vibrato(ac, t, end, dur, 5.4, f * 0.007)
    for (const [type, mul, det, gain] of [['sawtooth', 1, -6, 1], ['sawtooth', 1, 6, 1], ['square', 0.5, 0, 0.35]]) {
      const o = oscAt(ac, type, f * mul, t, end, det), og = ac.createGain(); og.gain.value = gain
      articulate(o, f * mul, t, dur, art)
      lg?.connect(o.frequency); o.connect(og).connect(flt)
    }
    flt.connect(g).connect(ch)
  },
  /** Synth lead: two detuned squares an octave apart, a quick filter blip, and fast vibrato. Unmistakably digital. */
  synth(ac, ch, t, f, dur, v, art) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 3
    const end = adsr(g.gain, t, dur, 0.16 * v, 0.006, 0.1, 0.8, 0.06)
    flt.frequency.setValueAtTime(Math.min(10000, f * 10), t); flt.frequency.setTargetAtTime(Math.min(7000, f * 5), t + 0.01, 0.06)
    const lg = vibrato(ac, t, end, dur, 6.5, f * 0.01, 'triangle')
    for (const [mul, det, gain] of [[1, -8, 1], [1, 8, 0.8], [2, 0, 0.25]]) {
      const o = oscAt(ac, 'square', f * mul, t, end, det), og = ac.createGain(); og.gain.value = gain
      articulate(o, f * mul, t, dur, art)
      lg?.connect(o.frequency); o.connect(og).connect(flt)
    }
    flt.connect(g).connect(ch)
  },
  /** Strings: three detuned saws, a slow swell, a soft filter. */
  strings(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = Math.min(4200, f * 5); flt.Q.value = 0.6
    const end = adsr(g.gain, t, dur, 0.15 * v, Math.min(0.22, dur * 0.5), 0.3, 0.9, 0.32)
    for (const det of [-10, 10]) oscAt(ac, 'sawtooth', f, t, end, det).connect(flt)
    flt.connect(g).connect(ch)
  },
  /** FM electric piano: a mellow body plus a short metallic tine, both fading. */
  epiano(ac, ch, t, f, dur, v) {
    const len = Math.max(0.35, Math.min(0.9, dur * 1.3)), end = t + len + 0.05
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + len)
    const car = oscAt(ac, 'sine', f, t, end)
    const m1 = oscAt(ac, 'sine', f, t, end), i1 = ac.createGain(); i1.gain.setValueAtTime(f * 2.2, t); i1.gain.exponentialRampToValueAtTime(f * 0.25, t + 0.6)
    const m2 = oscAt(ac, 'sine', f * 14, t, end), i2 = ac.createGain(); i2.gain.setValueAtTime(f * 1.1, t); i2.gain.exponentialRampToValueAtTime(f * 0.01, t + 0.07)
    m1.connect(i1).connect(car.frequency); m2.connect(i2).connect(car.frequency)
    car.connect(g).connect(ch)
  },
  /** FM glockenspiel: bright, inharmonic, ringing. */
  glock(ac, ch, t, f, dur, v) {
    const len = 0.55, end = t + len + 0.05
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0006, t + len)
    const car = oscAt(ac, 'sine', f, t, end), m = oscAt(ac, 'sine', f * 3.5, t, end), i = ac.createGain()
    i.gain.setValueAtTime(f * 1.6, t); i.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.25)
    m.connect(i).connect(car.frequency); car.connect(g).connect(ch)
  },
  /**
   * Overdriven guitar, palm-muted: a power chord (root, fifth, octave) of
   * detuned saws, soft-clipped, then a speaker-cabinet band (no fizz, no mud).
   */
  power(ac, ch, t, f, dur, v) {
    const pre = ac.createGain(); pre.gain.value = 0.55
    const sh = ac.createWaveShaper(); sh.curve = driveCurve(ac); sh.oversample = '2x'
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95
    const cab = ac.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 2900; cab.Q.value = 0.9
    const mid = ac.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.gain.value = 4; mid.Q.value = 0.8
    const g = ac.createGain(), end = adsr(g.gain, t, dur, 0.2 * v, 0.003, 0.09, 0.55, 0.05)
    for (const [mul, det] of [[1, -5], [1, 5], [1.4983, -4], [2, 3]]) oscAt(ac, 'sawtooth', f * mul, t, end, det).connect(pre)
    pre.connect(sh).connect(hp).connect(mid).connect(cab).connect(g).connect(ch)
  },
  /**
   * Piano: six partials, slightly stretched as real strings are, each dying
   * away faster the higher it is, and a felt-hammer knock at the start.
   */
  piano(ac, ch, t, f, dur, v) {
    const len = Math.max(0.4, Math.min(1.8, dur * 2.2)), end = t + len + 0.05
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.26 * v, t + 0.003)
    g.gain.setTargetAtTime(0, t + len - 0.12, 0.05)
    for (const [n, amp] of [[1, 1], [2, 0.5], [3, 0.28], [4, 0.17], [5, 0.1], [6, 0.06]]) {
      // Each partial stops once it has died away: the upper ones are gone long before the note is.
      const die = t + Math.min(len, 1.6 / (0.6 + n * 0.5))
      const o = oscAt(ac, 'sine', f * n * Math.sqrt(1 + 0.0004 * n * n), t, Math.min(end, die + 0.01)), pg = ac.createGain()
      pg.gain.setValueAtTime(amp, t); pg.gain.exponentialRampToValueAtTime(amp * 0.002, die)
      o.connect(pg).connect(g)
    }
    noiseHit(ac, g, t, { type: 'bandpass', f: Math.min(4000, f * 3), q: 1, len: 0.02, vol: 0.25 })
    g.connect(ch)
  },
  /**
   * Choir, singing "ah": detuned saws through the vowel's formants (the
   * resonances of a voice), with a slow swell and a gentle vibrato.
   */
  choir(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), end = adsr(g.gain, t, dur, 0.4 * v, Math.min(0.35, dur * 0.5), 0.4, 0.9, 0.4)
    const lg = vibrato(ac, t, end, dur, 4.8, f * 0.005)
    const src = ac.createGain()
    for (const det of [-11, 0, 12]) { const o = oscAt(ac, 'sawtooth', f, t, end, det); lg?.connect(o.frequency); o.connect(src) }
    for (const [ff, q, amp] of [[730, 6, 1], [1150, 7, 0.55], [2650, 8, 0.18]]) {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = ff; bp.Q.value = q
      const fg = ac.createGain(); fg.gain.value = amp; src.connect(bp).connect(fg).connect(g)
    }
    g.connect(ch)
  },
  /** A violin section: detuned saws, a quick bow attack, bright, with vibrato that comes in as the note holds. */
  violins(ac, ch, t, f, dur, v, art) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = Math.min(7500, f * 6); flt.Q.value = 0.7
    const end = adsr(g.gain, t, dur, (dur < 0.2 ? 0.18 : 0.13) * v, 0.03, 0.2, 0.85, 0.12)   // two saws sum quieter than four
    const lg = vibrato(ac, t, end, dur, 5.8, f * 0.008)
    // Four bows for a held note; a short one (tremolo, a quick run) gets by with two.
    for (const det of dur < 0.2 ? [-8, 9] : [-12, -4, 5, 13]) { const o = oscAt(ac, 'sawtooth', f, t, end, det); articulate(o, f, t, dur, art); lg?.connect(o.frequency); o.connect(flt) }
    flt.connect(g).connect(ch)
  },
  /**
   * Saxophone: a reedy saw-and-square tone through the horn's resonances, a
   * breath of air on the attack, a growl (a fast flutter in the level) and
   * vibrato once the note holds.
   */
  sax(ac, ch, t, f, dur, v, art) {
    const g = ac.createGain(), end = adsr(g.gain, t, dur, 0.17 * v, 0.025, 0.15, 0.8, 0.07)
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(6000, f * 5.5); lp.Q.value = 1
    const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1400; pk.gain.value = 7; pk.Q.value = 1.1
    const lg = vibrato(ac, t, end, dur, 5.2, f * 0.009, 'sine', Math.min(0.22, dur * 0.5))
    const growl = ac.createGain(); growl.gain.value = 1
    const gl = oscAt(ac, 'sine', 31, t, end), gd = ac.createGain(); gd.gain.value = 0.16; gl.connect(gd).connect(growl.gain)
    for (const [type, gain, det] of [['sawtooth', 1, -4], ['square', 0.45, 4]]) {
      const o = oscAt(ac, type, f, t, end, det), og = ac.createGain(); og.gain.value = gain
      articulate(o, f, t, dur, art); lg?.connect(o.frequency); o.connect(og).connect(lp)
    }
    noiseHit(ac, lp, t, { type: 'bandpass', f: Math.min(5000, f * 3), q: 0.8, len: 0.06, vol: 0.12 })
    lp.connect(pk).connect(growl).connect(g).connect(ch)
  },
  /** Clavinet: a bright, buzzy pluck through an envelope filter that snaps shut ("wah"), very short. */
  clav(ac, ch, t, f, dur, v) {
    const len = Math.max(0.09, Math.min(0.28, dur)), end = t + len + 0.03
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.001, t + len)
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5
    bp.frequency.setValueAtTime(Math.min(6000, f * 9), t); bp.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.09)
    oscAt(ac, 'square', f, t, end, 3).connect(bp); const o2 = oscAt(ac, 'sawtooth', f * 2, t, end), o2g = ac.createGain(); o2g.gain.value = 0.35; o2.connect(o2g).connect(bp)
    bp.connect(g).connect(ch)
  },
  /**
   * Pipe organ: sine "drawbars" (the sub-octave, the fundamental and its
   * harmonics up to the 8th), a steady level with a breath of air at the
   * start, and a slow tremulant. Holds as long as the note does.
   */
  organ(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), end = adsr(g.gain, t, dur, 0.1 * v, 0.03, 0.1, 1, 0.12)
    const trem = ac.createGain(); trem.gain.value = 1
    const lfo = oscAt(ac, 'sine', 5.6, t, end), lg = ac.createGain(); lg.gain.value = 0.08; lfo.connect(lg).connect(trem.gain)
    for (const [mul, amp] of [[0.5, 0.6], [1, 1], [2, 0.7], [3, 0.35], [4, 0.4], [6, 0.15], [8, 0.2]]) {
      const o = oscAt(ac, 'sine', f * mul, t, end), og = ac.createGain(); og.gain.value = amp; o.connect(og).connect(trem)
    }
    noiseHit(ac, trem, t, { type: 'bandpass', f: Math.min(6000, f * 4), q: 0.7, len: 0.05, vol: 0.06 })
    trem.connect(g).connect(ch)
  },
  /** Tubular bells: a struck tube's out-of-tune partials (the hum below, the strike tone, and bright ones above), ringing for seconds. */
  bells(ac, ch, t, f, dur, v) {
    const len = 2.6, end = t + len + 0.05
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.11 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0008, t + len)
    for (const [mul, amp, decay] of [[0.5, 0.35, 2.4], [1, 1, 2.2], [2.01, 0.55, 1.4], [2.76, 0.4, 1.0], [4.07, 0.25, 0.6], [5.43, 0.15, 0.35]]) {
      const o = oscAt(ac, 'sine', f * mul, t, Math.min(end, t + decay + 0.01)), og = ac.createGain()
      og.gain.setValueAtTime(amp, t); og.gain.exponentialRampToValueAtTime(amp * 0.003, t + decay); o.connect(og).connect(g)
    }
    g.connect(ch)
  },
  /** Low strings (cellos and basses together): dark saws and a sine an octave down, bowed hard at the start. */
  lowstrings(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = Math.min(1800, f * 7); flt.Q.value = 0.8
    const end = adsr(g.gain, t, dur * 0.95, 0.36 * v, 0.012, 0.12, 0.7, 0.08)
    for (const det of [-9, 8]) oscAt(ac, 'sawtooth', f, t, end, det).connect(flt)
    const sub = oscAt(ac, 'sine', f / 2, t, end), sg = ac.createGain(); sg.gain.value = 0.6; sub.connect(sg).connect(g)
    flt.connect(g).connect(ch)
  },
  /** Synth bass: saw and sine sub, a resonant filter that snaps shut. */
  bass(ac, ch, t, f, dur, v) {
    const g = ac.createGain(), flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.Q.value = 4
    const end = adsr(g.gain, t, dur * 0.92, 0.42 * v, 0.004, 0.18, 0.62, 0.05)
    flt.frequency.setValueAtTime(Math.min(5000, f * 11), t); flt.frequency.setTargetAtTime(f * 2.6, t + 0.005, 0.05)
    oscAt(ac, 'sawtooth', f, t, end).connect(flt)
    const sub = oscAt(ac, 'sine', f, t, end), sg = ac.createGain(); sg.gain.value = 0.9; sub.connect(sg).connect(g)
    flt.connect(g).connect(ch)
  },
}
/* ── drum kit ── */
function noiseHit(ac, ch, t, { type, f, q = 0.8, len, vol, f1 }) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf(ac)
  const fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + len); fl.Q.value = q
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len)
  s.connect(fl).connect(g).connect(ch); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02); voiceEnd = Math.max(voiceEnd, t + len + 0.02)
}
function toneHit(ac, ch, t, { type = 'sine', f, f1, len, vol }) {
  const o = oscAt(ac, type, f, t, t + len + 0.02), g = ac.createGain()
  o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f1, t + len * 0.6)
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0005, t + len)
  o.connect(g).connect(ch)
}
const KIT = {
  K: (ac, m, t, v = 1) => { toneHit(ac, m.kick, t, { f: 155, f1: 46, len: 0.34, vol: 0.95 * v }); noiseHit(ac, m.kick, t, { type: 'highpass', f: 3000, len: 0.012, vol: 0.35 * v }) },
  S: (ac, m, t, v = 1) => { noiseHit(ac, m.snare, t, { type: 'bandpass', f: 1900, q: 0.7, len: 0.17, vol: 0.85 * v }); noiseHit(ac, m.snare, t, { type: 'highpass', f: 6000, len: 0.09, vol: 0.35 * v }); toneHit(ac, m.snare, t, { type: 'triangle', f: 205, f1: 170, len: 0.09, vol: 0.5 * v }) },
  g: (ac, m, t) => KIT.S(ac, m, t, 0.28),   // ghost snare
  h: (ac, m, t, v = 1) => noiseHit(ac, m.hat, t, { type: 'highpass', f: 8200, len: 0.045, vol: 0.55 * v }),
  o: (ac, m, t) => noiseHit(ac, m.hat, t, { type: 'highpass', f: 7600, len: 0.28, vol: 0.45 }),
  C: (ac, m, t) => { noiseHit(ac, m.cym, t, { type: 'highpass', f: 4800, len: 1.6, vol: 0.6 }); noiseHit(ac, m.cym, t, { type: 'bandpass', f: 9500, q: 0.6, len: 0.9, vol: 0.3 }) },
  T: (ac, m, t) => toneHit(ac, m.tom, t, { f: 190, f1: 115, len: 0.3, vol: 0.8 }),
  /** Hand clap: three quick bursts of filtered noise, the last one ringing a little. */
  X: (ac, m, t, v = 1) => { for (const [d, len] of [[0, 0.01], [0.011, 0.01], [0.022, 0.13]]) noiseHit(ac, m.snare, t + d, { type: 'bandpass', f: 1250, q: 1.3, len, vol: 0.7 * v }) },
  /** Timpani, tuned (to the chord's root when the song schedules it): a long, round low boom with a soft mallet. */
  P: (ac, m, t, v = 1, f = 73.4) => { toneHit(ac, m.tom, t, { f: f * 1.06, f1: f, len: 1.1, vol: 0.9 * v }); toneHit(ac, m.tom, t, { f: f * 2.02, f1: f * 2, len: 0.5, vol: 0.18 * v }); noiseHit(ac, m.tom, t, { type: 'lowpass', f: 600, len: 0.06, vol: 0.25 * v }) },
  t: (ac, m, t) => toneHit(ac, m.tom, t, { f: 140, f1: 85, len: 0.34, vol: 0.8 }),
}

/* ── lookahead scheduling ──
   A song pass no longer builds every note up front. It queues them, and each
   note's audio nodes are created only shortly before it plays: about a second
   ahead while the page is visible, a couple of seconds when it's hidden
   (background tabs only wake timers once a second). That keeps the work at
   any moment small, however long or rich the arrangement. The second of
   margin is what a busy phone needs: when its main thread stalls (garbage
   collection, a battle's animations), notes built too close to their time
   come out late, all at once, a stumble that gets worse the longer it plays.
   A third of a second wasn't enough. A note that's late anyway (by more than
   LATE_DROP) is dropped rather than played out of time. Offline renders (the
   videos) flush the queue in one-second steps the same way. */
const JIT_AHEAD = 1.2, JIT_AHEAD_HIDDEN = 2.2, LATE_DROP = 0.08
function jitQueue(ac) {
  if (ac.__q) return ac.__q
  ac.__q = []
  if (!(ac instanceof OfflineAudioContext)) {
    setInterval(() => jitFlush(ac, ac.currentTime + (document.hidden ? JIT_AHEAD_HIDDEN : JIT_AHEAD)), 25)
    watchLoad(ac)
  }
  return ac.__q
}
/*
 * Retiring finished notes. A note's nodes stay wired into its mixer channel
 * after it ends, and the audio thread keeps visiting every one of them until
 * the garbage collector happens by: the work grows with each loop of a song
 * (a minute of the Champion's theme went from 0.4 to over 1 core before a
 * collection), and on a phone that's what broke the music up after a few
 * loops and then made everything late. So each note is built behind its own
 * gain, and that gain is disconnected once the note is over.
 */
function voice(ac, ch, build) {
  const vg = ac.createGain(); vg.connect(ch)
  voiceEnd = 0; build(vg)
  ;(ac.__retire ??= []).push({ end: voiceEnd + 0.05, node: vg })
}
/** The same for a drum hit, which may sound on several of the mixer's channels: one retiring gain per channel it uses. */
function kitVoice(ac, M, build) {
  const vgs = {}
  voiceEnd = 0
  build(new Proxy(M, { get: (m, k) => vgs[k] ??= (() => { const vg = ac.createGain(); vg.connect(m[k]); return vg })() }))
  for (const vg of Object.values(vgs)) (ac.__retire ??= []).push({ end: voiceEnd + 0.05, node: vg })
}
function retire(ac, now) {
  const r = ac.__retire; if (!r?.length) return
  let k = 0
  for (const v of r) if (v.end < now) v.node.disconnect(); else r[k++] = v
  r.length = k
}
function jitFlush(ac, until) {
  retire(ac, ac instanceof OfflineAudioContext ? until - 1.5 : ac.currentTime)
  const q = ac.__q; if (!q?.length) return
  let n = 0; while (n < q.length && q[n].t < until) n++
  // Notes for a song that has since been stopped are dropped, not played; so are notes already too late to be in time,
  // and the parts a slow phone has been spared (offline renders, the videos, always get everything).
  const offline = ac instanceof OfflineAudioContext, late = offline ? -Infinity : ac.currentTime - LATE_DROP, keep = offline ? 2 : MUSIC_LOAD.keep
  for (const e of q.splice(0, n)) if (!e.out.__stopped && e.t >= late && e.lvl <= keep) e.fn()
}
/* ── keeping up on a slow phone ──
   Every note is its own little synthesiser, built and played on the audio
   thread. A rich arrangement (the Champion's tremolo strings and piano runs,
   Trainer B's horn section) can ask more of a slow phone's audio thread than
   it has. Then the audio clock itself runs slow: everything, music and
   effects alike, comes out late and broken up, and stays that way, because
   the music keeps queueing more. So the audio clock is checked against the
   real one every second. When it runs slow, the music lightens for the rest
   of the visit: first the ornaments go (tremolo, runs, ostinatos, comping,
   glockenspiel, doubled lines), then the colour (harmony, pads, the extra
   hats), leaving the melody, the bass and the drums. Effects and cries are
   never thinned. Each part of a song is tagged with a level (0 core, 1 colour,
   2 ornament), and MUSIC_LOAD.keep is the highest level still played. */
const MUSIC_LOAD = { tier: 0, keep: 2, slow: 0, rate: 1, changes: [] }
const LOAD_SLOW = 0.9   // the audio clock at under 90% of real time: the audio thread isn't keeping up
function lightenMusic(why) {
  if (MUSIC_LOAD.tier >= 2) return
  MUSIC_LOAD.tier++; MUSIC_LOAD.keep = 2 - MUSIC_LOAD.tier; MUSIC_LOAD.slow = 0
  MUSIC_LOAD.changes.push({ tier: MUSIC_LOAD.tier, why, at: performance.now() })
}
function watchLoad(ac) {
  let wall = performance.now(), clock = ac.currentTime, ran = ac.state === 'running'
  setInterval(() => {
    const w = performance.now(), c = ac.currentTime, running = ac.state === 'running', dw = (w - wall) / 1000, dc = c - clock
    const fair = ran && running && !document.hidden && dw >= 0.5   // a paused context or a hidden tab says nothing about load
    wall = w; clock = c; ran = running
    if (!fair) { MUSIC_LOAD.slow = 0; return }
    const rate = MUSIC_LOAD.rate = dc / dw
    // Two slow seconds in a row, or one badly slow one, and the music lightens a step.
    if (rate < LOAD_SLOW) MUSIC_LOAD.slow += rate < 0.7 ? 2 : 1; else MUSIC_LOAD.slow = 0
    if (MUSIC_LOAD.slow >= 2) lightenMusic(rate)
  }, 1000)
}
/** For an offline render of `secs`: flush the queue a second at a time as it renders. */
function prepareOffline(ac, secs) {
  jitFlush(ac, 1.5)
  for (let s = 1; s < secs; s += 1) ac.suspend(s).then(() => { jitFlush(ac, s + 1.5); ac.resume() })
}

/* ── arrangements ── how each song's parts are voiced (the notes are the same as before) */
Object.assign(SONGS.battle, { leadInst: 'brass', comp: true, hats16: true, fill: 'TTtt', glock: true })

/* ── new themes ──
   Two original pieces, written in the same step format as the others (one
   token per eighth note: a note starts, '.' holds it, '-' rests). */
const bars = (...b) => b.join(' ').split(' ')
/** Wild battle: urgent, in D minor, lifting into F major in the second half. */
SONGS.wild = { file: null, loop: true, bpm: 160, div: 2, chordLen: 8,
  chords: 'Dm Bb C A Dm Bb Gm A'.split(' '),
  lead: bars('D5 . F5 A5 . G5 F5 E5', 'F5 . D5 . Bb4 . D5 F5', 'E5 . G5 . C6 . Bb5 A5', 'A5 . . . E5 . C#5 E5',
    'D6 . C6 A5 . F5 G5 A5', 'Bb5 . A5 F5 . D5 F5 Bb5', 'A5 . G5 . F5 . E5 D5', 'C#5 . E5 . A5 . . -'),
  bass: bars('D2 D2 D3 D2 D2 D3 D2 D3', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2', 'C2 C2 C3 C2 C2 C3 C2 C3', 'A1 A1 A2 A1 A1 A2 A1 A2',
    'D2 D2 D3 D2 D2 D3 D2 D3', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb2', 'G1 G1 G2 G1 G1 G2 G1 G2', 'A1 A1 A2 A1 A2 G2 E2 C#2'),
  drums: 'KhSgKKSh'.repeat(7) + 'KhShSSSS',
  leadInst: 'brass', harmInst: 'strings', glock: true, hats16: true, fill: 'SSTt' }
/**
 * Rival encounter: plays under the rival's dialogue before the battle, every
 * time they turn up. Cheeky, swung, at a walking tempo and sitting quieter
 * than the battle music so it stays under the text. A one-bar brass "hey!"
 * as they step up, then an eight-bar loop for as long as they talk. E minor,
 * ending each loop on B7, so it hands over cleanly to the rival battle
 * theme, in E minor. The lead is the rival's synth.
 */
SONGS.rivalTalk = { file: null, loop: true, bpm: 132, div: 2, chordLen: 8, swing: 0.32, vol: 0.75,
  leadInst: 'synth', leadVel: 0.7, harmInst: 'strings', comp: true, hats16: false, crash: false, fill: '',
  intro: { chords: ['B7'], lead: bars('B4 . D#5 . F#5 . B5 .'), bass: bars('B1 . . . B1 . . .'), drums: 'K.S.K.SS',
    leadInst: 'brass', leadVel: 0.9, comp: false, crash: true },
  sections: [{
    chords: 'Em Am D G C Am B7 B7'.split(' '),
    lead: bars('E5 . - G5 . F#5 E5 -', 'A5 . - C6 . B5 A5 -', 'F#5 . A5 . D6 . C6 A5', 'B5 . . . - - G5 A5',
      'G5 . E5 . C6 . B5 G5', 'A5 . - E5 . A5 C6 -', 'D#6 . . . F#5 . A5 .', 'B5 . - - D#5 . F#5 .'),
    bass: bars('E2 . B1 . E2 . G2 .', 'A1 . E2 . A1 . C2 .', 'D2 . A1 . D2 . F#2 .', 'G1 . D2 . G1 . B1 .',
      'C2 . G1 . C2 . E2 .', 'A1 . E2 . A1 . G1 .', 'B1 . F#2 . B1 . A1 .', 'B1 . D#2 . F#2 . B1 .'),
    drums: 'KhShKhSh'.repeat(3) + 'KhShKhSg' + 'KhShKhSh'.repeat(3) + 'KhShSoSo' }] }

/**
 * Gym leader intro: under the VS splash and the leader's words. A brass
 * fanfare with timpani toms, then a stately eight-bar loop in D minor that
 * holds for as long as they talk. Broad and ceremonial, not yet a fight.
 */
SONGS.gymIntro = { file: null, loop: true, bpm: 112, div: 2, chordLen: 8, vol: 0.85,
  leadInst: 'brass', harmInst: 'brass', comp: false, hats16: false, crash: false, fill: 'TTtt',
  intro: { chords: ['Dm', 'A'], lead: bars('A4 . D5 . F5 . A5 .', 'C#6 . . . A5 . . .'), bass: bars('D2 . . . D2 . . .', 'A1 . . . A1 . . .'),
    drums: 'K...T.t.' + 'K.T.ttSS', crash: true, fill: '' },
  sections: [{
    chords: 'Dm Bb Gm A Dm F Gm A'.split(' '),
    lead: bars('D5 . . . F5 . A5 .', 'Bb5 . . . A5 . G5 .', 'G5 . . . Bb5 . D6 .', 'C#6 . . . . . A5 .',
      'D6 . . . A5 . F5 .', 'C6 . . . A5 . F5 .', 'Bb5 . A5 . G5 . Bb5 .', 'A5 . . . E5 . C#5 .'),
    bass: bars('D2 . . . A1 . . .', 'Bb1 . . . F2 . . .', 'G1 . . . D2 . . .', 'A1 . . . E2 . . .',
      'D2 . . . A1 . . .', 'F2 . . . C2 . . .', 'G1 . . . D2 . . .', 'A1 . . . A1 . C#2 .'),
    drums: 'K..hS.h.'.repeat(7) + 'K.TtTtSS' }] }

/**
 * Gym battle: the biggest piece, C minor at 176 bpm, about 38 s a loop.
 * Brass stabs, a driving verse, the verse again higher with the glockenspiel,
 * a heroic half-time bridge in E-flat major, and a build back to the top.
 */
const GYM_A_BASS = bars('C2 C2 C3 C2 C2 C3 C2 Bb1', 'Ab1 Ab1 Ab2 Ab1 Ab1 Ab2 Ab1 G1', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1', 'G1 G1 G2 G1 G1 G2 F2 D2',
  'C2 C2 C3 C2 C2 C3 C2 Bb1', 'Ab1 Ab1 Ab2 Ab1 Ab1 Ab2 Ab1 G1', 'F1 F1 F2 F1 F1 F2 F1 Ab1', 'G1 G1 G2 G1 B1 D2 F2 G2')
SONGS.gym = { file: null, loop: true, bpm: 176, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Cm', 'G'], lead: bars('C5 . - C5 . - Eb5 .', 'D5 . - B4 . - G4 .'), bass: bars('C2 . - C2 . - Eb2 .', 'D2 . - B1 . - G1 .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', hats16: false, comp: false, fill: '', crash: true },
  sections: [
    { // A: the verse
      chords: 'Cm Ab Bb G Cm Ab Fm G'.split(' '),
      lead: bars('C5 . Eb5 G5 . F5 Eb5 D5', 'Eb5 . C5 . Ab5 . G5 F5', 'F5 . D5 . Bb5 . Ab5 G5', 'G5 . . . B4 . D5 F5',
        'Eb5 G5 C6 . Bb5 Ab5 G5 F5', 'Eb5 . Ab5 . C6 . Ab5 Eb5', 'F5 . Ab5 . C6 . Bb5 Ab5', 'G5 . . . D5 . B4 .'),
      bass: GYM_A_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS' },
    { // A': higher, with the glockenspiel
      chords: 'Cm Ab Bb G Cm Ab Fm G'.split(' '), glock: true,
      lead: bars('G5 . . C6 Eb6 . D6 C6', 'C6 . . Ab5 Eb6 . C6 Ab5', 'D6 . . Bb5 F6 . D6 Bb5', 'D6 . . . B5 . G5 .',
        'C6 . Eb6 . G6 . F6 Eb6', 'Eb6 . C6 . Ab5 . C6 Eb6', 'F6 . Eb6 . C6 . Ab5 F5', 'G5 . B5 . D6 . F6 .'),
      bass: GYM_A_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS' },
    { // Bridge: heroic, half-time, E-flat major
      chords: 'Eb Bb Cm Ab Eb Bb Ab G'.split(' '), harmInst: 'strings', comp: false, hats16: false, crash: true,
      lead: bars('G5 . . . Bb5 . . .', 'D6 . . . F5 . . .', 'Eb6 . . . C6 . G5 .', 'C6 . . . . . . .',
        'Bb5 . . . Eb6 . G6 .', 'F6 . . . D6 . Bb5 .', 'Eb6 . . . C6 . Ab5 .', 'B5 . . . D6 . F6 .'),
      bass: bars('Eb2 . . . Eb2 . Bb1 .', 'Bb1 . . . Bb1 . F2 .', 'C2 . . . C2 . G1 .', 'Ab1 . . . Ab1 . Eb2 .',
        'Eb2 . . . Eb2 . Bb1 .', 'Bb1 . . . Bb1 . F2 .', 'Ab1 . . . Ab1 . Eb2 .', 'G1 . . . G1 . D2 .'),
      drums: 'KhhhShhh'.repeat(7) + 'KhhhSSSS' },
    { // Build: stabs and a snare roll back to the top
      chords: 'Fm Fm G G'.split(' '), comp: false, glock: true, fill: 'SSSS',
      lead: bars('C5 . C5 . F5 . C5 .', 'Ab5 . Ab5 . F5 . C5 .', 'D5 . D5 . G5 . B5 .', 'D6 . . . - - - -'),
      bass: bars('F1 F1 F2 F1 F1 F2 F1 F2', 'F1 F1 F2 F1 F1 F2 F1 F2', 'G1 G1 G2 G1 G1 G2 G1 G2', 'G1 . . . G1 . . .'),
      drums: 'KhKhKhKh' + 'KhKhKhKh' + 'KSKSKSKS' + 'SSSSSSSS' },
  ] }

/*
 * Gym battle, second version. The first (now SONGS.gymClassic) shared its
 * harmony, groove and arrangement with the other battle themes: minor
 * i-VI-VII-V, straight eighth-note octave bass, brass/strings/e-piano/glock,
 * a half-time bridge. This one takes its cues from the series' gym leader
 * themes instead, and differs on purpose:
 *   - F-sharp minor over a chromatically falling bass (F# F E D# D C#) under
 *     the held tonic, and a second verse that modulates up a whole step;
 *   - a 3+3+2 syncopated drive in the kick, bass and an overdriven guitar;
 *   - a chromatic sixteenth-note run to open, long heroic notes with trills
 *     and scoops, brass doubled an octave up by the synth;
 *   - a middle section in A major as a march: marching snare, a walking bass
 *     and running sixteenth-note arpeggios, closed by tuned timpani.
 * Sixteenth-note grid (div 4), 150 bpm, 16 steps a bar: a 6 s intro once, then a 38 s loop.
 */
SONGS.gymClassic = SONGS.gym
/** A bar of the 3+3+2 drive on one bass note: low, octave, low; and again. */
const drive = (n) => { const hi = transpose([n], 12)[0]; return `${n} . . ${hi} . . ${n} . ${n} . . ${hi} . . ${n} .` }
/** A bar of walking quarter notes. */
const walk = (...ns) => ns.map((n) => `${n} . . .`).join(' ')
const GYM2_DRIVE = 'K.hKS.K.K.hKSgKh'
const GYM2_VERSE = {
  chords: 'F#m F#mmaj7 F#m7 B7 D C#7 Bm C#7'.split(' '),
  lead: bars('F#5^ . . . . . . . C#5 . F#5 . A5 . C#6 .', 'A5 . . . . . G#5 A5 C#6 . . . E#5 . . .',
    'A5~ . . . . . G#5 A5 C#6 . B5 . A5 . E5 .', 'D#5 . . . F#5 . . . B5 . . . A5 . G#5 .',
    'A5^ . . . . . F#5 . D5 . F#5 . A5 . D6 .', 'C#6 . . . B5 . A5 . G#5 . . . E#5 . G#5 .',
    'B5~ . . . . . C#6 . D6 . C#6 . B5 . F#5 .', 'G#5 . . . . . . . E#5 . . . C#5 . . .'),
  bass: bars(drive('F#2'), drive('F2'), drive('E2'), drive('D#2'), drive('D2'), drive('C#2'), drive('B1'),
    'C#2 . . C#3 . . C#2 . G#1 . . G#2 . . E#2 .'),
  drums: GYM2_DRIVE.repeat(7) + 'K.hKS.K.TTttSSSS' }
SONGS.gym = { file: null, loop: true, bpm: 150, div: 4, chordLen: 16,
  leadInst: 'brass', leadDouble: 'synth', harmInst: 'strings', power: true, comp: false, glock: false, hats16: false, crash: true, fill: '',
  intro: { chordLen: 8, chords: 'F#m F#m D C#7 F#m F#m C#7 C#7'.split(' '),
    lead: bars('C#6 C6 B5 A#5 A5 G#5 G5 F#5 F5 E5 D#5 D5 C#5 C5 B4 A#4', 'A4 . . A4 . . A4 . G#4 . . G#4 . . E#4 .',
      'F#4 . . F#4 . . F#4 . F#4 . A4 . C#5 . F#5 .', 'E#5~ . . . . . . . . . . . - - - -'),
    bass: bars('F#1 . . . . . . . . . . . . . . .', 'D2 . . D2 . . D2 . C#2 . . C#2 . . C#2 .',
      'F#1 . . F#2 . . F#1 . F#1 . . F#2 . . F#1 .', 'C#2 . . . . . . . . . . . - - - -'),
    drums: 'K...T...t...SSSS' + 'K..K..K.K..K..SS' + 'K..K..K.P.P.P.P.' + 'PPPPPPPPSSSSSSSS', power: false },
  sections: [
    { ...GYM2_VERSE },
    { // The verse again, a whole step up (G-sharp minor), turning at the end towards A major
      ...GYM2_VERSE,
      chords: [...transposeChords(GYM2_VERSE.chords.slice(0, 7), 2), 'E7'],
      lead: [...transpose(GYM2_VERSE.lead.slice(0, 112), 2), ...bars('B5~ . . . . . . . G#5 . . . E5 . D5 .')],
      bass: [...transpose(GYM2_VERSE.bass.slice(0, 112), 2), ...bars('E2 . . E3 . . E2 . B1 . . B2 . . D2 .')] },
    { // March: A major, walking bass, running sixteenths, the snare on every step
      chords: 'A E F#m D Bm C#7 D C#7'.split(' '), harmInst: 'brass',
      lead: bars('E5 A5 C#6 E6 . . C#6 . A5 . . . E5 . A5 .', 'E5 G#5 B5 E6 . . B5 . G#5 . . . E5 . G#5 .',
        'F#5 A5 C#6 F#6 . . C#6 . A5 . . . F#5 . A5 .', 'D6^ . . . . . . . F#5 . A5 . D6 . E6 .',
        'F#6 . E6 C#6 D6 . B5 . F#5 . B5 . D6 . F#6 .', 'E#6 . D6 C#6 B5 . G#5 . E#5 . G#5 . B5 . C#6 .',
        'D6 . C#6 B5 A5 . F#5 . D5 . F#5 . A5 . D6 .', 'C#6~ . . . . . . . - - - - G#5 A5 B5 C#6'),
      bass: bars(walk('A1', 'C#2', 'E2', 'F#2'), walk('E2', 'G#2', 'B2', 'C#3'), walk('F#2', 'A2', 'C#3', 'D3'), walk('D2', 'F#2', 'A2', 'B2'),
        walk('B1', 'D2', 'F#2', 'G#2'), walk('C#2', 'E#2', 'G#2', 'B2'), walk('D2', 'F#2', 'A2', 'B2'), 'C#2 . . . . . . . G#1 . . . C#2 . . .'),
      drums: 'KghgSghgKghgSghg'.repeat(7) + 'KghgSgSgPPPPSSSS' },
  ] }

Object.assign(SONGS.encounter, { leadInst: 'brass', comp: false, hats16: true, glock: true, pulse: true })
Object.assign(SONGS.win, { leadInst: 'epiano', leadOct: 0, comp: true, glock: true, harmInst: 'strings' })
Object.assign(SONGS.vs, { leadInst: 'brass', hit: true })
Object.assign(SONGS.victory, { leadInst: 'brass', hit: true })
Object.assign(SONGS.caught, { leadInst: 'glock', harmInst: 'brass', hit: true })

scheduleSong = function scheduleSong(ac, out, song, t0) {
  if (!song.sections) return schedulePart(ac, out, song, t0)
  const list = song.intro && !out.__introDone ? [song.intro, ...song.sections] : song.sections
  out.__introDone = true
  let t = t0
  for (const sec of list) t += schedulePart(ac, out, { ...song, ...sec }, t)
  return t - t0
}
function schedulePart(ac, out, song, t0) {
  const step = 60 / song.bpm / song.div, M = mixer(ac, out, song.vol), q = jitQueue(ac)
  /** Where step i lands: on the grid, or with swing, the off-beats pushed late. */
  const T = (i) => t0 + i * step + (song.swing && i % 2 ? song.swing * step : 0)
  const at = (t, fn, lvl = 0) => q.push({ t, out, fn, lvl })   // every note goes through the lookahead queue; lvl: 0 core, 1 colour, 2 ornament
  const each = (track, fn) => {
    for (let i = 0; i < track.length; i++) {
      const n = track[i]; if (n === '.' || n === '-') continue
      let len = 1; while (track[i + len] === '.') len++
      fn(T(i), n, len * step - (song.swing && i % 2 ? song.swing * step : 0), i)
    }
  }
  const chordAt = (i) => song.chords ? chordPcs(song.chords[Math.min(song.chords.length - 1, Math.floor(i / song.chordLen))]) : null
  const play = (name, ch, t, m, d, v, art, lvl = 0) => at(t, () => voice(ac, ch, (vg) => INST[name](ac, vg, t, HZ(m), d, v, art)), lvl)
  /** A lead token: its pitch, and its articulation mark if it has one ('~' trill, '^' scoop, 'v' fall, '!' staccato: short and accented). */
  const tok = (n) => { const [, b, art] = /^(.+?)([~^v!]?)$/.exec(n); return [MIDI(b), art] }
  const hit = (c, t, v, lvl = 0) => at(t, () => kitVoice(ac, M, (m) => KIT[c](ac, m, t, v)), lvl)
  const lastLead = song.lead.reduce((k, n, i) => (n !== '.' && n !== '-' ? i : k), 0)

  // Lead melody.
  each(song.lead, (t, n, d0, i) => {
    const [base, art] = tok(n), m = base + (song.leadOct ?? 0) * 12
    const d = art === '!' ? Math.min(d0, step * 0.85) : d0   // staccato: clipped short
    play(song.leadInst ?? 'brass', M.lead, t, m, d, i === lastLead && song.hit ? 1 : (song.leadVel ?? 0.85) * (art === '!' ? 1.15 : 1), art)
    // A second instrument on the melody, an octave up (or wherever leadDoubleOct says), quieter: the unison lines battle themes are built on.
    if (song.leadDouble) play(song.leadDouble, M.lead, t, m + 12 * (song.leadDoubleOct ?? 1), d, song.leadDoubleVel ?? 0.32, art, 2)
    // Or several: [instrument, octaves, velocity] each (violins above and low brass below, say).
    for (const [inst, oct, vel] of song.doubles ?? []) play(inst, M.lead, t, m + 12 * oct, d, vel, art, 2)
  })
  // Harmony under the melody: the nearest chord tone 3-9 semitones down.
  if (song.chords) each(song.lead, (t, n, d, i) => {
    const lead = tok(n)[0], pcs = chordAt(i)
    for (let k = 3; k <= 9; k++) if (pcs.includes(((lead - k) % 12 + 12) % 12)) { play(song.harmInst ?? 'brass', M.harm, t, lead - k, d, 0.55, '', 1); break }
  })
  // String pad holding each chord, voiced around middle C.
  if (song.chords) song.chords.forEach((c, k) => {
    const t = t0 + k * song.chordLen * step, dur = Math.min(song.chordLen, song.lead.length - k * song.chordLen) * step
    for (const pc of chordPcs(c).slice(0, 3)) play(song.padInst ?? 'strings', M.pad, t, 55 + ((pc - 55) % 12 + 12) % 12, dur * 0.98, 0.8, '', 1)
  })
  // Clavinet and horn-section stabs: the chord, short, wherever their one-bar rhythm ('x') says.
  const chordAround = (i, lo) => chordPcs(song.chords[Math.min(song.chords.length - 1, Math.floor(i / song.chordLen))]).slice(0, 4).map((pc) => lo + ((pc - lo) % 12 + 12) % 12)
  for (const [pat, inst, ch, lo, len, vel] of [[song.clav, 'clav', M.keys, 58, 0.8, 0.8], [song.stabs, 'brass', M.harm, 55, 1.3, 0.7]]) {
    if (pat) for (let i = 0; i < song.lead.length; i++) if (pat[i % pat.length] === 'x') for (const m of chordAround(i, lo)) play(inst, ch, T(i), m, step * len, vel, '', 2)
  }
  // String tremolo: the strings shaking between the chord's notes, two to a step, wherever a bar is marked 'x'.
  if (song.trem) for (let b = 0; b * song.chordLen < song.lead.length; b++) {
    if (song.trem[b % song.trem.length] !== 'x') continue
    const n = Math.min(song.chordLen, song.lead.length - b * song.chordLen), tones = chordAt(b * song.chordLen).slice(0, 3).map((pc) => 60 + ((pc - 60) % 12 + 12) % 12).sort((a, c) => a - c)
    for (let k = 0; k < n * 2; k++) {
      const t = T(b * song.chordLen) + k * step / 2
      for (const m of k % 2 ? [tones[1], tones[2] + 12] : [tones[0], tones[2]]) play('violins', M.pad, t, m, step * 0.48, 0.34, '', 2)
    }
  }
  // Piano runs: a bar-long sweep through the chord across four octaves, one letter a bar ('u' up, 'd' down, 'w' up and back, '.' none),
  // or 'f', a flourish: eight quick notes ripping up through the chord in the bar's last beat, into the next downbeat.
  if (song.runs) for (let b = 0; b * song.chordLen < song.lead.length; b++) {
    const kind = song.runs[b % song.runs.length], n = Math.min(song.chordLen, song.lead.length - b * song.chordLen); if (kind === '.') continue
    const pcs = chordAt(b * song.chordLen), tones = []
    for (let m = 48; m <= 96; m++) if (pcs.includes(m % 12)) tones.push(m)
    if (kind === 'f') {
      const hi = tones.filter((m) => m >= 72), t1 = T(b * song.chordLen + n - song.div)
      for (let k = 0; k < 8; k++) play('piano', M.keys, t1 + k * step * song.div / 8, hi[Math.min(hi.length - 1, k)], step * 0.6, 0.55 + k * 0.06, '', 2)
      continue
    }
    for (let k = 0; k < n; k++) {
      const x = kind === 'u' ? k / (n - 1) : kind === 'd' ? 1 - k / (n - 1) : 1 - Math.abs(2 * k / (n - 1) - 1)
      const m = tones[Math.round(x * (tones.length - 1))]
      play('piano', M.keys, T(b * song.chordLen + k), m, step * 1.6, 0.45 + 0.4 * (kind === 'd' ? 1 - x : x), '', 2)
    }
  }
  // Piano ostinato: a repeating figure through the chord (its three notes from middle C up, and the root an octave higher).
  if (song.ostinato) for (let i = 0; i < song.lead.length; i++) {
    const k = song.ostinato[i % song.ostinato.length]; if (k === '-') continue
    const tones = chordAt(i).slice(0, 3).map((pc) => 60 + ((pc - 60) % 12 + 12) % 12).sort((a, b) => a - b)
    tones.push(tones[0] + 12)
    play('piano', M.keys, T(i), tones[+k] + 12 * (song.ostinatoOct ?? 0), step * 1.4, i % song.div ? 0.5 : 0.8, '', 2)
  }
  // Electric piano comping: chord stabs on the off-beats.
  if (song.comp) for (let i = 1; i < song.lead.length; i += 2) {
    const pcs = chordAt(i).slice(0, 2)
    for (const pc of pcs) play('epiano', M.keys, T(i), 60 + ((pc - 60) % 12 + 12) % 12, step * 0.9, 0.55, '', 2)
  }
  // Glockenspiel arpeggio up and back through the chord.
  if (song.glock) for (let i = 0; i < song.lead.length; i++) {
    const notes = chordAt(i).slice(0, 3).map((pc) => 72 + ((pc - 72) % 12 + 12) % 12).sort((a, b) => a - b)
    const seq = [notes[0], notes[1], notes[2], notes[0] + 12, notes[2], notes[1]]
    play('glock', M.glock, T(i), seq[i % seq.length], step, i % 2 ? 0.5 : 0.75, '', 2)
  }
  // Generated bass: sixteenth notes bouncing between the chord's root and its octave.
  if (song.bassGen === 'octave16') for (let i = 0; i < song.lead.length; i++) {
    const r = 33 + ((chordAt(i)[0] - 33) % 12 + 12) % 12   // the root, from A1 up
    play('bass', M.bass, t0 + i * step, r, step * 0.45, 1); play('bass', M.bass, t0 + (i + 0.5) * step, r + 12, step * 0.4, 0.7)
  }
  // Guitar: a palm-muted power chord on the chord's root (not the bass note, so a bass line can walk under it) wherever the bass plays.
  if (song.power) each(song.bass, (t, n, d, i) => {
    const r = 40 + ((chordAt(i)[0] - 40) % 12 + 12) % 12   // E2..D#3
    play('power', M.gtr, t, r, Math.min(d, step * 1.6) * 0.85, 1, '', 2)
  })
  // Bass: the written line; on pulse songs, an extra eighth-note pulse on the root.
  each(song.bass, (t, n, d, i) => {
    if (song.pulse && d > step * 1.5) { for (let k = 0; k < d / step - 0.5; k++) play('bass', M.bass, t + k * step, MIDI(n), step * 0.8, k ? 0.6 : 1) }
    else play(song.bassInst ?? 'bass', M.bass, t, MIDI(n), d, 1)
    // Other instruments on the bass line ([instrument, octaves, velocity]): piano octaves over low strings, say.
    for (const [inst, oct, vel] of song.bassDoubles ?? []) play(inst, M.keys, t, MIDI(n) + 12 * oct, d, vel, '', 2)
  })
  // Drums, as written; then sixteenth-note hats between the steps, and a tom fill closing the loop.
  const fillFrom = song.fill ? song.drums.length - song.fill.length : Infinity
  ;[...song.drums].forEach((c, i) => {
    const t = T(i)
    if (i >= fillFrom) { hit(song.fill[i - fillFrom], t); return }
    // Timpani are tuned to the chord's root, low.
    if (c === 'P') { const f = HZ(31 + ((chordAt(i)[0] - 31) % 12 + 12) % 12); at(t, () => kitVoice(ac, M, (m) => KIT.P(ac, m, t, 1, f))); return }
    if (KIT[c]) hit(c, t)
    if (song.hats16) hit('h', t + step / 2, 0.5, 1)
    if (song.hats16 && c !== 'h' && c !== 'C' && i % 2 === 1) hit('h', t, 0.8, 1)
  })
  if (song.crash ?? (song.loop && song.hats16)) hit('C', t0)   // a crash on each loop's (or section's) downbeat
  // Jingles end on an orchestra hit: a full brass chord, crash and low tom together.
  if (song.hit && song.chords) {
    const t = t0 + lastLead * step, pcs = chordAt(lastLead).slice(0, 3)
    for (const [k, pc] of pcs.entries()) { play('brass', M.harm, t, 55 + ((pc - 55) % 12 + 12) % 12, step * 6, 0.9); play('strings', M.pad, t, 43 + ((pc - 43) % 12 + 12) % 12 + (k ? 12 : 0), step * 7, 1) }
    hit('C', t); hit('t', t); hit('K', t)
  }
  q.sort((a, b) => a.t - b.t)
  return song.lead.length * step
}

/* ── video soundtrack, now in stereo ──
   Replaces the template's mono render: the same timeline of logged sounds,
   rendered offline through the same buses, as 16-bit stereo WAV. */
window.__renderAudio = async (fromMs, toMs, rate = 24000) => {
  const dur = (toMs - fromMs) / 1000
  const ac = new OfflineAudioContext(2, Math.ceil(dur * rate), rate)
  const master = ac.createGain(); master.gain.value = 0.6; master.connect(ac.destination)
  const s = ac.createGain(); s.gain.value = 0.9; s.connect(master)
  const m = ac.createGain(); m.gain.value = 0.5; m.connect(master)
  const log = window.__audioLog.filter((e) => e.t <= toMs)
  await window.__scheduleCries?.(ac, s, log, fromMs)
  log.forEach((e, i) => {
    const t = (e.t - fromMs) / 1000
    if (e.kind === 'sfx' && t >= 0 && SFX[e.name]) SFX[e.name].synth(ac, s, t)
    if (e.kind === 'music' && e.name) {
      const song = SONGS[e.name]
      const end = (log.slice(i + 1).find((x) => x.kind === 'music')?.t ?? toMs) - fromMs
      if (end / 1000 < 0) return
      const g = ac.createGain(); g.connect(m)
      g.gain.setValueAtTime(1, Math.max(0, end / 1000)); g.gain.linearRampToValueAtTime(0, Math.max(0, end / 1000) + 0.08)
      let t0 = t + 0.06
      do { const len = scheduleSong(ac, g, song, t0); t0 += len } while (song.loop && t0 < end / 1000)
    }
  })
  prepareOffline(ac, dur)
  const buf = await ac.startRendering()
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length
  const out = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o, x) => [...x].forEach((c, k) => out.setUint8(o + k, c.charCodeAt(0)))
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, n * 4, true)
  for (let k = 0; k < n; k++) {
    out.setInt16(44 + k * 4, Math.max(-1, Math.min(1, L[k])) * 0x7fff, true)
    out.setInt16(46 + k * 4, Math.max(-1, Math.min(1, R[k])) * 0x7fff, true)
  }
  const bytes = new Uint8Array(out.buffer); let bin = ''
  for (let k = 0; k < bytes.length; k += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000))
  return btoa(bin)
}

/* ══════════════ the League's music ══════════════
   Each Elite Four member gets their own intro under the VS splash and their
   words, in the spirit of their type; all four share one battle theme. The
   Champion gets a set of his own. Same shape as the gym's: a short sting,
   then a loop that holds for as long as they talk or fight. */

/** Will, psychic: E minor, an eerie glockenspiel line over slow strings. */
SONGS.e4Will = { file: null, loop: true, bpm: 104, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'glock', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Em', 'B7'], lead: bars('B4 . E5 . G5 . B5 .', 'D#6 . . . . . . .'), bass: bars('E2 . . . . . . .', 'B1 . . . . . . .'),
    drums: 'K.......' + 'T.t.T.t.', crash: true },
  sections: [{
    chords: 'Em C Am B7 Em G C B7'.split(' '),
    lead: bars('E5 . G5 . B5 . G5 .', 'C6 . B5 . G5 . E5 .', 'A5 . C6 . E6 . C6 .', 'D#6 . . . B5 . F#5 .',
      'G5 . B5 . E6 . B5 .', 'D6 . B5 . G5 . D5 .', 'E5 . G5 . C6 . E6 .', 'D#6 . . . . . - -'),
    bass: bars('E2 . . . B1 . . .', 'C2 . . . G1 . . .', 'A1 . . . E2 . . .', 'B1 . . . F#2 . . .',
      'E2 . . . B1 . . .', 'G1 . . . D2 . . .', 'C2 . . . G1 . . .', 'B1 . . . B1 . . .'),
    drums: 'K...h...'.repeat(7) + 'K...T.t.' }] }

/** Koga, poison: D minor with a flattened second (the ninja's E-flat), a sly synth and tom hits. */
SONGS.e4Koga = { file: null, loop: true, bpm: 120, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'synth', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Dm', 'A'], lead: bars('D5 . . . Eb5 . . .', 'C#5 . . . . . . .'), bass: bars('D2 . . . D2 . . .', 'A1 . . . A1 . . .'),
    drums: 'K...T...' + 'T.t.TtSS', crash: true },
  sections: [{
    chords: 'Dm Eb Dm C Dm Eb Gm A'.split(' '),
    lead: bars('D5 . F5 . A5 . F5 .', 'G5 . Eb5 . Bb4 . G5 .', 'A5 . . F5 D5 . F5 .', 'E5 . G5 . C6 . G5 .',
      'D6 . A5 . F5 . A5 .', 'Bb5 . G5 . Eb5 . G5 .', 'G5 . Bb5 . D6 . Bb5 .', 'C#6 . . . A5 . E5 .'),
    bass: bars('D2 . . D2 . . A1 .', 'Eb2 . . Eb2 . . Bb1 .', 'D2 . . D2 . . A1 .', 'C2 . . C2 . . G1 .',
      'D2 . . D2 . . A1 .', 'Eb2 . . Eb2 . . Bb1 .', 'G1 . . G1 . . D2 .', 'A1 . . A1 . . E2 .'),
    drums: 'K..T..t.'.repeat(7) + 'K.TtTtSS' }] }

/** Bruno, fighting: A minor, pounding brass and a kick that doesn't let up. */
SONGS.e4Bruno = { file: null, loop: true, bpm: 132, div: 2, chordLen: 8, vol: 0.82,
  leadInst: 'brass', harmInst: 'brass', comp: true, hats16: false, crash: false, fill: 'TTtt',
  intro: { chords: ['Am', 'E'], lead: bars('A4 . - A4 . - C5 .', 'E5 . . . . . . .'), bass: bars('A1 . - A1 . - C2 .', 'E1 . . . . . . .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', crash: true, comp: false, fill: '' },
  sections: [{
    chords: 'Am Am F G Am Am F E'.split(' '),
    lead: bars('A4 . . A4 C5 . E5 .', 'A5 . . . G5 . E5 .', 'F5 . . F5 A5 . C6 .', 'B5 . . . G5 . D5 .',
      'A5 . C6 . E6 . C6 .', 'A5 . . . E5 . A5 .', 'F5 . A5 . C6 . A5 .', 'G#5 . . . B5 . E5 .'),
    bass: bars('A1 A1 A2 A1 A1 A2 A1 A1', 'A1 A1 A2 A1 A1 A2 A1 G1', 'F1 F1 F2 F1 F1 F2 F1 F1', 'G1 G1 G2 G1 G1 G2 G1 G1',
      'A1 A1 A2 A1 A1 A2 A1 A1', 'A1 A1 A2 A1 A1 A2 A1 G1', 'F1 F1 F2 F1 F1 F2 F1 F1', 'E1 E1 E2 E1 E1 E2 E1 E1'),
    drums: 'K.SKK.S.'.repeat(7) + 'K.SKSSSS' }] }

/** Karen, dark: F minor, slow and swung, a smoky electric piano with a walking bass. */
SONGS.e4Karen = { file: null, loop: true, bpm: 96, div: 2, chordLen: 8, swing: 0.3, vol: 0.8,
  leadInst: 'epiano', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Fm', 'C7'], lead: bars('C5 . F5 . Ab5 . C6 .', 'E5 . . . . . . .'), bass: bars('F2 . . . . . . .', 'C2 . . . . . . .'),
    drums: 'K.......' + 'S.g.S.gg' },
  sections: [{
    chords: 'Fm Db Bb7 C7 Fm Db Bbm C7'.split(' '),
    lead: bars('F5 . Ab5 . C6 . Ab5 .', 'Db6 . . . C6 . Ab5 .', 'Bb5 . D6 . F5 . Ab5 .', 'G5 . . . E5 . C5 .',
      'F5 . C6 . Ab5 . F5 .', 'Ab5 . F5 . Db5 . F5 .', 'Bb5 . Db6 . F6 . Db6 .', 'E5 . G5 . Bb5 . . .'),
    bass: bars('F2 . C2 . F2 . Ab2 .', 'Db2 . Ab1 . Db2 . F2 .', 'Bb1 . F2 . Bb1 . D2 .', 'C2 . G1 . C2 . E2 .',
      'F2 . C2 . F2 . Ab2 .', 'Db2 . Ab1 . Db2 . F2 .', 'Bb1 . F2 . Bb1 . Db2 .', 'C2 . G1 . C2 . E2 .'),
    drums: 'K.h.S.h.'.repeat(7) + 'K.h.S.Sg' }] }

/** Lorelei, ice (the Kanto League): a waltz in C minor, violins with bells over cold strings, the bass an oom-pah-pah. */
SONGS.e4Lorelei = { file: null, loop: true, bpm: 112, div: 2, chordLen: 6, vol: 0.82,
  leadInst: 'violins', doubles: [['bells', 0, 0.3]], harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Cm', 'G7'], lead: bars('C6 . G5 . Eb5 .', 'D5 . . . . .'), bass: bars('C2 . . . . .', 'G1 . . . . .'), drums: 'K.....' + 'T.t.T.', crash: true },
  sections: [{
    chords: 'Cm Ab Fm G7 Cm Ab Bb G7'.split(' '),
    lead: bars('C6 . . Eb6 . D6', 'C6 . . . G5 .', 'Ab5 . . C6 . Bb5', 'G5 . . . . .',
      'Eb6 . . G6 . F6', 'Eb6 . . C6 . Ab5', 'D6 . . F6 . Eb6', 'D6 . . B5 . .'),
    bass: bars('C2 . G2 . G2 .', 'Ab1 . Eb2 . Eb2 .', 'F1 . C2 . C2 .', 'G1 . D2 . D2 .',
      'C2 . G2 . G2 .', 'Ab1 . Eb2 . Eb2 .', 'Bb1 . F2 . F2 .', 'G1 . B1 . D2 .'),
    drums: 'K.h.h.'.repeat(7) + 'K.T.tt' }] }

/** Agatha, ghost (the Kanto League): B-flat minor, slow, an organ over a choir, slipping by semitones. */
SONGS.e4Agatha = { file: null, loop: true, bpm: 84, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'organ', harmInst: 'strings', padInst: 'choir', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Bbm', 'A7'], lead: bars('F5 . . . E5 . . .', 'F5 . . . . . . -'), bass: bars('Bb1 . . . . . . .', 'A1 . . . . . . .'), drums: 'K.......' + 't...T...' },
  sections: [{
    chords: 'Bbm Bbm Gb F Bbm Gb Ebm F7'.split(' '),
    lead: bars('Bb4 . Db5 . F5 . E5 .', 'F5 . . . Db5 . Bb4 .', 'Bb4 . Db5 . Gb5 . F5 .', 'F5 . . . . . A4 .',
      'Bb4 . F5 . Bb5 . A5 .', 'Gb5 . . . Db5 . Bb4 .', 'Eb5 . Gb5 . Bb5 . Gb5 .', 'A4 . . . C5 . Eb5 .'),
    bass: bars('Bb1 . . . F1 . . .', 'Bb1 . . . A1 . . .', 'Gb1 . . . Db2 . . .', 'F1 . . . C2 . . .',
      'Bb1 . . . F1 . . .', 'Gb1 . . . Db2 . . .', 'Eb1 . . . Bb1 . . .', 'F1 . . . A1 . . .'),
    drums: 'K.....t.'.repeat(7) + 'K...TtTt' }] }

/** Lance, dragon (the Kanto League, back for more): a C minor fanfare, brass over low brass, tuned timpani, tremolo strings. */
SONGS.e4KantoLance = { file: null, loop: true, bpm: 108, div: 2, chordLen: 8, vol: 0.85,
  leadInst: 'brass', doubles: [['brass', -1, 0.4]], harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  intro: { chords: ['Cm', 'G'], lead: bars('C5 . G4 . C5 . Eb5 .', 'D5 . . . . . . .'), bass: bars('C2 . . . . . . .', 'G1 . . . . . . .'), drums: 'P.......' + 'P.P.PPSS', crash: true },
  sections: [{
    chords: 'Cm Ab Eb Bb Cm Ab Fm G'.split(' '), trem: '. . . . x x x x'.split(' '),
    lead: bars('G5 . . . C6 . . .', 'Eb6 . . . D6 . C6 .', 'Bb5 . . . G5 . . .', 'F5 . . . D5 . Bb4 .',
      'C5 . Eb5 . G5 . C6 .', 'Eb6 . . . C6 . Ab5 .', 'F5 . Ab5 . C6 . F6 .', 'D6 . . . B5 . G5 .'),
    bass: bars('C2 . . . G1 . . .', 'Ab1 . . . Eb2 . . .', 'Eb2 . . . Bb1 . . .', 'Bb1 . . . F2 . . .',
      'C2 . . . G1 . . .', 'Ab1 . . . Eb2 . . .', 'F1 . . . C2 . . .', 'G1 . . . D2 . . .'),
    drums: 'P...S...'.repeat(7) + 'P.T.tTSS' }] }

/**
 * The Hall of Fame, after Alex's last battle: E major, where the rival's final
 * theme turned at its height. A stately anthem on brass and violins over a
 * choir, then the rival's four notes (E, G-sharp, F-sharp, E) as a farewell,
 * bells ringing above them. 92 bpm, eighth-note grid.
 */
SONGS.hallOfFame = { file: null, loop: true, bpm: 92, div: 2, chordLen: 8, vol: 0.85,
  leadInst: 'brass', doubles: [['violins', 0, 0.35]], harmInst: 'strings', padInst: 'choir', comp: false, hats16: false, crash: true, fill: '',
  intro: { chords: ['E', 'B'], doubles: [['bells', 0, 0.3]], lead: bars('E5 . B4 . E5 . G#5 .', 'B5 . . . . . . .'), bass: bars('E1 . . . . . . .', 'B1 . . . . . . .'), drums: 'P.......' + 'P.P.PPSS' },
  sections: [
    { // The anthem
      chords: 'E A E B C#m A B E'.split(' '),
      lead: bars('B4 . E5 . G#5 . B5 .', 'C#6 . . . B5 . A5 .', 'G#5 . . . E5 . G#5 .', 'F#5 . . . . . . .',
        'E5 . G#5 . C#6 . E6 .', 'E6 . . . C#6 . A5 .', 'B5 . . . D#6 . F#6 .', 'E6~ . . . . . . .'),
      bass: bars('E2 . . . B1 . . .', 'A1 . . . E2 . . .', 'E2 . . . G#1 . . .', 'B1 . . . F#1 . . .',
        'C#2 . . . G#1 . . .', 'A1 . . . E2 . . .', 'B1 . . . F#1 . . .', 'E2 . . . B1 . . .'),
      drums: 'P...S...'.repeat(7) + 'P.T.tTSS' },
    { // The rival's farewell: the motif in E major, bells above it
      chords: 'E C#m A B E C#m A B7'.split(' '), doubles: [['violins', 0, 0.35], ['bells', 1, 0.2]], trem: '. . . . x x x x'.split(' '),
      lead: bars('E5 . . . G#5 . F#5 .', 'E5 . . . B4 . . .', 'C#5 . E5 . A5 . G#5 .', 'F#5 . . . . . . .',
        'E6 . . . G#6 . F#6 .', 'E6 . . . C#6 . . .', 'A5 . C#6 . E6 . D#6 .', 'B5~ . . . . . . .'),
      bass: bars('E2 . . . B1 . . .', 'C#2 . . . G#1 . . .', 'A1 . . . E2 . . .', 'B1 . . . F#1 . . .',
        'E2 . . . B1 . . .', 'C#2 . . . G#1 . . .', 'A1 . . . E2 . . .', 'B1 . . . B1 . B1 .'),
      drums: 'K...S...'.repeat(7) + 'P.P.PPSS' },
  ] }

/**
 * The Elite Four battle: B minor at 172 bpm, about 45 s a loop. A driving
 * verse, the verse again higher with the glockenspiel, a broad bridge in
 * D major, and a build back to the top.
 */
const E4_CHORDS = 'Bm G A F# Bm G Em F#'.split(' ')
const E4_BASS = bars('B1 B1 B2 B1 B1 B2 B1 A1', 'G1 G1 G2 G1 G1 G2 G1 F#1', 'A1 A1 A2 A1 A1 A2 A1 A1', 'F#1 F#1 F#2 F#1 F#1 F#2 E2 C#2',
  'B1 B1 B2 B1 B1 B2 B1 A1', 'G1 G1 G2 G1 G1 G2 G1 G1', 'E1 E1 E2 E1 E1 E2 E1 E1', 'F#1 F#1 F#2 F#1 A#1 C#2 E2 F#2')
SONGS.elite = { file: null, loop: true, bpm: 172, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Bm', 'F#'], lead: bars('B4 . - B4 . - D5 .', 'C#5 . - A#4 . - F#4 .'), bass: bars('B1 . - B1 . - D2 .', 'C#2 . - A#1 . - F#1 .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', hats16: false, comp: false, fill: '', crash: true },
  sections: [
    { chords: E4_CHORDS, bass: E4_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS',
      lead: bars('B4 . D5 F#5 . E5 D5 C#5', 'D5 . B4 . G5 . F#5 E5', 'E5 . C#5 . A5 . G5 F#5', 'F#5 . . . A#4 . C#5 E5',
        'D5 F#5 B5 . A5 G5 F#5 E5', 'D5 . G5 . B5 . G5 D5', 'E5 . G5 . B5 . A5 G5', 'F#5 . . . C#5 . A#4 .') },
    { chords: E4_CHORDS, bass: E4_BASS, drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS', glock: true,
      lead: bars('F#5 . . B5 D6 . C#6 B5', 'B5 . . G5 D6 . B5 G5', 'C#6 . . A5 E6 . C#6 A5', 'C#6 . . . A#5 . F#5 .',
        'B5 . D6 . F#6 . E6 D6', 'D6 . B5 . G5 . B5 D6', 'E6 . D6 . B5 . G5 E5', 'F#5 . A#5 . C#6 . E6 .') },
    { // Bridge: broad, half-time, D major
      chords: 'D A Bm G D A G F#'.split(' '), comp: false, hats16: false, crash: true,
      lead: bars('F#5 . . . A5 . . .', 'C#6 . . . E5 . . .', 'D6 . . . B5 . F#5 .', 'B5 . . . . . . .',
        'A5 . . . D6 . F#6 .', 'E6 . . . C#6 . A5 .', 'D6 . . . B5 . G5 .', 'A#5 . . . C#6 . E6 .'),
      bass: bars('D2 . . . D2 . A1 .', 'A1 . . . A1 . E2 .', 'B1 . . . B1 . F#2 .', 'G1 . . . G1 . D2 .',
        'D2 . . . D2 . A1 .', 'A1 . . . A1 . E2 .', 'G1 . . . G1 . D2 .', 'F#1 . . . F#1 . C#2 .'),
      drums: 'KhhhShhh'.repeat(7) + 'KhhhSSSS' },
    { // Build back to the top
      chords: 'Em Em F# F#'.split(' '), comp: false, glock: true, fill: 'SSSS',
      lead: bars('B4 . B4 . E5 . B4 .', 'G5 . G5 . E5 . B4 .', 'C#5 . C#5 . F#5 . A#5 .', 'C#6 . . . - - - -'),
      bass: bars('E1 E1 E2 E1 E1 E2 E1 E2', 'E1 E1 E2 E1 E1 E2 E1 E2', 'F#1 F#1 F#2 F#1 F#1 F#2 F#1 F#2', 'F#1 . . . F#1 . . .'),
      drums: 'KhKhKhKh' + 'KhKhKhKh' + 'KSKSKSKS' + 'SSSSSSSS' },
  ] }

/*
 * The trainer battle, second version: SONGS.battleB. Trainer battles pick
 * this or the first (SONGS.battle) at random each time. Scalpers at a
 * vending machine are a street encounter, so this one is cheeky funk rather
 * than another urgent minor theme:
 *   - C Dorian (minor, with a bright raised sixth), on a Cm7-F7 vamp turned
 *     around through A-flat 7 to G7;
 *   - a syncopated slap-bass line, a clavinet comping in sixteenths, horn
 *     section stabs and hand claps;
 *   - a saxophone lead that growls and falls off its notes;
 *   - a middle section of jazz changes, each chord leading into the next
 *     (Fm7 Bb7 Ebmaj7 Abmaj7 Dm7 G7), and a breakdown of bass, drums and clav.
 * 160 bpm, sixteenth-note grid, 16 steps a bar: a 3 s intro, then a 42 s loop.
 */
/** A bar of funk bass on a root: the root, its octave popped, the flat seventh below, the fifth, the seventh, and back up. */
const funk = (n) => { const [lo7, hi, fifth, sev] = transpose([n, n, n, n], 0).map((x, k) => transpose([x], [-2, 12, 7, 10][k])[0]); return `${n} . . ${hi} - ${n} . ${lo7} . . ${n} . ${fifth} . ${sev} ${hi}` }
const FUNK_A = {
  chords: 'Cm7 F7 Cm7 F7 Cm7 F7 Ab7 G7'.split(' '),
  lead: bars('- - G5 . Bb5 . C6 . - Bb5 . G5 . . F5 G5', 'A5 . . . . . F5 . Eb5 . F5 . A5 . C6 .',
    'Bb5 . . G5 . . Eb5 . G5 . F5 . - - C6 .', 'Eb6v . . . . . . . - - C6 . A5 . F5 .',
    'G5 . C6 . Eb6 . C6 . Bb5 . . G5 . . Bb5 .', 'C6 . A5 . F5 . A5 . C6 . D6 . Eb6 . C6 .',
    'Eb6 . . C6 . . Ab5 . Gb5 . . . Eb5 . . .', 'D6~ . . . . . . . B5 . . . G5 . F5 .'),
  bass: bars(funk('C2'), funk('F1'), funk('C2'), funk('F1'), funk('C2'), funk('F1'), funk('Ab1'), funk('G1')),
  drums: 'K.hgS.hKhgKhS.hg'.repeat(7) + 'K.hgS.hKXXXXSSSS' }
SONGS.battleB = { file: null, loop: true, bpm: 160, div: 4, chordLen: 16,
  leadInst: 'sax', harmInst: 'strings', comp: false, glock: false, hats16: false, crash: true, fill: '',
  clav: '.x.x.xx..x.x.xx.', stabs: '..........x..x..',
  intro: { chords: ['Cm7', 'Cm7'], leadInst: 'brass', clav: '', stabs: '',
    lead: bars('G5 . . G5 . . G5 . Bb5 . . Bb5 . . C6 .', 'C6v . . . . . . . - - - - - - - -'),
    bass: bars('C2 . . C2 . . C2 . Bb1 . . Bb1 . . C2 .', 'C2 . . . . . . . - - - - - - - -'),
    drums: 'K..K..K.S..S..S.' + 'K...S...XXXXSSSS' },
  sections: [
    { ...FUNK_A },
    { // Jazz changes, each chord leading into the next; claps on the backbeat
      chords: 'Fm7 Bb7 Ebmaj7 Abmaj7 Dm7 G7 Cm7 G7'.split(' '), stabs: '....x.......x...',
      lead: bars('Ab5 . . . C6 . . . Eb6 . . . C6 . Ab5 .', 'D6 . . . . . . . F5 . Ab5 . Bb5 . D6 .',
        'G6v . . . . . . . - - Eb6 . D6 . Bb5 .', 'C6 . . . Eb6 . . . G5 . . . Ab5 . C6 .',
        'F6 . . . D6 . . . A5 . . . C6 . . .', 'B5 . . . D6 . . . F6 . . . D6 . B5 .',
        'C6^ . . . . . . . G5 . Bb5 . C6 . Eb6 .', 'D6~ . . . . . . . G5 . . . G5 A5 B5 D6'),
      bass: bars(funk('F1'), funk('Bb1'), funk('Eb2'), funk('Ab1'), funk('D2'), funk('G1'), funk('C2'), funk('G1')),
      drums: 'K.hgX.hKhgKhX.hg'.repeat(7) + 'K.hgX.hKSSSSXXXX' },
    { ...FUNK_A, leadInst: 'brass', leadDouble: 'sax', leadDoubleOct: -1, leadDoubleVel: 0.5, stabs: '' },   // the vamp again: trumpet on top, the sax an octave under
    { // Breakdown: bass, drums and clav, then the sax back in
      chords: 'Cm7 F7 Cm7 F7'.split(' '), stabs: '',
      lead: bars('- - - - - - - - - - - - - - - -', '- - - - - - - - - - - - - - - -', '- - - - - - - - - - - - - - - -', 'F5 . A5 . C6 . Eb6 . F6 . A6 . - - - -'),
      bass: bars(funk('C2'), funk('F1'), funk('C2'), funk('F1')),
      drums: 'K..hS..hK.hhS..h'.repeat(3) + 'SSSSXXXXSSSSKKKK' },
  ] }

/*
 * The Elite Four battle, second version (the first is SONGS.eliteClassic).
 * Where the gym theme drives, this one looms. It's the only battle theme not
 * in straight 4/4: a galloping 12/8 (three steps a beat, div 3), in G minor.
 *   - The verse starts over a pedal: the bass holds D, the dominant, while
 *     the chords move above it (Gm, Eb, Cm, D7), and only lets go in its
 *     second half, through the Neapolitan Ab major to D7.
 *   - A choir holds the chords instead of strings; a piano ostinato rolls
 *     through them the whole time; the melody is a violin section with the
 *     brass an octave below.
 *   - A middle section moves by thirds instead of steps: B-flat major, G-flat,
 *     E-flat, then E-flat minor sliding down to D7.
 *   - A breakdown of piano, timpani and choir alone before the loop.
 * 160 bpm, 12 steps a bar: a 6 s intro once, then a 42 s loop.
 */
SONGS.eliteClassic = SONGS.elite
/** A bar of the gallop on one bass note: the note, then its octave, on each beat's first and last triplet. */
const gallop = (n) => { const hi = transpose([n], 12)[0]; return Array(4).fill(`${n} . ${hi}`).join(' ') }
const E4V_CHORDS = 'Gm Eb Cm7 D7 Gm Eb Ab D7'.split(' ')
const E4V_BASS = bars(gallop('D2'), gallop('D2'), gallop('D2'), gallop('D2'), gallop('G1'), gallop('Eb2'), gallop('Ab1'), gallop('D2'))
const E4V_DRUMS = 'K.hS.hK.KS.h'.repeat(7) + 'K.hS.hTTtSSS'
SONGS.elite = { file: null, loop: true, bpm: 160, div: 3, chordLen: 12,
  leadInst: 'violins', leadDouble: 'brass', leadDoubleOct: -1, leadDoubleVel: 0.42, harmInst: 'strings', padInst: 'choir',
  ostinato: '0 1 2 3 2 1 0 1 2 3 2 1'.split(' '), comp: false, glock: false, hats16: false, power: false, crash: true, fill: '',
  intro: { chords: 'D7 D7 Gm D7'.split(' '),
    lead: bars('- - - - - - - - - - - -', '- - - - - - - - - - - -', 'G4 . . . . . Bb4 . . D5 . .', 'F#5~ . . . . . . . . - - -'),
    bass: bars('D1 . . . . . . . . . . .', 'D1 . . . . . . . . . . .', gallop('G1'), 'D2 . . . . . D2 . . D2 . .'),
    drums: 'PPPPPPPPPPPP' + 'PPPPPPPPPPPP' + 'K.....K.....' + 'K.....K.SSSS' },
  sections: [
    { // The verse, over the pedal
      chords: E4V_CHORDS, bass: E4V_BASS, drums: E4V_DRUMS,
      lead: bars('G5 . . . . . D5 . . G5 . A5', 'Bb5 . . . . . G5 . . Eb5 . .', 'C6 . . Bb5 . . G5 . . Eb5 . .', 'F#5~ . . . . . A5 . . C6 . .',
        'D6 . . . . . Bb5 . . G5 . A5', 'Bb5 . . . . . Eb6 . . G6 . .', 'Ab6^ . . . . . Eb6 . . C6 . .', 'A5 . . F#5 . . D5 . . C6 . .') },
    { // The verse again, higher, with triplet turns
      chords: E4V_CHORDS, bass: E4V_BASS, drums: E4V_DRUMS,
      lead: bars('G5 A5 Bb5 D6 . . Bb5 . . G6 . .', 'G6 . . Eb6 . . Bb5 . . G5 . .', 'Eb6 . . C6 . . G5 . . Eb6 D6 C6', 'D6 . . F#6 . . A6 . . F#6 . .',
        'G6 . . . . . D6 . . Bb5 . .', 'Eb6 . . . . . Bb5 . . G5 . .', 'C6 . . Eb6 . . Ab6 . . Eb6 . C6', 'D6~ . . . . . . . . - - -') },
    { // By thirds: B-flat, G-flat, E-flat, then E-flat minor sliding to D7; the snare only on beat three
      chords: 'Bb Gb Eb Cm Bb Gb Ebm D7'.split(' '), harmInst: 'brass',
      lead: bars('D6 . . . . . F6 . . . . .', 'Gb6^ . . . . . Db6 . . Bb5 . .', 'Bb5 . . . . . G5 . . Eb6 . .', 'Eb6 . . . . . C6 . . G5 . .',
        'F6 . . . . . D6 . . Bb5 . .', 'Db6 . . . . . Gb6 . . Bb6 . .', 'Bb6~ . . . . . Gb6 . . Eb6 . .', 'F#6 . . . . . D6 . . A5 C6 D6'),
      bass: bars(gallop('Bb1'), gallop('Gb1'), gallop('Eb2'), gallop('C2'), gallop('Bb1'), gallop('Gb1'), gallop('Eb2'), gallop('D2')),
      drums: 'K.hK.hS.hK.h'.repeat(7) + 'K.hK.hSSSPPP' },
    { // Breakdown: piano, timpani and choir
      chords: 'Gm Eb Cm D7'.split(' '), crash: false,
      lead: bars('- - - - - - - - - - - -', '- - - - - - - - - - - -', '- - - - - - - - - - - -', 'D5 . . F#5 . . A5 . . C6 . .'),
      bass: bars('G1 . . . . . . . . . . .', 'Eb2 . . . . . . . . . . .', 'C2 . . . . . . . . . . .', 'D2 . . . . . D2 . . D2 . .'),
      drums: 'P.....P.....'.repeat(3) + 'P.PP.PSSSSSS' },
  ] }

/** The Champion's intro: a regal brass fanfare with timpani, then a stately loop in E-flat. */
SONGS.championIntro = { file: null, loop: true, bpm: 100, div: 2, chordLen: 8, vol: 0.88,
  leadInst: 'brass', harmInst: 'brass', comp: false, hats16: false, crash: false, fill: 'TTtt', glock: true,
  intro: { chords: ['Bb', 'Bb'], lead: bars('F4 . Bb4 . D5 . F5 .', 'Bb5 . . . . . . .'), bass: bars('Bb1 . . . . . . .', 'Bb1 . . . . . . .'),
    drums: 'K...T.t.' + 'TtTtTtSS', crash: true, fill: '' },
  sections: [{
    chords: 'Eb Cm Ab Bb Eb Gm Ab Bb'.split(' '),
    lead: bars('G5 . . . Bb5 . Eb6 .', 'Eb6 . . . C6 . G5 .', 'Ab5 . . . C6 . Eb6 .', 'D6 . . . . . Bb5 .',
      'G5 . Bb5 . Eb6 . G6 .', 'F6 . . . D6 . Bb5 .', 'C6 . . . Eb6 . Ab5 .', 'Bb5 . . . F5 . D5 .'),
    bass: bars('Eb2 . . . Bb1 . . .', 'C2 . . . G1 . . .', 'Ab1 . . . Eb2 . . .', 'Bb1 . . . F2 . . .',
      'Eb2 . . . Bb1 . . .', 'G1 . . . D2 . . .', 'Ab1 . . . Eb2 . . .', 'Bb1 . . . Bb1 . D2 .'),
    drums: 'K..hT.h.'.repeat(7) + 'K.TtTtSS' }] }

/**
 * The Champion's battle: F minor at 180 bpm, the biggest piece in the game.
 * A relentless verse, a heroic half-time chorus with the glockenspiel, and
 * the verse again on the synth over the brass.
 */
const CHAMP_A = { chords: 'Fm Db Eb C Fm Db Bbm C'.split(' '), drums: 'KhSKKhSh'.repeat(7) + 'KhSKSSSS',
  lead: bars('F5 . Ab5 C6 . Bb5 Ab5 G5', 'F5 . Db5 . Ab5 . F5 Db5', 'Eb5 . G5 . Bb5 . Ab5 G5', 'G5 . . . E5 . C5 .',
    'C6 . . F6 . Eb6 Db6 C6', 'Db6 . Ab5 . F5 . Ab5 Db6', 'Db6 . Bb5 . F5 . Db6 F6', 'E6 . . . C6 . G5 .'),
  bass: bars('F1 F1 F2 F1 F1 F2 F1 F1', 'Db2 Db2 Db3 Db2 Db2 Db3 Db2 C2', 'Eb2 Eb2 Eb3 Eb2 Eb2 Eb3 Eb2 Eb2', 'C2 C2 C3 C2 C2 C3 Bb1 G1',
    'F1 F1 F2 F1 F1 F2 F1 F1', 'Db2 Db2 Db3 Db2 Db2 Db3 Db2 C2', 'Bb1 Bb1 Bb2 Bb1 Bb1 Bb2 Bb1 Bb1', 'C2 C2 C3 C2 E2 G2 Bb2 C3') }
SONGS.champion = { file: null, loop: true, bpm: 180, div: 2, chordLen: 8, leadInst: 'brass', harmInst: 'strings', comp: true, hats16: true, fill: 'TTtt',
  intro: { chords: ['Fm', 'C'], lead: bars('F5 . - F5 . - Ab5 .', 'G5 . - E5 . - C5 .'), bass: bars('F1 . - F1 . - Ab1 .', 'G1 . - E2 . - C2 .'),
    drums: 'K.K.SKSK' + 'K.KSSSSS', hats16: false, comp: false, fill: '', crash: true },
  sections: [
    { ...CHAMP_A },
    { // Chorus: heroic, half-time
      chords: 'Db Eb Cm Fm Db Eb C C'.split(' '), comp: false, hats16: false, crash: true, glock: true,
      lead: bars('F5 . . . Ab5 . . .', 'G5 . . . Bb5 . . .', 'C6 . . . G5 . Eb5 .', 'F5 . . . . . . .',
        'Ab5 . . . Db6 . F6 .', 'G6 . . . Eb6 . Bb5 .', 'C6 . . . E6 . G6 .', 'C6 . . . - - - -'),
      bass: bars('Db2 . . . Db2 . Ab1 .', 'Eb2 . . . Eb2 . Bb1 .', 'C2 . . . C2 . G1 .', 'F1 . . . F1 . C2 .',
        'Db2 . . . Db2 . Ab1 .', 'Eb2 . . . Eb2 . Bb1 .', 'C2 . . . C2 . G1 .', 'C2 . . . C2 . . .'),
      drums: 'KhhhShhh'.repeat(7) + 'KhhhSSSS' },
    { ...CHAMP_A, leadInst: 'synth', glock: true },
  ] }

/*
 * The Champion's battle, second version (the first is SONGS.championClassic).
 * Dark: F minor, piano-led over the orchestra, the last fight in the game.
 * Written in the manner of a dark piano score the owner shared (none of its
 * notes or progression are used): a piano figure rising over a low pedal, a
 * hammered motif, the harmonic minor's E natural and the Neapolitan G-flat,
 * tremolo strings under the loudest chords, a quiet passage over a churning
 * bass, quick runs ripping up into stabs, and a chromatic slide of chords
 * down to the dominant.
 *   - Intro: the piano rises through the chords over a held low F, choir and
 *     timpani underneath.
 *   - The hammer: the piano and low brass strike one note again and again,
 *     leaning on the semitone above (C and D-flat, A-flat and B-flat...),
 *     strings in tremolo, the bass pounding in octaves.
 *   - The Neapolitan: G-flat major, D-flat, a diminished seventh on E, big
 *     brass lines over the tremolo.
 *   - The storm: hushed, a sixteenth-note bass churning around F with its
 *     leading tone, the piano ripping up into stabs, timpani rolling louder.
 *   - The slide: chords sliding down by semitones (F minor, E, E-flat, D,
 *     D-flat) onto C, over a C pedal, and back to the hammer.
 * 160 bpm, sixteenth-note grid, 16 steps a bar: a 6 s intro, then a long
 * loop (see below).
 */
SONGS.championClassic = SONGS.champion
/** A bar of the hammer: three struck notes, the semitone above held, three more. */
const hammer = (x, up) => `${x}! - ${x}! - ${x}! - ${up} . . . ${x}! - ${x}! - ${x}! -`
/** A bar of pounding bass octaves, in eighths. */
const octs = (n) => { const hi = transpose([n], 12)[0]; return Array(8).fill(0).map((_, k) => (k % 2 ? `${hi} .` : `${n} .`)).join(' ') }
/** A bar of churning sixteenths around a note: its neighbours, down to the leading tone and back. */
const churn = (n) => transpose(Array(16).fill(n), 0).map((x, k) => transpose([x], [0, 2, 3, 2, 0, -1, 0, 2, 3, 5, 3, 2, 0, -1, -4, -1][k])[0]).join(' ')
SONGS.champion = { file: null, loop: true, bpm: 160, div: 4, chordLen: 16, vol: 1.15,
  leadInst: 'piano', leadVel: 1.15, doubles: [['brass', -1, 0.42]], harmInst: 'strings', padInst: 'choir',
  bassInst: 'lowstrings', bassDoubles: [['piano', 1, 0.5]], comp: false, glock: false, hats16: false, power: false, crash: true, fill: '',
  intro: { chords: 'Fm Db Bbm C7'.split(' '), doubles: [], bassDoubles: [], ostinato: '0 - 1 - 2 - 3 - 1 - 2 - 3 - 2 -'.split(' '), ostinatoOct: 0,
    lead: bars('- - - - - - - - - - - - - - - -', '- - - - - - - - - - - - - - - -', '- - - - - - - - - - - - - - - -', '- - - - - - - - E5 . . . G5 . C6 .'),
    bass: bars('F1 . . . . . . . . . . . . . . .', 'F1 . . . . . . . . . . . . . . .', 'F1 . . . . . . . . . . . . . . .', 'C2 . . . . . . . C2 . . . C2 . . .'),
    drums: 'P...............' + 'P...............' + 'P.......P.......' + 'P...P...PPPPSSSS', runs: '. . . f'.split(' ') },
  sections: [
    { // The hammer
      chords: 'Fm Fm Db Db Bbm C7 Fm C7'.split(' '), trem: '. . x x x x . x'.split(' '), runs: '. . . f . . . f'.split(' '),
      lead: bars(hammer('C5', 'Db5'), hammer('C5', 'Db5'), hammer('Ab4', 'Bb4'), 'Ab5! - Ab5! - F5! - Db5 . . . F5! - Ab5! - C6! -',
        hammer('F5', 'Gb5'), hammer('E5', 'F5'), 'F5! - Ab5! - C6! - F6 . . . Eb6! - C6! - Ab5! -', 'G5 . . . E5 . . . C5 . . . Bb4 . . .'),
      bass: bars(octs('F1'), octs('F1'), octs('Db2'), octs('Db2'), octs('Bb1'), octs('C2'), octs('F1'), octs('C2')),
      drums: 'K.h.S.h.K.h.S.hK'.repeat(7) + 'K.h.S.h.SSSSPPPP' },
    { // The Neapolitan: G-flat, D-flat, a diminished seventh on E
      chords: 'Gb Gb Db C7 Fm Gb Edim7 C7'.split(' '), trem: 'x x x x x x x x'.split(' '), runs: '. . . f . . . f'.split(' '), doubles: [['brass', -1, 0.5], ['violins', 1, 0.3]],
      lead: bars('Gb5^ . . . . . . . Bb5 . . . Db6 . . .', 'Gb6 . . . Db6 . . . Bb5 . . . Gb5 . . .', 'Ab5 . . . . . F5 . Db5 . . . F5 . Ab5 .', 'G5~ . . . . . . . E5 . . . Bb5 . . .',
        'C6 . . . . . Ab5 . F5 . . . Ab5 . C6 .', 'Db6 . . . . . Bb5 . Gb5 . . . Bb5 . Db6 .', 'Db6 . . . Bb5 . . . G5 . . . E5 . . .', 'C6 . . . . . . . - - - - - - - -'),
      bass: bars('Gb1 . . . . . . . Gb1 . . . Gb2 . . .', 'Gb1 . . . . . . . Gb1 . . . Db2 . . .', 'Db2 . . . . . . . Db2 . . . Ab1 . . .', 'C2 . . . . . . . C2 . . . G1 . . .',
        'F1 . . . . . . . F1 . . . C2 . . .', 'Gb1 . . . . . . . Gb1 . . . Db2 . . .', 'E1 . . . . . . . E1 . . . G1 . . .', 'C2 . . . . . . . C2 . C2 . C2 . C2 .'),
      drums: 'K.......S.......'.repeat(3) + 'K...S...P.P.P.P.' + 'K.......S.......'.repeat(3) + 'PPPPPPPPSSSSSSSS' },
    { // The storm: hushed, churning bass, the piano ripping up into stabs
      chords: 'Fm Fm Db Db Bbm Bbm C7 C7'.split(' '), doubles: [], bassDoubles: [['piano', 1, 0.35]], padInst: 'strings', crash: false, runs: '. f . f . f . f'.split(' '), leadVel: 0.95,
      lead: bars('- - - - - - - - - - - - - - - -', 'F6! - - - - - - - - - - - C6! - - -', '- - - - - - - - - - - - - - - -', 'F6! - - - - - - - - - - - Ab6! - - -',
        '- - - - - - - - - - - - - - - -', 'F6! - - - - - - - - - - - Db6! - - -', '- - - - - - - - - - - - - - - -', 'E6! - - - G6! - - - Bb6! - - - C7! - - -'),
      bass: bars(churn('F2'), churn('F2'), churn('Db2'), churn('Db2'), churn('Bb1'), churn('Bb1'), churn('C2'), churn('C2')),
      drums: 'P...............'.repeat(4) + 'P.......P.......'.repeat(2) + 'P...P...P...P...' + 'PPPPPPPPSSSSSSSS' },
    { // The slide: chords sliding down by semitones over a C pedal, onto C
      chordLen: 8, chords: 'Fm E Eb D Db C C7 C7'.split(' '), trem: 'x x x x'.split(' '), doubles: [['brass', -1, 0.5], ['violins', 1, 0.3]],
      lead: bars('F6 . . . . . . . E6 . . . . . . .', 'Eb6 . . . . . . . D6 . . . . . . .', 'Db6 . . . . . . . C6 . . . . . . .', 'C6~ . . . . . . . . . . . - - - -'),
      bass: bars(octs('C2'), octs('C2'), octs('C2'), 'C2 . . . . . . . C2 . . . . . . .'),
      drums: 'K.h.S.h.K.h.S.hK'.repeat(3) + 'K...S...SSSSPPPP' },
  ] }

/*
 * The rival's first battle (SONGS.rival2 and rival3, below, are the second
 * and the last), and a serious one.
 * The rival who was all swagger in their encounter music (SONGS.rivalTalk)
 * means it now. E minor, so it takes over from that tune's closing B7.
 * Written to sound unlike the other battles: the Gym has the 3+3+2 drive
 * and the Champion the piano; this one is a double kick and a palm-muted
 * guitar chugging an eighth and two sixteenths (straight time, unlike the
 * Elite Four's 12/8 gallop), the rival's own four notes from their encounter tune
 * (E, G, F-sharp, E) made dark, and the Phrygian F major (a semitone above
 * the key) for menace.
 *   - Intro: the four notes, low and in unison, brass over cellos and basses,
 *     the drums gathering, a timpani roll onto B7.
 *   - Verse: the chug under everything, the motif on brass and violins in
 *     unison, through C, A minor and B, then the F major and B7.
 *   - Chorus: long climbing lines over a straight rock beat and pounding
 *     octaves, the strings in tremolo as it peaks.
 *   - Breakdown: half time and hushed: tubular bells toll the motif slowly
 *     over cellos and basses, tremolo strings creep in, a snare roll builds.
 *   - The verse again, led by the rival's synth (their instrument in the
 *     encounter music), low brass under it and horn stabs, back to the top.
 * 168 bpm, sixteenth-note grid, 16 steps a bar: a 6 s intro, then a 46 s loop.
 */
/** A bar of the chug on one note: an eighth and two sixteenths, four times (straight time, not the Elite Four's 12/8 gallop). */
const chug = (n) => `${n} . ${n} ${n} `.repeat(4).trim()
const RIVAL_CHUG = 'KhKKShKKKhKKShKK'
const RIVAL_VERSE = {
  chords: 'Em C Am B Em C F B7'.split(' '),
  lead: bars('E5^ . . . . . G5 . F#5 . E5 . B4 . . .', 'C5 . . . E5 . G5 . C6 . . . B5 . G5 .',
    'A5 . . . . . G5 . E5 . . . C5 . E5 .', 'D#5 . . . F#5 . . . B5 . . . A5 . F#5 .',
    'E6^ . . . . . D6 . B5 . . . G5 . B5 .', 'C6 . . . B5 . G5 . E5 . . . G5 . C6 .',
    'F6 . . . E6 . C6 . A5 . . . F5 . A5 .', 'D#6~ . . . . . . . B5 . A5 . F#5 . D#5 .'),
  bass: bars(chug('E2'), chug('C2'), chug('A1'), chug('B1'), chug('E2'), chug('C2'), chug('F2'), chug('B1')),
  drums: RIVAL_CHUG.repeat(7) + 'KhKKShKKTTttSSSS' }
SONGS.rival = { file: null, loop: true, bpm: 168, div: 4, chordLen: 16, vol: 0.9,
  leadInst: 'brass', doubles: [['violins', 0, 0.3]], harmInst: 'strings', power: true, comp: false, glock: false, hats16: false, crash: true, fill: '',
  intro: { chords: 'Em Em F B7'.split(' '), doubles: [['lowstrings', -1, 0.6]], power: false,
    lead: bars('E4! - E4! - E4! - G4 . F#4 . . . E4 . D#4 .', 'E4! - E4! - E4! - B4 . C5 . . . B4 . A4 .',
      'F4 . . . . . . . A4 . . . C5 . F5 .', 'D#5 . . . . . . . F#5 . A5 . B5 . D#5 .'),
    bass: bars('E1 . . . . . . . . . . . . . . .', 'E1 . . . . . . . . . . . . . . .', chug('F2'), chug('B1')),
    drums: 'K.......K...S...' + 'K.......K..KS.SS' + RIVAL_CHUG + 'PPPPPPPPSSSSSSSS' },
  sections: [
    { ...RIVAL_VERSE },
    { // Chorus: long climbing lines, straight rock, pounding octaves, tremolo as it peaks
      chords: 'Am D G Em C D B7 B7'.split(' '), doubles: [['violins', 0, 0.32], ['brass', -1, 0.4]], trem: '. . . . x x x x'.split(' '),
      lead: bars('A5 . . . . . . . C6 . . . E6 . . .', 'F#6 . . . . . E6 . D6 . . . A5 . . .',
        'B5 . . . . . . . D6 . . . G6 . . .', 'G6 . . . F#6 . E6 . B5 . . . . . . .',
        'C6 . . . . . . . E6 . . . G6 . . .', 'A6 . . . . . G6 . F#6 . . . D6 . . .',
        'D#6^ . . . . . . . F#6 . . . A6 . G6 F#6', 'F#6~ . . . . . . . . . . . - - - -'),
      bass: bars(octs('A1'), octs('D2'), octs('G1'), octs('E2'), octs('C2'), octs('D2'), octs('B1'), octs('B1')),
      drums: 'K.h.S.h.K.hKS.h.'.repeat(7) + 'K.h.S.h.TTttSSSS' },
    { // Breakdown: half time and hushed, bells tolling the motif, tremolo creeping in, a snare roll
      chords: 'Em Em C C Am Am B B'.split(' '), leadInst: 'bells', leadVel: 1.1, doubles: [], bassInst: 'lowstrings',
      power: false, crash: false, trem: '. . . . x x x x'.split(' '),
      lead: bars('E5 . . . . . . . G5 . . . . . . .', 'F#5 . . . . . . . E5 . . . . . . .',
        'C5 . . . . . . . E5 . . . . . . .', 'G5 . . . . . . . E5 . . . . . . .',
        'A5 . . . . . . . C6 . . . . . . .', 'B5 . . . . . . . A5 . . . . . . .',
        'F#5 . . . . . . . A5 . . . . . . .', 'B5 . . . D#6 . . . F#6 . . . A6 . . .'),
      bass: bars(octs('E1'), octs('E1'), octs('C2'), octs('C2'), octs('A1'), octs('A1'), octs('B1'), octs('B1')),
      drums: 'K.h.h.h.S.h.h.h.'.repeat(6) + 'K.h.S.h.K.hKS.SS' + 'S.S.S.S.SSSSSSSS' },
    { // The verse again, on the rival's synth, low brass under it and horn stabs
      ...RIVAL_VERSE, leadInst: 'synth', doubles: [['brass', -1, 0.45]], stabs: 'x.....x.....x...',
      drums: RIVAL_CHUG.repeat(7) + 'KhKKShKKPPPPSSSS' },
  ] }

/*
 * The rival's second battle: the first one's music, grown darker. Same key,
 * same chug, the same chorus shape, but something has gone wrong with it.
 *   - The motif is corrupted: E, G, F-sharp, E becomes E, G, F, E, the
 *     semitone above the key where the first theme only visited it.
 *   - The harmony leans on the tritone: B-flat major and D minor take the
 *     places of the first theme's B and D major.
 *   - Intro: the bells that tolled in the first theme's breakdown open this
 *     one, over low brass and basses, then hammered hits onto the tritone.
 *   - Verse: the first verse with the corrupted motif and B-flat under it;
 *     its second half is the first verse's, note for note.
 *   - Chorus: the first chorus's climbing lines, reharmonised in minor
 *     (D minor, B-flat), a choir under it and the strings in tremolo throughout.
 *   - The descent: new. The bass falls by semitones from E to B (E, D-sharp,
 *     D, C-sharp, C) under an organ and the choir singing the motif, half
 *     time, timpani on the downbeats.
 *   - The corrupted verse once more on the rival's synth, with violins,
 *     low brass and horn stabs, back to the top.
 * 160 bpm, sixteenth-note grid, 16 steps a bar: a 6 s intro, then a 48 s loop.
 */
const RIVAL2_VERSE = {
  chords: 'Em F Em Bb Em C F B7'.split(' '),
  lead: [...bars('E5^ . . . . . G5 . F5 . E5 . B4 . . .', 'C5 . . . F5 . A5 . C6 . . . B5 . A5 .',
    'G5 . . . . . F#5 . E5 . . . B4 . E5 .', 'F5 . . . D5 . . . Bb4 . . . D5 . F5 .'), ...RIVAL_VERSE.lead.slice(64)],
  bass: bars(chug('E2'), chug('F2'), chug('E2'), chug('Bb1'), chug('E2'), chug('C2'), chug('F2'), chug('B1')),
  drums: RIVAL_CHUG.repeat(7) + 'KhKKShKKTTttSSSS' }
SONGS.rival2 = { file: null, loop: true, bpm: 160, div: 4, chordLen: 16, vol: 0.9,
  leadInst: 'brass', doubles: [['violins', 0, 0.3], ['brass', -1, 0.4]], harmInst: 'strings', padInst: 'choir', power: true,
  comp: false, glock: false, hats16: false, crash: true, fill: '',
  intro: { chords: 'Em F Em B7'.split(' '), doubles: [['lowstrings', -1, 0.6], ['bells', 1, 0.35]], power: false,
    lead: bars('E4 . . . . . . . G4 . . . . . . .', 'F4 . . . . . . . E4 . . . . . . .',
      'E4! - E4! - F4! - E4! - Bb4 . . . . . . .', 'B4~ . . . . . . . D#5 . F#5 . A5 . D#5 .'),
    bass: bars('E1 . . . . . . . . . . . . . . .', 'F1 . . . . . . . . . . . . . . .', 'E1 . . . . . . . . . . . . . . .', chug('B1')),
    drums: 'P...............' + 'P...............' + 'K.K.K.K.P.......' + 'PPPPPPPPSSSSSSSS' },
  sections: [
    { ...RIVAL2_VERSE },
    { // Chorus: the first chorus's lines, in minor, choir and tremolo throughout
      chords: 'Am Dm Bb Em C Bb B7 B7'.split(' '), trem: 'x x x x x x x x'.split(' '),
      lead: bars('A5 . . . . . . . C6 . . . E6 . . .', 'F6 . . . . . E6 . D6 . . . A5 . . .',
        'Bb5 . . . . . . . D6 . . . F6 . . .', 'G6 . . . F#6 . E6 . B5 . . . . . . .',
        'C6 . . . . . . . E6 . . . G6 . . .', 'F6 . . . . . D6 . Bb5 . . . F5 . . .',
        'D#6^ . . . . . . . F#6 . . . A6 . G6 F#6', 'F#6~ . . . . . . . . . . . - - - -'),
      bass: bars(octs('A1'), octs('D2'), octs('Bb1'), octs('E2'), octs('C2'), octs('Bb1'), octs('B1'), octs('B1')),
      drums: 'K.h.S.h.K.hKS.h.'.repeat(7) + 'K.h.S.h.TTttSSSS' },
    { // The descent: the bass falling by semitones, organ and choir singing the motif, half time, timpani
      chords: 'Em B Em C#dim C C B7 B7'.split(' '), leadInst: 'organ', leadVel: 1.1, doubles: [['choir', 0, 0.55]], padInst: 'strings',
      bassInst: 'lowstrings', power: false,
      lead: bars('E5 . . . . . . . G5 . . . . . . .', 'F#5 . . . . . . . D#5 . . . . . . .',
        'E5 . . . . . . . B4 . . . . . . .', 'E5 . . . . . . . G5 . . . . . . .',
        'G5 . . . . . . . E5 . . . . . . .', 'C6 . . . . . . . B5 . . . A5 . G5 .',
        'F#5 . . . . . . . A5 . . . . . . .', 'B5 . . . . . . . - - - - - - - -'),
      bass: bars('E2 . . . . . . . . . . . . . . .', 'D#2 . . . . . . . . . . . . . . .', 'D2 . . . . . . . . . . . . . . .',
        'C#2 . . . . . . . . . . . . . . .', 'C2 . . . . . . . . . . . . . . .', 'C2 . . . . . . . C2 . . . C2 . . .',
        'B1 . . . . . . . . . . . . . . .', 'B1 . . . . . . . B1 . B1 . B1 . B1 .'),
      drums: 'P.......S.......' + 'K.......S.......'.repeat(5) + 'P.......P.......' + 'PPPPPPPPSSSSSSSS' },
    { // The corrupted verse once more, on the rival's synth, violins and low brass with it, horn stabs
      ...RIVAL2_VERSE, leadInst: 'synth', doubles: [['brass', -1, 0.45], ['violins', 0, 0.25]], stabs: 'x.....x.....x...',
      drums: RIVAL_CHUG.repeat(7) + 'KhKKShKKPPPPSSSS' },
  ] }

/*
 * The rival's last battle. The first theme was the rival serious, the second
 * the same music gone wrong (the motif corrupted, F for F-sharp); this one
 * settles it. It begins in the old darkness, puts the motif right, and at its
 * height turns to E major for the first time: E, G-sharp, F-sharp, E, the
 * rival's four notes as a salute.
 *   - Intro: the corrupted motif on the bells, answered by the true one, then
 *     the first theme's hammered unison and a run up B7.
 *   - The duel: the first theme's verse with everything: brass and violins,
 *     low brass, the guitar's chug, a choir, tremolo as it turns to B7.
 *   - The first theme's chorus in full, tremolo throughout and a choir.
 *   - The reckoning: new, in E major. The motif in major over E, B, C-sharp
 *     minor and A, climbing to A6 and settling onto B7.
 *   - The last stand: the bass climbs by semitones from B to E (the second
 *     theme's descent turned round), the motif hammered a step higher each
 *     bar, timpani rolling into B7 and back to the duel.
 * 172 bpm, sixteenth-note grid, 16 steps a bar: a 6 s intro, then a 45 s loop.
 */
SONGS.rival3 = { file: null, loop: true, bpm: 172, div: 4, chordLen: 16, vol: 0.9,
  leadInst: 'brass', doubles: [['violins', 0, 0.3], ['brass', -1, 0.42]], harmInst: 'strings', padInst: 'choir', power: true,
  comp: false, glock: false, hats16: false, crash: true, fill: '',
  intro: { chords: 'Em Em Em B7'.split(' '), leadInst: 'bells', leadVel: 1.1, doubles: [['lowstrings', -2, 0.5]], power: false,
    lead: bars('E5 . . . G5 . . . F5 . . . E5 . . .', 'E5 . . . G5 . . . F#5 . . . E5 . . .',
      'E4! - E4! - E4! - G4 . F#4 . . . E4 . D#4 .', 'B4 . D#5 . F#5 . A5 . B5 . D#6 . F#6 . A6 .'),
    bass: bars('E1 . . . . . . . . . . . . . . .', 'E1 . . . . . . . . . . . . . . .', chug('E2'), chug('B1')),
    drums: 'P.......P.......' + 'P.......P.......' + RIVAL_CHUG + 'PPPPPPPPSSSSSSSS' },
  sections: [
    { ...RIVAL_VERSE, trem: '. . . . . . x x'.split(' ') },   // the duel
    { ...SONGS.rival.sections[1], doubles: [['violins', 0, 0.32], ['brass', -1, 0.42]], trem: 'x x x x x x x x'.split(' ') },   // the first chorus, in full
    { // The reckoning: the motif in E major, at last
      chords: 'E B C#m A E B A B7'.split(' '), trem: 'x x x x x x x x'.split(' '), doubles: [['violins', 0, 0.32], ['brass', -1, 0.45], ['bells', 0, 0.2]],
      lead: bars('E5^ . . . . . G#5 . F#5 . E5 . B4 . . .', 'D#5 . . . F#5 . B5 . D#6 . . . C#6 . B5 .',
        'C#6 . . . . . B5 . G#5 . . . E5 . G#5 .', 'A5 . . . . . . . C#6 . . . E6 . . .',
        'E6^ . . . . . D#6 . B5 . . . G#5 . B5 .', 'B5 . . . A5 . G#5 . F#5 . . . D#5 . F#5 .',
        'A5 . . . C#6 . E6 . A6 . . . G#6 . F#6 .', 'F#6~ . . . . . . . D#6 . B5 . A5 . F#5 .'),
      bass: bars(octs('E2'), octs('B1'), octs('C#2'), octs('A1'), octs('E2'), octs('B1'), octs('A1'), octs('B1')),
      drums: 'K.h.S.h.K.hKS.h.'.repeat(7) + 'K.h.S.h.TTttSSSS' },
    { // The last stand: the bass climbing from B to E, the motif hammered higher each bar
      chords: 'B C A D B Em B7 B7'.split(' '), doubles: [['brass', -1, 0.45], ['violins', 1, 0.22]], trem: '. . . . x x x x'.split(' '),
      lead: bars(hammer('B4', 'C5'), hammer('C5', 'D5'), hammer('C#5', 'E5'), hammer('D5', 'F#5'), hammer('D#5', 'F#5'), hammer('E5', 'G5'),
        'F#5 . . . A5 . . . B5 . . . D#6 . . .', 'F#6~ . . . . . . . . . . . - - - -'),
      bass: bars(chug('B1'), chug('C2'), chug('C#2'), chug('D2'), chug('D#2'), chug('E2'), chug('B1'), 'B1 . . . . . . . B1 . B1 . B1 . B1 .'),
      drums: RIVAL_CHUG.repeat(5) + 'KhKKShKKP.P.P.P.' + RIVAL_CHUG + 'PPPPPPPPSSSSSSSS' },
  ] }

/*
 * The Kanto Elite Four's battle. Unlike the others: violins lead (doubled by
 * low brass) over an organ, and the bass and kick push a 3-3-3-3-2-2
 * syncopation (the gym theme's is 3+3+2, the Johto Elite Four's a 12/8
 * gallop). B minor, a lift into D major, a hushed breakdown with bells.
 * 172 bpm, sixteenth-note grid: a 3 s intro, then a 34 s loop.
 */
/** A bar of the 3-3-3-3-2-2 push on one bass note, the last of it up the octave. */
const push = (n) => { const hi = transpose([n], 12)[0]; return `${n} . . ${n} . . ${n} . . ${n} . . ${n} . ${hi} .` }
const KE4_PUSH = 'K.hKS.KhhKh.ShKh'
SONGS.kantoElite = { file: null, loop: true, bpm: 172, div: 4, chordLen: 16, vol: 1.1,
  leadInst: 'violins', leadVel: 1.05, doubles: [['brass', -1, 0.45]], harmInst: 'brass', padInst: 'organ', bassInst: 'lowstrings',
  comp: false, glock: false, hats16: false, crash: true, fill: '',
  intro: { chords: 'Bm F#'.split(' '), doubles: [['brass', -1, 0.45], ['bells', 0, 0.2]],
    lead: bars('B4 . D5 . F#5 . B5 . D6 . F#6 . B6 . . .', 'A#6~ . . . . . . . F#6 . C#6 . A#5 . F#5 .'),
    bass: bars('B1 . . . . . . . . . . . . . . .', 'F#1 . . . . . . . . . . . . . . .'),
    drums: 'P.......P.P.P.P.' + 'PPPPPPPPSSSSSSSS' },
  sections: [
    { // The verse: B minor over the push
      chords: 'Bm G Em F# Bm G A F#7'.split(' '), power: true,
      lead: bars('B5^ . . . . . F#5 . D6 . . . C#6 . B5 .', 'G5 . . . . . B5 . D6 . . . G6 . F#6 .',
        'E6 . . . D6 . B5 . G5 . . . E5 . G5 .', 'F#5 . . . A#5 . . . C#6 . . . E6 . C#6 .',
        'B5 . . . D6 . F#6 . B6 . . . A6 . F#6 .', 'G6 . . . F#6 . E6 . D6 . . . B5 . D6 .',
        'C#6 . . . E6 . . . A6 . . . G6 . E6 .', 'F#6~ . . . . . . . E6 . C#6 . A#5 . F#5 .'),
      bass: bars(push('B1'), push('G1'), push('E2'), push('F#1'), push('B1'), push('G1'), push('A1'), push('F#1')),
      drums: KE4_PUSH.repeat(7) + 'K.hKS.KhTTttSSSS' },
    { // The lift: D major, long lines, the strings shaking under the second half
      chords: 'D A Bm G D A G F#'.split(' '), trem: '. . . . x x x x'.split(' '), power: true,
      lead: bars('F#6 . . . . . . . E6 . D6 . A5 . . .', 'C#6 . . . . . . . E6 . . . A6 . . .',
        'F#6 . . . . . E6 . D6 . . . B5 . . .', 'D6 . . . . . . . G6 . F#6 . E6 . D6 .',
        'A6 . . . . . F#6 . D6 . . . F#6 . A6 .', 'E6 . . . . . C#6 . A5 . . . C#6 . E6 .',
        'D6 . . . B5 . . . G5 . . . B5 . D6 .', 'C#6~ . . . . . . . A#5 . F#5 . C#5 . E5 .'),
      bass: bars(octs('D2'), octs('A1'), octs('B1'), octs('G1'), octs('D2'), octs('A1'), octs('G1'), octs('F#1')),
      drums: 'K.h.S.h.K.hKS.h.'.repeat(7) + 'K.h.S.h.TTttSSSS' },
    { // The breakdown: half time, bells tolling over the organ, tremolo creeping in
      chords: 'Em Em Bm Bm G G F# F#'.split(' '), leadInst: 'bells', leadVel: 1.1, doubles: [], crash: false, trem: '. . . . x x x x'.split(' '),
      lead: bars('E5 . . . . . . . G5 . . . . . . .', 'F#5 . . . . . . . B4 . . . . . . .',
        'D5 . . . . . . . F#5 . . . . . . .', 'B5 . . . . . . . A5 . . . . . . .',
        'G5 . . . . . . . B5 . . . . . . .', 'D6 . . . . . . . C#6 . . . . . . .',
        'A#5 . . . . . . . C#6 . . . . . . .', 'F#6 . . . E6 . . . C#6 . . . A#5 . . .'),
      bass: bars('E2 . . . . . . . E2 . . . . . . .', 'E2 . . . . . . . E2 . . . . . . .', 'B1 . . . . . . . B1 . . . . . . .', 'B1 . . . . . . . B1 . . . . . . .',
        'G1 . . . . . . . G1 . . . . . . .', 'G1 . . . . . . . G1 . . . . . . .', 'F#1 . . . . . . . F#1 . . . . . . .', 'F#1 . . . F#1 . . . F#1 . F#1 . F#1 . F#1 .'),
      drums: 'K.......S.......'.repeat(6) + 'K.K.S.K.KKS.SSSS' + 'PPPPPPPPSSSSSSSS' },
  ] }

/*
 * Red's battle, at the top of Mt. Silver: the last trainer in the game. A
 * choir leads (no other battle has one in front), doubled by low brass and
 * violins, over the guitar and octave bass. C-sharp minor, the fastest
 * battle in the game, with a heroic E major middle and a hushed summit.
 *   - Intro: under Red's silence, lone bells and timpani, the bass a pedal.
 *   - The climb: C-sharp minor, the choir over the guitar's eighths.
 *   - The legend: E major, long lines, crash on every section.
 *   - The summit: bells over tremolo strings, half time, building to a roll.
 * 184 bpm, sixteenth-note grid, 16 steps a bar: a 5 s intro, then a 42 s loop.
 */
const RED_DRIVE = 'KhhKShhKKhhKShhK'
const RED_CLIMB = {
  chords: 'C#m A F#m G# C#m E B G#7'.split(' '),
  lead: bars('C#6^ . . . . . . . G#5 . . . C#6 . E6 .', 'E6 . . . D#6 . C#6 . B5 . . . A5 . . .',
    'A5 . . . . . . . F#5 . . . A5 . C#6 .', 'B#5 . . . . . . . D#6 . . . G#6 . . .',
    'G#6 . . . . . F#6 . E6 . . . C#6 . E6 .', 'G#6 . . . . . . . B5 . . . E6 . G#6 .',
    'F#6 . . . . . E6 . D#6 . . . B5 . D#6 .', 'B#5~ . . . . . . . G#5 . . . D#5 . F#5 .'),
  bass: bars(octs('C#2'), octs('A1'), octs('F#1'), octs('G#1'), octs('C#2'), octs('E2'), octs('B1'), octs('G#1')),
  drums: RED_DRIVE.repeat(7) + 'KhhKShhKTTttSSSS' }
SONGS.red = { file: null, loop: true, bpm: 184, div: 4, chordLen: 16, vol: 0.9,
  leadInst: 'choir', leadVel: 1.2, leadOct: -1, doubles: [['brass', -1, 0.45], ['violins', 0, 0.25]], harmInst: 'strings', power: true,
  comp: false, glock: false, hats16: false, crash: true, fill: '',
  intro: { chords: 'C#m C#m A G#'.split(' '), leadInst: 'bells', leadVel: 1.1, leadOct: 0, doubles: [['lowstrings', -1, 0.5]], power: false, crash: false,
    lead: bars('C#5 . . . . . . . . . . . G#4 . . .', 'C#5 . . . . . . . E5 . . . D#5 . . .', 'C#5 . . . . . . . B4 . . . A4 . . .', 'G#4~ . . . . . . . . . . . - - - -'),
    bass: bars('C#1 . . . . . . . . . . . . . . .', 'C#1 . . . . . . . . . . . . . . .', 'A1 . . . . . . . . . . . . . . .', 'G#1 . . . . . . . . . . . . . . .'),
    drums: 'P...............' + 'P.......P.......' + 'P...P...P...P...' + 'PPPPPPPPSSSSSSSS' },
  sections: [
    { ...RED_CLIMB },
    { // The legend: E major, long lines
      chords: 'E B C#m A E B A B'.split(' '), trem: '. . . . x x x x'.split(' '),
      lead: bars('B5 . . . . . . . E6 . . . G#6 . . .', 'F#6 . . . . . D#6 . B5 . . . . . . .',
        'C#6 . . . . . E6 . G#6 . . . . . . .', 'A6 . . . G#6 . F#6 . E6 . . . C#6 . . .',
        'E6 . . . . . G#6 . B6 . . . . . . .', 'A6 . . . . . F#6 . D#6 . . . B5 . . .',
        'C#6 . . . E6 . . . A6 . . . G#6 . F#6 .', 'G#6~ . . . . . . . F#6 . . . D#6 . B5 .'),
      bass: bars(octs('E2'), octs('B1'), octs('C#2'), octs('A1'), octs('E2'), octs('B1'), octs('A1'), octs('B1')),
      drums: 'K.h.S.h.K.hKS.h.'.repeat(7) + 'K.h.S.h.TTttSSSS' },
    { // The summit: bells over tremolo strings, half time, building to a roll
      chords: 'A A B B C#m C#m G# G#'.split(' '), leadInst: 'bells', leadVel: 1.1, leadOct: 0, doubles: [], power: false, crash: false, bassInst: 'lowstrings',
      trem: '. . x x x x x x'.split(' '),
      lead: bars('E5 . . . . . . . C#5 . . . . . . .', 'A4 . . . . . . . E5 . . . . . . .',
        'F#5 . . . . . . . D#5 . . . . . . .', 'B4 . . . . . . . F#5 . . . . . . .',
        'G#5 . . . . . . . E5 . . . . . . .', 'C#6 . . . . . . . B5 . . . . . . .',
        'B#5 . . . . . . . G#5 . . . . . . .', 'D#6 . . . F#6 . . . G#6 . . . B#6 . . .'),
      bass: bars('A1 . . . . . . . A1 . . . . . . .', 'A1 . . . . . . . A1 . . . . . . .', 'B1 . . . . . . . B1 . . . . . . .', 'B1 . . . . . . . B1 . . . . . . .',
        'C#2 . . . . . . . C#2 . . . . . . .', 'C#2 . . . . . . . C#2 . . . . . . .', 'G#1 . . . . . . . G#1 . . . . . . .', 'G#1 . . . G#1 . . . G#1 . G#1 . G#1 . G#1 .'),
      drums: 'K.......S.......'.repeat(5) + 'K...S...K...S...' + 'K.S.K.S.KKSSKKSS' + 'PPPPPPPPSSSSSSSS' },
    { ...RED_CLIMB, stabs: 'x.....x.....x...', doubles: [['brass', -1, 0.5], ['violins', 0, 0.3]] },   // the climb again, horns stabbing under it
  ] }

/*
 * The Champion's battle runs long, so the loop does too: after the four
 * sections above, six more develop the same material before it all comes
 * round again (about 1:48 a loop):
 *   - the hammer a half step higher, F-sharp minor, a tritone jolt away from
 *     the C before it, slipping back down to C7;
 *   - a lament: half-time, a mournful piano and violin line over a bass
 *     falling F, E-flat, D-flat, C, with choir and low timpani, turning to F7;
 *   - a chase in B-flat minor: hammered staccato arpeggios over piano runs
 *     every bar, tremolo, the drums driving;
 *   - the storm again, now with a long dark melody over the churning bass;
 *   - a climax: fortissimo, D-flat, G-flat, the diminished seventh on E,
 *     brass and violins over tremolo and rising piano runs;
 *   - the slide again, down onto C and back to the top.
 */
{
  const [HAMMER, , STORM, SLIDE] = SONGS.champion.sections
  SONGS.champion.sections.push(
    { // The hammer, a half step up (F-sharp minor), slipping back to C7
      ...HAMMER, trem: 'x x x x x x x x'.split(' '), doubles: [['brass', -1, 0.5], ['violins', 1, 0.28]],
      chords: [...transposeChords(HAMMER.chords.slice(0, 7), 1), 'C7'],
      lead: [...transpose(HAMMER.lead.slice(0, 112), 1), ...HAMMER.lead.slice(112)],
      bass: [...transpose(HAMMER.bass.slice(0, 112), 1), ...HAMMER.bass.slice(112)] },
    { // The lament: half-time, piano and violins together over a falling bass
      chords: 'Fm Eb Db C Fm Eb Db F7'.split(' '), doubles: [['violins', 0, 0.32]], leadVel: 1, crash: true,
      lead: bars('C6 . . . . . . . Ab5 . . . . . . .', 'G5 . . . . . . . Bb5 . . . . . . .', 'Ab5 . . . . . F5 . . . . . Db5 . . .', 'E5~ . . . . . . . G5 . . . C6 . . .',
        'F6 . . . . . . . C6 . . . Ab5 . . .', 'Bb5 . . . . . . . G5 . . . Eb5 . . .', 'F5 . . . . . Ab5 . . . . . Db6 . . .', 'A5 . . . . . . . . . . . Eb6 . . .'),
      bass: bars('F1 . . . . . . . . . . . C2 . . .', 'Eb1 . . . . . . . . . . . Bb1 . . .', 'Db1 . . . . . . . . . . . Ab1 . . .', 'C1 . . . . . . . . . . . G1 . . .',
        'F1 . . . . . . . . . . . C2 . . .', 'Eb1 . . . . . . . . . . . Bb1 . . .', 'Db1 . . . . . . . . . . . Ab1 . . .', 'F1 . . . . . . . . . . . C2 . . .'),
      drums: 'P.......S.......'.repeat(7) + 'P.......SSSSPPPP' },
    { // The chase: B-flat minor, staccato arpeggios over runs every bar
      chords: 'Bbm Bbm Gb Gb Ebm Ebm C7 C7'.split(' '), runs: 'u d u d u d u f'.split(' '), trem: '. . x x . . x x'.split(' '), doubles: [['brass', -1, 0.42]],
      lead: bars('F5! - Db5! - Bb4! - Db5! - F5! - Bb5! - Db6! - Bb5! -', 'Db6! - F6! - Db6! - Bb5! - F5! - Bb5! - Db6! - F6! -',
        'Gb5! - Bb5! - Db6! - Bb5! - Gb5! - Db5! - Gb5! - Bb5! -', 'Db6 . . . . . . . Bb5 . . . Gb5 . . .',
        'Eb5! - Gb5! - Bb5! - Gb5! - Eb6! - Bb5! - Gb5! - Bb5! -', 'Gb6 . . . . . . . Eb6 . . . Bb5 . . .',
        'E5! - G5! - Bb5! - C6! - E6! - C6! - Bb5! - G5! -', 'C6~ . . . . . . . . . . . - - - -'),
      bass: bars(octs('Bb1'), octs('Bb1'), octs('Gb1'), octs('Gb1'), octs('Eb1'), octs('Eb1'), octs('C2'), octs('C2')),
      drums: 'K.h.S.hKK.h.S.hK'.repeat(7) + 'K.h.SSSSPPPPSSSS' },
    { // The storm again, with a melody over the churning bass
      ...STORM, doubles: [['violins', 0, 0.3]], leadVel: 1,
      lead: bars('Ab5 . . . . . . . C6 . . . . . . .', 'F6 . . . . . Eb6 . C6 . . . Ab5 . . .', 'Ab5 . . . . . . . F5 . . . . . . .', 'Db6 . . . . . C6 . Ab5 . . . F5 . . .',
        'F5 . . . . . . . Bb5 . . . . . . .', 'Db6 . . . . . C6 . Bb5 . . . F5 . . .', 'E5 . . . . . . . G5 . . . Bb5 . . .', 'C6~ . . . . . . . E6 . . . G6 . . .') },
    { // The climax: fortissimo, D-flat, G-flat, the diminished seventh on E
      chords: 'Db Gb Edim7 C7 Db Gb Bbm C7'.split(' '), trem: 'x x x x x x x x'.split(' '), runs: 'u . u . u . u f'.split(' '), doubles: [['brass', -1, 0.55], ['violins', 0, 0.32]], crash: true,
      lead: bars('F6^ . . . . . . . Db6 . . . Ab5 . . .', 'Gb6 . . . . . . . Db6 . . . Bb5 . . .', 'G6 . . . . . . . E6 . . . Db6 . . .', 'E6~ . . . . . . . C6 . . . G5 . . .',
        'Ab6 . . . . . . . F6 . . . Db6 . . .', 'Bb6 . . . . . . . Gb6 . . . Db6 . . .', 'Db7 . . . . . . . Bb6 . . . F6 . . .', 'C7 . . . . . . . . . . . - - - -'),
      bass: bars(octs('Db2'), octs('Gb1'), octs('E1'), octs('C2'), octs('Db2'), octs('Gb1'), octs('Bb1'), octs('C2')),
      drums: 'K.h.S.h.K.h.S.hK'.repeat(3) + 'K.h.S.h.PPPPSSSS' + 'K.h.S.h.K.h.S.hK'.repeat(3) + 'SSSSSSSSPPPPPPPP' },
    { ...SLIDE },
  )
}

/** Which intro plays under each League member's words. */
const LEAGUE_INTRO = { will: 'e4Will', koga: 'e4Koga', bruno: 'e4Bruno', karen: 'e4Karen', lance: 'championIntro' }

/*
 * Multi-hit moves. Each hit gets its own STRIKE ring, and a missed ring is a
 * missed hit: only landing every ring deals the move's full damage. `power`
 * is per hit. PP cost goes by total power (power × hits): up to 50 costs
 * 1 PP, 55–75 costs 2, 80 and up costs 3. Everyone gets one, picked by
 * species where it's a real signature (Froakie's Water Shuriken), otherwise
 * by type.
 */
Object.assign(MOVEDEX, {
  'DOUBLE HIT':     { type: 'normal', power: 35, cat: 'phys', cost: 2, hits: 2, fx: 'dash', snd: 'thud' },
  'FURY SWIPES':    { type: 'normal', power: 20, cat: 'phys', cost: 2, hits: 3, fx: 'slash', snd: 'whoosh' },
  'DOUBLE KICK':    { type: 'fighting', power: 30, cat: 'phys', cost: 2, hits: 2, fx: 'dash', snd: 'thud' },
  'BULLET SEED':    { type: 'grass', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'seed', snd: 'whoosh' },
  'WATER SHURIKEN': { type: 'water', power: 20, cat: 'spec', cost: 2, hits: 3, fx: 'shuriken', snd: 'whoosh' },
  'DUAL CHOP':      { type: 'dragon', power: 40, cat: 'phys', cost: 3, hits: 2, fx: 'slash', snd: 'thud' },
  'ROCK BLAST':     { type: 'rock', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'rock', snd: 'thud' },
  'BONE RUSH':      { type: 'ground', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'dash', snd: 'thud' },
  'ICICLE SPEAR':   { type: 'ice', power: 25, cat: 'phys', cost: 2, hits: 3, fx: 'icicle', snd: 'whoosh' },
  TWINEEDLE:        { type: 'bug', power: 25, cat: 'phys', cost: 1, hits: 2, fx: 'needle', snd: 'whoosh' },
  'DUAL WINGBEAT':  { type: 'flying', power: 40, cat: 'phys', cost: 3, hits: 2, fx: 'dash', snd: 'whoosh' },
})
const MULTI_BY_SPECIES = { TORCHIC: 'DOUBLE KICK', CHIMCHAR: 'FURY SWIPES', FROAKIE: 'WATER SHURIKEN', TREECKO: 'BULLET SEED', CHESPIN: 'BULLET SEED', RIOLU: 'DOUBLE KICK', GIBLE: 'DUAL CHOP', LARVITAR: 'ROCK BLAST' }
const MULTI_BY_TYPE = { grass: 'BULLET SEED', water: 'WATER SHURIKEN', fighting: 'DOUBLE KICK', dragon: 'DUAL CHOP', rock: 'ROCK BLAST', ground: 'BONE RUSH', ice: 'ICICLE SPEAR', bug: 'TWINEEDLE', flying: 'DUAL WINGBEAT' }
const multiMoveOf = (m) => MULTI_BY_SPECIES[m.name] ?? MULTI_BY_TYPE[m.types[0]] ?? 'DOUBLE HIT'

/*
 * Support moves, which 2v2 brings in. They heal, raise stats, or change who
 * goes when. A ring still decides how well they work: PERFECT gives the
 * strongest version. `prio` is the priority bracket (higher acts first).
 * After You is +4 here (it's 0 in the games, where it often whiffs on a
 * faster ally); the point of it in this game is "let my partner go now".
 */
const SUPPORT = {
  'HELPING HAND': { type: 'normal', target: 'ally', effect: 'boost', prio: 5, cost: 0, sub: 'ally ×1.5 · first' },
  'AFTER YOU':    { type: 'normal', target: 'ally', effect: 'hurry', prio: 4, cost: 0, sub: 'ally goes next' },
  HOWL:           { type: 'normal', target: 'side', effect: 'atkUp', prio: 0, cost: 1, sub: 'ATK ▲ both', solo: 'ATK ▲' },
  GROWTH:         { type: 'normal', target: 'self', effect: 'growth', prio: 0, cost: 1, sub: 'ATK/SP.A ▲ self', solo: 'ATK/SP.A ▲' },
  'LIFE DEW':     { type: 'water', target: 'side', effect: 'heal', amount: 0.25, prio: 0, cost: 1, sub: 'heal both 25%', solo: 'heal 25%' },
  'HEAL PULSE':   { type: 'psychic', target: 'ally', effect: 'heal', amount: 0.5, prio: 0, cost: 1, sub: 'heal ally 50%' },
  TAILWIND:       { type: 'flying', target: 'side', effect: 'tailwind', prio: 0, cost: 1, sub: 'SPE ×2 · 4 turns' },
  RECOVER:        { type: 'normal', target: 'self', effect: 'heal', amount: 0.5, prio: 0, cost: 0, sub: 'heals self 50%' },
  'SLACK OFF':    { type: 'normal', target: 'self', effect: 'heal', amount: 0.5, prio: 0, cost: 0, sub: 'heals self 50%' },
}
const SUPPORT_BY_TYPE = { water: 'LIFE DEW', psychic: 'HEAL PULSE', fairy: 'HEAL PULSE', fire: 'HOWL', fighting: 'HOWL', dark: 'HOWL', grass: 'GROWTH', flying: 'TAILWIND', dragon: 'TAILWIND' }
/* What scalpers' Pokémon add in a 2v2: a way to patch themselves up. */
const TRAINER_SUPPORT = { GHOLDENGO: 'RECOVER', HIPPOWDON: 'SLACK OFF' }
/* Moves that hit both of yours in a 2v2, at 0.75× each, like the games' spread moves. */
const SPREAD = new Set(['BULLDOZE', 'SURF', 'DISCHARGE', 'SLUDGE WAVE'])

const moveInfo = (name) => SUPPORT[name] ? { name, kind: 'support', ...SUPPORT[name] } : { name, kind: 'strike', ...MOVEDEX[name] }

/*
 * Spread moves for your side in a 2v2. 'foes' hits both opponents; 'all'
 * hits everyone else on the field, your own partner included, like
 * Earthquake in the games. These all travel along the ground, so the
 * partner can JUMP to get out of the way. With more than one target each
 * takes 0.75×.
 */
Object.assign(MOVEDEX, {
  'HEAT WAVE':      { type: 'fire', power: 45, cat: 'spec', cost: 1, spread: 'foes', fx: 'ember', snd: 'whoosh' },
  'RAZOR LEAF':     { type: 'grass', power: 40, cat: 'phys', cost: 1, spread: 'foes', fx: 'seed', snd: 'whoosh' },
  'ROCK SLIDE':     { type: 'rock', power: 45, cat: 'phys', cost: 1, spread: 'foes', fx: 'rock', snd: 'thud' },
  'ICY WIND':       { type: 'ice', power: 35, cat: 'spec', cost: 1, spread: 'foes', fx: 'icicle', snd: 'whoosh' },
  'AIR CUTTER':     { type: 'flying', power: 40, cat: 'spec', cost: 1, spread: 'foes', fx: 'slash', snd: 'whoosh' },
  'DAZZLING GLEAM': { type: 'fairy', power: 45, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'whoosh' },
  SNARL:            { type: 'dark', power: 35, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'crunch' },
  'STRUGGLE BUG':   { type: 'bug', power: 35, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'whoosh' },
  'HYPER VOICE':    { type: 'normal', power: 45, cat: 'spec', cost: 1, spread: 'foes', fx: 'spray', snd: 'whoosh' },
  SURF:             { type: 'water', power: 45, cat: 'spec', cost: 1, spread: 'all', fx: 'water', snd: 'whoosh' },
  EARTHQUAKE:       { type: 'ground', power: 50, cat: 'phys', cost: 1, spread: 'all', fx: 'quake', snd: 'quake' },
  DISCHARGE:        { type: 'electric', power: 40, cat: 'spec', cost: 1, spread: 'all', fx: 'spray', snd: 'zap' },
  'SLUDGE WAVE':    { type: 'poison', power: 45, cat: 'spec', cost: 1, spread: 'all', fx: 'spray', snd: 'whoosh' },
})
const SPREAD_BY_TYPE = { fire: 'HEAT WAVE', water: 'SURF', grass: 'RAZOR LEAF', electric: 'DISCHARGE', ground: 'EARTHQUAKE', rock: 'ROCK SLIDE', ice: 'ICY WIND',
  poison: 'SLUDGE WAVE', flying: 'AIR CUTTER', fairy: 'DAZZLING GLEAM', dark: 'SNARL', bug: 'STRUGGLE BUG' }
/* ── PP to start a battle with ──
   Most Pokémon start each battle with 1 PP. The four natures that raise
   Speed (Timid, Hasty, Jolly, Naive) are quick off the mark: they start
   with 2. In a 2v2 both Pokémon bring theirs to the shared pool. */
const QUICK_NATURES = new Set(['Timid', 'Hasty', 'Jolly', 'Naive'])
const startPP = (m) => (QUICK_NATURES.has(m.nature[0]) ? 2 : 1)

/* ── EXP ──
   Medium-fast growth: Lv L to L+1 takes (L+1)^3 - L^3 points. Beating or
   catching a Pokémon is worth 12 × its level, 18 × from a scalper's. */
const expToNext = (L) => (L + 1) ** 3 - L ** 3
const expYield = (foe, trainer = false) => Math.round(foe.level * (trainer ? 18 : 12))
/** Stats at a level, from the same IVs and nature (the formula individual() uses). */
function statsAt(m, level) {
  const stats = {}
  for (const k of STAT_KEYS) {
    const b = m.base[BASE_KEY[k]], core = Math.floor((2 * b + m.ivs[k]) * level / 100)
    stats[k] = k === 'hp' ? core + level + 10 : Math.floor((core + 5) * (m.nature[1] === k ? 1.1 : m.nature[2] === k ? 0.9 : 1))
  }
  return stats
}
Object.assign(SFX, {
  exp: { file: null, synth: (ac, o, t) => tone(ac, o, t, { type: 'triangle', f: 520, f1: 1560, dur: .32, vol: .07 }) },
})

/* ── learned moves, and the four that are equipped ──
   Every Pokémon learns a pool of moves and carries at most four into
   battle, swapped in the Box. Everyone learns three 0-PP moves (Tackle, its
   species' own basic move where it has one, and Quick Attack), and must keep
   at least one 0-PP attack equipped, so there's always something to use with an
   empty PP bar. Support moves only work in a 2v2. */
Object.assign(MOVEDEX, {
  'QUICK ATTACK':  { type: 'normal', power: 40, cat: 'phys', cost: 0, prio: 1, fx: 'dash', snd: 'whoosh', sub: 'goes first' },
  'THUNDER SHOCK': { type: 'electric', power: 40, cat: 'spec', cost: 1, fx: 'spray', snd: 'zap' },
  'POWDER SNOW':   { type: 'ice', power: 40, cat: 'spec', cost: 1, fx: 'icicle', snd: 'whoosh' },
  'KARATE CHOP':   { type: 'fighting', power: 50, cat: 'phys', cost: 1, fx: 'slash', snd: 'thud' },
  'ROCK THROW':    { type: 'rock', power: 50, cat: 'phys', cost: 1, fx: 'rock', snd: 'thud' },
  'MUD-SLAP':      { type: 'ground', power: 30, cat: 'spec', cost: 1, fx: 'spray', snd: 'thud' },
  'DRAGON BREATH': { type: 'dragon', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow' },
  ASTONISH:        { type: 'ghost', power: 35, cat: 'phys', cost: 1, fx: 'dash', snd: 'shadow' },
  BITE:            { type: 'dark', power: 45, cat: 'phys', cost: 1, fx: 'dash', snd: 'crunch' },
  'METAL CLAW':    { type: 'steel', power: 50, cat: 'phys', cost: 1, fx: 'slash', snd: 'crunch' },
  CONFUSION:       { type: 'psychic', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow' },
  'POISON STING':  { type: 'poison', power: 35, cat: 'phys', cost: 1, fx: 'needle', snd: 'whoosh' },
  'BUG BITE':      { type: 'bug', power: 50, cat: 'phys', cost: 1, fx: 'dash', snd: 'crunch' },
  GUST:            { type: 'flying', power: 40, cat: 'spec', cost: 1, fx: 'spray', snd: 'whoosh' },
  'FAIRY WIND':    { type: 'fairy', power: 40, cat: 'spec', cost: 1, fx: 'spray', snd: 'whoosh' },
})
/* Alex's Porygon. */
Object.assign(MOVEDEX, {
  'TRI ATTACK': { type: 'normal', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'zap' },
  PSYBEAM:      { type: 'psychic', power: 45, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow' },
})
Object.assign(OWN_MOVE, { electric: 'THUNDER SHOCK', ice: 'POWDER SNOW', fighting: 'KARATE CHOP', rock: 'ROCK THROW', ground: 'MUD-SLAP', dragon: 'DRAGON BREATH',
  ghost: 'ASTONISH', dark: 'BITE', steel: 'METAL CLAW', psychic: 'CONFUSION', poison: 'POISON STING', bug: 'BUG BITE', flying: 'GUST', fairy: 'FAIRY WIND' })
const MAX_MOVES = 4
const moveCost = (name) => (SUPPORT[name] ?? MOVEDEX[name]).cost ?? 0
/*
 * Moves are learned gradually. Each Pokémon has a level schedule, built
 * from its type: its basic 0-PP move at Lv 1, its type move at 3, Quick
 * Attack at 6, the multi-hit at 9, a support move at 12, the spread move at
 * 15, a second support move at 18, for some types a sleep / confusion / poison
 * move at 20 (STATUS2_BY_TYPE), Protect at 25, a stat or field move at 27
 * (STAT_BY_TYPE), Counter or Mirror Coat at 36 for a few types
 * (COUNTER_BY_TYPE), and its type's later moves at 30, 45
 * and 60 (LATE_MOVES). It appears knowing only what its level
 * allows, so a Lv 5 starter knows two moves. Move Discs teach anything else.
 */
function levelMoves(m) {
  const t = m.types[0], basic = NORMAL_MOVE[m.name] ?? 'TACKLE', own = OWN_MOVE[t], sup = SUPPORT_BY_TYPE[t] ?? 'HELPING HAND'
  const list = [[1, basic], [3, own ?? 'QUICK ATTACK'], ...(own ? [[6, 'QUICK ATTACK']] : []), [7, statusOf(m)], [9, multiMoveOf(m)], [10, 'REFRESH'], [12, sup],
    [15, SPREAD_BY_TYPE[t] ?? 'HYPER VOICE'], [18, sup === 'HELPING HAND' ? 'AFTER YOU' : 'HELPING HAND'], ...(STATUS2_BY_TYPE[t] ? [[20, STATUS2_BY_TYPE[t]]] : []),
    ...(basic !== 'TACKLE' ? [[21, 'TACKLE']] : []), [25, 'PROTECT'], ...(STAT_BY_TYPE[t] ? [[27, STAT_BY_TYPE[t]]] : []), ...(COUNTER_BY_TYPE[t] ? [[36, COUNTER_BY_TYPE[t]]] : []),
    ...(t === 'grass' ? [[24, 'ABSORB']] : []), ...(LATE_MOVES[t] ?? []).map((n, i) => [30 + 15 * i, n])]
  const seen = new Set()
  return [...list, ...(SPECIES_MOVES[m.name] ?? [])].sort((a, b) => a[0] - b[0]).filter(([, n]) => !seen.has(n) && seen.add(n))
}
/**
 * Fills in learned and equipped moves the first time they're needed: all
 * moves due by its level, with the basic 0-PP move plus the three most
 * recent equipped (the games keep the latest four).
 */
function learn(m) {
  if (m.moves) return m
  const known = levelMoves(m).filter(([lv]) => lv <= m.level).map(([, n]) => n)
  m.learned = known
  m.moves = [known[0], ...known.slice(1).slice(-(MAX_MOVES - 1))]
  return m
}
/** Teaches one move (a level-up or a Move Disc), equipping it if there's a free slot. */
function teach(m, n, fromDisc = false) {
  learn(m)
  if (m.learned.includes(n)) return { name: n, already: true }
  if (fromDisc && !canLearnDisc(m, n)) return { name: n, cant: true }
  m.learned.push(n)
  const equipped = m.moves.length < MAX_MOVES
  if (equipped) m.moves.push(n)
  return { name: n, equipped }
}
/** Everything due at exactly this level, taught. */
const learnAtLevel = (m) => levelMoves(learn(m)).filter(([lv, n]) => lv === m.level && !m.learned.includes(n)).map(([, n]) => teach(m, n))
/** What it learns later, for the Box: [[level, name]]. */
const upcoming = (m) => levelMoves(learn(m)).filter(([lv, n]) => lv > m.level && !m.learned.includes(n))

/* Move Discs: one-use items that teach their move to any Pokémon. Gym Leaders
   give one (of their type) when you win, the VVM sometimes stocks one, and a
   booster pack's rare slot can hold one. */
const DISC_POOL = ['HELPING HAND', 'TAILWIND', 'AFTER YOU', 'HEAL PULSE', 'HOWL', 'EARTHQUAKE', 'ROCK SLIDE', 'HYPER VOICE']
const discKey = (n) => 'disc:' + n
/*
 * Which Pokémon each disc can teach, like the games' TM lists. The support
 * staples work for nearly everyone; the rest follow type, with a few extra
 * species that fit. Magikarp learns nothing from a disc.
 */
const DISC_RULES = {
  'HELPING HAND': { all: true },
  'AFTER YOU':    { all: true },
  'HYPER VOICE':  { all: true },
  HOWL:           { all: true },
  EARTHQUAKE:     { types: ['ground', 'rock', 'steel', 'fighting', 'dragon'], species: ['SNORLAX', 'GREEDENT'] },
  'ROCK SLIDE':   { types: ['ground', 'rock', 'steel', 'fighting', 'dragon'], species: ['SNORLAX', 'GREEDENT'] },
  TAILWIND:       { types: ['flying', 'dragon'], species: ['EEVEE'] },
  'HEAL PULSE':   { types: ['psychic', 'fairy', 'water'] },
}
const DISC_NEVER = ['MAGIKARP']
/** Can this Pokémon learn this disc's move? */
function canLearnDisc(m, move) {
  const r = DISC_RULES[move]
  if (!r || DISC_NEVER.includes(m.name)) return false
  return !!(r.all || r.types?.some((t) => m.types.includes(t)) || r.species?.includes(m.name))
}
/** Registers a disc as a Bag item the first time one turns up. */
const discItem = (n) => (ITEMS[discKey(n)] ??= { name: n, sub: `MOVE DISC · teaches ${n}`, cls: 't-disc', disc: n })
/** The equipped moves (at most four), used in 1v1 and 2v2 alike. */
const movesOf = (m) => learn(m).moves
const duoMovesOf = movesOf
/**
 * Puts `name` into equipped slot `slot`. Returns an error message instead
 * when that would leave no 0-PP move equipped.
 */
function equip(m, slot, name) {
  learn(m)
  if (m.moves.includes(name)) return `${name} is already equipped.`
  const next = m.moves.slice(); next[slot] = name
  // A 0-PP *attack*: Helping Hand costs nothing too, but it can't hit anything.
  if (!next.some((n) => moveCost(n) === 0 && !SUPPORT[n])) return `Keep at least one 0 PP attack (like ${m.moves[slot]}) so ${m.name} always has something to hit with.`
  m.moves = next
  return null
}

/*
 * Accuracy and evasion, on the timing rings. Each stage (−3 to +3, reset on
 * switching out) works out as one number per attack: the attacker's accuracy
 * stage minus the target's evasion stage, counting only when it's below 0.
 *  · Your attack on a target you have trouble hitting: your STRIKE ring
 *    closes 15% faster per stage and every grade's window (PERFECT, GREAT…)
 *    is 20% tighter per stage.
 *  · An attack on you from a foe that has trouble hitting you: its ring
 *    closes 15% slower per stage and your parry, dodge and jump windows are
 *    20% wider per stage.
 * Accuracy drops: Sand Attack, Smokescreen, Flash, Kinesis, and Mud-Slap's
 * hit. Evasion: Minimize, Double Team. Foes use them too.
 */
Object.assign(SUPPORT, {
  'SAND ATTACK': { type: 'ground', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  SMOKESCREEN:   { type: 'normal', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  FLASH:         { type: 'normal', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  KINESIS:       { type: 'psychic', target: 'foe', effect: 'accDown', prio: 0, cost: 1, sub: "foe's ACC ▼", solo: "foe's ACC ▼" },
  MINIMIZE:      { type: 'normal', target: 'self', effect: 'evaUp', prio: 0, cost: 1, sub: 'EVA ▲ self', solo: 'EVA ▲' },
  'DOUBLE TEAM': { type: 'normal', target: 'self', effect: 'evaUp', prio: 0, cost: 1, sub: 'EVA ▲ self', solo: 'EVA ▲' },
})
MOVEDEX['MUD-SLAP'].accDown = 1   // damage, and the target's accuracy falls a stage
/** Each type's accuracy/evasion move, learned at Lv 7 (and what foes of that type use). */
const STATUS_BY_TYPE = { ground: 'SAND ATTACK', rock: 'SAND ATTACK', fire: 'SMOKESCREEN', electric: 'FLASH', fairy: 'FLASH', psychic: 'KINESIS',
  poison: 'MINIMIZE', ghost: 'MINIMIZE', water: 'MINIMIZE' }
const statusOf = (m) => STATUS_BY_TYPE[m.types[0]] ?? 'DOUBLE TEAM'
const STAGE_MAX = 3
/** Attacker's accuracy minus target's evasion, only counting when it's below 0: −3..0. */
const ringNet = (acc, eva) => Math.max(-STAGE_MAX, Math.min(0, (acc ?? 0) - (eva ?? 0)))
const strikeRing = (net) => ({ speed: 1 - 0.15 * -net, tight: 1 - 0.2 * -net })   // your ring: faster, tighter
const defendRing = (net) => ({ speed: 1 + 0.15 * -net, wide: 1 + 0.2 * -net })    // their ring on you: slower, wider windows
/**
 * Defending, by how close to the hit you press (ms either side, before
 * defendRing's `wide`): a PERFECT parry or jump blocks it all, a good one
 * most of it, a dodge some of it. Parries and jumps earn the PP either way;
 * only PERFECT parries on every hit earn the counter.
 */
const DEFEND_MS = { perfect: 35, parry: 90, dodge: 170, jump: 190 }
const DEFEND_TAKEN = { miss: 1, dodge: 0.4, parry: 0.2, jump: 0.2, perfect: 0 }
/** 'parry' / 'jump' / 'dodge' / 'miss' for a press `dt` ms off the hit, and whether it was PERFECT. */
function defendResult(first, dt, low, wide) {
  const d = Math.abs(dt), perfect = d <= DEFEND_MS.perfect * wide
  if (low) return first?.btn === 'up' && d <= DEFEND_MS.jump * wide ? { r: 'jump', perfect } : { r: 'miss' }
  if (first?.btn === 'a' && d <= DEFEND_MS.parry * wide) return { r: 'parry', perfect }
  if (first?.btn === 'b' && d <= DEFEND_MS.dodge * wide) return { r: 'dodge' }
  return { r: 'miss' }
}
const takenOf = ({ r, perfect }) => (perfect ? DEFEND_TAKEN.perfect : DEFEND_TAKEN[r])
/**
 * How a foe paces its attacks, so you have to watch the ring rather than tap
 * from rhythm: each hit's ring closes at a speed picked from `speed`, after a
 * wind-up of up to `wait` ms once the move is announced. `tell` is the chance
 * of a feint, ×2 or low → high (Gym Leaders keep their own `tellRate`).
 * Wild Pokémon and Brian vary a little; scalpers and leaders a lot. Everyday
 * trainers and the crew start throwing tells once your lead is Lv 15.
 */
function attackPace(T, lv) {
  if (!T || T.easy) return { speed: [0.92, 1.08], wait: 250, tell: 0 }
  if (T.hard) return { speed: [0.75, 1.15], wait: 550, tell: 0 }
  if (T === HERB || T === PAUL) return { speed: [0.78, 1.15], wait: 500, tell: lv >= 10 ? 0.25 : 0.12 }
  return { speed: [0.85, 1.12], wait: 400, tell: lv >= 15 ? 0.12 : 0 }
}
const paceRoll = ([lo, hi]) => lo + Math.random() * (hi - lo)
/** "ACC▼2", "EVA▲" for the HUD tags. */
const stageTags = (t) => [t.acc && `ACC${t.acc > 0 ? '▲' : '▼'}${Math.abs(t.acc) > 1 ? Math.abs(t.acc) : ''}`, t.eva && `EVA${t.eva > 0 ? '▲' : '▼'}${Math.abs(t.eva) > 1 ? Math.abs(t.eva) : ''}`].filter(Boolean)
Object.assign(DISC_RULES, { 'SAND ATTACK': { all: true }, SMOKESCREEN: { all: true }, 'DOUBLE TEAM': { all: true }, MINIMIZE: { all: true }, FLASH: { all: true } })
DISC_POOL.push('SAND ATTACK', 'SMOKESCREEN', 'DOUBLE TEAM', 'MINIMIZE', 'FLASH')

/*
 * Status conditions: one at a time on a Pokémon (`m.status`). They carry over
 * between battles, like HP, until cured: a cure item, Refresh or Heal Bell,
 * the Pokémon Center, a Revive, or fainting.
 *  · PAR, paralysis: 25% of turns it can't move; its parry, dodge and jump
 *    windows are 20% narrower; half Speed (in 2v2, where Speed sets order).
 *  · FRZ, frozen: can't move; thaws 20% of turns, or at once when hit by a
 *    fire move. Rings on it can't be parried, dodged or jumped.
 *  · BRN, burned: its physical attacks do half damage; loses 1/16 of max HP
 *    at the end of each turn.
 *  · PSN, poisoned: loses 1/8 of max HP at the end of each turn.
 *  · TOX, badly poisoned: loses 1/16 of max HP, then 2/16, 3/16… each turn
 *    (the count starts over each battle and on a switch).
 *  · SLP, asleep: can't move for 1-3 turns, and can't parry, dodge or jump.
 *    One of yours can be woken early: mash A when it's its turn.
 * Electric types can't be paralyzed, Fire types burned, Ice types frozen,
 * Poison and Steel types poisoned.
 *
 * And for one battle only (gone on a switch), alongside any of those:
 *  · CONF, confused (2-4 turns): its rings wobble, and a third of the time it
 *    hurts itself instead of moving.
 *  · SEED, Leech Seed: loses 1/8 of max HP each turn to whoever seeded it.
 *    Grass types can't be seeded.
 *  · DROWSY, from Yawn: falls asleep at the end of the next turn.
 *  · Flinch: a hit before it moves (Fake Out, or a GREAT/PERFECT Bite,
 *    Headbutt, Air Slash…) can cost it that turn.
 */
const STATUS_NAME = { par: 'PAR', frz: 'FRZ', brn: 'BRN', psn: 'PSN', tox: 'TOX', slp: 'SLP' }
const STATUS_WORD = { par: 'paralyzed', frz: 'frozen', brn: 'burned', psn: 'poisoned', tox: 'badly poisoned', slp: 'asleep' }
const STATUS_IMMUNE = { par: ['electric'], brn: ['fire'], frz: ['ice'], psn: ['poison', 'steel'], tox: ['poison', 'steel'], slp: [] }
/** Moves with a chance to inflict a status when they land, per hit: [status, chance]. */
const STATUS_ON_HIT = {
  'THUNDER SHOCK': ['par', 0.1], THUNDERBOLT: ['par', 0.1], DISCHARGE: ['par', 0.3], NUZZLE: ['par', 1], SPARK: ['par', 0.3],
  EMBER: ['brn', 0.1], FLAMETHROWER: ['brn', 0.1], 'FIRE FANG': ['brn', 0.1], 'LAVA PLUME': ['brn', 0.3], 'FLAME WHEEL': ['brn', 0.1], 'HEAT WAVE': ['brn', 0.1],
  'POWDER SNOW': ['frz', 0.1], BLIZZARD: ['frz', 0.1], 'ICE BEAM': ['frz', 0.1],
  'POISON STING': ['psn', 0.3], 'SLUDGE WAVE': ['psn', 0.1], 'SLUDGE BOMB': ['psn', 0.3], 'CROSS POISON': ['psn', 0.1], TWINEEDLE: ['psn', 0.2], 'POISON JAB': ['psn', 0.3],
}
/* Status moves that inflict one outright (taught by Move Disc). */
Object.assign(SUPPORT, {
  'THUNDER WAVE':   { type: 'electric', target: 'foe', effect: 'status', status: 'par', chance: 0.8, prio: 0, cost: 1, sub: 'paralyzes the foe', solo: 'paralyzes' },
  'WILL-O-WISP':    { type: 'fire', target: 'foe', effect: 'status', status: 'brn', chance: 0.75, prio: 0, cost: 1, sub: 'burns the foe', solo: 'burns' },
  'POISON POWDER':  { type: 'poison', target: 'foe', effect: 'status', status: 'psn', chance: 0.75, prio: 0, cost: 1, sub: 'poisons the foe', solo: 'poisons' },
})
Object.assign(DISC_RULES, { 'THUNDER WAVE': { types: ['electric', 'normal', 'psychic', 'dragon'] }, 'WILL-O-WISP': { types: ['fire', 'ghost', 'psychic'] }, 'POISON POWDER': { types: ['grass', 'bug', 'poison'] } })
DISC_POOL.push('THUNDER WAVE', 'WILL-O-WISP', 'POISON POWDER')
/* Sleep, bad poison, confusion, Leech Seed and Yawn. `chance`: how often it lands on a GOOD (see statusLands; never certain, MISS never). */
Object.assign(SUPPORT, {
  SING:            { type: 'normal', target: 'foe', effect: 'status', status: 'slp', chance: 0.6, prio: 0, cost: 1, sub: 'puts the foe to sleep', solo: 'sleep' },
  HYPNOSIS:        { type: 'psychic', target: 'foe', effect: 'status', status: 'slp', chance: 0.65, prio: 0, cost: 1, sub: 'puts the foe to sleep', solo: 'sleep' },
  'SLEEP POWDER':  { type: 'grass', target: 'foe', effect: 'status', status: 'slp', chance: 0.75, prio: 0, cost: 2, sub: 'puts the foe to sleep', solo: 'sleep' },
  YAWN:            { type: 'normal', target: 'foe', effect: 'yawn', chance: 0.8, prio: 0, cost: 1, sub: 'foe sleeps next turn', solo: 'sleep next turn' },
  TOXIC:           { type: 'poison', target: 'foe', effect: 'status', status: 'tox', chance: 0.75, prio: 0, cost: 1, sub: 'badly poisons the foe', solo: 'bad poison' },
  'CONFUSE RAY':   { type: 'ghost', target: 'foe', effect: 'confuse', chance: 0.8, prio: 0, cost: 1, sub: 'confuses the foe', solo: 'confuses' },
  SUPERSONIC:      { type: 'normal', target: 'foe', effect: 'confuse', chance: 0.6, prio: 0, cost: 0, sub: 'confuses the foe', solo: 'confuses' },
  'SWEET KISS':    { type: 'fairy', target: 'foe', effect: 'confuse', chance: 0.75, prio: 0, cost: 1, sub: 'confuses the foe', solo: 'confuses' },
  SWAGGER:         { type: 'normal', target: 'foe', effect: 'swagger', chance: 0.8, prio: 0, cost: 1, sub: "confuses · foe's ATK ▲2", solo: 'confuses, ATK ▲2 foe' },
  'LEECH SEED':    { type: 'grass', target: 'foe', effect: 'seed', chance: 0.8, prio: 0, cost: 1, sub: 'drains 1/8 HP a turn', solo: 'drains 1/8 a turn' },
})
/* Fake Out: only on the user's first turn out, first, and the foe flinches. */
MOVEDEX['FAKE OUT'] = { type: 'normal', power: 40, cat: 'phys', cost: 1, prio: 3, fx: 'dash', snd: 'thud', firstTurn: true, sub: 'first turn only · flinch' }
/** A hit that lands before the target moves can make it flinch: the chance, on a GREAT or PERFECT (foes' on a clean hit). */
const FLINCH = { 'FAKE OUT': 1, BITE: 0.3, HEADBUTT: 0.3, STOMP: 0.3, ASTONISH: 0.3, 'IRON HEAD': 0.3, 'AIR SLASH': 0.3, 'ZEN HEADBUTT': 0.2, 'DARK PULSE': 0.2, EXTRASENSORY: 0.1 }
/* Who learns them: a second status move at Lv 20 for these types; the rest by Move Disc. */
const STATUS2_BY_TYPE = { grass: 'LEECH SEED', poison: 'TOXIC', ghost: 'CONFUSE RAY', psychic: 'HYPNOSIS', fairy: 'SWEET KISS', bug: 'SLEEP POWDER', flying: 'SUPERSONIC', dark: 'SWAGGER', normal: 'YAWN' }
Object.assign(DISC_RULES, {
  SING: { species: ['JIGGLYPUFF', 'WIGGLYTUFF', 'CLEFAIRY', 'CLEFABLE', 'LAPRAS', 'CHANSEY'], types: ['fairy'] }, HYPNOSIS: { types: ['psychic', 'ghost'] },
  'SLEEP POWDER': { types: ['grass', 'bug'] }, YAWN: { all: true }, TOXIC: { all: true }, 'CONFUSE RAY': { types: ['ghost', 'psychic', 'dark'] },
  SUPERSONIC: { types: ['flying', 'bug', 'water'] }, 'SWEET KISS': { types: ['fairy', 'normal'] }, SWAGGER: { all: true }, 'LEECH SEED': { types: ['grass'] },
  'FAKE OUT': { types: ['normal', 'fighting', 'dark'] },
})
DISC_POOL.push('TOXIC', 'YAWN', 'HYPNOSIS', 'CONFUSE RAY', 'FAKE OUT', 'LEECH SEED')
/* What foes use, by species first, then type: their sleep / confusion / poison move (else their type's accuracy or evasion move). */
const FOE_STATUS_BY_SPECIES = { JIGGLYPUFF: 'SING', WIGGLYTUFF: 'SING', CLEFAIRY: 'SING', LAPRAS: 'SING', GASTLY: 'HYPNOSIS', HAUNTER: 'HYPNOSIS', GENGAR: 'HYPNOSIS',
  HOOTHOOT: 'HYPNOSIS', NOCTOWL: 'HYPNOSIS', KADABRA: 'HYPNOSIS', MISDREAVUS: 'CONFUSE RAY', MURKROW: 'SWAGGER', SUNKERN: 'LEECH SEED', SLAKOTH: 'YAWN', PSYDUCK: 'YAWN', SNORLAX: 'YAWN' }
/**
 * A foe's status or setup move, or null if none of its choices would do
 * anything (`works`, see moveWorks): then it just attacks. Its own species'
 * move comes first; a leader's type stat move, its type's second status
 * move and a Normal type's Growl or Tail Whip each get a half chance; its
 * type's accuracy or evasion move is the fallback.
 */
function foeStatusMove(m, r, hard = false, works = () => true) {
  const t = m.types[0], options = []
  if (FOE_STATUS_BY_SPECIES[m.name]) options.push([FOE_STATUS_BY_SPECIES[m.name], true])
  if (hard && STAT_BY_TYPE[t]) options.push([STAT_BY_TYPE[t], false])
  if (STATUS2_BY_TYPE[t]) options.push([STATUS2_BY_TYPE[t], false])
  if (t === 'normal') options.push([r() < 0.5 ? 'GROWL' : 'TAIL WHIP', false])
  options.push([statusOf(m), true])
  const ok = options.filter(([n]) => works(n))
  return (ok.find(([, sure], i) => sure || i === ok.length - 1 || r() < 0.5) ?? [null])[0]
}
/**
 * Would this status or setup move do anything, from `user` on `target`?
 * `S` gives a Pokémon's battle stages and extras; `field` the weather. Keeps
 * foes from wasting a turn: no sleep on the sleeping, no Leech Seed on a
 * Grass type, no Swords Dance at +4, no Curse they can't pay for.
 */
function moveWorks(name, user, target, S, field = {}) {
  const mv = SUPPORT[name]; if (!mv) return true
  const ts = S(target), us = S(user)
  switch (mv.effect) {
    case 'status': return canTake(target, mv.status)
    case 'yawn': return canTake(target, 'slp') && !ts.drowsy
    case 'confuse': case 'swagger': return !ts.conf
    case 'seed': return !ts.seeded && !target.types.includes('grass')
    case 'taunt': return !ts.taunt
    case 'trap': return !ts.trapped
    case 'curse': return !ts.cursed && user.hp > user.stats.hp / 2
    case 'accDown': return (ts.acc ?? 0) > -STAGE_MAX
    case 'evaUp': return (us.eva ?? 0) < STAGE_MAX
    case 'stat': {
      const who = mv.target === 'foe' ? ts : us
      const room = Object.entries(mv.stages).some(([k, by]) => (by > 0 ? (who[k] ?? 0) < 4 : (who[k] ?? 0) > -4))
      return room && (mv.target === 'foe' || user.hp > user.stats.hp / 2)   // no setting up when it's about to faint
    }
    case 'weather': return field.weather !== mv.weather
    case 'screen': return !field[mv.screen]
    default: return true
  }
}
/*
 * Does a status move land? Never certain, even on a PERFECT: its `chance`
 * (what it lands on a GOOD) times the timing's factor, up to that grade's
 * ceiling. Better timing always helps; a MISS never lands. A foe's counts as
 * a GOOD.
 */
const STATUS_TIMING = { PERFECT: [1.35, 0.95], GREAT: [1.2, 0.9], GOOD: [1, 0.85], OK: [0.8, 0.75] }
const STATUS_CHANCE = 0.75   // for a status move without its own chance
const statusOdds = (mv, label) => { const [f, cap] = STATUS_TIMING[label] ?? [0, 0]; return Math.min(cap, (mv.chance ?? STATUS_CHANCE) * f) }
const statusLands = (mv, acc, r) => r() < statusOdds(mv, acc.label)
/** The per-battle extras (confusion, seed, drowsy, flinch) as HUD tags. */
const volTags = (t) => [t.conf && 'CONF', t.seeded && 'SEED', t.drowsy && 'DROWSY', t.cursed && 'CURSE', t.perish && `PERISH ${t.perish}`, t.trapped && 'TRAPPED', t.disabled && 'DISABLE'].filter(Boolean)
/*
 * Stat moves, Protect, Counter, weather, screens and Taunt. Stages run -6..+6
 * (×2/8 .. ×8/2), a PERFECT doubles a stat move's stages, and switching out
 * clears them. In a 1v1, where you always move first, your Speed stages give
 * you 8% more time per stage on the foe's rings (less for a minus).
 *  · PROTECT / DETECT: blocks every attack on the user this turn. Used again
 *    the next turn it only works a third of the time.
 *  · COUNTER / MIRROR COAT: for this turn, a parried physical (special) hit
 *    isn't just blocked: twice the damage it would have done goes back.
 *  · RAIN DANCE / SUNNY DAY: 5 turns. Rain: Water ×1.5, Fire ×0.5. Sun: the
 *    other way round.
 *  · REFLECT / LIGHT SCREEN: 5 turns of half damage from physical (special)
 *    moves on the user's side.
 *  · TAUNT: for 3 turns the target can only attack.
 */
Object.assign(SUPPORT, {
  'SWORDS DANCE': { type: 'normal', target: 'self', effect: 'stat', stages: { atk: 2 }, prio: 0, cost: 1, sub: 'ATK ▲2 self', solo: 'ATK ▲2' },
  'NASTY PLOT':   { type: 'dark', target: 'self', effect: 'stat', stages: { spa: 2 }, prio: 0, cost: 1, sub: 'SP.A ▲2 self', solo: 'SP.A ▲2' },
  'IRON DEFENSE': { type: 'steel', target: 'self', effect: 'stat', stages: { def: 2 }, prio: 0, cost: 1, sub: 'DEF ▲2 self', solo: 'DEF ▲2' },
  'BULK UP':      { type: 'fighting', target: 'self', effect: 'stat', stages: { atk: 1, def: 1 }, prio: 0, cost: 1, sub: 'ATK/DEF ▲ self', solo: 'ATK/DEF ▲' },
  'CALM MIND':    { type: 'psychic', target: 'self', effect: 'stat', stages: { spa: 1, spd: 1 }, prio: 0, cost: 1, sub: 'SP.A/SP.D ▲ self', solo: 'SP.A/SP.D ▲' },
  AGILITY:        { type: 'psychic', target: 'self', effect: 'stat', stages: { spe: 2 }, prio: 0, cost: 1, sub: 'SPE ▲2 self', solo: 'SPE ▲2' },
  GROWL:          { type: 'normal', target: 'foe', effect: 'stat', stages: { atk: -1 }, prio: 0, cost: 0, sub: "foe's ATK ▼", solo: "foe's ATK ▼" },
  'TAIL WHIP':    { type: 'normal', target: 'foe', effect: 'stat', stages: { def: -1 }, prio: 0, cost: 0, sub: "foe's DEF ▼", solo: "foe's DEF ▼" },
  SCREECH:        { type: 'normal', target: 'foe', effect: 'stat', stages: { def: -2 }, prio: 0, cost: 1, sub: "foe's DEF ▼2", solo: "foe's DEF ▼2" },
  PROTECT:        { type: 'normal', target: 'self', effect: 'protect', prio: 4, cost: 1, sub: 'blocks attacks · first', solo: 'blocks this turn' },
  DETECT:         { type: 'fighting', target: 'self', effect: 'protect', prio: 4, cost: 1, sub: 'blocks attacks · first', solo: 'blocks this turn' },
  COUNTER:        { type: 'fighting', target: 'self', effect: 'counter', cat: 'phys', prio: 4, cost: 1, sub: 'parried physical hits: 2× back', solo: 'parry phys: 2× back' },
  'MIRROR COAT':  { type: 'psychic', target: 'self', effect: 'counter', cat: 'spec', prio: 4, cost: 1, sub: 'parried special hits: 2× back', solo: 'parry spec: 2× back' },
  'RAIN DANCE':   { type: 'water', target: 'self', effect: 'weather', weather: 'rain', prio: 0, cost: 1, sub: 'rain 5 turns: Water ▲ Fire ▼', solo: 'rain, 5 turns' },
  'SUNNY DAY':    { type: 'fire', target: 'self', effect: 'weather', weather: 'sun', prio: 0, cost: 1, sub: 'sun 5 turns: Fire ▲ Water ▼', solo: 'sun, 5 turns' },
  REFLECT:        { type: 'psychic', target: 'side', effect: 'screen', screen: 'reflect', prio: 0, cost: 1, sub: 'physical damage ½ · 5 turns', solo: 'phys ½, 5 turns' },
  'LIGHT SCREEN': { type: 'psychic', target: 'side', effect: 'screen', screen: 'light', prio: 0, cost: 1, sub: 'special damage ½ · 5 turns', solo: 'spec ½, 5 turns' },
  TAUNT:          { type: 'dark', target: 'foe', effect: 'taunt', prio: 0, cost: 1, sub: 'foe can only attack · 3 turns', solo: 'attacks only, 3 turns' },
})
/* Who learns them: everyone gets PROTECT at 25; a stat or field move by type at 27; Counter and Mirror Coat at 36. The rest by Move Disc. */
const STAT_BY_TYPE = { fire: 'SUNNY DAY', water: 'RAIN DANCE', grass: 'SWORDS DANCE', electric: 'AGILITY', ice: 'LIGHT SCREEN', fighting: 'BULK UP', poison: 'TAUNT',
  ground: 'SWORDS DANCE', flying: 'AGILITY', psychic: 'CALM MIND', bug: 'SWORDS DANCE', rock: 'IRON DEFENSE', ghost: 'NASTY PLOT', dragon: 'AGILITY', dark: 'NASTY PLOT',
  steel: 'IRON DEFENSE', fairy: 'LIGHT SCREEN', normal: 'SCREECH' }
const COUNTER_BY_TYPE = { fighting: 'COUNTER', psychic: 'MIRROR COAT', water: 'MIRROR COAT' }
Object.assign(DISC_RULES, {
  'SWORDS DANCE': { types: ['normal', 'grass', 'ground', 'bug', 'fighting', 'steel', 'dragon', 'dark'] }, 'NASTY PLOT': { types: ['dark', 'ghost', 'psychic', 'fire', 'electric', 'steel'] },
  'IRON DEFENSE': { types: ['steel', 'rock', 'ground', 'bug'] }, 'BULK UP': { types: ['fighting', 'normal', 'dragon', 'dark'] }, 'CALM MIND': { types: ['psychic', 'fairy', 'ghost', 'water', 'ice'] },
  AGILITY: { types: ['electric', 'flying', 'psychic', 'dragon', 'water', 'bug'] }, GROWL: { all: true }, 'TAIL WHIP': { all: true }, SCREECH: { all: true }, PROTECT: { all: true },
  DETECT: { types: ['fighting', 'normal', 'flying', 'dark'] }, COUNTER: { types: ['fighting', 'normal'] }, 'MIRROR COAT': { types: ['psychic', 'water', 'fairy'] },
  'RAIN DANCE': { all: true }, 'SUNNY DAY': { all: true }, REFLECT: { types: ['psychic', 'fairy', 'steel', 'electric', 'normal'] }, 'LIGHT SCREEN': { types: ['psychic', 'fairy', 'steel', 'electric', 'ice'] },
  TAUNT: { types: ['dark', 'poison', 'fighting', 'ghost', 'flying'] },
})
DISC_POOL.push('SWORDS DANCE', 'NASTY PLOT', 'CALM MIND', 'PROTECT', 'RAIN DANCE', 'SUNNY DAY', 'REFLECT', 'LIGHT SCREEN', 'TAUNT', 'SCREECH')
/*
 * Signature moves, learned by species (SPECIES_MOVES) rather than by type.
 *  · METRONOME: a random move from the whole game, for free.
 *  · SKETCH: learns, for good, the last move used on it this battle.
 *  · TRANSFORM: becomes the foe for the battle (types, stats, sprite, moves).
 *  · CURSE: costs half the user's max HP; the foe loses 1/4 each turn.
 *  · REST: full HP and no status, then asleep for 2 turns. SNORE: the one
 *    attack it can use asleep.
 *  · WISH: half the user's max HP, at the end of next turn, to whoever is out.
 *  · DISABLE: the foe can't use its last move for 3 turns.
 *  · MEAN LOOK: the foe can't flee (a roaming legendary stays put).
 *  · PERISH SONG: every Pokémon on the field faints in 3 turns unless it switches out.
 *  · BATON PASS: switches out, and the next one keeps the stat changes.
 *  · CONVERSION: the user's type becomes its first move's, for the battle.
 *  · TELEPORT: escapes a wild battle (a wild Abra, Kadabra or Alakazam may
 *    teleport away on any turn, unless Mean Look holds it). In a trainer
 *    battle it's a flash that lowers the other side's accuracy, then the
 *    user switches out for a teammate.
 *  · FLAIL: stronger the lower the user's HP. VOLT TACKLE: a third of the
 *    damage dealt comes back as recoil. KNOCK OFF: ×1.5 on a trainer's
 *    Pokémon, and it knocks a Gym Leader's FULL RESTORE away. FURY CUTTER:
 *    doubles each time it lands in a row (up to ×4).
 */
Object.assign(SUPPORT, {
  METRONOME:       { type: 'normal', target: 'self', effect: 'metronome', prio: 0, cost: 1, sub: 'a random move, free', solo: 'random move' },
  SKETCH:          { type: 'normal', target: 'foe', effect: 'sketch', prio: 0, cost: 0, sub: "learns the foe's last move", solo: 'copies foe move' },
  TRANSFORM:       { type: 'normal', target: 'foe', effect: 'transform', prio: 0, cost: 0, sub: 'becomes the foe this battle', solo: 'becomes the foe' },
  CURSE:           { type: 'ghost', target: 'foe', effect: 'curse', prio: 0, cost: 1, sub: '½ own HP: foe −¼ a turn', solo: '½ HP: foe −¼/turn' },
  REST:            { type: 'psychic', target: 'self', effect: 'rest', prio: 0, cost: 1, sub: 'full heal, sleeps 2 turns', solo: 'full heal + sleep' },
  'SOFT-BOILED':   { type: 'normal', target: 'self', effect: 'heal', amount: 0.5, prio: 0, cost: 1, sub: 'heals self 50%', solo: 'heal 50%' },
  WISH:            { type: 'normal', target: 'self', effect: 'wish', prio: 0, cost: 1, sub: 'heals 50% end of next turn', solo: 'heal 50% next turn' },
  'DRAGON DANCE':  { type: 'dragon', target: 'self', effect: 'stat', stages: { atk: 1, spe: 1 }, prio: 0, cost: 1, sub: 'ATK/SPE ▲ self', solo: 'ATK/SPE ▲' },
  DISABLE:         { type: 'normal', target: 'foe', effect: 'disable', prio: 0, cost: 1, sub: "foe's last move off · 3 turns", solo: 'blocks foe move' },
  AMNESIA:         { type: 'psychic', target: 'self', effect: 'stat', stages: { spd: 2 }, prio: 0, cost: 1, sub: 'SP.D ▲2 self', solo: 'SP.D ▲2' },
  'MEAN LOOK':     { type: 'normal', target: 'foe', effect: 'trap', prio: 0, cost: 0, sub: "foe can't flee", solo: "foe can't flee" },
  'PERISH SONG':   { type: 'normal', target: 'all', effect: 'perish', prio: 0, cost: 2, sub: 'all faint in 3 turns', solo: 'all faint in 3' },
  'FEATHER DANCE': { type: 'flying', target: 'foe', effect: 'stat', stages: { atk: -2 }, prio: 0, cost: 1, sub: "foe's ATK ▼2", solo: "foe's ATK ▼2" },
  'BATON PASS':    { type: 'normal', target: 'self', effect: 'baton', prio: 0, cost: 1, sub: 'switch, keeping stat changes', solo: 'switch + keep stats' },
  CONVERSION:      { type: 'normal', target: 'self', effect: 'conversion', prio: 0, cost: 0, sub: "type → its first move's", solo: 'changes its type' },
  TELEPORT:        { type: 'psychic', target: 'self', effect: 'teleport', prio: -1, cost: 0, sub: 'wild: escape · else flash, ACC ▼, switch', solo: 'escape / flash + switch' },
})
SUPPORT.RECOVER.solo = 'heal 50%'; SUPPORT['SLACK OFF'].solo = 'heal 50%'
Object.assign(MOVEDEX, {
  SNORE:         { type: 'normal', power: 50, cat: 'spec', cost: 1, fx: 'spray', snd: 'shadow', sleepOk: true, sub: 'only while asleep' },
  FLAIL:         { type: 'normal', power: 20, cat: 'phys', cost: 1, fx: 'dash', snd: 'thud', flail: true, sub: 'stronger at low HP' },
  'VOLT TACKLE': { type: 'electric', power: 90, cat: 'phys', cost: 3, fx: 'dash', snd: 'zap', recoil: 1 / 3, sub: '⅓ recoil' },
  'KNOCK OFF':   { type: 'dark', power: 65, cat: 'phys', cost: 2, fx: 'dash', snd: 'crunch', knockOff: true, sub: '×1.5 on trainers' },
  'FURY CUTTER': { type: 'bug', power: 40, cat: 'phys', cost: 1, fx: 'slash', snd: 'whoosh', furyCutter: true, sub: 'doubles in a row' },
})
Object.assign(FLINCH, { SNORE: 0.3 })
Object.assign(STATUS_ON_HIT, { 'VOLT TACKLE': ['par', 0.1] })
/** FLAIL's power at this HP: 20 at full, up to 120 near fainting. */
const flailPower = (m) => { const r = m.hp / m.stats.hp; return r > 0.68 ? 20 : r > 0.35 ? 40 : r > 0.2 ? 60 : r > 0.1 ? 80 : r > 0.04 ? 100 : 120 }
/** Metronome's pool: anything but the moves that need a setup it can't give. */
const METRONOME_NOT = new Set(['METRONOME', 'SKETCH', 'TRANSFORM', 'BATON PASS', 'TELEPORT', 'FAKE OUT', 'SNORE', 'PROTECT', 'DETECT', 'COUNTER', 'MIRROR COAT', 'HELPING HAND', 'AFTER YOU', 'HEAL PULSE', 'REST', 'PERISH SONG'])
const metronomePick = (solo) => { const pool = [...Object.keys(MOVEDEX), ...Object.keys(SUPPORT)].filter((n) => !METRONOME_NOT.has(n) && (!solo || !SUPPORT[n] || SUPPORT[n].solo)); return pool[Math.floor(Math.random() * pool.length)] }
/* Who learns what, by species: [level, move]. Evolved forms that share the line are listed too. */
const SPECIES_MOVES = {
  JIGGLYPUFF: [[5, 'SING']], CLEFAIRY: [[5, 'SING'], [20, 'METRONOME']], SMEARGLE: [[10, 'SKETCH']], DITTO: [[1, 'TRANSFORM']],
  GASTLY: [[12, 'HYPNOSIS'], [33, 'CURSE']], HAUNTER: [[12, 'HYPNOSIS'], [33, 'CURSE']], GENGAR: [[12, 'HYPNOSIS'], [33, 'CURSE']],
  SNORLAX: [[12, 'YAWN'], [20, 'REST'], [21, 'SNORE']], SLAKOTH: [[8, 'YAWN'], [20, 'SLACK OFF']],
  CHANSEY: [[12, 'SOFT-BOILED'], [23, 'SING'], [30, 'WISH']], BLISSEY: [[12, 'SOFT-BOILED'], [23, 'SING'], [30, 'WISH']],
  MAGIKARP: [[15, 'FLAIL']], GYARADOS: [[15, 'FLAIL'], [25, 'DRAGON DANCE']],
  PICHU: [[33, 'VOLT TACKLE']], PIKACHU: [[33, 'VOLT TACKLE']], RAICHU: [[33, 'VOLT TACKLE']],
  PSYDUCK: [[18, 'DISABLE'], [28, 'AMNESIA']], GOLDUCK: [[18, 'DISABLE'], [28, 'AMNESIA']],
  SABLEYE: [[15, 'MEAN LOOK'], [30, 'KNOCK OFF']], MISDREAVUS: [[14, 'CONFUSE RAY'], [40, 'PERISH SONG']],
  MURKROW: [[11, 'TAUNT'], [25, 'FEATHER DANCE']], SCYTHER: [[12, 'FURY CUTTER'], [24, 'SWORDS DANCE']],
  EEVEE: [[20, 'BATON PASS']], TANGELA: [[33, 'ANCIENT POWER']], PORYGON: [[1, 'CONVERSION']], ABRA: [[1, 'TELEPORT']], KADABRA: [[1, 'TELEPORT']], ALAKAZAM: [[1, 'TELEPORT']], GHOLDENGO: [[30, 'NASTY PLOT']],
}
Object.assign(DISC_RULES, { 'KNOCK OFF': { types: ['dark', 'fighting', 'ghost'] }, CURSE: { types: ['ghost'] }, REST: { all: true }, 'MEAN LOOK': { types: ['ghost', 'dark'] } })
DISC_POOL.push('REST', 'KNOCK OFF')
/* Foes' own setup or tricks, by species. */
/** Wild ones that teleport away: a chance each turn they're free to. */
const TELEPORTERS = new Set(['ABRA', 'KADABRA', 'ALAKAZAM'])
const TELEPORT_CHANCE = 0.35
Object.assign(FOE_STATUS_BY_SPECIES, { KADABRA: 'TELEPORT', ALAKAZAM: 'TELEPORT', SABLEYE: 'MEAN LOOK', MURKROW: 'TAUNT', GENGAR: 'CURSE', GYARADOS: 'DRAGON DANCE', SCYTHER: 'SWORDS DANCE', PSYDUCK: 'AMNESIA', GHOLDENGO: 'NASTY PLOT' })
/** "ATK▲2", "DEF▼" and the rest, for the HUD. */
const statTags = (t) => [['atk', 'ATK'], ['spa', 'SP.A'], ['def', 'DEF'], ['spd', 'SP.D'], ['spe', 'SPE']].filter(([k]) => t[k]).map(([k, l]) => `${l}${t[k] > 0 ? '▲' : '▼'}${Math.abs(t[k]) > 1 ? Math.abs(t[k]) : ''}`)
/** Weather on a move's damage. */
const weatherMult = (w, type) => (w === 'rain' ? (type === 'water' ? 1.5 : type === 'fire' ? 0.5 : 1) : w === 'sun' ? (type === 'fire' ? 1.5 : type === 'water' ? 0.5 : 1) : 1)
const WEATHER_TEXT = { rain: ['It started to rain!', 'The rain stopped.', 'RAIN'], sun: ['The sunlight turned harsh!', 'The sunlight faded.', 'SUN'] }
const FIELD_EFFECTS = ['stat', 'protect', 'counter', 'weather', 'screen', 'taunt']
/** How a move with its own `input` is landed, for the Box. */
const INPUT_HINT = { charge: 'hold A, let go in the gold zone', mash: 'mash A', swipe: 'enter the arrows', twin: 'two rings, one after the other', track: 'hold A while the dot is in the arc', rhythm: 'tap on the beat' }
const SPECIAL_EFFECTS = ['metronome', 'sketch', 'transform', 'curse', 'rest', 'wish', 'disable', 'trap', 'perish', 'baton', 'conversion', 'teleport']
/** Protect used again straight after: only a third of the time (a ninth the time after that…). */
const protectWorks = (t, r) => r() < 1 / 3 ** (t.protectRun ?? 0)
/** Can `m` take this status right now? (Not if it already has one, or its type is immune.) */
const canTake = (m, st) => !m.status && m.hp > 0 && !STATUS_IMMUNE[st].some((t) => m.types.includes(t))
/** After a landed hit: the status it inflicts, if its chance comes up. */
function statusFromHit(def, mv, r) { const e = STATUS_ON_HIT[mv.name]; return e && canTake(def, e[0]) && (window.__forceStatusHit || r() < e[1]) ? e[0] : null }   // __forceStatusHit: testing only
/** At a Pokémon's turn: 'thaw', 'frozen', 'para', 'asleep', 'wake' or null ('frozen', 'para' and 'asleep' lose the turn). */
function statusAtAction(m, r) {
  if (m.status === 'frz') { if (r() < 0.2) { m.status = null; return 'thaw' } return 'frozen' }
  if (m.status === 'slp') { if ((m.sleep ?? 0) > 0) { m.sleep--; return 'asleep' } m.status = null; return 'wake' }
  return m.status === 'par' && r() < 0.25 ? 'para' : null
}
const STATUS_TEXT = { thaw: 'thawed out!', frozen: 'is frozen solid!', para: "is paralyzed! It can't move!", asleep: 'is fast asleep.', wake: 'woke up!' }
const STATUS_GOT = { par: 'is paralyzed! It may be unable to move!', frz: 'was frozen solid!', brn: 'was burned!', psn: 'was poisoned!', tox: 'was badly poisoned!', slp: 'fell asleep!' }
/** Put on a status: sleep also rolls how long (1-3 turns). */
function setStatus(m, st, r) { m.status = st; if (st === 'slp') m.sleep = 1 + Math.floor(r() * 3); if (st === 'tox') m.toxN = 0 }
/** End of turn: the HP a burn or poison takes (bad poison counts up each turn). */
function statusTick(m) {
  if (m.hp <= 0) return 0
  if (m.status === 'tox') { m.toxN = Math.min(15, (m.toxN ?? 0) + 1); return Math.max(1, Math.floor(m.stats.hp * m.toxN / 16)) }
  return m.status === 'brn' || m.status === 'psn' ? Math.max(1, Math.floor(m.stats.hp / (m.status === 'brn' ? 16 : 8))) : 0
}
const STATUS_SFX = { par: 'zap', brn: 'whoosh', frz: 'clang', psn: 'shadow', tox: 'shadow', slp: 'shadow' }
const STAGE_WORD = { acc: 'accuracy', eva: 'evasiveness', atk: 'Attack', spa: 'Sp. Atk', def: 'Defense', spd: 'Sp. Def', spe: 'Speed' }
/** Confused and hurt itself: a 40-power typeless physical hit on itself. */
const confusionDmg = (m, atkStage = 0) => Math.max(1, Math.floor(Math.floor(Math.floor(2 * m.level / 5 + 2) * 40 * m.stats.atk * (atkStage >= 0 ? (2 + atkStage) / 2 : 2 / (2 - atkStage)) / m.stats.def) / 50) + 2)
const statusChip = (m) => (m.status ? `<span class="st ${m.status}">${STATUS_NAME[m.status]}</span>` : '')

/* Curing a status: items (Antidote, Paralyze Heal, Burn Heal, Ice Heal, Full
   Heal), and two support moves. Refresh cures the user (everyone learns it at
   Lv 10); Heal Bell cures your whole side (Move Disc). */
const CURE_ITEMS = ['antidote', 'parlyz', 'burnheal', 'iceheal', 'fullheal']
/** The cure to spend on `m`: the one made for its status if you have it, else a Full Heal; null if none fits. */
const cureFor = (m, bag) => (!m.status ? null : CURE_ITEMS.find((k) => k !== 'fullheal' && bag[k] && ITEMS[k].cure.includes(m.status)) ?? (bag.fullheal ? 'fullheal' : null))
const cureCount = (bag) => CURE_ITEMS.reduce((n, k) => n + (bag[k] ?? 0), 0)
Object.assign(SUPPORT, {
  REFRESH:     { type: 'normal', target: 'self', effect: 'cure', prio: 0, cost: 1, sub: 'cures own status', solo: 'cures its status' },
  'HEAL BELL': { type: 'normal', target: 'side', effect: 'cure', prio: 0, cost: 1, sub: 'cures both', solo: 'cures its status' },
})
Object.assign(DISC_RULES, { REFRESH: { all: true }, 'HEAL BELL': { all: true } })
DISC_POOL.push('HEAL BELL')

/* The battle Bag: a scrolling list of what you have, in this order. */
const BATTLE_ITEMS = ['ball', 'great', 'potion', 'super', 'revive', ...CURE_ITEMS]
/** One battle-Bag button: `off` greys it out, `why` is the line under its name. */
const bagButton = (k, n, off, why) => `<button class="btn ${ITEMS[k].cls}${off ? ' off' : ''}" data-act="${k}">${ITEMS[k].name}<small>× ${n} · ${why}</small></button>`
/** The list, scrolling, with BACK below it; a note when it's empty. */
const bagPanel = (buttons) => `<div class="bagscroll">${buttons.join('') || '<p class="bagempty">Your Bag is empty.</p>'}</div><button class="btn fback t-run" data-act="back">◀ BACK</button>`

/**
 * After the battle Bag is drawn: a bouncing ▼ at its foot while items
 * are hidden below, kept up to date as it scrolls.
 */
function bagMore(panel) {
  const list = panel.querySelector('.bagscroll'); if (!list) return
  const tag = document.createElement('div'); tag.className = 'bagmore'; panel.appendChild(tag)
  const update = () => {
    const below = [...list.querySelectorAll('.btn')].filter((b) => b.offsetTop + b.offsetHeight / 2 > list.scrollTop + list.clientHeight).length
    tag.textContent = '▼'; tag.hidden = !below   // just a bouncing arrow while there's more below
  }
  list.addEventListener('scroll', update, { passive: true }); requestAnimationFrame(update)
}

/*
 * Evolution. Each species' next form and level come from DATA.evos (real
 * levels where the games use them, stand-ins for stones, trade and the like).
 * It's checked on a level-up: a Pokémon at or past its level is prompted to
 * evolve after the battle (even one caught above that level: at its next
 * level-up). Stopped, it tries again 5 levels later. Branching species (Eevee)
 * pick one form, once.
 */
const speciesByName = (n) => [...DATA.starters, ...DATA.wild, ...DATA.trainer, ...(DATA.forms ?? [])].find((s) => s.name === n)
/** The evolution `m` is due for at its level, or null. */
function evoDue(m) {
  if (m.evoForce) return m.evoForce   // an evolution item, used from the Bag
  if (m.hp <= 0) return null
  const how = EVO_HOW[m.name]
  if (how) {
    if (m.evoWait && m.level < m.evoWait) return null
    // At a level-up: knowing the move, or a full Bond (with the time of day or a Fairy move where that picks the form).
    const r = how.find((x) => (x.move ? learn(m).learned.includes(x.move) : x.bond ? bondReady(m, x) : false))
    // A species that also evolves by level (Slowpoke: Slowbro by level, Slowking by Linking Cord) goes on to check that.
    if (r || !(DATA.evos?.[m.name] ?? []).some((o) => !o.standIn)) return r ?? null
  }
  const opts = DATA.evos?.[m.name]; if (!opts?.length) return null
  m.evoPick ??= Math.floor(Math.random() * opts.length)
  const e = opts[Math.min(m.evoPick, opts.length - 1)]
  return m.level >= e.level && (!m.evoWait || m.level >= m.evoWait) ? e : null
}
/** "Charmeleon at Lv 16", for the stat page. */
function evoText(m) {
  const how = EVO_HOW[m.name]
  const byLevel = (DATA.evos?.[m.name] ?? []).filter((o) => !o.standIn).map((o) => `${cap1(o.to)} at Lv ${o.level}`)
  if (how) return [...byLevel, ...how.map((r) => `${cap1(r.to)} ${howText(r)}`)].join('; ') + (m.evoWait ? ` (it was stopped: not before Lv ${m.evoWait})` : '')
  const opts = DATA.evos?.[m.name]; if (!opts?.length) return ''
  const names = [...new Set(opts.map((o) => o.to))], lv = opts[0].level
  const when = m.evoWait && m.evoWait > lv ? `Lv ${m.evoWait} (it was stopped)` : `Lv ${lv}${opts[0].standIn ? ' (stand-in)' : ''}`
  return `${names.length > 1 ? names.join(', ') : names[0]} at ${when}`
}
/** Becomes the new form: same level, IVs, nature, moves; new species, types and stats; the HP it was missing stays missing. */
function evolveInto(m, to) {
  const sp = speciesByName(to), missing = m.stats.hp - m.hp
  Object.assign(m, { id: sp.id, name: sp.name, types: sp.types, base: sp.base, capture: sp.capture })
  delete m.evo; delete m.evoPick; delete m.evoWait; delete m.evoForce
  m.stats = statsAt(m, m.level); m.hp = Math.max(1, m.stats.hp - missing)
}
/* The music: a shimmering loop while it changes, then a short fanfare. */
SONGS.evolution = { file: null, loop: true, bpm: 132, div: 2, chordLen: 8, vol: 0.8,
  leadInst: 'glock', harmInst: 'strings', comp: false, hats16: false, crash: false, fill: '',
  sections: [{
    chords: 'C Am F G C Am F G'.split(' '),
    lead: bars('C5 E5 G5 C6 G5 E5 C5 E5', 'A4 C5 E5 A5 E5 C5 A4 C5', 'F4 A4 C5 F5 C5 A4 F4 A4', 'G4 B4 D5 G5 D5 B4 G4 B4',
      'E5 G5 C6 E6 C6 G5 E5 G5', 'C5 E5 A5 C6 A5 E5 C5 E5', 'A4 C5 F5 A5 F5 C5 A4 C5', 'B4 D5 G5 B5 D6 B5 G5 D5'),
    bass: bars('C2 . . . . . . .', 'A1 . . . . . . .', 'F1 . . . . . . .', 'G1 . . . . . . .', 'C2 . . . . . . .', 'A1 . . . . . . .', 'F1 . . . . . . .', 'G1 . . . G1 . . .'),
    drums: '........'.repeat(6) + 'K...K...' + 'K.K.SSSS' }] }
SONGS.evolved = { file: null, loop: false, bpm: 140, div: 2, chordLen: 8, vol: 0.9,
  leadInst: 'brass', harmInst: 'brass', comp: false, hats16: false, crash: true, fill: '', glock: true,
  sections: [{
    chords: 'C F G C'.split(' '),
    lead: bars('G4 . C5 . E5 . G5 .', 'A5 . . . F5 . A5 .', 'G5 . B5 . D6 . . .', 'C6 . . . . . . -'),
    bass: bars('C2 . . . G1 . . .', 'F1 . . . C2 . . .', 'G1 . . . D2 . . .', 'C2 . . . . . . -'),
    drums: 'K...S...' + 'K...S...' + 'K.S.K.SS' + 'C.......' }] }

/*
 * Evolutions that don't go by level, the way the games do them:
 *   item  — use an evolution stone (or the LINKING CORD, for trade evolutions)
 *           on it from the Bag. Seadra also needs a DRAGON SCALE in the Bag.
 *   bond  — its Bond is full at a level-up. Eevee's form then follows the time
 *           of day (Espeon by day, Umbreon at night), or Sylveon if it knows a
 *           Fairy move.
 *   move  — it levels up knowing that move (learned by level, or a Move Disc).
 * Stopped (B) on a level-up, it tries again 5 levels later; stopped with an
 * item, the item isn't used.
 */
const EVO_HOW = {
  PIKACHU: [{ to: 'RAICHU', item: 'thunderstone' }],
  MAGNETON: [{ to: 'MAGNEZONE', item: 'thunderstone' }],
  EEVEE: [{ to: 'VAPOREON', item: 'waterstone' }, { to: 'JOLTEON', item: 'thunderstone' }, { to: 'FLAREON', item: 'firestone' },
    { to: 'LEAFEON', item: 'leafstone' }, { to: 'GLACEON', item: 'icestone' },
    { to: 'SYLVEON', bond: true, fairy: true }, { to: 'ESPEON', bond: true, time: 'day' }, { to: 'UMBREON', bond: true, time: 'night' }],
  PICHU: [{ to: 'PIKACHU', bond: true }],
  RIOLU: [{ to: 'LUCARIO', bond: true }],
  AIPOM: [{ to: 'AMBIPOM', move: 'DOUBLE HIT' }],
  LICKITUNG: [{ to: 'LICKILICKY', move: 'ROLLOUT' }],
  PILOSWINE: [{ to: 'MAMOSWINE', move: 'ANCIENT POWER' }],
  HAUNTER: [{ to: 'GENGAR', item: 'linkcable' }],
  SEADRA: [{ to: 'KINGDRA', item: 'linkcable', needs: 'dragonscale' }],
}
// The families added with the new species (see DATA.wild): stones, the Linking Cord for trade evolutions, Bond for friendship ones.
Object.assign(EVO_HOW, {"CLEFFA":[{"to":"CLEFAIRY","bond":true}],"IGGLYBUFF":[{"to":"JIGGLYPUFF","bond":true}],"HAPPINY":[{"to":"CHANSEY","bond":true}],"MUNCHLAX":[{"to":"SNORLAX","bond":true}],"MIME JR.":[{"to":"MR. MIME","bond":true}],"CHANSEY":[{"to":"BLISSEY","bond":true}],"CLEFAIRY":[{"to":"CLEFABLE","item":"moonstone"}],"JIGGLYPUFF":[{"to":"WIGGLYTUFF","item":"moonstone"}],"SKITTY":[{"to":"DELCATTY","item":"moonstone"}],"SUNKERN":[{"to":"SUNFLORA","item":"sunstone"}],"MURKROW":[{"to":"HONCHKROW","item":"duskstone"}],"MISDREAVUS":[{"to":"MISMAGIUS","item":"duskstone"}],"RHYDON":[{"to":"RHYPERIOR","item":"linkcable"}],"SCYTHER":[{"to":"SCIZOR","item":"linkcable"}],"PORYGON":[{"to":"PORYGON2","item":"linkcable"}],"PORYGON2":[{"to":"PORYGON-Z","item":"linkcable"}],"ELECTABUZZ":[{"to":"ELECTIVIRE","item":"linkcable"}],"MAGMAR":[{"to":"MAGMORTAR","item":"linkcable"}],"TANGELA":[{"to":"TANGROWTH","move":"ANCIENT POWER"}]})
Object.assign(EVO_HOW, {"VULPIX":[{"to":"NINETALES","item":"firestone"}],"GOLBAT":[{"to":"CROBAT","bond":true}],"GLOOM":[{"to":"VILEPLUME","item":"leafstone"}],"POLIWHIRL":[{"to":"POLIWRATH","item":"waterstone"}],"KADABRA":[{"to":"ALAKAZAM","item":"linkcable"}],"MACHOKE":[{"to":"MACHAMP","item":"linkcable"}],"WEEPINBELL":[{"to":"VICTREEBEL","item":"leafstone"}],"GRAVELER":[{"to":"GOLEM","item":"linkcable"}],"EXEGGCUTE":[{"to":"EXEGGUTOR","item":"leafstone"}],"STARYU":[{"to":"STARMIE","item":"waterstone"}]})
EVO_HOW.GLOOM.push({ to: 'BELLOSSOM', item: 'sunstone' })
// Gen 1-2's stone, Linking Cord and Bond evolutions, added to any a species already has (Poliwhirl: Water Stone for Poliwrath, Linking Cord for Politoed).
for (const [n, rules] of Object.entries({"BUDEW":[{"to":"ROSELIA","bond":true,"time":"day"}],"ROSELIA":[{"to":"ROSERADE","item":"shinystone"}],"MINCCINO":[{"to":"CINCCINO","item":"shinystone"}],"FLOETTE":[{"to":"FLORGES","item":"shinystone"}],"TOGETIC":[{"to":"TOGEKISS","item":"shinystone"}]})) EVO_HOW[n] = [...(EVO_HOW[n] ?? []), ...rules]
for (const [n, rules] of Object.entries({"NIDORINA":[{"to":"NIDOQUEEN","item":"moonstone"}],"NIDORINO":[{"to":"NIDOKING","item":"moonstone"}],"SHELLDER":[{"to":"CLOYSTER","item":"waterstone"}],"TOGEPI":[{"to":"TOGETIC","bond":true}],"POLIWHIRL":[{"to":"POLITOED","item":"linkcable"}],"SLOWPOKE":[{"to":"SLOWKING","item":"linkcable"}],"GROWLITHE":[{"to":"ARCANINE","item":"firestone"}],"ONIX":[{"to":"STEELIX","item":"linkcable"}]})) EVO_HOW[n] = [...(EVO_HOW[n] ?? []), ...rules]
const cap1 = (s) => s[0] + s.slice(1).toLowerCase()
const EVO_ITEM_NAME = { thunderstone: 'THUNDER STONE', waterstone: 'WATER STONE', firestone: 'FIRE STONE', leafstone: 'LEAF STONE', icestone: 'ICE STONE', moonstone: 'MOON STONE', sunstone: 'SUN STONE', duskstone: 'DUSK STONE', shinystone: 'SHINY STONE', linkcable: 'LINKING CORD', dragonscale: 'DRAGON SCALE' }
/** "with a THUNDER STONE", "at full Bond, by day", "levelling up knowing ROLLOUT". */
const howText = (r) => (r.item ? `with a ${EVO_ITEM_NAME[r.item]}${r.needs ? ` (and a ${EVO_ITEM_NAME[r.needs]})` : ''}`
  : r.bond ? `at full Bond${r.fairy ? ', knowing a Fairy move' : r.time === 'day' ? ', by day' : r.time === 'night' ? ', at night' : ''}`
  : `levelling up knowing ${r.move}`)

/* Bond: 0-100, per Pokémon. It grows from battles it fights in (+10), sitting
   out with the EXP. SHARE (+4), and PERFECT strikes and parries (+2 each); a
   faint costs 10. */
const BOND_FULL = 100
const addBond = (m, n) => { if (m) m.bond = Math.max(0, Math.min(BOND_FULL, (m.bond ?? 0) + n)) }
const knowsFairy = (m) => learn(m).learned.some((n) => (SUPPORT[n] ?? MOVEDEX[n])?.type === 'fairy')
function bondReady(m, r) {
  if ((m.bond ?? 0) < BOND_FULL) return false
  if (r.fairy) return knowsFairy(m)
  const t = typeof timeOfDay === 'function' ? timeOfDay() : 'day'
  return !r.time || (r.time === 'night' ? t === 'night' : t !== 'night')
}
/** Does any of its evolutions go by Bond? (for the stat page's heart) */
const bondEvolves = (m) => !!EVO_HOW[m.name]?.some((r) => r.bond)
/** The rule an item would use on `m`, or a reason it won't work. */
function evoByItem(m, key, bag) {
  const r = EVO_HOW[m.name]?.find((x) => x.item === key)
  if (!r) return { why: `${m.name} won't react to it` }
  if (m.hp <= 0) return { why: `${m.name} has fainted` }
  if (r.needs && !bag[r.needs]) return { why: `needs a ${EVO_ITEM_NAME[r.needs]} too` }
  return { rule: r }
}

/* The moves those evolutions need, as moves. Aipom's multi-hit move is Fury
   Swipes until Double Hit at 32 (when it evolves, a level later), Lickitung
   learns Rollout at 33, Piloswine Ancient Power at 40; Move Discs teach them
   sooner. Eevee needs a disc for a Fairy move (Fairy Wind). */
Object.assign(MOVEDEX, {
  ROLLOUT:         { type: 'rock', power: 30, cat: 'phys', cost: 3, hits: 3, fx: 'dash', snd: 'thud' },
  'ANCIENT POWER': { type: 'rock', power: 60, cat: 'spec', cost: 2, fx: 'rock', snd: 'thud' },
})
MULTI_BY_SPECIES.AIPOM = 'FURY SWIPES'

/*
 * The later moves: every type learns three more, at Lv 30, 45 and 60, and
 * Grass learns ABSORB at 24. PP follows total power (up to 50: 1 PP,
 * 55-75: 2, 80 and up: 3). `drain` heals the user that share of the damage
 * dealt. Each is also a Move Disc for its own type; the Lv 30 ones (and
 * Absorb) can drop from battles.
 */
Object.assign(MOVEDEX, {
  ABSORB:         { type: 'grass', power: 40, cat: 'spec', cost: 1, fx: 'seed', snd: 'whoosh', drain: 0.5 },
  'FIRE FANG':    { type: 'fire', power: 65, cat: 'phys', cost: 2, fx: 'ember', snd: 'crunch' },
  FLAMETHROWER:   { type: 'fire', power: 75, cat: 'spec', cost: 2, fx: 'ember', snd: 'whoosh' },
  'FIRE BLAST':   { type: 'fire', power: 90, cat: 'spec', cost: 3, fx: 'ember', snd: 'whoosh' },
  'WATER PULSE':  { type: 'water', power: 60, cat: 'spec', cost: 2, fx: 'water', snd: 'whoosh' },
  WATERFALL:      { type: 'water', power: 75, cat: 'phys', cost: 2, fx: 'water', snd: 'whoosh' },
  'HYDRO PUMP':   { type: 'water', power: 90, cat: 'spec', cost: 3, fx: 'water', snd: 'whoosh' },
  'SEED BOMB':    { type: 'grass', power: 60, cat: 'phys', cost: 2, fx: 'seed', snd: 'thud' },
  'ENERGY BALL':  { type: 'grass', power: 75, cat: 'spec', cost: 2, fx: 'seed', snd: 'whoosh' },
  'GIGA DRAIN':   { type: 'grass', power: 80, cat: 'spec', cost: 3, fx: 'seed', snd: 'whoosh', drain: 0.5 },
  SPARK:          { type: 'electric', power: 60, cat: 'phys', cost: 2, fx: 'spray', snd: 'zap' },
  THUNDERBOLT:    { type: 'electric', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'zap' },
  THUNDER:        { type: 'electric', power: 90, cat: 'spec', cost: 3, fx: 'spray', snd: 'zap' },
  'AURORA BEAM':  { type: 'ice', power: 60, cat: 'spec', cost: 2, fx: 'icicle', snd: 'whoosh' },
  'ICE BEAM':     { type: 'ice', power: 75, cat: 'spec', cost: 2, fx: 'icicle', snd: 'whoosh' },
  BLIZZARD:       { type: 'ice', power: 90, cat: 'spec', cost: 3, fx: 'icicle', snd: 'whoosh' },
  'BRICK BREAK':  { type: 'fighting', power: 60, cat: 'phys', cost: 2, fx: 'slash', snd: 'thud' },
  'DYNAMIC PUNCH':{ type: 'fighting', power: 75, cat: 'phys', cost: 2, fx: 'dash', snd: 'thud' },
  'CROSS CHOP':   { type: 'fighting', power: 90, cat: 'phys', cost: 3, fx: 'slash', snd: 'thud' },
  'POISON JAB':   { type: 'poison', power: 65, cat: 'phys', cost: 2, fx: 'needle', snd: 'whoosh' },
  'SLUDGE BOMB':  { type: 'poison', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'whoosh' },
  'GUNK SHOT':    { type: 'poison', power: 90, cat: 'phys', cost: 3, fx: 'spray', snd: 'thud' },
  'MUD SHOT':     { type: 'ground', power: 60, cat: 'spec', cost: 2, fx: 'spray', snd: 'thud' },
  DIG:            { type: 'ground', power: 75, cat: 'phys', cost: 2, fx: 'dash', snd: 'thud' },
  'EARTH POWER':  { type: 'ground', power: 90, cat: 'spec', cost: 3, fx: 'rock', snd: 'thud' },
  'WING ATTACK':  { type: 'flying', power: 60, cat: 'phys', cost: 2, fx: 'slash', snd: 'whoosh' },
  'AIR SLASH':    { type: 'flying', power: 75, cat: 'spec', cost: 2, fx: 'slash', snd: 'whoosh' },
  'BRAVE BIRD':   { type: 'flying', power: 90, cat: 'phys', cost: 3, fx: 'dash', snd: 'whoosh' },
  EXTRASENSORY:   { type: 'psychic', power: 65, cat: 'spec', cost: 2, fx: 'spray', snd: 'shadow' },
  PSYCHIC:        { type: 'psychic', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'shadow' },
  'ZEN HEADBUTT': { type: 'psychic', power: 90, cat: 'phys', cost: 3, fx: 'dash', snd: 'shadow' },
  'X-SCISSOR':    { type: 'bug', power: 65, cat: 'phys', cost: 2, fx: 'slash', snd: 'whoosh' },
  'BUG BUZZ':     { type: 'bug', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'whoosh' },
  MEGAHORN:       { type: 'bug', power: 90, cat: 'phys', cost: 3, fx: 'needle', snd: 'thud' },
  'ROCK TOMB':    { type: 'rock', power: 60, cat: 'phys', cost: 2, fx: 'rock', snd: 'thud' },
  'POWER GEM':    { type: 'rock', power: 75, cat: 'spec', cost: 2, fx: 'rock', snd: 'whoosh' },
  'STONE EDGE':   { type: 'rock', power: 90, cat: 'phys', cost: 3, fx: 'rock', snd: 'thud' },
  HEX:            { type: 'ghost', power: 65, cat: 'spec', cost: 2, fx: 'spray', snd: 'shadow' },
  'SHADOW BALL':  { type: 'ghost', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'shadow' },
  'PHANTOM FORCE':{ type: 'ghost', power: 90, cat: 'phys', cost: 3, fx: 'dash', snd: 'shadow' },
  'DRAGON CLAW':  { type: 'dragon', power: 65, cat: 'phys', cost: 2, fx: 'slash', snd: 'crunch' },
  'DRAGON PULSE': { type: 'dragon', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'shadow' },
  OUTRAGE:        { type: 'dragon', power: 90, cat: 'phys', cost: 3, fx: 'dash', snd: 'thud' },
  'FEINT ATTACK': { type: 'dark', power: 60, cat: 'phys', cost: 2, fx: 'dash', snd: 'crunch' },
  CRUNCH:         { type: 'dark', power: 75, cat: 'phys', cost: 2, fx: 'dash', snd: 'crunch' },
  'DARK PULSE':   { type: 'dark', power: 90, cat: 'spec', cost: 3, fx: 'spray', snd: 'shadow' },
  'IRON HEAD':    { type: 'steel', power: 65, cat: 'phys', cost: 2, fx: 'dash', snd: 'crunch' },
  'FLASH CANNON': { type: 'steel', power: 75, cat: 'spec', cost: 2, fx: 'spray', snd: 'zap' },
  'IRON TAIL':    { type: 'steel', power: 90, cat: 'phys', cost: 3, fx: 'slash', snd: 'thud' },
  'DRAINING KISS':{ type: 'fairy', power: 50, cat: 'spec', cost: 1, fx: 'spray', snd: 'whoosh', drain: 0.75 },
  'PLAY ROUGH':   { type: 'fairy', power: 75, cat: 'phys', cost: 2, fx: 'dash', snd: 'whoosh' },
  MOONBLAST:      { type: 'fairy', power: 90, cat: 'spec', cost: 3, fx: 'spray', snd: 'whoosh' },
  HEADBUTT:       { type: 'normal', power: 60, cat: 'phys', cost: 2, fx: 'dash', snd: 'thud' },
  'BODY SLAM':    { type: 'normal', power: 75, cat: 'phys', cost: 2, fx: 'dash', snd: 'thud' },
  'HYPER BEAM':   { type: 'normal', power: 90, cat: 'spec', cost: 3, fx: 'spray', snd: 'zap' },
})
const LATE_MOVES = {
  fire: ['FIRE FANG', 'FLAMETHROWER', 'FIRE BLAST'],
  water: ['WATER PULSE', 'WATERFALL', 'HYDRO PUMP'],
  grass: ['SEED BOMB', 'ENERGY BALL', 'GIGA DRAIN'],
  electric: ['SPARK', 'THUNDERBOLT', 'THUNDER'],
  ice: ['AURORA BEAM', 'ICE BEAM', 'BLIZZARD'],
  fighting: ['BRICK BREAK', 'DYNAMIC PUNCH', 'CROSS CHOP'],
  poison: ['POISON JAB', 'SLUDGE BOMB', 'GUNK SHOT'],
  ground: ['MUD SHOT', 'DIG', 'EARTH POWER'],
  flying: ['WING ATTACK', 'AIR SLASH', 'BRAVE BIRD'],
  psychic: ['EXTRASENSORY', 'PSYCHIC', 'ZEN HEADBUTT'],
  bug: ['X-SCISSOR', 'BUG BUZZ', 'MEGAHORN'],
  rock: ['ROCK TOMB', 'POWER GEM', 'STONE EDGE'],
  ghost: ['HEX', 'SHADOW BALL', 'PHANTOM FORCE'],
  dragon: ['DRAGON CLAW', 'DRAGON PULSE', 'OUTRAGE'],
  dark: ['FEINT ATTACK', 'CRUNCH', 'DARK PULSE'],
  steel: ['IRON HEAD', 'FLASH CANNON', 'IRON TAIL'],
  fairy: ['DRAINING KISS', 'PLAY ROUGH', 'MOONBLAST'],
  normal: ['HEADBUTT', 'BODY SLAM', 'HYPER BEAM'],
}
Object.assign(STATUS_ON_HIT, { 'FIRE BLAST': ['brn', 0.1], THUNDER: ['par', 0.3], 'GUNK SHOT': ['psn', 0.3], 'BODY SLAM': ['par', 0.3] })
for (const [t, names] of Object.entries(LATE_MOVES)) for (const n of names) DISC_RULES[n] = { types: [t] }
DISC_RULES.ABSORB = { types: ['grass'] }
DISC_POOL.push('ABSORB', ...Object.values(LATE_MOVES).map((l) => l[0]))
/* How each move is landed, when it isn't one STRIKE ring (see strikeInput). */
for (const [input, names] of Object.entries({
  charge: ['HYPER BEAM', 'SOLAR BEAM', 'FIRE BLAST', 'HYDRO PUMP', 'BLIZZARD', 'THUNDER'],
  mash: ['OUTRAGE', 'THRASH', 'PETAL DANCE', 'ROLLOUT'],
  swipe: ['CROSS CHOP', 'X-SCISSOR', 'DRAGON CLAW', 'IRON TAIL', 'BRICK BREAK'],
  twin: ['DOUBLE KICK', 'DUAL CHOP', 'DUAL WINGBEAT', 'DOUBLE HIT', 'TWINEEDLE'],
  track: ['PSYCHIC', 'ICE BEAM', 'AURORA BEAM', 'FLASH CANNON'],
})) for (const n of names) if (MOVEDEX[n]) MOVEDEX[n].input = input
SUPPORT.SING.input = 'rhythm'
/* Rampage moves: mashed, and unless it was PERFECT the user is confused afterwards from the effort. Hyper Beam: the user has to recharge next turn. */
Object.assign(MOVEDEX, {
  THRASH:        { type: 'normal', power: 90, cat: 'phys', cost: 3, fx: 'dash', snd: 'thud', input: 'mash', rampage: true },
  'PETAL DANCE': { type: 'grass', power: 90, cat: 'spec', cost: 3, fx: 'seed', snd: 'whoosh', input: 'mash', rampage: true },
  'SOLAR BEAM':  { type: 'grass', power: 90, cat: 'spec', cost: 3, fx: 'seed', snd: 'zap', input: 'charge' },
})
MOVEDEX.OUTRAGE.rampage = true; MOVEDEX['HYPER BEAM'].recharge = true
Object.assign(MOVEDEX.ROLLOUT, { power: 90, hits: 1 })   // one mashed roll now, not three rings
Object.assign(DISC_RULES, { THRASH: { types: ['normal', 'fighting', 'dragon'] }, 'PETAL DANCE': { types: ['grass', 'fairy'] }, 'SOLAR BEAM': { types: ['grass'] } })
const EVO_MOVES = { AIPOM: [32, 'DOUBLE HIT'], LICKITUNG: [33, 'ROLLOUT'], PILOSWINE: [40, 'ANCIENT POWER'] }
{
  const base = levelMoves
  levelMoves = (m) => { const l = base(m), e = EVO_MOVES[m.name]; return e && !l.some(([, n]) => n === e[1]) ? [...l, e].sort((a, b) => a[0] - b[0]) : l }
}
Object.assign(DISC_RULES, {
  'DOUBLE HIT':    { types: ['normal', 'fighting'] },
  ROLLOUT:         { types: ['rock', 'ground', 'normal', 'ice'] },
  'ANCIENT POWER': { types: ['rock', 'ground', 'ice'] },
  'FAIRY WIND':    { types: ['fairy', 'flying'], species: ['EEVEE'] },
})
DISC_POOL.push('DOUBLE HIT', 'ROLLOUT', 'ANCIENT POWER', 'FAIRY WIND')

const TRAINER_MOVES = {
  GHOLDENGO: [
    { name: 'MAKE IT RAIN', type: 'steel', power: 20, cat: 'spec', hits: 3, kind: 'strike', ranged: true, fx: 'coins', snd: 'coin' },
    L_('LOW KICK', 'fighting', 40, 'phys', 'sweep', 'thud'),
    { name: 'SHADOW BALL', type: 'ghost', power: 40, cat: 'spec', hits: 1, kind: 'strike', ranged: true, fx: 'orb', snd: 'shadow' },
  ],
  // Paul's ground-type wall: two of its three moves have to be jumped.
  HIPPOWDON: [
    L_('BULLDOZE', 'ground', 40, 'phys', 'quake', 'quake'),
    S_('CRUNCH', 'dark', 45, 'phys', 'crunch'),
    L_('SAND TOMB', 'ground', 35, 'phys', 'wave', 'thud'),
  ],
  // The rest of the scalpers' pools.
  PERSIAN: [S_('PAY DAY', 'normal', 40, 'phys', 'coin', { ranged: true, fx: 'coins' }), S_('SLASH', 'normal', 50, 'phys', 'whoosh'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
  SABLEYE: [L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('POWER GEM', 'rock', 50, 'spec', 'shadow', { ranged: true }), S_('FURY SWIPES', 'normal', 18, 'phys', 'whoosh', { hits: 3 })],
  MAWILE: [S_('IRON HEAD', 'steel', 50, 'phys', 'crunch'), S_('PLAY ROUGH', 'fairy', 50, 'phys', 'thud'), S_('CRUNCH', 'dark', 45, 'phys', 'crunch')],
  GREEDENT: [S_('BULLET SEED', 'grass', 20, 'phys', 'whoosh', { hits: 3, ranged: true }), S_('BODY SLAM', 'normal', 50, 'phys', 'thud'), L_('STOMPING TANTRUM', 'ground', 45, 'phys', 'quake', 'quake')],
  SNORLAX: [S_('BODY SLAM', 'normal', 55, 'phys', 'thud'), L_('HIGH HORSEPOWER', 'ground', 50, 'phys', 'quake', 'quake'), S_('CRUNCH', 'dark', 45, 'phys', 'crunch')],
  GARBODOR: [L_('SLUDGE WAVE', 'poison', 45, 'spec', 'wave', 'whoosh'), S_('BODY SLAM', 'normal', 50, 'phys', 'thud'), S_('ACID SPRAY', 'poison', 35, 'spec', 'whoosh', { ranged: true })],
  // Brian's: whatever was cheapest.
  MAGIKARP,
  BIDOOF: [S_('TACKLE', 'normal', 40, 'phys', 'thud'), L_('ROLLOUT', 'rock', 25, 'phys', 'roll', 'thud', { hits: 2 }), S_('HEADBUTT', 'normal', 45, 'phys', 'thud')],
  SUNKERN: [S_('ABSORB', 'grass', 30, 'spec', 'whoosh', { ranged: true, drain: 0.5 }), S_('RAZOR LEAF', 'grass', 40, 'phys', 'whoosh', { ranged: true })],
  PSYDUCK: [S_('WATER GUN', 'water', 40, 'spec', 'whoosh', { ranged: true }), S_('SCRATCH', 'normal', 40, 'phys', 'whoosh'), S_('CONFUSION', 'psychic', 40, 'spec', 'shadow', { ranged: true })],
}

/*
 * Each scalper draws from a pool rather than bringing one set Pokémon. `min`
 * is the trainer level a Pokémon starts turning up at. Every trainer brings
 * two or three (their deck): see deckFor().
 */
const POOLS = {
  HERB: [{ name: 'GHOLDENGO', min: 1 }, { name: 'PERSIAN', min: 1 }, { name: 'SABLEYE', min: 8 }, { name: 'MAWILE', min: 12 }],
  PAUL: [{ name: 'HIPPOWDON', min: 1 }, { name: 'GREEDENT', min: 1 }, { name: 'SNORLAX', min: 10 }, { name: 'GARBODOR', min: 14 }],
  BRIAN: [{ name: 'MAGIKARP', min: 1 }, { name: 'BIDOOF', min: 1 }, { name: 'SUNKERN', min: 1 }, { name: 'PSYDUCK', min: 5 }],
}
/*
 * The scalpers. `down` and `faceDown` are their pose and portrait after
 * losing. Each line set is a list of variations, one picked per battle:
 * `intro` before, `outro` when they lose, `gloat` when they win.
 */
const HERB = {
  short: 'HERB', full: 'TEAM UNEMPLOYED HERB', vs: 'herbVs', face: 'herbFace', body: 'herbBody', down: 'herbDown', faceDown: 'herbFaceDown', tokens: '0.75', mon: 'GHOLDENGO',
  intro: [
    ["Ayy, machine's closed, chief.", "Been refreshing since 6 AM. This restock's mine."],
    ['You here for the packs? Cute.', "I got a bot, two phones and a cousin in the back. You got... that?"],
    ["Don't even look at the Charizard slot.", "I already sold it. Online. Twenty minutes ago."],
    ['Retail is for people with patience.', 'I have a resale margin.'],
    ["Funny seeing you again.", "Same spot, same restock. Different outcome this time."],
    ["Chief. Chief. Don't make this weird.", 'Just hand me the spot and nobody gets outbid.'],
    ['I got three tabs open and a cart waiting.', "You're the only thing loading slow."],
    ["Paul's holding my place in the other line.", "So this one's all me. Me and Gholdengo."],
  ],
  outro: [
    ['...Aight. You got hands.', "Machine's yours. I'll catch the next one."],
    ['Nah, that was lag.', "...Fine. It wasn't lag."],
    ['Whatever. My bot gets the next drop anyway.', "Probably. Hopefully."],
    ["You know what? Keep 'em.", "Market's soft on this set anyway."],
    ['Tell nobody about this.', "Especially not Paul."],
    ['Bro. My resale spreadsheet.', 'You just put a red number on it.'],
    ["Aight, aight. I'll flip the next one.", "Can't win 'em all. Statistically."],
    ["That's a loss I can write off.", "...Can I write that off? I'll ask my cousin."],
  ],
  gloat: [
    ['Told you. Restock was always mine.', 'Try being faster next time.'],
    ["Don't feel bad. Everybody loses to me eventually.", 'Mostly at checkout.'],
    ["That's the cost of retail, chief.", 'Go heal up and come back crying.'],
    ["I'll save you a pack.", "Triple MSRP, though."],
    ['Packs secured, chief.', "Check the listings tonight. You'll see 'em."],
    ["Speed, chief. It's all speed.", 'Bots, phones, Pokémon. All fast.'],
  ],
}
const PAUL = {
  short: 'PAUL', full: 'TEAM UNEMPLOYED PAUL', vs: 'paulVs', face: 'paulFace', body: 'paulBody', down: 'paulDown', faceDown: 'paulFaceDown', tokens: '1.00', mon: 'HIPPOWDON',
  intro: [
    ['Purchase limit? Never heard of her.', 'Forty booster boxes in the basement. Room for forty more.'],
    ["I'm just browsing.", "...Browsing the whole machine. Every slot."],
    ['My mom says I can have one more shelf.', "This restock is that shelf."],
    ['Back of the line, buddy.', "The line is me. I'm the line."],
    ['Oh. You again.', "Fine. Quick battle. I've got boxes to sort."],
    ['I brought a wagon this time.', 'A big one. For the boxes.'],
    ['Herb said I gotta be scarier.', '...Boo? Was that scary? Battle me.'],
    ["Shh. I'm counting the slots.", 'Okay. All of them. I want all of them.'],
  ],
  outro: [
    ['Oof. Okay. Fine.', "Basement's getting kinda full anyway."],
    ["That's... that's fair.", "I'll just go reorganise my binders."],
    ['Mom is gonna ask why I came home empty-handed.', 'I am not telling her about this.'],
    ["You can have it. I'm on a budget now.", "...Since about four seconds ago."],
    ["Good battle. Real good.", "Don't tell Herb I said that."],
    ['The wagon goes home empty.', 'Sad little wagon.'],
    ["That's okay. I like my old cards.", "...I'm saying that to feel better."],
    ["Herb's gonna text me 'bro.'", "Just 'bro.' I hate when he does that."],
  ],
  gloat: [
    ['Heh. Sorry, buddy.', 'This restock goes in the basement.'],
    ["Don't worry about it.", "I'll list one for you. Small markup. Tiny."],
    ['Shelf space secured.', 'Better luck next drop.'],
    ['You should get a bigger team.', 'Or a bigger basement.'],
    ["Wagon's full!", "Watch your toes. It doesn't steer."],
    ['Sorry, buddy.', 'The basement says thank you.'],
  ],
}
/* When they show up together: a line each, Herb then Paul. */
const TAG_BANTER = [
  ['Paul. PAUL. We got company.', "Two of us, two of them. Fair's fair."],
  ['Me and my associate here split everything.', 'Fifty-fifty. Well. Sixty-forty. Him.'],
  ["You take the left slot, I'll take the right.", 'We are talking about the battle, right? Not the machine?'],
  ['Tag team. Nobody beats the tag team.', "We've lost before though. Twice. This week."],
]
/* The same, when one of them faces you alone with two out at once. */
const SOLO_DOUBLE = {
  HERB: [['Two at once. Keeps it moving.', "I've got a drop at noon."], ['Double battle, double the margin.', "That's how math works, chief."]],
  PAUL: [['I brought two. I always bring two.', 'Backups. Of everything.'], ['Double battle. Like double-sleeving.', 'Safe. Thorough. Mine.']],
  BRIAN: [['Two at once? Is that allowed?', 'Okay. Go, uh... both of you.'], ['My kid said to bring two.', "I think. I wasn't really listening."]],
}
/*
 * Brian doesn't know the first thing about Pokémon. He's here for the resale
 * money and claims it's all "for his kid". He's the easy one, though his
 * Pokémon are as strong as anyone's: `easy` has them pick targets at random
 * in a 2v2, and `blunder` is the chance he wastes a turn entirely. `calls` is what he
 * thinks his Pokémon are called.
 */
const BRIAN = {
  short: 'BRIAN', full: 'RESELLER BRIAN', title: 'RESELLER · "FOR MY KID"', vs: 'brianVs', face: 'brianFace', body: 'brianBody', down: 'brianDown', faceDown: 'brianFaceDown',
  tokens: '0.50', mon: 'MAGIKARP', easy: true, blunder: 0.4,
  calls: { MAGIKARP: 'the fish one', BIDOOF: 'the beaver', SUNKERN: 'the seed guy', PSYDUCK: 'the duck' },
  intro: [
    ['Whoa, whoa. Back of the line, pal.', "These are for my kid. My son. Or daughter. My child."],
    ['You into these pokey-men too?', "My kid loves 'em. The shiny ones are worth more, right?"],
    ["Look, I'm just a dad.", 'A dad who heard these go for four hundred bucks online.'],
    ['Is this the line for the Pikachus?', 'My kid needs, uh... all of them. Every Pikachu.'],
    ['Hey, quick question.', 'Which one of these is the Charizard? Asking for my child.'],
    ['Excuse me, is this the toy aisle?', "My kid said 'the vending machine.' This is a vending machine."],
    ['My kid sent me a picture of the one he wants.', "It's blurry. I'm buying all of them."],
    ['You look like you know stuff.', "Is a 'holo' good? I feel like a holo is good."],
  ],
  outro: [
    ["Huh. Didn't know they could do that.", "Kid's gonna be... fine. Probably."],
    ['Okay, okay. You know your pokey-mans.', "I'll tell my kid you said hi. Theoretically."],
    ["That's fine. I'll just buy 'em online.", 'At a markup. From Herb, probably.'],
    ['My kid is going to be so disappointed.', "...I don't actually have a kid."],
    ["Wait, you don't get money for losing?", 'What am I even doing here, then.'],
    ['Okay, you got me.', "I'll tell my kid it was sold out. Classic dad move."],
    ["I don't get it, but I respect it.", 'Do you do birthday parties?'],
    ['Well, I tried.', 'Gonna go look at boats online instead.'],
  ],
  gloat: [
    ["Ha! Beginner's luck. My kid's luck. Whoever's.", 'Anyway, these are mine now.'],
    ['I have no idea what just happened.', "But I'll take it."],
    ["See? It's easy. You just yell at them.", "Restock's mine. For the child."],
    ['Wow. You lost to me?', 'I thought the fish one was broken.'],
    ['Did I win? I won!', 'Wait till I tell my kid. Who exists. Who I have.'],
    ['Is that a W? My kid says W.', 'Big W. Huge. For the child.'],
  ],
  blunders: [
    ['BRIAN told {mon} to "do the Pikachu thing."', "{mon} didn't know what that meant."],
    ['BRIAN is checking resale prices', 'on his phone...'],
    ['BRIAN shouted "Use Charizard!"', "There's no Charizard. {mon} just stood there."],
    ['BRIAN is reading the back of a booster pack', 'for instructions...'],
    ['{mon} is waiting for orders.', 'BRIAN is on a call. "Yeah, two hundred, firm."'],
    ['BRIAN told {mon} to "go evolve."', 'It did not.'],
  ],
}
/*
 * Everyday trainers who turn up at the machine too: not scalpers, just
 * people who also want the restock. They battle like the scalpers (same
 * fields: pose and portrait after losing, a pool by trainer level, line
 * sets picked per battle), with `role` under their name when they talk
 * and `title` on their VS card. Names are placeholders for now.
 */
const ROSE = {
  short: 'ROSE', full: 'GRANDMA ROSE', role: 'GRANDMA', title: 'GRANDMA · ON A VIDEO CALL', vs: 'roseVs', face: 'roseFace', body: 'roseBody', down: 'roseDown', faceDown: 'roseFaceDown', tokens: '0.50', mon: 'SKITTY',
  intro: [
    ['Say hi to the nice trainer, sweetie!', "My grandson's on the phone. He says you're standing in front of the Charizards."],
    ['Oh, are you in line, dear?', "I've been here since the store opened. I brought a folding chair."],
    ['My grandkids sent me a list.', "Booster boxes, tins, and something called a 'chase card'."],
    ['You remind me of my grandson.', 'He also stands too close to the machine.'],
    ['Oh! Let me put my glasses on.', "There. Now I can see who I'm battling."],
    ['Hold on, dear, the call froze.', "Sweetie? Sweetie! ...Okay, he's back. Let's go."],
    ['I knitted Skitty a little sweater.', 'It makes her faster. I believe that.'],
    ['My book club meets in an hour.', "So let's not dawdle, dear."],
  ],
  outro: [
    ["Oh my. You're very good at this.", "I'll tell the grandkids you said hello."],
    ["Well, that's alright, dear.", "There's always the next restock. I'm retired. I have time."],
    ["Hang on, he's asking what happened.", '...Nana lost, sweetie. To a very polite young trainer.'],
    ['Take a butterscotch for the road.', "And keep those Pokémon warm. It's chilly out."],
    ['Oh, fiddlesticks.', 'Well, you earned it, dear.'],
    ["He says you have 'mad skills.'", "I'll take his word for it. Well done."],
    ["My hip says it's time to sit down anyway.", 'Good luck with your packs, dear.'],
    ["I'll bake you cookies for next time.", "Losing cookies. They're still very good."],
  ],
  gloat: [
    ['Bless your heart.', 'Maybe have a snack and try again later.'],
    ['Did you see that, sweetie? Nana won!', "...He says I'm 'goated.' Is that good?"],
    ['I raised four kids.', 'I can handle one battle at a vending machine.'],
    ["Nana's still got it!", 'Sweetie, are you recording this?'],
    ["Don't pout, dear.", 'Have a peppermint. It helps.'],
  ],
}
const DEREK = {
  short: 'DEREK', full: 'OFFICE WORKER DEREK', role: 'OFFICE WORKER', title: 'OFFICE WORKER · ON LUNCH BREAK', vs: 'derekVs', face: 'derekFace', body: 'derekBody', down: 'derekDown', faceDown: 'derekFaceDown', tokens: '0.75', mon: 'PATRAT',
  intro: [
    ['I have twenty-six minutes left on my lunch break.', 'This is going to be quick.'],
    ["Sorry, I'm on a call. On mute. Mostly.", "Can we battle without my manager hearing?"],
    ['My restock alert went off in the middle of a meeting.', 'I told them it was a family emergency.'],
    ["I've had four meetings today that could've been emails.", 'Just let me have this one thing.'],
    ["My calendar says 'Focus Time.'", "This is what I'm focusing on."],
    ["I set my status to 'Out at VVM.'", 'Nobody asked. Nobody ever asks.'],
    ['I expensed the gas to get here.', "Don't tell accounting."],
    ['Quick question before we start:', 'do you have availability for a battle? Now works.'],
  ],
  outro: [
    ['...Great. Perfect. Love that.', 'Back to my desk, I guess.'],
    ["I'm going to be late back from lunch.", 'For nothing. Late for nothing.'],
    ["Just got pinged. 'Quick sync?'", 'Nothing is ever a quick sync.'],
    ["That's fine. I'll circle back.", "...I've been saying that too much."],
    ['Adding this to the list of things', "I don't want to talk about at standup."],
    ['Lunch is over. So is my dignity.', 'Back to the spreadsheets.'],
    ["Fine. I'll take the action item.", 'Action item: get better.'],
    ["My boss just messaged 'got a sec?'", 'Losing to you was the good part of my day.'],
  ],
  gloat: [
    ['Yes! Finally, a win this week.', 'Putting this in my performance review.'],
    ['Per my last attack...', 'You should have dodged.'],
    ["Great battle. Let's take this offline.", "Actually, no. The restock's mine. Bye."],
    ['Win logged. Ticket closed.', 'Resolution: you lost.'],
    ["Let's touch base next restock.", "Spoiler: I'll win then too."],
  ],
}
const NATE = {
  short: 'NATE', full: 'CAMPER NATE', role: 'CAMPER', title: 'CAMPER · HERE SINCE 3 AM', vs: 'nateVs', face: 'nateFace', body: 'nateBody', down: 'nateDown', faceDown: 'nateFaceDown', tokens: '0.75', mon: 'SLAKOTH',
  intro: [
    ["*yawn* ...Oh. Someone's here.", "I've been camping this machine since 3 AM. In my pajamas."],
    ["Don't talk to me. I haven't slept.", 'But I WILL battle you.'],
    ["You don't get to just walk up.", 'I slept on the floor for this. It was very cold.'],
    ['Is it morning?', "Doesn't matter. It's restock o'clock."],
    ["I've been here so long the floor knows me.", "We're friends now. The floor and me."],
    ['Shh. Slakoth is napping.', 'Battle quietly. Then lose quietly.'],
    ['I brought a sleeping bag AND a pillow.', "I'm not leaving without packs."],
    ['My alarm went off at 2:45.', "I've been awake for... let me count... too long."],
  ],
  outro: [
    ["...I'm going back to bed.", 'Wake me up for the next restock.'],
    ['All night. I waited all night.', 'For this. To lose. In Crocs.'],
    ['Fine. You win.', "I'm too tired to be mad. I'll be mad later."],
    ['Note to self:', 'next time, bring coffee. And a better team.'],
    ['Zzz... huh? I lost?', 'Cool. Cool. Going back to sleep.'],
    ['Can I at least keep my spot on the floor?', "It's warm now. I worked hard on it."],
    ["I'm not sad. I'm just tired.", '...And a little sad.'],
    ['You win. Enjoy the packs.', "I'll be over there. Lying down."],
  ],
  gloat: [
    ["Ha. Didn't even fully wake up for that.", 'Camping pays off.'],
    ['The early bird gets the packs.', 'And the early bird is me. In pajamas.'],
    ["Good battle. Now if you'll excuse me,", "I'm going to buy everything and then sleep for a week."],
    ['Sleep is temporary.', 'Packs are forever.'],
    ['Woke up just long enough to win.', 'Goodnight. And good morning.'],
  ],
}
const HANA = {
  short: 'HANA', full: 'IDOL FAN HANA', role: 'IDOL FAN', title: 'IDOL FAN · PHOTOCARD HUNTER', vs: 'hanaVs', face: 'hanaFace', body: 'hanaBody', down: 'hanaDown', faceDown: 'hanaFaceDown', tokens: '0.75', mon: 'JIGGLYPUFF',
  intro: [
    ["I'm not here for the cards. Okay, a little.", 'My favorite idol collects them, so now I do too.'],
    ['Lightstick: charged. Tote bag: packed.', 'Do you know how many photocards I traded to afford this?'],
    ['Cards are just photocards for a different fandom.', "And I'm going to complete this set too."],
    ['Out of my way!', 'Pulling rare cards is literally my whole personality.'],
    ['Wait, let me fix my bag charms first.', 'Okay. Now we can battle.'],
    ['This is my lucky lightstick color.', "Pink means I win. That's just science."],
    ['I queued six hours for concert tickets.', 'A vending machine line? Easy.'],
    ["Jigglypuff's been practicing the choreography.", 'Prepare for a stage performance.'],
  ],
  outro: [
    ['...My lightstick is crying.', "I mean I am. I'm crying."],
    ["That's okay. I'm used to losing.", 'Concert ticket sales trained me for this.'],
    ['You were good! Like, really good.', 'Can I have your autograph? For trading purposes?'],
    ["Fine. I'll be back.", "Fans don't give up. We just stream harder."],
    ["That's okay! Every group has a flop era.", 'This was mine.'],
    ["I'm putting this loss in my journal.", 'With stickers. Sad stickers.'],
    ["You'd make a great bias.", "That's a compliment! I think."],
    ['My group chat is going to roast me.', "I'm not telling them. Ever."],
  ],
  gloat: [
    ['Yes!! Fan power!', 'I learned dodging in concert crowds.'],
    ["That's what happens", 'when you go up against a fan who never misses a comeback.'],
    ['Hehe. Better luck next era!', "Restock's mine."],
    ['Fancam-worthy!', 'Somebody tell me they filmed that.'],
    ['Fan chant time!', "Ha-na! Ha-na! ...Okay, I'll stop."],
  ],
}
const TYLER = {
  short: 'TYLER', full: 'STREAMER TYLER', role: 'STREAMER', title: 'STREAMER · LIVE NOW', vs: 'tylerVs', face: 'tylerFace', body: 'tylerBody', down: 'tylerDown', faceDown: 'tylerFaceDown', tokens: '1.00', mon: 'PIKACHU',
  intro: [
    ["What's up, chat! We're live at the VVM!", 'And look, we got a challenger! Chat, say hi.'],
    ['Chat says you look nervous.', 'Chat is never wrong.'],
    ['Smash that follow button!', "Because I'm about to smash YOU."],
    ['A battle? On stream?', "Twelve viewers are watching. That's a big moment for both of us."],
    ['Yo! Say something for the stream!', "...Anything? Okay, we'll just battle."],
    ['I promised chat a hype moment today.', "You're the hype moment. No pressure."],
    ["Mods, ban anyone who says I'll lose.", '...Mods, why is everyone banned?'],
    ['Chat bet 500 channel points on me.', 'So I literally cannot lose this.'],
  ],
  outro: [
    ["Chat, clip that... no, DON'T clip that.", 'Ending stream. Technical difficulties.'],
    ['We lost viewers. During the battle.', 'Down to three. One of them is my mom.'],
    ['Okay, okay. GG.', "Chat says you're cracked. Chat's right."],
    ['This is the worst stream ever.', "Which means it'll probably do numbers."],
    ["Chat's spamming 'F.'", 'Yeah. F. Big F.'],
    ["Let's... cut to an ad break.", 'A really long ad break.'],
    ["Okay, that's content.", 'Painful content. But content.'],
    ['Chat lost their channel points.', "They're blaming me. Fair."],
  ],
  gloat: [
    ["LET'S GOOO! Chat, spam it!", 'Pack opening stream starts now!'],
    ['GG EZ. ...Is that mean?', "Chat says it's mean. Sorry. GG."],
    ["That's going in the highlight reel.", "Don't worry, I'll blur your face."],
    ["Chat, we're so back!", "Raid incoming. Restock's mine."],
    ['Thanks for the content!', 'Hit follow on your way out.'],
  ],
}
const DANA = {
  short: 'DANA', full: 'CLERK DANA', role: 'STORE CLERK', title: 'STORE CLERK · ON SHIFT', vs: 'danaVs', face: 'danaFace', body: 'danaBody', down: 'danaDown', faceDown: 'danaFaceDown', tokens: '0.75', mon: 'SKWOVET',
  intro: [
    ['I work here. I see who camps this machine.', 'And I know every restock day by heart.'],
    ['Hi! Welcome in! Can I help you find anything?', '...Besides the packs. Those are mine. Employee perks.'],
    ["I'm technically on break.", "I'm spending it beating you."],
    ['Price check on aisle you!', "Ha. Retail humor. Let's battle."],
    ['I just finished facing the shelves.', "Don't mess them up. Battle over here."],
    ["My name tag says 'Ask me!'", "Ask me if I'll win. Yes."],
    ['Restocks come in Tuesdays and Thursdays.', "...I didn't say that. Forget I said that."],
    ["I'm closing tonight.", "So let's make this quick."],
  ],
  outro: [
    ["Okay, that's fair.", 'Back to stocking shelves.'],
    ["My manager's going to ask where I've been.", "I'll say 'inventory.' Kind of true."],
    ["You're good. Like, scary good.", "Please don't camp here tomorrow."],
    ["Customer's always right, I guess.", 'Have a great day! Come back soon! ...Not too soon.'],
    ["Okay. I'll go do a price check.", 'On my pride.'],
    ['Clocking out of this battle.', 'Unpaid, by the way.'],
    ['Could you not mention this to my manager?', 'Or the regulars. Especially the regulars.'],
    ['Thanks for shopping at...', '...losing to customers. Great.'],
  ],
  gloat: [
    ['Thank you for shopping with us!', 'Your receipt says: you lost.'],
    ['Sorry! Employees know the restock schedule.', 'Home field advantage.'],
    ['Cleanup on aisle you!', "...I've been waiting all week to say that."],
    ['Return policy: no returns.', 'Especially on losses.'],
    ['Employee of the month.', 'Well, employee of this battle.'],
  ],
}
const MARCUS = {
  short: 'MARCUS', full: 'GUARD MARCUS', role: 'SECURITY', title: 'SECURITY · ONE AT A TIME', vs: 'marcusVs', face: 'marcusFace', body: 'marcusBody', down: 'marcusDown', faceDown: 'marcusFaceDown', tokens: '1.00', mon: 'GROWLITHE',
  intro: [
    ['Step back from the machine.', 'One trainer at a time. Store policy.'],
    ["I've seen grown adults fight over this thing.", "Let's keep it civil. A Pokémon battle. Civil."],
    ["Copy that. I've got eyes on a challenger.", 'Requesting backup: my Pokémon.'],
    ['No loitering.', "...Unless it's me. I'm on duty."],
    ["You've been flagged.", "Flagged for a Pokémon battle. Let's go."],
    ['I watched the cameras all morning.', "You've been circling this machine."],
    ['Hands where I can see them.', 'And your Poké Balls. Especially those.'],
    ['Growlithe is a certified guard dog.', 'Certified by me. Just now.'],
  ],
  outro: [
    ['Respect.', "Machine's yours. Purchase limit still applies."],
    ['Radio, this is Marcus.', "I lost. Don't put it in the report."],
    ['Clean battle.', 'No complaints from me. Move along, champ.'],
    ['Alright, you win.', "Don't tell the store manager."],
    ['Incident report: none.', "I'm not writing this one down."],
    ["Alright. You're cleared.", 'Proceed to the machine. Calmly.'],
    ['Good hustle.', 'Store still closes at nine, though.'],
    ['Growlithe, stand down.', "We'll get 'em next shift."],
  ],
  gloat: [
    ['Situation contained.', 'Machine stays closed for now.'],
    ['Nothing personal.', 'Just doing my job. And my job is winning, apparently.'],
    ['Back of the line, champ.', 'And no cutting.'],
    ['Situation handled.', 'Please step away from the machine.'],
    ['Consider this a warning.', "For your Pokémon's sake."],
  ],
}
const GRANT = {
  short: 'GRANT', full: 'PROFESSOR GRANT', role: 'PROFESSOR', title: 'PROFESSOR · "FOR RESEARCH"', vs: 'grantVs', face: 'grantFace', body: 'grantBody', down: 'grantDown', faceDown: 'grantFaceDown', tokens: '1.00', mon: 'SLOWPOKE',
  intro: [
    ['Ah. A field sample.', "I'm studying the secondary market for collectible cards."],
    ['This is purely academic, you understand.', 'I need a sealed booster box for... my research.'],
    ["I'm writing a paper on scarcity economics.", "You're about to become a case study."],
    ['My grad students think I am holding office hours.', 'I am not holding office hours.'],
    ['Please hold still.', "I'm recording your behavior for my study."],
    ["My grant proposal says 'field research.'", 'This is the field.'],
    ['Pop quiz:', 'what beats a well-funded professor? Nothing. Begin.'],
    ['Slowpoke and I have co-authored three papers.', 'None were accepted. Today, we publish a win.'],
  ],
  outro: [
    ['Fascinating. A most unexpected result.', "I'll need to revise my hypothesis."],
    ["That's fine.", 'Peer review is always brutal.'],
    ['You clearly did the reading.', "I'll grade that an A."],
    ['The sample size was too small.', "That's what I'll write in my notes, anyway."],
    ['Your methodology was flawless.', 'Mine was... a first draft.'],
    ["I'll present this loss at a conference.", 'As a cautionary tale.'],
    ['Do you have a minute for a survey?', "It's about how you beat me."],
    ['Tenure did not prepare me for this.', 'Nothing prepares you for this.'],
  ],
  gloat: [
    ['As my research predicted.', 'Hypothesis confirmed.'],
    ['Class dismissed.', 'Read chapters four through nine before next time.'],
    ['Thank you for participating.', 'Your contribution will be cited. Probably.'],
    ['Results are in.', 'See the appendix: I won.'],
    ['A textbook outcome.', 'My textbook. Chapter twelve.'],
  ],
}
const KYLE = {
  short: 'KYLE', full: 'KEYBOARD KYLE', role: 'POSTER', title: 'POSTER · TERMINALLY ONLINE', vs: 'kyleVs', face: 'kyleFace', body: 'kyleBody', down: 'kyleDown', faceDown: 'kyleFaceDown', tokens: '0.50', mon: 'PURRLOIN',
  intro: [
    ['Imagine buying packs at retail.', "Couldn't be me. Actually, it's me. I'm here."],
    ["Hold on, I'm posting about you.", "'Just saw the cringiest trainer at the VVM.'"],
    ["L + ratio + you're battling me.", "I already wrote the post where I win."],
    ['Do you even know the meta?', 'I read every forum thread. Every single one.'],
    ['Ugh, a real person.', 'I prefer you in the comments.'],
    ["I've got 40 tabs open about this set.", "You've got... vibes? Cute."],
    ["Don't @ me.", "Actually, battle me. Then don't @ me."],
    ["Thread incoming: 'Why I'm better at this.'", '1/37.'],
  ],
  outro: [
    ["Whatever. That doesn't count.", "I wasn't even trying. I was typing."],
    ['Deleting this post.', 'Deleting all my posts.'],
    ['Okay, that was lag.', "Real-life lag. It's a thing. Look it up."],
    ['Touching grass now.', 'This grass is mid.'],
    ['Logging off.', 'Touching grass. For real this time.'],
    ['Not the ratio...', 'Anything but the ratio.'],
    ["I'm going private.", 'Nobody saw that. Nobody.'],
    ['Okay. Unpopular opinion:', "you're actually good. Don't screenshot that."],
  ],
  gloat: [
    ["Ratio'd.", 'Posting the screenshot right now.'],
    ['Get good.', "Or don't. More packs for me."],
    ["That's going on my timeline.", "With a caption. You'll hate it."],
    ['Called it.', 'Pinned-post energy.'],
    ['Skill issue.', 'Yours, specifically.'],
  ],
}
const MIKA = {
  short: 'MIKA', full: 'COLLECTOR MIKA', role: 'COLLECTOR', title: 'COLLECTOR · MERCH HAUL', vs: 'mikaVs', face: 'mikaFace', body: 'mikaBody', down: 'mikaDown', faceDown: 'mikaFaceDown', tokens: '0.75', mon: 'DITTO',
  intro: [
    ['Do you know how much merch is in this bag?', 'Neither do I. I stopped counting.'],
    ['I already have every other card in this set.', 'The last one is in that machine. I can feel it.'],
    ['My shelf has room for exactly one more thing.', "That thing is today's restock."],
    ['You have the look of a fellow collector.', 'Too bad. Only one of us gets the full set.'],
    ['Careful, this bag has my top loaders.', "Bump it and we're battling for real."],
    ['I sort my binders by set AND number.', "I'm organized. And I'm winning."],
    ['Ditto, transform into my lucky charm!', '...It turned into a keychain. Close enough.'],
    ["I've got a wishlist on my phone.", 'This restock covers three things on it.'],
  ],
  outro: [
    ['Noooo. My merch!', "...Okay, I'm picking it all up. Don't look."],
    ['This is fine.', "I'll just trade for it online. Again."],
    ['You beat me. Fair and square.', 'Want to trade duplicates sometime?'],
    ['My collection is crying.', 'Everything goes back in the bag. Somehow.'],
    ['The collection will survive.', 'Barely. But it will.'],
    ['You can have this one.', 'I have... let me check... four already.'],
    ['My display case stays empty a while longer.', "That's okay. It's a nice display case."],
    ['Respect.', 'Want to see my binder? It helps me cope.'],
  ],
  gloat: [
    ['Another one for the shelf!', 'Collection status: one step closer.'],
    ["Gotta collect 'em all!", 'And by all, I mean this whole restock.'],
    ["Hehe. Don't worry.", "I'll post the haul so you can look at it."],
    ['Sleeved, top-loaded, and shelved.', 'The packs, I mean. You just lost.'],
    ['Wishlist: one item shorter!', 'Thanks for helping.'],
  ],
}
const CREW = [ROSE, DEREK, NATE, HANA, TYLER, DANA, MARCUS, GRANT, KYLE, MIKA]
/* Their Pokémon, by the trainer level each starts turning up at (as POOLS above). */
Object.assign(POOLS, {
  ROSE: [{ name: 'SKITTY', min: 1 }, { name: 'CHANSEY', min: 1 }, { name: 'MILTANK', min: 8 }, { name: 'BLISSEY', min: 14 }],
  DEREK: [{ name: 'PATRAT', min: 1 }, { name: 'MAGNEMITE', min: 1 }, { name: 'WATCHOG', min: 8 }, { name: 'PORYGON', min: 12 }],
  NATE: [{ name: 'SLAKOTH', min: 1 }, { name: 'HOOTHOOT', min: 1 }, { name: 'DROWZEE', min: 6 }, { name: 'SNORLAX', min: 12 }],
  HANA: [{ name: 'JIGGLYPUFF', min: 1 }, { name: 'PLUSLE', min: 1 }, { name: 'MINUN', min: 1 }, { name: 'CLEFAIRY', min: 8 }],
  TYLER: [{ name: 'PIKACHU', min: 1 }, { name: 'CHATOT', min: 1 }, { name: 'ROTOM', min: 8 }],
  DANA: [{ name: 'SKWOVET', min: 1 }, { name: 'SUNKERN', min: 1 }, { name: 'TROPIUS', min: 8 }, { name: 'GREEDENT', min: 12 }],
  MARCUS: [{ name: 'GROWLITHE', min: 1 }, { name: 'MACHOKE', min: 1 }, { name: 'HITMONCHAN', min: 8 }, { name: 'ARCANINE', min: 14 }],
  GRANT: [{ name: 'SLOWPOKE', min: 1 }, { name: 'NATU', min: 1 }, { name: 'PORYGON', min: 8 }, { name: 'KADABRA', min: 12 }],
  KYLE: [{ name: 'PURRLOIN', min: 1 }, { name: 'CROAGUNK', min: 1 }, { name: 'GARBODOR', min: 8 }, { name: 'LIEPARD', min: 14 }],
  MIKA: [{ name: 'DITTO', min: 1 }, { name: 'SMEARGLE', min: 1 }, { name: 'MIMIKYU', min: 10 }],
})
/* What each says sending out two at once (as SOLO_DOUBLE above). */
Object.assign(SOLO_DOUBLE, {
  ROSE: [["Two at once? The grandkids call that a 'double battle.'", "Nana's going to try it."], ['I brought two. One for each grandkid.', 'Otherwise they argue.']],
  DEREK: [['Two at once. Multitasking.', "It's on my résumé."], ['A double battle. Like double-booked meetings.', "I'm used to it."]],
  NATE: [['Two at once. Less time awake.', "Let's get this over with."], ['I brought both.', 'One to battle, one to hold my spot.']],
  HANA: [['Two at once! Like a duet!', 'Ready? Cheer with me.'], ['My two favorites, together.', "It's a reunion stage."]],
  TYLER: [['Two at once! Double the content!', 'Chat, this is a collab.'], ['Double battle, double the views.', "That's just analytics."]],
  DANA: [['Two at once. Two registers open.', 'Faster checkout.'], ["I'm used to doing two things at once.", 'Watch this.']],
  MARCUS: [['Two units on scene.', "Let's do this by the book."], ['I always bring a partner on patrol.', 'Standard procedure.']],
  GRANT: [['A controlled experiment.', 'Two variables at once.'], ['Two at once. Twice the data.', 'Excellent.']],
  KYLE: [['Two at once. Alt accounts.', "Don't report me."], ['A double battle?', 'Double ratio.']],
  MIKA: [['Two at once! A matching set!', 'Collectors always buy two.'], ['One to battle,', 'and one to keep mint in the box.']],
})
/* What each says teaming up with someone in a 2v2 (Herb and Paul have their own double act: TAG_BANTER). */
const TEAM_UP = {
  HERB: ["Fine, we team up. But I get first pick, chief.", "New partner? Cool. Don't slow me down."],
  PAUL: ['Tag team! I brought backups.', 'We split it evenly. Mostly. I get the boxes.'],
  BRIAN: ["We're a team now? Great. You do the Pokémon part.", 'My kid would love this. Hypothetically.'],
  ROSE: ['Oh, a team! Like bingo night, but louder.', "Stand behind Nana, dear. I've got this."],
  DEREK: ["Fine. Let's circle up and align on this.", 'Teamwork makes the dream work. I hate that I said that.'],
  NATE: ["You take the left side. I'm too tired to argue.", 'Two of us? Great. Less work for me.'],
  HANA: ["A duo! Let's do a fan chant!", "We're a unit now. Matching lightsticks next time."],
  TYLER: ['Collab! Chat, meet my new co-host.', 'Two-person stream. Double the content.'],
  DANA: ['Team effort! Like a holiday shift.', "I'll cover this register. You cover that one."],
  MARCUS: ['Requesting backup. Backup has arrived.', 'Two-person patrol. By the book.'],
  GRANT: ["A collaboration. I'll be first author.", "Let's call this a joint study."],
  KYLE: ["Duo queue. Don't throw.", 'My alt account showed up. Let\'s go.'],
  MIKA: ['A matching set! We even look like a combo.', "Two collectors, one machine. Let's clear it."],
}
/* Everyone who can block the machine. In Play, who turns up is random. */
/*
 * The roaming legendaries: Raikou, Entei and Suicune. One of each roams at a
 * time, shared by every trainer: whoever meets one fights the same Pokémon,
 * with whatever HP the last trainer left it on. They attack once, then flee
 * on their second turn. Catch rate 3, so it takes a worn-down one, a good
 * ball and an Excellent throw. Knocked out or caught, a fresh one (full HP,
 * new IVs and nature) starts roaming in its place.
 */
const LEGEND_LEVEL = 40
const LEGEND_RATE = 0.04   // the share of wild encounters that turn out to be a roaming legendary
const LEGENDS = ['RAIKOU', 'ENTEI', 'SUICUNE']
const LEGEND_MOVES = {
  RAIKOU: [S_('THUNDERBOLT', 'electric', 75, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 60, 'spec', 'current', 'zap'), S_('EXTRASENSORY', 'psychic', 65, 'spec', 'shadow', { ranged: true })],
  ENTEI: [S_('FLAMETHROWER', 'fire', 75, 'spec', 'whoosh', { ranged: true }), S_('FIRE FANG', 'fire', 65, 'phys', 'crunch'), L_('LAVA PLUME', 'fire', 65, 'spec', 'wave', 'whoosh')],
  SUICUNE: [L_('SURF', 'water', 70, 'spec', 'wave', 'whoosh'), S_('AURORA BEAM', 'ice', 60, 'spec', 'whoosh', { ranged: true }), S_('EXTRASENSORY', 'psychic', 65, 'spec', 'shadow', { ranged: true })],
}
// Herb and Paul pick their hardest-hitting move, like a leader (no tells, though).
HERB.smart = PAUL.smart = true
const SCALPERS = [HERB, PAUL, BRIAN, ...CREW]
/*
 * Alex: the trainer who steps in the first time you meet the scalpers. He
 * has you pick a starter, then fights beside you with his Porygon, which he
 * commands himself, and coaches you through each mechanic the first time it
 * comes up (TUTORIAL_TIPS).
 */
const ALEX = {
  short: 'ALEX', full: 'TRAINER ALEX', role: 'TRAINER', vs: 'alexVs', face: 'alexFace', body: 'alexBody', ally: true, mon: 'PORYGON',
  moves: ['TRI ATTACK', 'PSYBEAM', 'THUNDER SHOCK', 'RECOVER'],
  hello: ["Hold up! Don't let these two push you around.", "No Pokémon? No problem. Pick a partner, and we'll take them on together."],
  picked: (name) => [`${name}! Good pick.`, "I'll send out Porygon. You call the shots for yours, I'll handle mine."],
  gift: ['Here, take these: five Potions and five Poké Balls.', "Potions patch your team up. Balls are for the wild ones that jump out around the machine."],
  again: ['Ready for round two?', "Same plan: you take yours, I'll take Porygon."],
  won: ["That's how it's done! You're a natural.", "They'll be back. They always are. Now you know how to send them packing."],
  lost: ['Ah, they got us this time.', "Heal up and we'll go again. I'm not going anywhere."],
}
/*
 * ══════════ Alex, the rival ══════════
 * The trainer who helped you through your first battle turns rival: seven
 * battles across the whole game, each one waiting at the machine on your
 * next tap once you reach its milestone (`due`, from your progress): after
 * 1, 3, 5 and 7 Johto badges, then in Kanto after Brock's badge (the first)
 * and Blaine's (the seventh, the last before Blue), and the last after you
 * beat Red at the end of the Kanto League. Lose
 * and Alex comes back a few taps later for the same battle; only a win moves
 * the story on.
 *
 * Three phases, each with its own look (art), battle theme and scene:
 *   1. battles 1-3, the friendly rival: SONGS.rival, look 1.
 *   2. battles 4-5, colder, Porygon upgraded: SONGS.rival2, look 2.
 *   3. battles 6-7, Porygon-Z; Mewtwo joins for the last: SONGS.rival3, look 3.
 * Alex's team is built around Porygon, which evolves along the way
 * (Porygon2 in phase 2, Porygon-Z in phase 3), with made and engineered
 * Pokémon around it (Magnemite's line, Rotom, Starmie), Alakazam in battle
 * 6, and in the last battle Zapdos and Mewtwo, cloned in a lab. Each team
 * covers its types: water, fire, electric, rock and dark, psychic and normal
 * by the end. Ace last.
 *
 * Levels are set, as a Gym Leader's (leaderLevels, `low` to the ace at
 * `min`): battles 1-6 a few levels above the leader just beaten (Falkner
 * 9-13, then Alex 12-16), the last, after Red, in the high 70s with the ace
 * at Lv 80. Alex fights like a leader (`hard`: the best move each turn,
 * tells, quicker rings, a line before the last Pokémon, or the battle's own
 * `last` words) with one Full Restore at most. A battle's own `tellRate`,
 * `ringFast` and `ivs` override its phase's, tuned to its aim (sim.mjs: 3
 * wins in 4, the friendly first 9 in 10). Battle 7, the hardest fight in the
 * game, has Red's rings, the fastest, but fewer tells and softer IVs: about 1
 * win in 3 for an average player.
 */
const RIVAL_PHASE_OF = [1, 1, 1, 2, 2, 3, 3]
/** Each phase's look (its art: rival-<phase>-vs.jpg, -face, -body, and -defeated and -face-down for a loss), theme and scene. */
const RIVAL_LOOKS = {
  1: { theme: 'rival', scene: 'factory', color: '#60a5fa', tellRate: 0.3, ringFast: 0.86, ivs: 20, title: 'RIVAL' },
  2: { theme: 'rival2', scene: 'distortion', color: '#a855f7', tellRate: 0.4, ringFast: 0.82, ivs: 22, title: 'RIVAL' },
  3: { theme: 'rival3', scene: 'hall', color: '#f59e0b', tellRate: 0.45, ringFast: 0.78, ivs: 25, title: 'RIVAL' },
}
for (const p of [1, 2, 3]) {
  const L = RIVAL_LOOKS[p]
  Object.assign(L, { vs: `rival${p}Vs`, face: `rival${p}Face`, body: `rival${p}Body`, down: `rival${p}Down`, faceDown: `rival${p}FaceDown` })
  for (const [k, file] of [['vs', 'vs.jpg'], ['face', 'face.jpg'], ['body', 'body.png'], ['down', 'defeated.png'], ['faceDown', 'face-down.jpg']]) ART[L[k]] = `/rpg/a/rival-${p}-${file}`
}
/** Your progress, as the milestones read it. */
const rivalProgress = (badges, champion, red = false) => ({ johto: badges.filter((n) => n < 8).length, kanto: badges.filter((n) => n >= 8).length, champion, red })
const RIVAL_BATTLES = [
  { due: (p) => p.johto >= 1, low: 12, min: 16, restores: 1, tellRate: 0.23, tokens: '3.00', team: ['MAGNEMITE', 'GROWLITHE', 'PORYGON'],
    intro: ['Hey! Remember me? I handed you your first Potions.', "You've got a badge now. So do I. Let's see which of us is getting better faster."],
    outro: ["Ha! Okay, okay. You're getting good.", 'Porygon and I will be ready next time. Count on it.'],
    gloat: ["Not bad! But Porygon's been studying you.", "Go heal up. I'll be around."] },
  { due: (p) => p.johto >= 3, low: 22, min: 26, restores: 1, tellRate: 0.66, ivs: 31, ringFast: 0.76, tokens: '4.00', team: ['STARYU', 'GROWLITHE', 'MAGNEMITE', 'PORYGON'],
    intro: ["Three badges? Same. I've been keeping count.", 'I rebuilt my whole team around Porygon. Let me show you what it can do now.'],
    outro: ['You read every move. How?', '...I need to rethink the whole setup.'],
    gloat: ['See? The new setup works.', "Don't fall behind now. That'd be boring."] },
  { due: (p) => p.johto >= 5, low: 27, min: 31, restores: 1, tellRate: 0.69, ivs: 31, ringFast: 0.76, tokens: '5.00', team: ['STARMIE', 'MAGNETON', 'PUPITAR', 'GROWLITHE', 'PORYGON'],
    intro: ["Five badges. You're keeping up. I hate that.", "Staryu evolved last night. Let's see you handle the full lineup."],
    outro: ['Again?! I ran every matchup. Every single one.', "...Fine. There's an upgrade I've been putting off. Not anymore."],
    gloat: ['Told you. Every matchup.', 'Keep training. I want you at your best when I win.'] },
  { due: (p) => p.johto >= 7, low: 33, min: 37, restores: 1, tellRate: 0.62, ringFast: 0.76, tokens: '6.00', team: ['STARMIE', 'MAGNETON', 'PUPITAR', 'ARCANINE', 'PORYGON2'],
    intro: ["You noticed. Porygon's different now. I installed the UPGRADE.", "Friends? We were. Now you're just the number I have to beat."],
    outro: ["...That doesn't make sense. The numbers were on my side.", "I'll find what's missing. Whatever it takes."],
    gloat: ["The upgrade works. You don't.", "Go home. The machine's mine today."] },
  { due: (p) => p.kanto >= 1, low: 50, min: 54, restores: 1, tellRate: 0.33, tokens: '8.00', team: ['STARMIE', 'ROTOM', 'ARCANINE', 'MAGNEZONE', 'TYRANITAR', 'PORYGON2'],
    intro: ['Champion. And? Lance was a pushover for me.', "I won't let you or those Team Unemployed freaks hog all the Kanto machines."],
    outro: ['…Stay out of my way, scalper.', "I won't let you bully the trainers here too."],
    gloat: ['Champion of what, exactly?', 'Go back to your badges.'] },
  { due: (p) => p.kanto >= 7, low: 62, min: 66, restores: 1, tellRate: 0.58, ringFast: 0.88, tokens: '12.00', team: ['STARMIE', 'MAGNEZONE', 'TYRANITAR', 'ARCANINE', 'ALAKAZAM', 'PORYGON-Z'],
    intro: ["You're better off vending with Paul and Herb. Do you even like Pokémon?", "Porygon-Z and I rewrote everything since last time. Let's see if it was enough."],
    outro: ["I won't let the other trainers down…", "There's one more thing. Something I found in a lab outside Cerulean. Next time, the last time."],
    gloat: ['Go back to Johto.', 'Come back when you can actually beat us.'] },
  { due: (p) => p.red, low: 77, min: 80, restores: 1, tellRate: 0.33, switches: 2, ringFast: 0.66, ivs: 15, tokens: '20.00', team: ['STARMIE', 'ARCANINE', 'ZAPDOS', 'TYRANITAR', 'PORYGON-Z', 'MEWTWO'],
    intro: ['Your story ends here.', "I brought something back from that lab. Get through the rest of my team, and you'll meet it."],
    last: ['Meet Mewtwo. Made in a lab, like Porygon was.', 'This is everything I have.'],
    outro: ["Hmm, maybe I had the wrong idea about you. You're not a scalper.", "Thanks for not letting me win the wrong way. See you around, Champion."],
    gloat: ['I won... and you made me earn every inch of it.', 'Rest up. I want the real you for the rematch.'] },
]
/** After your first battle with Alex, win or lose: the EXP. SHARE (if you haven't one already). */
const RIVAL_GIFT = ["Here. Take this EXP. SHARE.", "Your whole team should be keeping up, not just your lead. Makes it a fairer fight next time."]
/** What Alex says in a rematch (after losing that battle to Alex), by phase. */
const RIVAL_AGAIN = {
  1: ['Back for more? Good.', 'Round two. Same stakes.'],
  2: ['You came back. Predictable.', 'The result will be too.'],
  3: ['You came back.', "Then let's finish this properly."],
}
/** Taps before Alex comes back for a rematch. */
const RIVAL_REMATCH_TAPS = 3
/*
 * The moves Alex's signature Pokémon fight with; the rest of the team uses
 * the moves for their type, the stronger set (STRONG_MOVES) from phase 2.
 */
const RIVAL_MOVES = {
  PORYGON: [S_('TRI ATTACK', 'normal', 45, 'spec', 'zap', { ranged: true }), S_('PSYBEAM', 'psychic', 45, 'spec', 'shadow', { ranged: true }), L_('DISCHARGE', 'electric', 40, 'spec', 'current', 'zap')],
  PORYGON2: [S_('TRI ATTACK', 'normal', 65, 'spec', 'zap', { ranged: true }), S_('ICE BEAM', 'ice', 65, 'spec', 'whoosh', { ranged: true }), L_('DISCHARGE', 'electric', 55, 'spec', 'current', 'zap')],
  'PORYGON-Z': [S_('TRI ATTACK', 'normal', 80, 'spec', 'zap', { ranged: true }), S_('ICE BEAM', 'ice', 70, 'spec', 'whoosh', { ranged: true }), L_('DISCHARGE', 'electric', 60, 'spec', 'current', 'zap'), S_('DARK PULSE', 'dark', 70, 'spec', 'shadow', { ranged: true })],
  ZAPDOS: [S_('THUNDER', 'electric', 85, 'spec', 'zap', { ranged: true }), S_('DRILL PECK', 'flying', 70, 'phys', 'whoosh'), L_('DISCHARGE', 'electric', 60, 'spec', 'current', 'zap'), S_('HEAT WAVE', 'fire', 65, 'spec', 'whoosh', { ranged: true })],
  MEWTWO: [S_('PSYSTRIKE', 'psychic', 85, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('AURA SPHERE', 'fighting', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('PSYWAVE', 'psychic', 60, 'spec', 'wave', 'shadow'), S_('SHADOW BALL', 'ghost', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' })],
}
/** Mewtwo and Zapdos: only Alex has them (they aren't wild, and don't evolve from anything). */
DATA.forms.push({ id: 150, name: 'MEWTWO', types: ['psychic'], base: { hp: 106, attack: 110, defense: 90, 'special-attack': 154, 'special-defense': 90, speed: 130 }, capture: 3 },
  { id: 145, name: 'ZAPDOS', types: ['electric', 'flying'], base: { hp: 90, attack: 90, defense: 85, 'special-attack': 125, 'special-defense': 90, speed: 100 }, capture: 3 })
for (const id of [150, 145]) Object.assign(ART, { [id]: `/rpg/a/${id}.gif`, [id + 'b']: `/rpg/a/${id}-back.gif`, ['cry:' + id]: `/rpg/a/cries/${id}.ogg` })
/** Alex as the battle needs them for battle n (0-6): the phase's look and difficulty, this battle's Full Restores and words. */
function rivalTrainer(n) {
  const B = RIVAL_BATTLES[n], phase = RIVAL_PHASE_OF[n], L = RIVAL_LOOKS[phase]
  return { ...B, phase, short: 'ALEX', full: 'RIVAL ALEX', title: L.title, role: 'RIVAL', rival: true, hard: true,
    vs: L.vs, face: L.face, body: L.body, down: L.down, faceDown: L.faceDown, tellRate: B.tellRate ?? L.tellRate, ringFast: B.ringFast ?? L.ringFast, ivs: B.ivs ?? L.ivs,
    movesFor: (f) => RIVAL_MOVES[f.name] ?? (phase > 1 ? strongMoves(f) : null) }
}
/*
 * ══════════ Herb and Paul, the glitchers ══════════
 * Between their everyday camping, the two scalpers have a racket: they glitch
 * the machines into dropping product, and sell it at card shows. Four battles
 * each, caught in the act at the machine on your next tap once you reach each
 * milestone, like Alex's (their milestones fall between his): Herb after 2 and
 * 6 Johto badges and 2 and 6 Kanto badges, Paul after 4 Johto badges, the
 * Champion, and 4 and 8 Kanto badges. Lose and they're back a few taps later
 * for the same battle; win and they hand back a pack from their card-show
 * stock.
 *
 * Their teams evolve with them: Herb's Gimmighoul eats enough glitched coins
 * to become Gholdengo, Meowth and Purrloin grow up, and Rotom (living in the
 * machines, doing the glitching), Sableye, Mawile and Mimikyu join. Paul's
 * Skwovet, Trubbish and Hippopotas evolve, Munchlax joins and becomes
 * Snorlax, with Slowbro and Golem guarding the van. Levels set as a Gym
 * Leader's (leaderLevels), a few above the leader just beaten, and they fight
 * like one (`hard`), the ace last with a stronger set of its
 * own from the second battle; the rest of the team with the stronger moves.
 */
DATA.forms.push({ id: 999, name: 'GIMMIGHOUL', types: ['ghost'], base: { hp: 45, attack: 30, defense: 70, 'special-attack': 75, 'special-defense': 70, speed: 10 }, capture: 45 })
Object.assign(ART, { 999: '/rpg/a/999.gif', '999b': '/rpg/a/999-back.gif', 'cry:999': '/rpg/a/cries/999.ogg' })
/** The aces' stronger sets, from their second battle on. */
const STORY_ACE_MOVES = {
  GHOLDENGO: [{ name: 'MAKE IT RAIN', type: 'steel', power: 30, cat: 'spec', hits: 3, kind: 'strike', ranged: true, fx: 'coins', snd: 'coin' },
    S_('SHADOW BALL', 'ghost', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('FLASH CANNON', 'steel', 65, 'spec', 'zap', { ranged: true })],
  HIPPOWDON: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('CRUNCH', 'dark', 60, 'phys', 'crunch'), S_('STONE EDGE', 'rock', 65, 'phys', 'thud', { ranged: true })],
}
const STORY = {
  HERB: { T: HERB, color: '#eab308',
    again: ["Back again? Machine's still mine.", 'Round two, chief.'],
    battles: [
      { due: (p) => p.johto >= 2, low: 16, min: 20, restores: 1, tellRate: 0.5, ringFast: 0.76, ivs: 24, tokens: '2.50', team: ['MEOWTH', 'PURRLOIN', 'GIMMIGHOUL'],
        intro: ['Shh. Watch this. Tap, tap, hold... free pack.', "I glitch 'em out and sell 'em at the card show for triple. Beat it, chief."],
        outro: ['Okay, okay. You caught me.', "Take a pack back. Keep it quiet. My card-show table's looking thin now."],
        gloat: ['The glitch stays between us, yeah?', 'See you at the card show. Bring cash.'] },
      { due: (p) => p.johto >= 6, low: 30, min: 34, restores: 1, tellRate: 0.06, ringFast: 0.86, ivs: 22, tokens: '4.00', team: ['ROTOM', 'SABLEYE', 'LIEPARD', 'PERSIAN', 'GHOLDENGO'],
        intro: ['Remember Gimmighoul? It ate enough glitched coins to evolve.', 'And Rotom gets inside the machine now. It spits out whatever I point at.'],
        outro: ["Rotom, out of the machine. We're blown.", "...Here. That's one less pack on my table this weekend."],
        gloat: ['The machine likes me better. Facts.', 'Three tables at the Goldenrod card show. Come buy something.'] },
      { due: (p) => p.kanto >= 2, low: 52, min: 56, restores: 2, tellRate: 0.16, ringFast: 0.8, ivs: 23, tokens: '7.00', team: ['MAWILE', 'ROTOM', 'SABLEYE', 'LIEPARD', 'PERSIAN', 'GHOLDENGO'],
        intro: ["Kanto machines are older. They glitch if you look at 'em funny.", 'Celadon card show, five tables. All glitched stock. Move.'],
        outro: ['You followed me to KANTO?', "Fine. Take a pack back. The Celadon show's off anyway."],
        gloat: ["Kanto's my market now, chief.", "You can't stop a glitch. It's a feature."] },
      { due: (p) => p.kanto >= 6, low: 60, min: 64, restores: 2, tellRate: 0.38, ringFast: 0.8, ivs: 25, tokens: '10.00', team: ['MIMIKYU', 'MAWILE', 'ROTOM', 'SABLEYE', 'PERSIAN', 'GHOLDENGO'],
        intro: ["Saffron card show. Biggest in Kanto. My whole year's in that van.", 'Every glitch I know, every Pokémon I got. Last time, chief.'],
        last: ['Gholdengo. Made out of every coin I ever glitched.', 'Make it rain.'],
        outro: ["...That's it. I'm out. No more glitching.", "Take the pack. Take the table. I'm gonna go get a real job. Probably."],
        gloat: ['Still the king of the glitch.', "Come back with a better team. I'll be at the Saffron show."] },
    ] },
  PAUL: { T: PAUL, color: '#a16207',
    again: ['Oh. You came back.', "Fine. One more. Then I've got boxes to sort."],
    battles: [
      { due: (p) => p.johto >= 4, low: 24, min: 28, restores: 1, tellRate: 0.5, ringFast: 0.74, ivs: 24, tokens: '3.00', team: ['SKWOVET', 'TRUBBISH', 'HIPPOPOTAS'],
        intro: ["Trubbish sits in the coin slot. Machine jams. Goes into 'maintenance'.", "Then the tech opens it up, and I'm standing right there. With a box."],
        outro: ['Okay. Okay. Trubbish, out of the slot.', "Here, take one back. I've got plenty for the card show."],
        gloat: ["Shh. It's not stealing if the machine's broken.", "Card show's Sunday. Bring a wagon."] },
      { due: (p) => p.champion, low: 49, min: 54, restores: 2, tellRate: 0.68, ringFast: 0.76, ivs: 31, tokens: '6.00', team: ['MUNCHLAX', 'SLOWBRO', 'GREEDENT', 'GARBODOR', 'HIPPOWDON'],
        intro: ["Champion, huh? Cool. I've got a basement full of glitched boxes.", 'Greedent stuffs its cheeks every time a machine jams. Saves me trips.'],
        outro: ['My mom found the boxes.', '...Take one back. I have to downsize for the card show anyway.'],
        gloat: ['Shelf space secured. Again.', 'Swing by my table at the card show. Champion discount: none.'] },
      { due: (p) => p.kanto >= 4, low: 56, min: 60, restores: 2, tellRate: 0.41, ringFast: 0.76, ivs: 23, tokens: '8.00', team: ['GOLEM', 'SLOWBRO', 'GREEDENT', 'GARBODOR', 'SNORLAX', 'HIPPOWDON'],
        intro: ['Kanto machines jam even easier. Snorlax just leans on them.', "Paul's Pack Palace: six tables at the Celadon card show. Hippowdon guards the van."],
        outro: ['The Pack Palace is... closing early today.', "Here. One back. Don't tell Herb how many I have."],
        gloat: ['The Palace stands.', 'Next show is bigger. So is my basement.'] },
      { due: (p) => p.kanto >= 8, low: 65, min: 69, restores: 3, tellRate: 0.54, ringFast: 0.78, ivs: 25, tokens: '12.00', team: ['GOLEM', 'SLOWBRO', 'GREEDENT', 'GARBODOR', 'SNORLAX', 'HIPPOWDON'],
        intro: ['Last card show of the year. I jammed every machine from Pewter to Fuchsia for it.', "Everything I've got. Every box, every Pokémon. Let's go, buddy."],
        last: ["Hippowdon. It's held the line since the first machine I jammed.", 'Hold the line, buddy.'],
        outro: ["...Okay. I'm done. I'll unjam them all.", 'Take the pack. And maybe the forty boxes. Mom says they have to go.'],
        gloat: ['Basement is safe. For now.', "Come back stronger. I'll save you a box. Full price."] },
    ] },
}
/** Each step's scene and battle theme: the glitching gets worse as it goes. */
const STORY_SCENES = ['arcade', 'factory', 'distortion', 'distortion']
const STORY_THEMES = ['gym', 'gym', 'elite', 'elite']
/** Herb or Paul (`who`) as the battle needs them for their battle n (0-3). */
function storyTrainer(who, n) {
  const S = STORY[who], B = S.battles[n], T = S.T
  return { ...T, ...B, story: who, step: n, full: T.full, title: 'SCALPER', role: 'SCALPER', hard: true, strong: n > 0,
    tellRate: B.tellRate ?? 0.3, ringFast: B.ringFast ?? 0.86, ivs: B.ivs ?? 20, scene: STORY_SCENES[n], theme: STORY_THEMES[n], color: S.color,
    movesFor: (f) => (n > 0 && f.name === B.team.at(-1) ? STORY_ACE_MOVES[f.name] : null) }
}
/* The scalpers, the first time: they size you up before Alex steps in. */
const FIRST_TAUNT = { HERB: ['Look who it is. Got any Pokémon, kid?', "...No? Then this restock's ours."], PAUL: ["Herb, be nice. They just got here.", "...The restock's still ours, though."] }
/* What Alex says the first time each thing happens in that battle. */
const TUTORIAL_TIPS = {
  start: ["Each turn you pick for your Pokémon. I'll handle Porygon.", 'Tap FIGHT, pick a move, then pick which of them to hit.'],
  strike: ['When you attack, a ring closes on your target.', 'Tap A right as it lands. The closer you are, the harder you hit.'],
  defend: ["Incoming! When they attack, the ring's on you.", 'Tap A as it closes to PARRY, or B to DODGE. Dodging is easier.'],
  jump: ['See that amber ring on the ground?', "That one can't be parried. JUMP it with ▲!"],
  pp: ['Nice! Stop every hit of an attack and you earn PP.', 'PP pays for your stronger moves, like your type move.'],
  partner: ["Don't worry about Porygon.", "I've got my own rings to hit."],
}
/*
 * Battle supplies the machine can stock beside the packs, as an admin sets
 * them up: whether each is sold at all, its price in tokens, and its
 * appearance rate, the chance (%) it's on the shelf when the machine is
 * stocked. In the app this belongs on the admin "Machine Items" page with
 * the packs; here the Play-mode admin panel edits it, and it's saved in this
 * browser so the settings survive a reload.
 */
const SHOP_DEFAULT = {
  potion: { on: true, price: 0.25, rate: 40 },
  super:  { on: true, price: 0.5, rate: 15 },
  ball:   { on: true, price: 0.2, rate: 35 },
  great:  { on: false, price: 0.4, rate: 10 },
  revive: { on: true, price: 0.6, rate: 15 },
  rarecandy: { on: true, price: 1.5, rate: 10 },
  summon: { on: true, price: 3, rate: 30 },   // a Gym Leader summon: always for your next gym
  elite:  { on: true, price: 5, rate: 30 },
  expshare: { on: false, price: 4, rate: 20 },
  antidote: { on: true, price: 0.15, rate: 20 },   // status cures
  parlyz:   { on: true, price: 0.2, rate: 15 },
  burnheal: { on: true, price: 0.2, rate: 15 },
  iceheal:  { on: true, price: 0.2, rate: 10 },
  fullheal: { on: true, price: 0.5, rate: 10 },
  // Evolution items (see EVO_HOW).
  thunderstone: { on: true, price: 1, rate: 10 },
  waterstone: { on: true, price: 1, rate: 8 },
  firestone: { on: true, price: 1, rate: 8 },
  leafstone: { on: true, price: 1, rate: 6 },
  icestone: { on: true, price: 1, rate: 6 },
  moonstone: { on: true, price: 1, rate: 6 },
  sunstone: { on: true, price: 1, rate: 5 },
  duskstone: { on: true, price: 1, rate: 5 },
  shinystone: { on: true, price: 1, rate: 4 },
  linkcable: { on: true, price: 1.5, rate: 8 },
  dragonscale: { on: true, price: 1, rate: 5 },
  disc: { on: true, price: 1.5, rate: 12 },   // a Move Disc: a different random one each time it's stocked   // a key item: off until switched on in the admin panel   // the Elite Four ticket: once you have all 8 Johto badges, until you're Champion
}
const SHOP = (() => {
  const base = structuredClone(SHOP_DEFAULT)
  try { const saved = JSON.parse(localStorage.getItem('vvm-shop')); if (saved) for (const k in base) Object.assign(base[k], saved[k]) } catch {}
  return base
})()
/** A shelf key's shop settings: a stocked 'disc:NAME' sells on the MOVE DISC slot's. */
const shopOf = (k) => SHOP[k.startsWith('disc:') ? 'disc' : k]
const saveShop = () => { try { localStorage.setItem('vvm-shop', JSON.stringify(SHOP)) } catch {} }
/*
 * Bundles: several supplies sold together as one thing on the shelf, at
 * their own price and appearance rate. An admin makes and edits them, with
 * any mix of BUNDLE_ITEMS; bought, they land in the Bag as the separate
 * items. Saved in this browser with the rest of the admin settings.
 */
const BUNDLE_ITEMS = ['potion', 'super', 'revive', 'ball', 'great']
const BUNDLES_DEFAULT = [
  { id: 'heal', name: 'HEALING BUNDLE', items: { potion: 3, revive: 1 }, price: 1.1, rate: 35, on: true },
  { id: 'catch', name: 'CATCH BUNDLE', items: { ball: 5, great: 1 }, price: 1.2, rate: 25, on: true },
]
const BUNDLES = (() => { try { const s = JSON.parse(localStorage.getItem('vvm-bundles')); if (Array.isArray(s)) return s } catch {} return structuredClone(BUNDLES_DEFAULT) })()
const saveBundles = () => { try { localStorage.setItem('vvm-bundles', JSON.stringify(BUNDLES)) } catch {} }
const bundleById = (id) => BUNDLES.find((b) => b.id === id)
const bundleText = (b) => BUNDLE_ITEMS.filter((k) => b.items[k] > 0).map((k) => `${b.items[k]} ${ITEMS[k].name}`).join(' + ')
/** What a bundle's contents cost bought one by one, at today's prices. */
const bundleWorth = (b) => BUNDLE_ITEMS.reduce((s, k) => s + (b.items[k] ?? 0) * SHOP[k].price, 0)
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const ITEMS = {
  summon: { name: 'GYM SUMMON', sub: 'summons your next Gym Leader', cls: 't-summon' },
  elite: { name: 'ELITE FOUR TICKET', sub: 'all five League battles', cls: 't-summon' },
  expshare: { name: 'EXP. SHARE', sub: 'your whole party shares EXP', cls: 't-key', key: true },
  antidote: { name: 'ANTIDOTE', sub: 'cures poison', cls: 't-cure', cure: ['psn', 'tox'] },
  parlyz:   { name: 'PARALYZE HEAL', sub: 'cures paralysis', cls: 't-cure', cure: ['par'] },
  burnheal: { name: 'BURN HEAL', sub: 'cures a burn', cls: 't-cure', cure: ['brn'] },
  iceheal:  { name: 'ICE HEAL', sub: 'thaws it out', cls: 't-cure', cure: ['frz'] },
  fullheal: { name: 'FULL HEAL', sub: 'cures any status', cls: 't-cure', cure: ['psn', 'tox', 'par', 'brn', 'frz', 'slp'] },
  thunderstone: { name: 'THUNDER STONE', sub: 'evolves Pikachu, Magneton, Eevee', cls: 't-evo', evo: true },
  waterstone: { name: 'WATER STONE', sub: 'evolves Eevee, Poliwhirl, Staryu', cls: 't-evo', evo: true },
  firestone: { name: 'FIRE STONE', sub: 'evolves Eevee, Vulpix', cls: 't-evo', evo: true },
  leafstone: { name: 'LEAF STONE', sub: 'evolves Eevee, Gloom, Weepinbell, Exeggcute', cls: 't-evo', evo: true },
  icestone: { name: 'ICE STONE', sub: 'evolves Eevee into Glaceon', cls: 't-evo', evo: true },
  moonstone: { name: 'MOON STONE', sub: 'evolves Clefairy, Jigglypuff, Skitty', cls: 't-evo', evo: true },
  sunstone: { name: 'SUN STONE', sub: 'evolves Sunkern, Gloom (Bellossom)', cls: 't-evo', evo: true },
  duskstone: { name: 'DUSK STONE', sub: 'evolves Murkrow, Misdreavus', cls: 't-evo', evo: true },
  shinystone: { name: 'SHINY STONE', sub: 'evolves Togetic, Roselia, Minccino, Floette', cls: 't-evo', evo: true },
  linkcable: { name: 'LINKING CORD', sub: 'trade evolutions: Kadabra, Scyther, Porygon…', cls: 't-evo', evo: true },
  dragonscale: { name: 'DRAGON SCALE', sub: 'Seadra needs it with a LINKING CORD', cls: 't-evo', held: true },
  ball: { name: 'POKé BALL', sub: 'catch ×1', cls: 't-ball' },
  great: { name: 'GREAT BALL', sub: 'catch ×1.5', cls: 't-great' },
  potion: { name: 'POTION', sub: 'heals 30%', cls: 't-potion', heal: 0.3 },
  super: { name: 'SUPER POTION', sub: 'heals 60%', cls: 't-heal', heal: 0.6 },
  revive: { name: 'REVIVE', sub: 'revives at 50% HP', cls: 't-revive', revive: 0.5 },
  rarecandy: { name: 'RARE CANDY', sub: 'raises a Pokémon one level', cls: 't-candy', candy: true },
  disc: { name: 'MOVE DISC', sub: 'a random move each restock', cls: 't-disc' },   // the shelf slot; what's bought is a 'disc:NAME'
}
/* The evolution items a scalper (or a pack's rare slot) can turn up. */
const EVO_DROPS = ['thunderstone', 'waterstone', 'firestone', 'leafstone', 'icestone', 'moonstone', 'sunstone', 'duskstone', 'shinystone', 'linkcable', 'dragonscale']
/* Item icons: the Scarlet/Violet Bag art, wherever an item is drawn. */
;(() => {
  const css = ['ball', 'great', 'potion', 'super', 'revive', 'expshare', 'antidote', 'parlyz', 'burnheal', 'iceheal', 'fullheal', 'thunderstone', 'waterstone', 'firestone', 'leafstone', 'icestone', 'moonstone', 'sunstone', 'duskstone', 'shinystone', 'linkcable', 'dragonscale'].map((k) => {
    const u = `url("${ART['item:' + k]}")`
    return `.supic.${k}, .ic.${k} { background: ${u} center / contain no-repeat !important; border: 0 !important; border-radius: 0 !important; transform: none !important; box-shadow: none !important; }
.supic.${k}::after, .ic.${k}::after { display: none !important; }
.btn.${ITEMS[k].cls} { padding-right: 30px; }
.btn.${ITEMS[k].cls} small { white-space: nowrap; letter-spacing: -.01em; }
.btn.${ITEMS[k].cls}::after { content: ''; position: absolute; right: 5px; top: 50%; width: 24px; height: 24px; margin-top: -12px; background: ${u} center / contain no-repeat; filter: drop-shadow(0 1px 1px rgba(0,0,0,.35)); }
.ibtn.${k} { position: relative; padding-left: 40px; }
.ibtn.${k}::before { content: ''; position: absolute; left: 8px; top: 50%; width: 26px; height: 26px; margin-top: -13px; background: ${u} center / contain no-repeat; }`
  }).join('\n')
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st)
})()
/** A badge's image, by its name (ZEPHYR, BOULDER...). */
const badgeArt = (name) => ART['badge:' + name.toLowerCase()]

/* ══════════════ plumbing ══════════════ */
const $ = (id) => document.getElementById(id)
const STOP = Symbol('stop')
let RUN = 0
/*
 * App mode: inside the TCG Tracker app (?app=1&u=<user id>). Play only, saves
 * per account, and the app's Settings (stored by the app on this same
 * origin) for text speed, advancing, volume and vibration.
 */
const APP = (() => {
  const q = new URLSearchParams(location.search)
  let s = {}
  try { s = JSON.parse(localStorage.getItem('tcg-settings') || '{}') } catch {}
  const on = q.has('app')
  return {
    on,
    uid: on ? (q.get('u') || '') : '',
    charMs: on ? ({ slow: 24, normal: 13, fast: 5 }[s.textSpeed] ?? 13) : 13,
    autoAdvance: on && s.advance === 'auto',
    haptics: on && s.haptics !== false,
    // The defaults (80% effects, 60% music) are the game's own mix.
    fx: (s.effectsVolume ?? 0.8) / 0.8,
    music: (s.musicVolume ?? 0.6) / 0.6,
  }
})()
/**
 * The real machine, in the app: PlayFrame's bridge (lib/vending/gameBridge.ts)
 * on the parent window. Anywhere else (the mockup, the demos) it's null and
 * the machine is the game's own simulation.
 */
const vvm = () => { if (!APP.on) return null; try { return window.parent !== window ? window.parent.__vvmApi ?? null : null } catch { return null } }
/** A short vibration, in the app, if the player hasn't turned it off. */
const buzz = (p) => { if (APP.haptics) try { navigator.vibrate?.(p) } catch {} }
/** The sound engine calls this when it builds its mixer: the app's volume settings go on the two buses. */
window.__busReady = (sfx, mus) => { if (APP.on) { sfx.gain.value = 0.9 * APP.fx; mus.gain.value = 0.5 * APP.music } }
if (APP.on) document.body.classList.add('app')
// On the app's VVM tab the frame sits under the app's own header, with no exit button over it.
if (APP.on && new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed')
let MODE = APP.on ? 'play' : { play: 'play', duo: 'duo', gym: 'gym' }[new URLSearchParams(location.search).get('mode')] ?? 'demo'
let listeners = [], upListeners = []
/** Buttons held down right now, and when each went down: hold-and-release moves read them. */
const btnDown = {}
function press(btn) {
  const t = performance.now()
  btnDown[btn] = t
  for (const fn of [...listeners]) fn(btn, t)
}
function release(btn) {
  if (!btnDown[btn]) return
  const t = performance.now(); btnDown[btn] = 0
  for (const fn of [...upListeners]) fn(btn, t)
}
const listen = (fn) => { listeners.push(fn); return () => { listeners = listeners.filter((f) => f !== fn) } }
const listenUp = (fn) => { upListeners.push(fn); return () => { upListeners = upListeners.filter((f) => f !== fn) } }
let pointerBtn = null   // the on-screen button a finger (or mouse) is holding
const letGo = () => { if (pointerBtn) { release(pointerBtn); pointerBtn = null } }
document.addEventListener('pointerup', letGo); document.addEventListener('pointercancel', letGo)
addEventListener('blur', () => { for (const b in btnDown) release(b) })
function hot(el) { if (!el) return; el.classList.add('hot'); setTimeout(() => el.classList.remove('hot'), 160) }
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-btn]')
  // On a phone there's no A key: while someone is talking, a tap on their box or the battle screen moves it on.
  if (!el && MODE === 'play' && $('talk').style.display === 'block' && e.target.closest('#talk, #ts')) { e.preventDefault(); press('a'); pointerBtn = 'a'; return }
  if (!el && MODE === 'play' && $('msg').classList.contains('wait') && e.target.closest('#battleL')) { e.preventDefault(); press('a'); pointerBtn = 'a'; return }
  if (!el || MODE !== 'play' || el.closest('.panel')?.style.display === 'none') return
  e.preventDefault(); hot(el); press(el.dataset.btn); pointerBtn = el.dataset.btn
})
const KEYS = { x: 'a', X: 'a', Enter: 'a', ' ': 'a', z: 'b', Z: 'b', Backspace: 'b', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
addEventListener('keydown', (e) => {
  const k = KEYS[e.key]
  if (!k || e.repeat || MODE !== 'play' || $('sheet').classList.contains('open')) return
  e.preventDefault(); press(k)
})
addEventListener('keyup', (e) => { const k = KEYS[e.key]; if (k) release(k) })
const ATTRACT_PACKS = ['jungle-scyther', 'gym-heroes-brock', 'fossil-lapras', 'team-rocket-giovanni', 'gym-challenge-koga', 'jungle-flareon', 'gym-heroes-misty', 'fossil-zapdos',
  'team-rocket-dark-gyarados', 'gym-challenge-blaine', 'jungle-wigglytuff', 'gym-heroes-lt-surge', 'fossil-aerodactyl', 'team-rocket-jessie-james',
  'gym-challenge-sabrina', 'gym-heroes-erika', 'team-rocket-rocket-gang', 'gym-challenge-giovanni']
;(() => {
  const rows = [[], [], [], []]
  ATTRACT_PACKS.forEach((f, i) => rows[i % 4].push(f))
  $('attractRows').innerHTML = rows.map((files, i) => {
    // Each strip slides by half its width, so a half must be wider than the screen: repeat, then double.
    const base = Array.from({ length: Math.max(1, Math.ceil(10 / files.length)) }, () => files).flat()
    const imgs = [...base, ...base].map((f) => `<img src="${ART['pack:' + f]}" alt="">`).join('')
    return `<div class="row"><div class="strip" style="animation:${i % 2 ? 'driftR' : 'driftL'} ${21 + i * 5}s linear infinite">${imgs}</div></div>`
  }).join('')
})()
for (const [id, k] of [['maintLogo', 'logo'], ['maintQr', 'qr'], ['maintArt', 'art']]) $(id).src = ART['maint:' + k]
function fit() { const sc = $('screen'), sw = $('sw'); if (sc && sw) sc.style.setProperty('--z', String(sw.clientWidth / 320)) }
addEventListener('resize', fit)
const MODES = { mDemo: 'demo', mDuo: 'duo', mGym: 'gym', mPlay: 'play' }
function setMode(m) { MODE = m; for (const [id, v] of Object.entries(MODES)) $(id).setAttribute('aria-pressed', String(v === m)) }
$('mDemo').onclick = () => { setMode('demo'); start() }
$('mDuo').onclick = () => { setMode('duo'); start() }
$('mGym').onclick = () => { setMode('gym'); start() }
$('mPlay').onclick = () => { setMode('play'); Sound.setOn(true); syncSnd(); start() }
function syncSnd() { $('snd').textContent = Sound.on ? 'Sound: on' : 'Sound: off'; $('snd').setAttribute('aria-pressed', String(Sound.on)) }
$('snd').onclick = () => { Sound.setOn(!Sound.on); syncSnd() }
/*
 * Battle scenes: Platinum's backgrounds with their matching platforms, one
 * picked at random per encounter. Wild battles happen out in the field or in
 * caves; scalpers can turn up anywhere, arenas included. Like the game, the
 * palette follows the clock: evening 17:00–19:59, night 20:00–03:59.
 */
const WILD_SCENES = ['plain', 'meadow', 'beach', 'marsh', 'water', 'puddles', 'forest', 'mountain', 'snow', 'ice', 'cave_1', 'cave_2', 'cave_3']
const SCALPER_SCENES = [...WILD_SCENES, 'city', 'indoors_1', 'indoors_2', 'indoors_3', 'aaron', 'bertha', 'flint', 'lucian', 'cynthia', 'distortion', 'tower', 'factory', 'arcade', 'castle', 'hall']
function timeOfDay() { const h = new Date().getHours(); return h >= 17 && h < 20 ? 'evening' : h >= 20 || h < 4 ? 'night' : 'day' }
function setScene(list, roll = Math.random) {
  $('scene').src = ART[`bg:${list[Math.floor(roll() * list.length)]}_${timeOfDay()}`]
  // Dawn (4-7 am) has no scenes of its own: the day ones, warmed and a touch dim.
  const h = new Date().getHours(); $('scene').style.filter = h >= 4 && h < 7 ? 'sepia(.3) saturate(1.25) hue-rotate(-15deg) brightness(.92)' : ''
}
setScene(['plain'])
Object.assign(SFX, {
  wipe:   { file: null, synth: (ac, o, t) => { noise(ac, o, t, { dur: .5, vol: .25, filter: 'bandpass', f: 300, f1: 3500, q: 1 }); tone(ac, o, t, { f: 220, f1: 880, dur: .45, vol: .08 }) } },
  restock:{ file: null, synth: (ac, o, t) => arp(ac, o, t, ['E5', 'G5', 'C6', 'E6'], .08, .1) },
  blocked:{ file: null, synth: (ac, o, t) => { tone(ac, o, t, { f: 196, dur: .14, vol: .16 }); tone(ac, o, t + .15, { f: 147, dur: .26, vol: .16 }) } },
})
function start() { RUN++; listeners = []; closeSheetNow(); run(RUN).catch((e) => { if (e !== STOP) console.error(e) }) }
let sheetCloser = null
function closeSheetNow() { $('sheet').classList.remove('open'); sheetCloser = null }
$('sheetClose').onclick = () => { if (MODE === 'play') sheetCloser?.() }
$('sheet').addEventListener('pointerdown', (e) => { if (e.target === $('sheet') && MODE === 'play') sheetCloser?.() })

/* ══════════════ the session ══════════════ */

/* ══════════════ the league: Johto's gyms, the Elite Four, Kanto's gyms ══════════════
   Summoned with a token bought from the machine, one challenge at a time, in
   order: Johto's eight gyms, then the Elite Four and Champion Lance back to
   back on a single summon, and once you're Champion, Kanto's eight gyms.
   Far tougher than scalpers: bigger teams, Pokémon above the everyday ones with high
   IVs, quicker attacks, sharp move choices, and a Full Restore on their last
   Pokémon. `team` lists their Pokémon, ace last.

   Levels are set, whatever yours are (leaderLevels): each leader's team
   runs from `low` up to their ace at `min`. Johto: Falkner 9-13 to Clair
   33-38; the Elite Four 36-40 to Karen 42-46, Champion Lance 45-50. Kanto:
   Brock 47-51 to Blaine 59-63, Blue 62-66; the Kanto Elite Four 63-67 to
   Lance 66-71, then Red 71-75. Everyday trainers and wild Pokémon scale with
   you but stay 3 below the next challenge's ace (trainerCap). */
const GYMS = [
  { short: 'FALKNER', full: 'GYM LEADER FALKNER', city: 'VIOLET CITY', type: 'flying', badge: 'ZEPHYR', color: '#7fb2ff', scene: 'tower', low: 9, min: 13,
    team: ['PIDGEY', 'HOOTHOOT', 'PIDGEOTTO'],
    intro: ["Falkner, Violet City's Gym Leader. You summoned me to a vending machine?", "Fine. My birds don't care where they fly. Show me you can keep up with them!"],
    outro: ["You grounded my birds... Not bad. Not bad at all.", 'This is yours now: the ZEPHYR BADGE.'],
    gloat: ['Too slow. The wind was on our side.', 'Come back when you can read the sky.'] },
  { short: 'BUGSY', full: 'GYM LEADER BUGSY', city: 'AZALEA TOWN', type: 'bug', badge: 'HIVE', color: '#86efac', scene: 'forest', low: 13, min: 17,
    team: ['METAPOD', 'KAKUNA', 'SCYTHER'],
    intro: ["I'm Bugsy! I study bug Pokémon, and I've got notes on every one of yours.", "Let's see if my research holds up. Ready?"],
    outro: ["Huh! That's going straight in my notebook.", 'You earned it. Here, take the HIVE BADGE.'],
    gloat: ['My research says I win this one!', 'Keep studying. You were close.'] },
  { short: 'WHITNEY', full: 'GYM LEADER WHITNEY', city: 'GOLDENROD CITY', type: 'normal', badge: 'PLAIN', color: '#f9a8d4', scene: 'hall', low: 17, min: 21,
    team: ['CLEFABLE', 'AMBIPOM', 'LICKILICKY', 'MILTANK'],
    intro: ["I'm Whitney! Isn't my Miltank the cutest?", "Don't let that fool you, though. We play to win!"],
    outro: ["No fair! You weren't supposed to win!", "...Ugh, fine. Here's the PLAIN BADGE. Don't gloat."],
    gloat: ['Ha! Nobody stops Miltank.', 'Better luck next time, cutie!'] },
  { short: 'MORTY', full: 'GYM LEADER MORTY', city: 'ECRUTEAK CITY', type: 'ghost', badge: 'FOG', color: '#c4b5fd', scene: 'distortion', low: 21, min: 25,
    team: ['HAUNTER', 'MIMIKYU', 'MISMAGIUS', 'GENGAR'],
    intro: ["I'm Morty. I had a feeling someone would call on me today.", "Let's see whether the future I saw was the right one."],
    outro: ["So that's how it goes. I didn't foresee this.", 'You have earned the FOG BADGE.'],
    gloat: ['I saw this ending before we began.', "Your path isn't clear yet. Keep walking it."] },
  { short: 'CHUCK', full: 'GYM LEADER CHUCK', city: 'CIANWOOD CITY', type: 'fighting', badge: 'STORM', color: '#fdba74', scene: 'bertha', low: 24, min: 28,
    team: ['TOXICROAK', 'MACHAMP', 'HITMONLEE', 'HITMONCHAN', 'POLIWRATH'],
    intro: ["HOOAH! I'm Chuck! My Pokémon and I train harder than anyone!", "Let's see what you've got! No holding back!"],
    outro: ["HOOAH... I lost?! What a fight!", 'You deserve this. The STORM BADGE is yours!'],
    gloat: ['HOOAH! More training for you!', "Come back stronger, and we'll go again!"] },
  { short: 'JASMINE', full: 'GYM LEADER JASMINE', city: 'OLIVINE CITY', type: 'steel', badge: 'MINERAL', color: '#cbd5e1', scene: 'factory', low: 27, min: 31,
    team: ['MAGNETON', 'SKARMORY', 'FORRETRESS', 'MAGNEZONE', 'STEELIX'],
    intro: ["...Oh. Hello. I'm Jasmine. I use steel types.", "...They're very sturdy. I hope you're ready."],
    outro: ["...You were wonderful.", '...Please take the MINERAL BADGE.'],
    gloat: ["...Sorry. Steel doesn't bend easily.", '...Do come back again.'] },
  { short: 'PRYCE', full: 'GYM LEADER PRYCE', city: 'MAHOGANY TOWN', type: 'ice', badge: 'GLACIER', color: '#bae6fd', scene: 'ice', low: 30, min: 34,
    team: ['DEWGONG', 'CLOYSTER', 'JYNX', 'GLACEON', 'LAPRAS', 'MAMOSWINE'],
    intro: ["I am Pryce. I have trained ice Pokémon longer than you have been alive.", "Patience and cold. Let us see if you have learned either."],
    outro: ["Hm. The ice gives way to you. I am impressed.", 'Take the GLACIER BADGE, young one.'],
    gloat: ['The cold is patient. You were not.', 'Warm up, and think on what went wrong.'] },
  { short: 'CLAIR', full: 'GYM LEADER CLAIR', city: 'BLACKTHORN CITY', type: 'dragon', badge: 'RISING', color: '#a5b4fc', scene: 'cynthia', low: 33, min: 38,
    team: ['GYARADOS', 'AERODACTYL', 'DRAGONAIR', 'DRAGONAIR', 'AMPHAROS', 'KINGDRA'],
    intro: ["I'm Clair. The best dragon trainer you'll ever meet.", "You summoned me, so I hope you're not wasting my time."],
    outro: ["...I lost? To you?", "...Fine. The RISING BADGE. You've earned it, I suppose."],
    gloat: ['Of course. Dragons are the strongest.', 'Train more before you dare face me again.'] },

  /* Kanto, open once you're Champion. Their aces' signature moves ride on the
     leader (`sig`), not the species, so Guard Marcus's Arcanine and the like
     keep fighting the way they always have. */
  { short: 'BROCK', full: 'GYM LEADER BROCK', city: 'PEWTER CITY', type: 'rock', badge: 'BOULDER', color: '#d6d3d1', scene: 'mountain', low: 47, min: 51, tokens: '10.00',
    team: ['GOLEM', 'OMASTAR', 'KABUTOPS', 'AERODACTYL', 'RHYPERIOR', 'STEELIX'],   // a rematch: his HGSS team, evolved and filled out
    sig: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('ROCK SLIDE', 'rock', 65, 'phys', 'thud', { ranged: true }), L_('ROLLOUT', 'rock', 30, 'phys', 'roll', 'thud', { hits: 3 })],
    intro: ["I'm Brock, Pewter City's Gym Leader. Rock types are all about grit.", "You beat the Champion? Then my defense is the real test."],
    outro: ['My rock-hard defense... crumbled. That was great.', "Here. The BOULDER BADGE. You've earned it."],
    gloat: ["Rock doesn't move. That's the whole point.", 'Work on your offense and come back.'] },
  { short: 'MISTY', full: 'GYM LEADER MISTY', city: 'CERULEAN CITY', type: 'water', badge: 'CASCADE', color: '#67e8f9', scene: 'water', low: 49, min: 53, tokens: '10.00',
    team: ['GOLDUCK', 'VAPOREON', 'POLITOED', 'GYARADOS', 'LAPRAS', 'STARMIE'],
    sig: [S_('PSYCHIC', 'psychic', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('SWIFT', 'normal', 40, 'spec', 'whoosh', { ranged: true, hits: 2 })],
    intro: ["Misty, Cerulean City's Gym Leader. Water types, all the way.", "Champion or not, I'm going to soak you!"],
    outro: ["Ugh, you're good. Really good.", 'Fine! The CASCADE BADGE is yours.'],
    gloat: ['Washed out! Told you so.', 'Go dry off and try again.'] },
  { short: 'LT. SURGE', full: 'GYM LEADER LT. SURGE', city: 'VERMILION CITY', type: 'electric', badge: 'THUNDER', color: '#fde047', scene: 'city', low: 51, min: 55, tokens: '10.00', key: 'lt_surge',
    team: ['RAICHU', 'ELECTRODE', 'JOLTEON', 'AMPHAROS', 'MAGNEZONE', 'ELECTIVIRE'],
    sig: [S_('THUNDERBOLT', 'electric', 75, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 55, 'spec', 'current', 'zap'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['Lt. Surge, Vermilion City! Ten-hut! My Pokémon run on pure voltage!', "Let's see if the Champion can take a shock!"],
    outro: ["Whoa! You're the real deal, kid!", 'The THUNDER BADGE. You earned every volt of it.'],
    gloat: ["Zapped! That's how we do it in Vermilion!", 'Come back with something insulated!'] },
  { short: 'ERIKA', full: 'GYM LEADER ERIKA', city: 'CELADON CITY', type: 'grass', badge: 'RAINBOW', color: '#bef264', scene: 'meadow', low: 53, min: 57, tokens: '10.00',
    team: ['BELLOSSOM', 'VILEPLUME', 'ROSERADE', 'LEAFEON', 'VENUSAUR', 'TANGROWTH'],
    sig: [S_('PETAL BLIZZARD', 'grass', 70, 'phys', 'whoosh', { ranged: true }), L_('GRASS KNOT', 'grass', 55, 'spec', 'vines', 'thud'), S_('MOONBLAST', 'fairy', 70, 'spec', 'whoosh', { ranged: true })],
    intro: ["Oh... I must have dozed off. I'm Erika, of Celadon City.", 'I use grass types. Shall we begin? Gently, of course.'],
    outro: ["Oh my. You're very strong. I concede.", 'Please accept the RAINBOW BADGE.'],
    gloat: ['The flowers bloomed for me today.', 'Do come and visit the garden again.'] },
  { short: 'JANINE', full: 'GYM LEADER JANINE', city: 'FUCHSIA CITY', type: 'poison', badge: 'SOUL', color: '#f5d0fe', scene: 'marsh', low: 55, min: 59, tokens: '10.00',
    team: ['TENTACRUEL', 'GENGAR', 'WEEZING', 'TOXICROAK', 'NIDOQUEEN', 'CROBAT'],
    sig: [S_('BUG BUZZ', 'bug', 70, 'spec', 'whoosh', { ranged: true }), S_('PSYBEAM', 'psychic', 55, 'spec', 'shadow', { ranged: true }), L_('SLUDGE WAVE', 'poison', 55, 'spec', 'wave', 'whoosh')],
    intro: ["I'm Janine! My father Koga taught me everything about poison.", "I'm a ninja too, you know. You won't see me coming!"],
    outro: ['Aww... Father warned me you were strong.', 'Here. The SOUL BADGE.'],
    gloat: ['Ha! Father would be proud of that one!', "Train harder. I'll be waiting in Fuchsia."] },
  { short: 'SABRINA', full: 'GYM LEADER SABRINA', city: 'SAFFRON CITY', type: 'psychic', badge: 'MARSH', color: '#fbcfe8', scene: 'hall', low: 57, min: 61, tokens: '10.00',
    team: ['MR. MIME', 'SLOWKING', 'SLOWBRO', 'EXEGGUTOR', 'ALAKAZAM', 'ESPEON'],
    sig: [S_('PSYCHIC', 'psychic', 80, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('SHADOW BALL', 'ghost', 65, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('PSYWAVE', 'psychic', 50, 'spec', 'wave', 'shadow')],
    intro: ['I am Sabrina. I knew you would summon me today.', 'I also know how this ends. Shall we confirm it?'],
    outro: ['...That was not the future I saw.', 'The MARSH BADGE. Take it.'],
    gloat: ['As I foresaw.', 'Your future holds another try. Not yet a win.'] },
  { short: 'BLAINE', full: 'GYM LEADER BLAINE', city: 'CINNABAR ISLAND', type: 'fire', badge: 'VOLCANO', color: '#fb923c', scene: 'flint', low: 59, min: 63, tokens: '10.00',
    team: ['RAPIDASH', 'HOUNDOOM', 'FLAREON', 'CHARIZARD', 'MAGMORTAR', 'ARCANINE'],
    sig: [S_('FLARE BLITZ', 'fire', 80, 'phys', 'whoosh'), L_('FLAME WHEEL', 'fire', 50, 'phys', 'roll', 'whoosh'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['Blaine! My gym burned down, so a vending machine will have to do!', 'Pop quiz: what melts a Champion? My fire types!'],
    outro: ["I've burned out! What a battle!", 'You have earned the VOLCANO BADGE!'],
    gloat: ['The answer was my fire. Correct!', 'Study up and come back for a retake!'] },
  { short: 'BLUE', full: 'GYM LEADER BLUE', city: 'VIRIDIAN CITY', type: 'normal', badge: 'EARTH', color: '#93c5fd', scene: 'tower', low: 62, min: 66, tokens: '20.00', anyType: true,
    team: ['PIDGEOT', 'ALAKAZAM', 'RHYDON', 'EXEGGUTOR', 'GYARADOS', 'ARCANINE'],
    sig: [S_('FLARE BLITZ', 'fire', 80, 'phys', 'whoosh'), S_('CRUNCH', 'dark', 70, 'phys', 'crunch'), S_('EXTREME SPEED', 'normal', 50, 'phys', 'whoosh', { fast: true })],
    intro: ["So you're the one who beat Lance. I'm Blue. I was Champion once, you know.", "I've never gone easy on anyone. Don't expect me to start now."],
    outro: ["...Heh. You're the real thing.", "Take the EARTH BADGE. That's every gym there is. The Kanto League is next."],
    gloat: ["Too bad. I'm still the best there is.", "Come back when you've caught up."] },
]
GYMS.forEach((L, i) => Object.assign(L, { gym: i, region: i < 8 ? 'johto' : 'kanto', role: 'GYM LEADER', hard: true, tokens: L.tokens ?? '8.00',
  // Blue's gym has no type of its own.
  title: `${L.city} GYM · ${L.anyType ? 'EVERY' : L.type.toUpperCase()} TYPE`, summonName: `${L.badge} SUMMON` }, art(L)))

/* The Elite Four and the Champion: one summon, five fights back to back. Your
   party carries its HP from one fight into the next (items still work in
   battle). Lose anywhere and the run is over; the next summon starts again
   from Will. Each win pays as you go. */
const ELITE = [
  { short: 'WILL', full: 'ELITE FOUR WILL', type: 'psychic', color: '#f0abfc', scene: 'lucian', low: 36, min: 40, tokens: '6.00',
    team: ['JYNX', 'EXEGGUTOR', 'SLOWBRO', 'ESPEON', 'ALAKAZAM', 'XATU'],
    sig: [S_('PSYCHIC', 'psychic', 75, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('AIR SLASH', 'flying', 65, 'spec', 'whoosh', { ranged: true }), L_('PSYWAVE', 'psychic', 45, 'spec', 'wave', 'shadow')],
    intro: ["Will, of the Elite Four. I've studied psychic power on every continent.", "A vending machine summons me, and you expect to win? Let's see your mind."],
    outro: ['...My psychic power, outmatched. Remarkable.', 'Go on. Koga is next, and he is far less polite.'],
    gloat: ['Your thoughts were loud. I heard every move coming.', 'Clear your head before you try the League again.'] },
  { short: 'KOGA', full: 'ELITE FOUR KOGA', type: 'poison', color: '#d8b4fe', scene: 'aaron', low: 38, min: 42, tokens: '6.00',
    team: ['NIDOKING', 'VENOMOTH', 'FORRETRESS', 'WEEZING', 'MUK', 'CROBAT'],
    sig: [S_('CROSS POISON', 'poison', 70, 'phys', 'crunch'), S_('AIR SLASH', 'flying', 65, 'spec', 'whoosh', { ranged: true }), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['Fwahahaha! Koga of the Elite Four. A ninja is never where you expect.', "Poison and patience. You'll be tangled before you notice."],
    outro: ['Hmm... You saw through every technique. Well done.', 'Bruno is next. Mind your footing.'],
    gloat: ['Fwahaha! Caught in the web, as planned.', 'Return when you can see what is hidden.'] },
  { short: 'BRUNO', full: 'ELITE FOUR BRUNO', type: 'fighting', color: '#fda4af', scene: 'bertha', low: 40, min: 44, tokens: '6.00',
    team: ['STEELIX', 'HITMONTOP', 'HITMONLEE', 'HITMONCHAN', 'POLIWRATH', 'MACHAMP'],
    sig: [S_('CROSS CHOP', 'fighting', 80, 'phys', 'thud'), L_('LOW SWEEP', 'fighting', 50, 'phys', 'sweep', 'thud'), S_('BULLET PUNCH', 'steel', 40, 'phys', 'thud', { fast: true })],
    intro: ['Bruno of the Elite Four! My Pokémon and I train until the mountains crack!', 'No tricks. No excuses. Hit us with everything!'],
    outro: ['Hah! Beaten fair and square. That was a real fight!', "Karen is next. She's tougher than she looks."],
    gloat: ['HAAH! Your guard was down!', 'Train your body, then come back!'] },
  { short: 'KAREN', full: 'ELITE FOUR KAREN', type: 'dark', color: '#94a3b8', scene: 'castle', low: 42, min: 46, tokens: '6.00',
    team: ['UMBREON', 'HONCHKROW', 'VILEPLUME', 'GENGAR', 'MIMIKYU', 'HOUNDOOM'],
    sig: [S_('FLAMETHROWER', 'fire', 75, 'spec', 'whoosh', { ranged: true }), S_('CRUNCH', 'dark', 70, 'phys', 'crunch'), L_('FLAME WHEEL', 'fire', 50, 'phys', 'roll', 'whoosh')],
    intro: ['Karen, of the Elite Four. I use dark types, and I raise them with love.', 'Strength is in how you treat your Pokémon. Show me yours.'],
    outro: ['Well, well. You really do care for your team.', "Go on. The Champion is waiting for you."],
    gloat: ['Not bad, but not enough. Love them harder.', 'Come back when your team trusts you completely.'] },
  { short: 'LANCE', full: 'CHAMPION LANCE', role: 'CHAMPION', switches: 2, type: 'dragon', color: '#f87171', scene: 'cynthia', low: 45, min: 50, tokens: '20.00',
    team: ['GYARADOS', 'DRAGONITE', 'CHARIZARD', 'AERODACTYL', 'DRAGONITE', 'DRAGONITE'],
    sig: [S_('OUTRAGE', 'dragon', 80, 'phys', 'thud', { rampage: true }), L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('EXTREME SPEED', 'normal', 50, 'phys', 'whoosh', { fast: true })],
    intro: ["I've been waiting. I'm Lance: the Champion, and a dragon master.", "Four down in one go. Let's see if you can finish it."],
    outro: ["...It's over. You're the new Champion of the Johto League.", "Kanto's Gym Leaders will want to meet you. Go show them."],
    gloat: ["Dragons don't yield. Neither do I.", 'The Elite Four are waiting. Start again from Will.'] },
]
ELITE.forEach((L) => Object.assign(L, { elite: true, city: 'INDIGO PLATEAU', role: L.role ?? 'ELITE FOUR', hard: true,
  title: `${L.role === 'CHAMPION' ? 'CHAMPION' : 'ELITE FOUR'} · ${L.type.toUpperCase()} TYPE` }, art(L)))
/** What the Elite Four summon shows on the shelf and in the Bag. */
const ELITE_CARD = { short: 'THE ELITE FOUR', city: 'INDIGO PLATEAU', summonName: 'ELITE FOUR TICKET', face: 'gymFace:lance', color: '#f87171', tag: 'LEAGUE' }
/*
 * The Kanto League: once you hold all sixteen badges, the Kanto Elite Four
 * (Lorelei, Bruno, Agatha and Lance, the last two back with new teams) and
 * then Red, at Mt. Silver, on one ticket, as the Johto League's ladder is.
 * Lose and the next ticket starts again from Lorelei; beat Red and it's done.
 * Their own battle theme (SONGS.kantoElite) and Red's (SONGS.red).
 */
const KANTO_ELITE = [
  { short: 'LORELEI', full: 'ELITE FOUR LORELEI', type: 'ice', color: '#7dd3fc', scene: 'castle', low: 63, min: 67, tokens: '10.00',
    team: ['DEWGONG', 'CLOYSTER', 'SLOWBRO', 'JYNX', 'GLACEON', 'LAPRAS'],
    sig: [S_('BLIZZARD', 'ice', 80, 'spec', 'whoosh', { ranged: true }), L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('ICE SHARD', 'ice', 45, 'phys', 'whoosh', { fast: true, ranged: true })],
    intro: ['Lorelei, of the Kanto Elite Four. You came a long way to freeze.', "My ice doesn't crack. Let's see if you do."],
    outro: ['...You thawed every one of them.', 'Bruno is next. Warm up while you can.'],
    gloat: ['Frozen solid. As I expected.', 'Come back when you can take the cold.'] },
  { short: 'BRUNO', full: 'ELITE FOUR BRUNO', type: 'fighting', color: '#fda4af', scene: 'bertha', low: 64, min: 68, tokens: '10.00',
    team: ['STEELIX', 'HITMONLEE', 'HERACROSS', 'MACHAMP', 'POLIWRATH', 'LUCARIO'],
    sig: [S_('AURA SPHERE', 'fighting', 80, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('CLOSE COMBAT', 'fighting', 85, 'phys', 'thud'), S_('EXTREME SPEED', 'normal', 50, 'phys', 'whoosh', { fast: true })],
    intro: ['Bruno again! A new team, the same fists!', "I trained on Kanto's mountains for this. Show me you've grown too!"],
    outro: ['HAAH! You have! Well fought!', 'Agatha is next. Keep your nerve.'],
    gloat: ['Not yet! Train harder!', 'Come back stronger!'] },
  { short: 'AGATHA', full: 'ELITE FOUR AGATHA', type: 'ghost', color: '#c4b5fd', scene: 'distortion', low: 65, min: 69, tokens: '10.00',
    team: ['CROBAT', 'ARBOK', 'MIMIKYU', 'MISMAGIUS', 'HAUNTER', 'GENGAR'],
    sig: [S_('SHADOW BALL', 'ghost', 80, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('SLUDGE BOMB', 'poison', 75, 'spec', 'whoosh', { ranged: true }), L_('SHADOW SNEAK', 'ghost', 45, 'phys', 'shadow', 'shadow', { fast: true })],
    intro: ['Agatha. I was battling before your parents were born.', "Ghosts don't tire, child. Let's see how long you last."],
    outro: ['Hmph. Not bad for a youngster.', 'Lance is waiting. Go on, then.'],
    gloat: ['Heh heh. Spooked, were you?', 'Run along home and rest.'] },
  { short: 'LANCE', full: 'ELITE FOUR LANCE', type: 'dragon', color: '#f87171', scene: 'cynthia', low: 66, min: 71, tokens: '10.00',
    team: ['KINGDRA', 'AERODACTYL', 'GYARADOS', 'GARCHOMP', 'DRAGONITE'],
    sig: [S_('DRACO METEOR', 'dragon', 90, 'spec', 'shadow', { ranged: true, fx: 'orb' }), S_('HURRICANE', 'flying', 80, 'spec', 'whoosh', { ranged: true }), S_('EXTREME SPEED', 'normal', 50, 'phys', 'whoosh', { fast: true })],
    intro: ["We meet again. Here, I'm the last of Kanto's Elite Four.", 'Beat me, and the road to Mt. Silver opens. Someone is waiting up there.'],
    outro: ["You've earned it. Mt. Silver is open to you.", 'Red is at the top. Go. I want to know how it ends.'],
    gloat: ['Dragons still rule here.', 'Start again from Lorelei.'] },
  { short: 'RED', full: 'POKéMON TRAINER RED', role: 'LEGEND', switches: 2, type: 'electric', color: '#ef4444', scene: 'hall', low: 71, min: 75, tokens: '30.00', restores: 3, red: true, city: 'MT. SILVER',
    team: ['ESPEON', 'SNORLAX', 'VENUSAUR', 'CHARIZARD', 'BLASTOISE', 'PIKACHU'],
    sig: [S_('VOLT TACKLE', 'electric', 90, 'phys', 'zap'), S_('THUNDERBOLT', 'electric', 75, 'spec', 'zap', { ranged: true }), S_('IRON TAIL', 'steel', 75, 'phys', 'crunch'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true })],
    intro: ['…', '…!'], outro: ['…Be careful…', 'Another trainer came by… very powerful.'], gloat: ['…'] },
]
KANTO_ELITE.forEach((L, i) => Object.assign(L, { elite: true, kanto: true, region: 'kanto', introSong: ['e4Lorelei', 'e4Bruno', 'e4Agatha', 'e4KantoLance', null][i], city: L.city ?? 'INDIGO PLATEAU', role: L.role ?? 'ELITE FOUR', hard: true, tellRate: [0.67, 0.51, 0.69, 0.22, 0.69][i], ringFast: [0.73, 0.82, 0.78, 0.9, 0.66][i],   // Lance: his dragons hit hardest, so he tells least; Red: the most tells and the fastest rings in the game
  title: L.red ? 'MT. SILVER · THE LEGEND' : `KANTO ELITE FOUR · ${L.type.toUpperCase()} TYPE` }, art(L)))
const KANTO_CARD = { short: 'THE KANTO LEAGUE', city: 'INDIGO PLATEAU', summonName: 'KANTO LEAGUE TICKET', face: 'gymFace:red', color: '#ef4444', tag: 'LEAGUE' }
/** The two Leagues, by their ticket's summon id: Johto's ('elite') and Kanto's ('kanto'). */
const LEAGUES = {
  elite: { members: ELITE, card: ELITE_CARD, sub: 'the Elite Four and Champion Lance, one at a time', battle: (L) => (L.short === 'LANCE' ? 'champion' : 'elite') },
  kanto: { members: KANTO_ELITE, card: KANTO_CARD, sub: 'the Kanto Elite Four, then Red, one at a time', battle: (L) => (L.red ? 'red' : 'kantoElite') },
}
// The new faces' art: their Pokémon Masters EX renders (from Bulbagarden Archives), framed as the others'.
for (const k of ['lorelei', 'agatha', 'red']) Object.assign(ART, { [`gymVs:${k}`]: `/rpg/a/gym-${k}-vs.jpg`, [`gymFace:${k}`]: `/rpg/a/gym-${k}-face.jpg`, [`gymBody:${k}`]: `/rpg/a/gym-${k}-body.png` })

/** A leader's art keys (build.mjs embeds `gymBody:<key>` and friends). */
function art(L) {
  const k = L.key ?? L.short.toLowerCase()
  return { key: k, vs: `gymVs:${k}`, face: `gymFace:${k}`, body: `gymBody:${k}`, down: `gymBody:${k}`, faceDown: `gymFace:${k}` }
}

const LEVEL_CAP = 100

/**
 * Whether a leader who switches (`switches`: Lance, Red, Alex's last battle)
 * pulls its Pokémon out: only once your best move is super effective on it,
 * and only for one on the bench (`bench`, never the ace, kept for last) with
 * over 40% of its HP that takes no more than 60% of the damage and trades
 * better against yours. Returns that Pokémon, or null. The game and the
 * balance simulator (tests/rpg/sim.mjs) both call this.
 */
function switchPick(cur, bench, me, myMoves, movesOf_) {
  const hits = (moves) => moves.filter((m) => m && (m.power ?? 0) > 0)
  const hit = (moves, att, def) => Math.max(0, ...hits(moves).map((m) => m.power * (m.hits ?? 1) * soften(gameMult(m.type, def.types)) * (att.types.includes(m.type) ? 1.5 : 1)))
  if (Math.max(0, ...hits(myMoves).map((m) => soften(gameMult(m.type, cur.types)))) <= 1) return null
  const taken = hit(myMoves, me, cur), trade = (f, took) => hit(movesOf_(f), f, me) / Math.max(1, took)
  let best = null, bestTrade = trade(cur, taken)
  for (const f of bench) {
    const took = hit(myMoves, me, f)
    if (f.hp <= f.stats.hp * 0.4 || took > taken * 0.6) continue
    const t = trade(f, took)
    if (t > bestTrade) { best = f; bestTrade = t }
  }
  return best
}
/**
 * The levels a leader's team fights at, ace last: set levels, whatever yours
 * are. The ace at `min`; the rest spread evenly from `low` up to 2 below it
 * (Falkner: 9, 11, then his ace at 13). Gym Leaders, both Elite Fours, Red,
 * Alex, Herb and Paul all fight this way.
 */
function leaderLevels(L) {
  const rest = L.team.length - 1, top = Math.max(L.low, L.min - 2)
  return L.team.map((_, i) => (i === rest ? L.min : rest < 2 ? L.low : Math.round(L.low + (top - L.low) * i / (rest - 1))))
}

/**
 * What a summon brings next, given the gyms beaten and whether you're
 * Champion: a gym's index (Johto 0-7, Kanto 8-15), 'elite' between the two
 * regions, or null once every gym is beaten.
 */
function nextChallenge(badges, champion) {
  if (badges.length < 8) return badges.length
  if (!champion) return 'elite'
  return badges.length < GYMS.length ? badges.length : null
}
/** The leader, or the Elite Four's card, that a challenge refers to. */
const challengeCard = (n) => LEAGUES[n]?.card ?? GYMS[n]

/* The aces' signature moves; the rest of a leader's team fights with its type's moves. */
Object.assign(TRAINER_MOVES, {
  PIDGEOTTO: [S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), S_('GUST', 'flying', 45, 'spec', 'whoosh', { ranged: true, hits: 2 })],
  SCYTHER: [S_('FURY CUTTER', 'bug', 30, 'phys', 'whoosh', { hits: 3 }), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh')],
  MILTANK: [L_('ROLLOUT', 'rock', 30, 'phys', 'roll', 'thud', { hits: 3 }), S_('STOMP', 'normal', 65, 'phys', 'thud'), S_('ATTRACT', 'normal', 30, 'spec', 'whoosh', { ranged: true })],
  GENGAR: [S_('SHADOW BALL', 'ghost', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('SLUDGE BOMB', 'poison', 70, 'spec', 'whoosh', { ranged: true })],
  POLIWRATH: [S_('DYNAMIC PUNCH', 'fighting', 75, 'phys', 'thud'), L_('SURF', 'water', 60, 'spec', 'wave', 'whoosh'), S_('DOUBLE SLAP', 'normal', 20, 'phys', 'thud', { hits: 3 })],
  STEELIX: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('IRON TAIL', 'steel', 75, 'phys', 'crunch'), S_('ROCK THROW', 'rock', 55, 'phys', 'thud', { ranged: true })],
  MAMOSWINE: [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('ICE SHARD', 'ice', 45, 'phys', 'whoosh', { fast: true, ranged: true }), S_('BLIZZARD', 'ice', 75, 'spec', 'whoosh', { ranged: true })],
  KINGDRA: [S_('DRAGON PULSE', 'dragon', 70, 'spec', 'shadow', { ranged: true }), L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('TWISTER', 'dragon', 35, 'spec', 'whoosh', { ranged: true, hits: 2 })],
})
/** A challenge's summon as a Bag item key: 'summon:3', 'summon:elite'. */
TRAINER_MOVES.PILOSWINE = TRAINER_MOVES.MAMOSWINE   // Pryce's ace before it evolved: the same set
const summonKey = (n) => 'summon:' + n
/** A challenge's summon as a Bag item, registered the first time one turns up. */
const summonItem = (n) => (ITEMS[summonKey(n)] ??= LEAGUES[n]
  ? { name: LEAGUES[n].card.summonName, sub: LEAGUES[n].sub, cls: 't-summon', summon: n, league: true }
  : { name: GYMS[n].summonName, sub: `summons ${GYMS[n].short} of ${GYMS[n].city}`, cls: 't-summon', summon: n })

/*
 * The Elite Four's aces fight with their signature moves (the rest with their type's).
 * Lance's other two Dragonite get a set of their own, without the ace's OUTRAGE: three
 * rampages in one team made him all but unbeatable (tests/rpg/sim.mjs: 7% for an average player).
 */
TRAINER_MOVES.DRAGONITE = [S_('DRAGON CLAW', 'dragon', 70, 'phys', 'whoosh'), S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh'), L_('TWISTER', 'dragon', 45, 'spec', 'wave', 'whoosh')]
ELITE.forEach((L) => { if (L.sig) TRAINER_MOVES[L.team.at(-1)] ??= L.sig })
KANTO_ELITE.forEach((L) => { if (L.sig) TRAINER_MOVES[L.team.at(-1)] ??= L.sig })

/*
 * Balance (tests/rpg/sim.mjs, `npm run sim:rpg`: thousands of simulated battles).
 * Aim, for an average player arriving at the leader's level: about 3 wins in 4
 * (Lance and Red about 1 in 2, Alex's last 1 in 3). Levels are set (`low` to
 * `min`, leaderLevels). Each leader's `tellRate` (how often an attack comes
 * with a tell) is tuned to that aim; `ringFast` (how fast their rings close;
 * lower is faster) stays as it was: the first gyms gentle, Kanto's gyms
 * nearly as quick as Red, Red the quickest of all. From Morty on, the Johto
 * leaders below their ace fight with the stronger moves, as Kanto's do
 * (`strong`). Lance, the Champion, is the toughest of the Johto League.
 */
/*
 * How far below a leader's ace everyday trainers and wild Pokémon stop
 * (trainerCap), so where you'd arrive without grinding: 3 at the Johto gyms,
 * widening through the game to 8 before Red, as the leaders pull ahead of
 * everyday battles.
 */
const GAP = { johto: 3, elite: 4, kanto: 6, kantoElite: 7, red: 8 }
const JOHTO_TELL = [0.11, 0.4, 0.33, 0.23, 0.26, 0.03, 0.45, 0.25]
const JOHTO_RING = [0.9, 0.9, 0.96, 0.9, 0.98, 0.93, 0.74, 0.92]
const KANTO_TELL = [0.54, 0.51, 0.59, 0.54, 0.65, 0.69, 0.7, 0.56]
// Tells stop at 0.7 (more and nearly every attack is a trick); past that, a leader's IVs are at least 31 instead of 20.
const IV31 = ['LT. SURGE', 'JANINE', 'SABRINA', 'BLAINE', 'BLUE', 'KAREN', 'RED']
const KANTO_RING = [0.73, 0.68, 0.69, 0.73, 0.7, 0.71, 0.69, 0.8]
GYMS.forEach((L, i) => Object.assign(L, i < 8
  ? { gap: GAP.johto, tellRate: JOHTO_TELL[i], ringFast: JOHTO_RING[i], strong: i >= 3 }
  : { gap: GAP.kanto, tellRate: KANTO_TELL[i - 8], ringFast: KANTO_RING[i - 8] }))
// Lance: the highest levels, fewer tells and slower rings (sim.mjs: a little under 1 in 2).
const ELITE_TELL = { WILL: 0.58, KOGA: 0.57, BRUNO: 0.57, KAREN: 0.67 }, ELITE_RING = { WILL: 0.77, KOGA: 0.83, BRUNO: 0.83, KAREN: 0.76 }
ELITE.forEach((L) => Object.assign(L, { gap: GAP.elite,
  ...(L.role === 'CHAMPION' ? { tellRate: 0.48, ringFast: 0.9 } : { tellRate: ELITE_TELL[L.short], ringFast: ELITE_RING[L.short], strong: true }) }))
KANTO_ELITE.forEach((L) => { L.gap = L.red ? GAP.red : GAP.kantoElite })
;[...GYMS, ...ELITE, ...KANTO_ELITE].forEach((L) => { if (IV31.includes(L.short)) L.ivs = 31 })

/* What a leader says after a tell: a jab when it lands, by the tell, or a grudging nod when you read it. */
const TELL_QUIP = {
  hit: ['Stay focused, trainer!', 'Eyes on the ring, not on me!', 'Too slow! Pay attention.', 'Did that one catch you off guard?'],
  feint: ['Ha! You flinched at nothing!', 'Patience, trainer. Wait for it next time.'],
  double: ['One ring is never the whole story!', 'Thought it was over? Think again!'],
  lowHigh: ['Watch the feet, then the fists!', 'Low, then high. Keep up!'],
  clean: ["Hmph. Not bad. Let's see you do it twice.", 'You read that one. Lucky?', "Sharp eyes. They won't save you forever."],
}
/* Each leader's own jab, used about half the time when a tell lands. */
const TELL_QUIPS = {
  FALKNER: 'My birds strike from where you least expect!', BUGSY: "Bugs are quicker than they look. I've studied it!",
  WHITNEY: 'Hee hee! Did that one sting?', MORTY: "You can't trust your eyes against a ghost.",
  CHUCK: 'WAHAHA! Keep your guard up!', JASMINE: 'Um... sorry. You should watch more closely.',
  PRYCE: 'Patience is learned over many winters, child.', CLAIR: 'Is that all? I expected more from a challenger.',
  BROCK: 'Rock-solid timing beats rushing in.', MISTY: "Ha! You're all wet!", 'LT. SURGE': 'Stay sharp, soldier!',
  ERIKA: 'Oh my... you seemed a little distracted.', JANINE: 'A ninja never shows the real strike!',
  SABRINA: 'I saw you hesitate before you did.', BLAINE: 'Hah! Hot-headed, are we?', BLUE: "What, you thought I'd go easy on you?",
  WILL: 'Your mind betrayed you there.', KOGA: "Fwahahaha! Deception is the ninja's art!", BRUNO: 'Hoo hah! Train harder!',
  KAREN: 'Strong trainers keep their eyes open.', LANCE: "A Champion's challenger can't afford to blink.",
}
/* A leader calling on their last Pokémon, before it comes out. */
const LAST_MON = ["It's all up to you, {mon}!", "{mon}, show them why you're my ace!", "Don't hold back now, {mon}!", "This is it. {mon}, let's finish this!"]

/*
 * Kanto's teams, below their ace, fight with full-power moves of their type
 * (the wild sets top out around 40 power, which barely scratches a Lv 55+
 * party). Each set has one move along the ground, to jump.
 */
const STRONG_MOVES = {
  normal:   [S_('BODY SLAM', 'normal', 70, 'phys', 'thud'), L_('RAPID SPIN', 'normal', 50, 'phys', 'roll', 'thud'), S_('QUICK ATTACK', 'normal', 40, 'phys', 'whoosh', { fast: true }), S_('HYPER BEAM', 'normal', 90, 'spec', 'zap', { ranged: true, charge: true })],
  fighting: [S_('CROSS CHOP', 'fighting', 75, 'phys', 'thud'), L_('LOW SWEEP', 'fighting', 55, 'phys', 'sweep', 'thud'), S_('MACH PUNCH', 'fighting', 40, 'phys', 'thud', { fast: true })],
  flying:   [S_('AIR SLASH', 'flying', 70, 'spec', 'whoosh', { ranged: true }), S_('WING ATTACK', 'flying', 60, 'phys', 'whoosh'), L_('TWISTER', 'dragon', 45, 'spec', 'wave', 'whoosh')],
  poison:   [S_('SLUDGE BOMB', 'poison', 70, 'spec', 'whoosh', { ranged: true }), L_('SLUDGE WAVE', 'poison', 55, 'spec', 'wave', 'whoosh'), S_('POISON JAB', 'poison', 65, 'phys', 'thud')],
  ground:   [L_('EARTHQUAKE', 'ground', 70, 'phys', 'quake', 'quake'), S_('DIG', 'ground', 65, 'phys', 'thud'), S_('MUD SHOT', 'ground', 55, 'spec', 'whoosh', { ranged: true })],
  rock:     [S_('STONE EDGE', 'rock', 80, 'phys', 'thud'), S_('ROCK SLIDE', 'rock', 65, 'phys', 'thud', { ranged: true }), L_('ROLLOUT', 'rock', 30, 'phys', 'roll', 'thud', { hits: 3 })],
  bug:      [S_('BUG BUZZ', 'bug', 70, 'spec', 'whoosh', { ranged: true }), S_('X-SCISSOR', 'bug', 65, 'phys', 'whoosh'), S_('PIN MISSILE', 'bug', 25, 'phys', 'whoosh', { hits: 3 })],
  ghost:    [S_('SHADOW BALL', 'ghost', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('SHADOW SNEAK', 'ghost', 40, 'phys', 'shadow', 'shadow', { fast: true }), S_('HEX', 'ghost', 60, 'spec', 'shadow', { ranged: true })],
  steel:    [S_('IRON HEAD', 'steel', 70, 'phys', 'thud'), S_('FLASH CANNON', 'steel', 70, 'spec', 'whoosh', { ranged: true }), L_('BULLDOZE', 'ground', 50, 'phys', 'quake', 'quake')],
  fire:     [S_('FLAMETHROWER', 'fire', 70, 'spec', 'whoosh', { ranged: true }), L_('FLAME WHEEL', 'fire', 50, 'phys', 'roll', 'whoosh'), S_('FIRE FANG', 'fire', 60, 'phys', 'crunch')],
  water:    [L_('SURF', 'water', 65, 'spec', 'wave', 'whoosh'), S_('WATERFALL', 'water', 70, 'phys', 'whoosh'), S_('AQUA JET', 'water', 40, 'phys', 'whoosh', { fast: true })],
  grass:    [S_('ENERGY BALL', 'grass', 70, 'spec', 'whoosh', { ranged: true }), L_('GRASS KNOT', 'grass', 55, 'spec', 'vines', 'thud'), S_('RAZOR LEAF', 'grass', 55, 'phys', 'whoosh', { ranged: true })],
  electric: [S_('THUNDERBOLT', 'electric', 70, 'spec', 'zap', { ranged: true }), L_('DISCHARGE', 'electric', 55, 'spec', 'current', 'zap'), S_('SPARK', 'electric', 55, 'phys', 'zap')],
  psychic:  [S_('PSYCHIC', 'psychic', 70, 'spec', 'shadow', { ranged: true, fx: 'orb' }), L_('PSYWAVE', 'psychic', 50, 'spec', 'wave', 'shadow'), S_('PSYBEAM', 'psychic', 55, 'spec', 'shadow', { ranged: true })],
  ice:      [S_('ICE BEAM', 'ice', 70, 'spec', 'whoosh', { ranged: true }), S_('ICE SHARD', 'ice', 40, 'phys', 'whoosh', { fast: true }), L_('BULLDOZE', 'ground', 50, 'phys', 'quake', 'quake')],
  dragon:   [S_('DRAGON PULSE', 'dragon', 70, 'spec', 'shadow', { ranged: true }), S_('DRAGON CLAW', 'dragon', 70, 'phys', 'whoosh'), L_('TWISTER', 'dragon', 45, 'spec', 'wave', 'whoosh'), S_('OUTRAGE', 'dragon', 80, 'phys', 'thud', { rampage: true })],
  dark:     [S_('CRUNCH', 'dark', 70, 'phys', 'crunch'), S_('FEINT ATTACK', 'dark', 55, 'phys', 'whoosh'), L_('SUCKER PUNCH', 'dark', 45, 'phys', 'shadow', 'shadow', { fast: true })],
  fairy:    [S_('MOONBLAST', 'fairy', 70, 'spec', 'whoosh', { ranged: true }), S_('DAZZLING GLEAM', 'fairy', 60, 'spec', 'whoosh', { ranged: true }), L_('DRAINING KISS', 'fairy', 45, 'spec', 'wave', 'whoosh', { drain: 0.75 })],
}
/** A Kanto leader's Pokémon's moves (not their ace's: that's the leader's `sig`). */
const strongMoves = (m) => STRONG_MOVES[m.types[0]] ?? STRONG_MOVES.normal

async function run(id) {
  const demo = MODE !== 'play'   // 'demo' and 'duo' are both watched
  const live = () => id === RUN
  const W = (ms) => new Promise((r, j) => setTimeout(() => (live() ? r() : j(STOP)), ms))
  const anim = (el, frames, opts) => el.animate(frames, { fill: 'forwards', ...opts })
  const sfx = (n) => { if (live()) Sound.sfx(n) }
  const cry = (m) => { if (live() && m) Sound.cry(m.id) }   // a Pokémon's cry, as it comes out
  const fx = $('fx')
  const rand = demo ? rng(1) : Math.random
  const sceneRoll = demo ? rng(7) : Math.random   // its own stream, so the demo's battles stay as tuned
  const flavor = demo ? rng(11) : Math.random     // lines and drops: also their own stream
  const pickOf = (list) => list[Math.floor(flavor() * list.length)]
  const bag = { ball: 0, great: 0, potion: 0, super: 0, revive: 0 }   // empty: Alex hands you the first Potions and Balls
  const badges = [], nextGym = () => badges.length   // gyms beaten, in order
  let champion = false   // beat the Elite Four and Lance: opens Kanto (and its row in the badge case)
  /*
   * The Elite Four ladder. One ticket covers all five battles, fought one at
   * a time from the Bag, with as long as you like in between. A win moves
   * you up a rung and keeps the ticket; a loss spends it and drops you back
   * to Will. Beating Lance spends it too, and makes you Champion.
   */
  let eliteStep = 0   // 0-4: who's next (Will, Koga, Bruno, Karen, Lance)
  let kantoStep = 0, redBeaten = false   // the Kanto League: who's next (Lorelei ... Red), and whether Red is beaten
  let shareOn = true   // the EXP. SHARE's switch, in the Bag
  let fame = null   // the Hall of Fame, after Alex's last battle: { at, team: [{ id, name, level }] }
  /** The League whose ticket you can use now: Johto's ('elite') with all 8 Johto badges, Kanto's ('kanto') as Champion with all 16; or null. */
  const leagueNow = () => (!champion ? (badges.length >= 8 ? 'elite' : null) : badges.length >= GYMS.length && !redBeaten ? 'kanto' : null)
  /** Where you are on a League's ladder. */
  const leagueStep = (id) => (id === 'kanto' ? kantoStep : eliteStep)
  /** A League ticket's Bag key for the League that's open now (Johto's until you're Champion). */
  const leagueKey = () => { const id = leagueNow() ?? (champion ? 'kanto' : 'elite'); summonItem(id); return summonKey(id) }
  // Alex: the next rival battle (0-6; 7 when all are won), taps until a rematch, and whether you lost this one already.
  let rivalStep = 0, rivalWait = 0, rivalLost = false
  /*
   * Story battles are spaced out. Alex's milestones and Herb's and Paul's
   * alternate badge by badge, so without this one would turn up on the very
   * next tap after another's. Once Alex, Herb or Paul has battled you, the
   * other two stay away for STORY_GAP taps (plus a few more at random); the
   * same one's rematch after a loss isn't held up by it.
   */
  const STORY_GAP = 8
  let storyGap = { taps: 0, who: null }   // taps left before another of them, and who battled last
  const gapClear = (who) => storyGap.taps <= 0 || storyGap.who === who
  const rivalDue = () => rivalStep < RIVAL_BATTLES.length && rivalWait <= 0 && gapClear('ALEX') && RIVAL_BATTLES[rivalStep].due(rivalProgress(badges, champion, redBeaten))
  // Herb's and Paul's glitcher battles (STORY), each kept like Alex's: the next battle, taps until a rematch, and whether you lost the last.
  const story = { HERB: { step: 0, wait: 0, lost: false }, PAUL: { step: 0, wait: 0, lost: false } }
  /** Whose glitcher battle is waiting at the machine, if anyone's: the one with the lower floor first. */
  const storyDue = () => Object.keys(STORY).map((who) => ({ who, s: story[who], B: STORY[who].battles[story[who].step] }))
    .filter(({ who, s, B }) => B && s.wait <= 0 && gapClear(who) && B.due(rivalProgress(badges, champion, redBeaten))).sort((a, b) => a.B.min - b.B.min)[0]?.who ?? null
  let pendingSummon = null   // a summon chosen in the Bag, to fight once the sheet closes
  const cart = new Map()   // the machine's cart: shelf key -> how many
  let pendingEvoItem = false   // an evolution item used in the Bag: the evolution plays once the sheet closes
  let wallet = 10, shelfItems = []   // tokens to spend, and the supplies on the shelf this restock
  let realShelf = null   // in the app: the real machine, as syncMachine last read it
  /*
   * Battle modes: WILD (wild Pokémon) and TRAINERS (scalpers, 2v2s, gyms, the
   * Elite Four), each switched on or off by the player. With both off the game
   * is just the vending machine: a tap goes straight to the purchase screen,
   * with no scalper camping it, no finds, and no tutorial first. Each player's
   * choice (per account, in the app) is kept in this browser.
   *
   * In the app an admin also decides what's live for members (battle_modes):
   * a kind that isn't live is off, and its switch hidden. Admins always have
   * both. Until the real machine has answered, both count as not live.
   */
  const MODE_KEY = (k) => `vvm-${k}` + (APP.uid ? ':' + APP.uid : '')
  const playerOn = (() => {
    const get = (k) => { try { return localStorage.getItem(MODE_KEY(k)) } catch { return null } }
    const legacy = get('battles')   // the one switch there used to be
    return { wild: (get('wild') ?? legacy) !== 'off', trainers: (get('trainers') ?? legacy) !== 'off' }
  })()
  const modeLive = { wild: !APP.on, trainers: !APP.on }
  /** Can this kind of battle happen to you now? The demos always have both. */
  const modeOn = (k) => demo || (playerOn[k] && modeLive[k])
  const battlesActive = () => modeOn('wild') || modeOn('trainers')
  const MODE_BTN = { wild: 'bWild', trainers: 'bTrainers' }
  function paintBattles() {
    for (const k of ['wild', 'trainers']) {
      const b = $(MODE_BTN[k]); if (!b) continue
      b.hidden = demo || !modeLive[k]; b.classList.toggle('off', !playerOn[k])
      b.innerHTML = `${k === 'wild' ? '🌿 WILD' : '⚔ TRAINERS'} <b>${playerOn[k] ? 'ON' : 'OFF'}</b><i class="knob" aria-hidden="true"></i>`
      b.setAttribute('aria-pressed', String(playerOn[k]))
      b.setAttribute('aria-label', `${k === 'wild' ? 'Wild Pokémon' : 'Trainer battles'}: ${playerOn[k] ? 'on' : 'off'}. Tap to switch ${playerOn[k] ? 'off' : 'on'}.`)
    }
  }
  // The Pokémon Center: FREE_HEALS free heals a day, then each one costs healPrice tokens (in the app, the
  // admin's price, paid on the server). `heals`: the day (Seattle's, as the battle limits reset) and how many
  // heals were used that day; a new day brings the free ones back.
  const FREE_HEALS = 3
  let heals = { day: null, used: 0 }, healPrice = 0.5
  const localDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  const healsUsed = () => (heals.day === localDay() ? heals.used : 0)
  const freeHealsLeft = () => Math.max(0, FREE_HEALS - healsUsed())
  /** A Pokémon Center heal: everyone to full HP, statuses cured, and one more of today's heals used. */
  function healAll() {
    party.forEach((m) => { m.hp = m.stats.hp; m.status = null }); sfx('heal')
    heals = { day: localDay(), used: healsUsed() + 1 }; saveGame()
  }
  const party = [], box = []
  let busy = false

  /* ── reset ── */
  fx.innerHTML = ''; $('wipe').innerHTML = ''
  for (const w of ['enemy', 'player', 'trainer']) { $(w).getAnimations().forEach((a) => a.cancel()); $(w).style.visibility = 'hidden'; $(w).style.opacity = '1' }
  $('trainer').style.display = 'none'
  ;['ehud', 'phud'].forEach((h) => { $(h).style.visibility = 'hidden' })
  for (const el of ['showcase', 'sum', 'vs', 'talk']) $(el).style.display = 'none'
  $('vs').getAnimations({ subtree: true }).forEach((a) => a.cancel())
  $('devlink').hidden = demo
  panel(null); msg0('', ''); Sound.stopMusic()
  showLayer('battle')
  renderTools(); toolsEnabled(false)

  function cap(tag, text) { $('cap').innerHTML = `<b>${tag}</b><p>${text}</p>` }
  const pendingEvos = new Set()   // Pokémon that levelled into an evolution this battle
  function panel(name) { for (const p of ['pPick', 'pNext', 'pMain', 'pFight', 'pBag', 'pParty', 'pDefend', 'pStrike', 'pEvo', 'pPad']) $(p).style.display = p === name ? 'block' : 'none' }
  function msg0(a, b) { $('l1').textContent = a; $('l2').textContent = b }
  async function say(a, b = '', hold = demo ? 470 : 620) {
    msg0('', '')
    const full = [a, b]
    for (let line = 0; line < 2; line++) for (let i = 1; i <= full[line].length; i++) { $(line ? 'l2' : 'l1').textContent = full[line].slice(0, i); await W(APP.charMs) }
    await W(hold)
  }
  /**
   * A move being announced, by either side: in Play it stays up until you
   * press A or tap, so there's time to read it and get ready. The demo runs on.
   */
  async function announce(a, b = '', hold) {
    // Settings → Attack announcements → Automatic: they move on by themselves, after time to read.
    if (demo || APP.autoAdvance) return say(a, b, Math.max(hold ?? 0, demo ? 0 : 900))
    await say(a, b, 0)
    $('msg').classList.add('wait')
    try { await waitFor(['a']) } finally { $('msg').classList.remove('wait') }
    sfx('advance')
  }
  function waitFor(btns) { return new Promise((res, rej) => { const off = listen((b) => { if (!live()) { off(); rej(STOP) } else if (btns.includes(b)) { off(); res(b) } }) }) }
  async function demoPress(btn, after = 380, el = null) { await W(after); hot(el); press(btn) }

  /* ── layers and wipes ── */
  function showLayer(which) { $('home').style.display = which === 'home' ? 'block' : 'none'; $('battleL').style.display = which === 'battle' ? 'block' : 'none' }
  /** The classic wild-encounter wipe: three flashes, then black bars sweep in from alternating sides. */
  async function wipeWild(swap) {
    sfx('wipe')
    const wp = $('wipe'); wp.innerHTML = '<div class="whiteout"></div>'
    const wo = wp.firstChild
    for (let i = 0; i < 3; i++) { anim(wo, [{ opacity: .9 }, { opacity: 0 }], { duration: 120 }); await W(140) }
    const N = 12, h = 426 / N
    const bars = Array.from({ length: N }, (_, i) => { const b = document.createElement('i'); b.style.top = (i * h) + 'px'; b.style.height = (h + 1) + 'px'; wp.appendChild(b); return b })
    await Promise.all(bars.map((b, i) => anim(b, [{ transform: `translateX(${i % 2 ? 100 : -100}%)` }, { transform: 'none' }], { duration: 300, delay: i * 22, easing: 'cubic-bezier(.5,0,.5,1)' }).finished))
    await swap(); await W(120)
    await Promise.all(bars.map((b, i) => anim(b, [{ transform: 'none' }, { transform: `translateX(${i % 2 ? -100 : 100}%)` }], { duration: 300, delay: (N - i) * 18, easing: 'cubic-bezier(.5,0,.5,1)' }).finished))
    wp.innerHTML = ''
  }
  /** Scalpers get their own wipe: red and black shutters slamming shut on a diagonal. */
  async function wipeTrainer(swap) {
    sfx('wipe')
    const wp = $('wipe'); wp.innerHTML = ''
    const a = document.createElement('div'), b = document.createElement('div')
    a.className = b.className = 'shard'
    a.style.background = '#e11d48'; a.style.clipPath = 'polygon(0 0, 100% 0, 0 100%)'
    b.style.background = '#05070d'; b.style.clipPath = 'polygon(100% 0, 100% 100%, 0 100%)'
    wp.append(a, b)
    await Promise.all([
      anim(a, [{ transform: 'translate(-100%,-100%)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
      anim(b, [{ transform: 'translate(100%,100%)' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
    ])
    shake(5, 220)
    await swap(); await W(150)
    await Promise.all([
      anim(a, [{ transform: 'none' }, { transform: 'translate(-100%,-100%)' }], { duration: 300, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
      anim(b, [{ transform: 'none' }, { transform: 'translate(100%,100%)' }], { duration: 300, easing: 'cubic-bezier(.6,0,.4,1)' }).finished,
    ])
    wp.innerHTML = ''
  }
  /** Back to the machine: a plain fade through black. */
  async function fadeThrough(swap) {
    const wp = $('wipe'); wp.innerHTML = '<div class="shard" style="background:#05070d;opacity:0"></div>'
    const s = wp.firstChild
    await anim(s, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 }).finished
    await swap(); await W(100)
    await anim(s, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 }).finished
    wp.innerHTML = ''
  }

  /* ── the machine's own screen ── */
  const PACKS = ['jungle-scyther', 'fossil-lapras', 'team-rocket-giovanni', 'gym-heroes-brock']
  let homeState = 'idle'
  let scalper = HERB, lastCrew = []
  /** n different trainers at random, never anyone from the encounter just before. */
  /*
   * A trainer you've just beaten stays away for a while: BEATEN_REST of your
   * taps (each tap counts it down). They're skipped when picking who turns up,
   * unless that would leave too few to choose from.
   */
  const BEATEN_REST = 6, resting = new Map()   // trainer -> taps left
  const restBeaten = (crew) => crew.forEach((T) => resting.set(T.short, BEATEN_REST))
  const tickRest = () => { for (const [k, n] of resting) n <= 1 ? resting.delete(k) : resting.set(k, n - 1) }
  function randomTrainers(n) {
    const fresh = SCALPERS.filter((T) => !lastCrew.includes(T) && !resting.has(T.short))
    const pool = fresh.length >= n ? fresh : SCALPERS.filter((T) => !lastCrew.includes(T)), out = []
    while (out.length < n) out.push(pool.splice(Math.floor(flavor() * pool.length), 1)[0])
    lastCrew = out
    return out
  }
  /**
   * The machine's screen. 'idle' is the attract screen (the default, and what
   * shows before any interaction); a tap turns into one of the state screens:
   * 'in' (stocked), 'out' (sold out) or 'maint' (maintenance).
   */
  function renderHome(state, blocked = false) {
    homeState = state
    const h = $('home')
    h.className = 'layer home ' + state
    if (blocked) h.classList.add('blocked')
    $('wallet').textContent = `${wallet.toFixed(2)} tk`
    h.classList.toggle('haswallet', !$('tools').hidden)
    if (state !== 'in') cart.clear()
    paintCart()
    if (state === 'idle') {
      const other = typeof machine !== 'undefined' && machine.lockedBy && machine.lockedBy !== 'YOU' ? machine.lockedBy : null
      h.classList.toggle('inuse', !!other)
      $('tts').innerHTML = other ? `${other} IS USING IT<small>${battlesActive() ? 'you can still tap: something may jump out' : 'wait for them to finish'}</small>` : battlesActive() || !(modeLive.wild || modeLive.trainers) ? 'TOUCH TO START' : 'TOUCH TO START<small>battles off: just the machine</small>'
      $('homeLoiterer').style.display = 'none'; $('supplies').innerHTML = ''; return
    }
    // Stocked: the machine's grid, the packs and then whatever battle supplies this restock has, side by side.
    const sup = state === 'in' ? shelfItems : [], real = vvm() && realShelf
    h.classList.toggle('has-sup', state === 'in' && (real ? true : sup.length > 0))
    $('supplies').innerHTML = state === 'in' && real ? realTiles() : state === 'in' ? STOCK_PACKS.map((p) => `<button class="tile pack" data-pack="${p.name}"><span class="art"><img src="${ART['pack:' + p.art]}" alt=""></span><span class="qty">${p.left}</span><b>${p.name}</b><span class="meta">1 token · ${p.left} left</span></button>`).join('') + sup.map(supplyTile).join('') : ''
    $('homeLine').textContent = blocked ? 'BLOCKED!' : { in: 'PACKS ARE IN!', out: 'NEXT RESTOCK 03:12', maint: 'BACK SOON' }[state]
    $('homeSub').textContent = blocked ? `${scalper.short} is camping the machine` : { in: 'tap items to add them to your cart', out: 'sold out', maint: 'under maintenance' }[state]
    if (real && !blocked && state !== 'in') paintClock()
    if (blocked) $('homeLoiterer').src = ART[scalper.body]
    $('homeLoiterer').style.display = blocked ? 'block' : 'none'
  }
  /* The packs in the stocked grid (the app's real stock: one per set, a token each). */
  const STOCK_PACKS = [{ art: 'jungle-scyther', name: 'Jungle', left: 12 }, { art: 'gym-heroes-brock', name: 'Gym Heroes', left: 7 }, { art: 'fossil-lapras', name: 'Fossil', left: 9 },
    { art: 'team-rocket-giovanni', name: 'Team Rocket', left: 4 }, { art: 'gym-challenge-koga', name: 'Gym Challenge', left: 15 }]
  /*
   * Booster packs as a battle award: beaten trainers sometimes leave one, Gym
   * Leaders half the time and the Elite Four every time. In the app it's a
   * real pack, out of a set's inventory and into your collection (opened
   * there, like one you bought), up to a few a day; the server decides. In
   * the mockup it's only named.
   */
  async function givePack(source) {
    const api = vvm()
    if (!api) return `a ${pickOf(STOCK_PACKS).name.toUpperCase()} PACK`
    const r = await api.awardPack(source).catch(() => null)
    if (!r?.ok) return null
    feed(`<b>You</b> won a ${esc(r.set_name)} pack (${esc(r.pack_name)}). It's in your collection.`)
    return `a ${String(r.set_name).toUpperCase()} PACK`
  }
  /* ── the real machine (in the app) ──
     The stock state, who holds the purchase screen, your tokens and cooldown
     all come from the server. The shelf is the real one: packs by set, raffle
     tickets, and the admin's battle supplies. Cart keys are 'set:CODE',
     'ticket:ID' and 'sup:KEY'. */
  // Catalog supplies (vvm_supplies) and what they are in the Bag.
  const BAG_OF = { potion: 'potion', super_potion: 'super', revive: 'revive', poke_ball: 'ball', great_ball: 'great', rare_candy: 'rarecandy' }
  async function syncMachine() {
    const api = vvm(); if (!api) return
    const m = await api.machine().catch(() => null); if (!m || !live()) return
    realShelf = m; m.changesAt = Date.now() + m.seconds_left * 1000
    syncSeed()   // and where your wild Pokémon come from, in case you've reported a timer since
    if (modeLive.wild !== m.wild || modeLive.trainers !== m.trainers) { modeLive.wild = m.wild; modeLive.trainers = m.trainers; paintBattles() }
    wallet = m.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk`
    if (m.heal_price != null) healPrice = m.heal_price   // the admin's price for a heal after the free ones
    const st = m.status === 'in_stock' ? 'in' : m.status === 'out_of_stock' ? 'out' : 'maint'
    machine.state = st; $('machineState').value = st
    machine.lockedBy = !m.holder_id ? null : m.holder_id === m.me ? YOU : (m.holder_name ?? 'SOMEONE')
    if (homeState === 'idle') renderHome('idle')
    // Looking at a sold-out or maintenance screen when it changes: back to idle, where a tap shows what it is now.
    else if ((homeState === 'out' || homeState === 'maint') && st !== homeState) renderHome('idle')
  }
  /*
   * Sold out or under maintenance, in the app: when the machine next changes,
   * counting down, as the VVM page shows it. Paused while someone holds the
   * machine. At zero it asks the server what the machine is now.
   */
  let clockTimer = null, clockAsked = false
  function paintClock() {
    clearInterval(clockTimer); clockAsked = false
    const tick = () => {
      if (!live() || homeState === 'idle' || homeState === 'in' || !realShelf) { clearInterval(clockTimer); return }
      const s = Math.max(0, Math.round((realShelf.changesAt - Date.now()) / 1000))
      $('homeLine').textContent = homeState === 'out' ? 'SOLD OUT' : 'BACK SOON'
      $('homeSub').textContent = realShelf.frozen ? 'the machine changes once its current trainer is done'
        : s > 0 ? `the machine changes in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'changing now…'
      if (s === 0 && !realShelf.frozen && !clockAsked) { clockAsked = true; syncMachine() }
    }
    tick(); clockTimer = setInterval(tick, 1000)
  }
  const realKey = (k) => { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)] }
  const realRow = (k) => {
    const [kind, id] = realKey(k), t = realShelf ?? { packs: [], tickets: [], supplies: [], boxes: [] }
    return kind === 'set' ? t.packs.find((p) => p.set_code === id) : kind === 'ticket' ? t.tickets.find((x) => String(x.ticket_id) === id) : kind === 'sup' ? t.supplies.find((x) => x.key === id)
      : kind === 'box' ? (t.boxes ?? []).find((x) => String(x.box_id) === id) : null
  }
  const isReal = (k) => /^(set|ticket|sup|box):/.test(k)
  /** Why a catalog supply can't be bought right now (a summon needs a gym to go to), or ''. */
  function supNot(key) {
    if ((key === 'gym_summon' || key === 'elite_ticket') && !modeLive.trainers) return "trainer battles aren't live yet"
    if (key === 'gym_summon') return nextGym() < GYMS.length && (nextGym() < 8 || champion) ? '' : 'no gym to summon'
    if (key === 'elite_ticket') { const lg = leagueNow(); return !lg ? (redBeaten ? "you've beaten Red" : champion ? 'needs all 16 badges' : 'needs all 8 Johto badges') : bag[summonKey(lg)] ? 'you have one' : '' }
    return ''
  }
  function realTiles() {
    const t = realShelf
    // A sealed booster box: the box (or a pack of its set), how many packs, the price.
    const sealed = (x) => `<button class="tile pack box" data-buy="box:${x.box_id}"><span class="art">${x.image ? `<img src="${esc(x.image)}" alt="">` : '<span class="supic box"></span>'}</span><span class="qty">${x.quantity}</span><i class="kind">BOX</i><b>${esc(x.name)}</b><span class="meta">${x.price.toFixed(2)} tk · ${x.packs} packs</span></button>`
    const pack = (p) => `<button class="tile pack" data-buy="set:${esc(p.set_code)}"><span class="art"><img src="${esc(p.image)}" alt=""></span><span class="qty">${p.quantity}</span><b>${esc(p.set_name)}</b><span class="meta">1 token · ${p.quantity} left</span></button>`
    const ticket = (x) => `<button class="tile summon" data-buy="ticket:${x.ticket_id}"><span class="art">${x.image ? `<img src="${esc(x.image)}" alt="">` : '<span class="supic summon"></span>'}</span><i class="kind">RAFFLE</i><b>${esc(x.name)}</b><span class="meta">${x.price.toFixed(2)} tk · ${x.quantity} left</span></button>`
    const sup = (x) => {
      const no = supNot(x.key), off = no ? ' disabled' : '', meta = (sub) => `<span class="meta">${x.price.toFixed(2)} tk · ${esc(no || sub)}</span>`
      if (x.kind === 'bundle') return `<button class="tile bundle" data-buy="sup:${esc(x.key)}"><span class="art">${(x.contents ?? []).map((c) => `<span class="brow"><span class="supic ${BAG_OF[c.key] ?? ''}"></span>×${c.qty}</span>`).join('')}</span><i class="kind">BUNDLE</i><b>${esc(x.name.toUpperCase())}</b>${meta(`${(x.contents ?? []).reduce((a, c) => a + c.qty, 0)} items`)}</button>`
      if (x.key === 'gym_summon') { const L = GYMS[nextGym()] ?? GYMS.at(-1); return `<button class="tile summon" data-buy="sup:gym_summon"${off}><span class="art"><img src="${ART[L.face]}" alt=""></span><i class="kind">GYM</i><b>${L.badge} SUMMON</b>${meta(L.short)}</button>` }
      if (x.key === 'elite_ticket') { const c = LEAGUES[leagueNow() ?? (champion ? 'kanto' : 'elite')].card; return `<button class="tile summon" data-buy="sup:elite_ticket"${off}><span class="art"><img src="${ART[c.face]}" alt=""></span><i class="kind">LEAGUE</i><b>${c.summonName}</b>${meta('all 5 battles')}</button>` }
      const ic = x.key === 'move_disc' ? 'disc' : BAG_OF[x.key] ?? ''
      return `<button class="tile item" data-buy="sup:${esc(x.key)}"${off}><span class="art"><span class="supic ${ic}"></span></span><i class="kind">${x.key === 'move_disc' ? 'MOVE DISC' : 'ITEM'}</i><b>${esc(x.name.toUpperCase())}</b>${meta(x.description ?? '')}</button>`
    }
    // A League ticket isn't on the shelf at all until its League is open: all 8 Johto badges (or, as Champion, all 16).
    const shelved = t.supplies.filter((x) => x.key !== 'elite_ticket' || leagueNow())
    return [...(t.boxes ?? []).filter((x) => x.max > 0).map(sealed), ...t.packs.filter((p) => p.quantity > 0).map(pack), ...t.tickets.filter((x) => x.max > 0).map(ticket), ...shelved.map(sup)].join('')
  }
  /**
   * Supplies bought at the machine (here or on the app's VVM page) move from
   * your account into the Bag: the game's save holds them from then on. A Move
   * Disc becomes a random disc now; a Gym Summon is for your next gym.
   */
  async function collectItems() {
    const api = vvm(); if (!api || !tutorialDone) return []
    const keys = [...Object.keys(BAG_OF), 'move_disc', ...['gym_summon', 'elite_ticket'].filter((k) => !supNot(k))]
    const got = await api.takeItems(keys).catch(() => [])
    const said = []
    for (const { key, qty } of got) {
      if (BAG_OF[key]) { bag[BAG_OF[key]] = (bag[BAG_OF[key]] ?? 0) + qty; said.push(`${qty} ${ITEMS[BAG_OF[key]].name}`) }
      else if (key === 'gym_summon') { const g = nextGym(); summonItem(g); bag[summonKey(g)] = (bag[summonKey(g)] ?? 0) + qty; said.push(`${qty} ${ITEMS[summonKey(g)].name}`) }
      else if (key === 'elite_ticket') { const k = leagueKey(); bag[k] = 1; said.push(`a ${ITEMS[k].name}`) }   // the catalog's one League ticket: for the League that's open
      else if (key === 'move_disc') for (let i = 0; i < qty; i++) { const n = pickOf(DISC_POOL); discItem(n); bag[discKey(n)] = (bag[discKey(n)] ?? 0) + 1; said.push(`a MOVE DISC (${n})`) }
    }
    if (said.length) { renderTools(); saveGame(); feed(`<b>You</b> collected ${said.join(', ')} into the Bag.`) }
    return said
  }
  /** Tokens a battle pays: in the app, real ones into your earned tokens, up to a daily cap. */
  async function payTokens(amount, source, b = '') {
    const api = vvm()
    if (!api) {
      wallet = Math.round((wallet + +amount) * 100) / 100; $('wallet').textContent = `${wallet.toFixed(2)} tk`
      sfx('tokens'); return say(`You got ${(+amount).toFixed(2)} tokens!`, b, 600)
    }
    const r = await api.awardTokens(+amount, source).catch(() => null)
    if (r) { wallet = r.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk` }
    if (r?.awarded > 0) { sfx('tokens'); return say(`You got ${r.awarded.toFixed(2)} tokens!`, b, 600) }
    return say(r?.reason === 'daily_cap' ? "That's all the battle tokens for today." : 'No tokens this time.', b, 600)
  }
  /**
   * A badge's, League win's, rival battle's or glitcher battle's tokens: in the
   * app, the server pays its own amount for `key` once per account, outside
   * the daily battle limit (v77).
   */
  async function payMilestone(key, amount) {
    const api = vvm()
    if (!api?.awardMilestone) return payTokens(amount, key)
    const r = await api.awardMilestone(key).catch(() => null)
    if (r) { wallet = r.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk` }
    if (r?.awarded > 0) { sfx('tokens'); return say(`You got ${r.awarded.toFixed(2)} tokens!`, '', 600) }
    return say(r?.reason === 'already_paid' ? "You've already been paid for this win." : 'No tokens this time.', '', 600)
  }
  /** A battle supply's tile in the grid: an item, a bundle, or your next gym's summon. */
  function supplyTile(k) {
    if (k.startsWith('bundle:')) {
      const b = bundleById(k.slice(7)); if (!b) return ''
      const n = BUNDLE_ITEMS.reduce((s, i) => s + (b.items[i] ?? 0), 0)
      return `<button class="tile bundle" data-buy="${k}"><span class="art">${BUNDLE_ITEMS.filter((i) => b.items[i] > 0).map((i) => `<span class="brow"><span class="supic ${i}"></span>×${b.items[i]}</span>`).join('')}</span><i class="kind">BUNDLE</i><b>${esc(b.name)}</b><span class="meta">${b.price.toFixed(2)} tk · ${n} items</span></button>`
    }
    if (k === 'elite') { const c = LEAGUES[leagueNow() ?? 'elite'].card; return `<button class="tile summon" data-buy="elite"><span class="art"><img src="${ART[c.face]}" alt=""></span><i class="kind">LEAGUE</i><b>${c.summonName}</b><span class="meta">${SHOP.elite.price.toFixed(2)} tk · all 5 battles</span></button>` }
    if (k === 'summon') { const L = GYMS[nextGym()]; return `<button class="tile summon" data-buy="summon"><span class="art"><img src="${ART[L.face]}" alt=""></span><i class="kind">GYM</i><b>${L.badge} SUMMON</b><span class="meta">${SHOP.summon.price.toFixed(2)} tk · ${L.short}</span></button>` }
    if (k.startsWith('disc:')) return `<button class="tile item" data-buy="${k}"><span class="art"><span class="supic disc"></span></span><i class="kind">MOVE DISC</i><b>${ITEMS[k].name}</b><span class="meta">${shopOf(k).price.toFixed(2)} tk · ${moveInfo(ITEMS[k].disc).type.toUpperCase()} · ${moveInfo(ITEMS[k].disc).kind === 'support' ? moveInfo(ITEMS[k].disc).sub : `${moveInfo(ITEMS[k].disc).power} power`}</span></button>`
    return `<button class="tile item" data-buy="${k}"><span class="art"><span class="supic ${k}"></span></span><i class="kind">${ITEMS[k].key ? 'KEY ITEM' : 'ITEM'}</i><b>${ITEMS[k].name}</b><span class="meta">${SHOP[k].price.toFixed(2)} tk · ${ITEMS[k].sub}</span></button>`
  }
  /** Buys one supply off the shelf: tokens out, the item (or a bundle's items) into the Bag. */
  function buySupply(k) {
    const b = k.startsWith('bundle:') ? bundleById(k.slice(7)) : null
    if (k.startsWith('bundle:') && !b) return false
    const price = b ? b.price : shopOf(k).price, el = $('supplies').querySelector(`[data-buy="${k}"]`)
    if (wallet + 1e-9 < price) { sfx('blocked'); $('homeSub').textContent = `not enough tokens for ${b ? `the ${b.name}` : `a ${ITEMS[k].name}`}`; return false }
    wallet = Math.round((wallet - price) * 100) / 100
    if (b) {
      for (const i of BUNDLE_ITEMS) if (b.items[i] > 0) bag[i] = (bag[i] ?? 0) + b.items[i]
      $('homeSub').textContent = `bought the ${b.name} for ${price.toFixed(2)} tk · ${bundleText(b)} into your Bag`
    } else {
      // A summon is always for your next gym: it goes in the Bag as that gym's.
      const key = k === 'summon' ? (summonItem(nextGym()), summonKey(nextGym())) : k === 'elite' ? leagueKey() : k
      bag[key] = ITEMS[key].key ? 1 : (bag[key] ?? 0) + 1   // a key item is had or not
      $('homeSub').textContent = `bought ${/^[AEIOU]/.test(ITEMS[key].name) ? 'an' : 'a'} ${ITEMS[key].name} for ${price.toFixed(2)} tk · ${ITEMS[key].key ? 'a key item, in your Bag' : `×${bag[key]} in your Bag`}`
    }
    renderTools(); sfx('click')
    $('wallet').textContent = `${wallet.toFixed(2)} tk`
    window.__saveSoon?.()
    if (el) anim(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }, { transform: 'scale(1)' }], { duration: 260 })
    return true
  }
  // A tap on a supply buys it rather than counting as a tap on the screen (which goes back to idle).
  $('supplies').onclick = (e) => {
    const b = e.target.closest('[data-buy]'), pk = e.target.closest('[data-pack]')
    if (!b && !pk) return
    e.stopPropagation()
    if (MODE !== 'play' || busy || !live()) return
    if (pk) { hot(pk); $('homeSub').textContent = `${pk.dataset.pack} packs check out as they do today`; return }
    const k = b.dataset.buy
    if (b.disabled) { sfx('blocked'); return }   // a greyed-out supply (a summon or ticket you can't use yet) never goes in the cart
    if (e.target.closest('[data-minus]')) { const n = (cart.get(k) ?? 0) - 1; n > 0 ? cart.set(k, n) : cart.delete(k); sfx('move') }
    else {
      const n = cart.get(k) ?? 0
      if (n >= cartMax(k)) { sfx('blocked'); $('homeSub').textContent = cartMax(k) === 1 ? 'one of those at a time' : `up to ${cartMax(k)} of each`; return }
      cart.set(k, n + 1); sfx('click'); hot(b)
      anim(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 200 })
    }
    paintCart(); vvm()?.heartbeat()
  }
  /* ── the cart ──
     Taps put supplies in the cart; CHECKOUT shows the order, PAY takes the
     tokens and the machine dispenses (like the packs in the app), and the
     items land in the Bag. A summon, a ticket or a key item is one at a time. */
  const cartMax = (k) => {
    if (isReal(k)) { const [kind, id] = realKey(k), r = realRow(k); return !r ? 0 : kind === 'set' ? r.quantity : kind === 'ticket' || kind === 'box' ? r.max : id === 'gym_summon' || id === 'elite_ticket' ? 1 : 20 }
    return k === 'summon' || k === 'elite' || ITEMS[k]?.key ? 1 : 9
  }
  const priceOf = (k) => (isReal(k) ? (realKey(k)[0] === 'set' ? 1 : realRow(k)?.price ?? 0) : k.startsWith('bundle:') ? bundleById(k.slice(7))?.price ?? 0 : shopOf(k).price)
  const nameOf = (k) => (isReal(k) ? (realKey(k)[0] === 'set' ? `${realRow(k)?.set_name ?? realKey(k)[1]} pack` : realRow(k)?.name ?? realKey(k)[1]) : k.startsWith('bundle:') ? bundleById(k.slice(7))?.name ?? 'BUNDLE' : k === 'summon' ? `${GYMS[nextGym()]?.badge ?? 'GYM'} SUMMON` : k.startsWith('disc:') ? `MOVE DISC (${ITEMS[k].disc})` : ITEMS[k].name)
  const cartCount = () => [...cart.values()].reduce((a, b) => a + b, 0)
  const cartTotal = () => Math.round([...cart].reduce((s, [k, n]) => s + priceOf(k) * n, 0) * 100) / 100
  /** The tiles' counts and the bar under them. */
  function paintCart() {
    for (const el of $('supplies').querySelectorAll('[data-buy]')) {
      const n = cart.get(el.dataset.buy) ?? 0
      el.querySelector('.incart')?.remove(); el.querySelector('.minus')?.remove()
      el.classList.toggle('picked', n > 0)
      if (n) el.insertAdjacentHTML('beforeend', `<span class="incart">×${n}</span><span class="minus" data-minus="1">−</span>`)
    }
    const n = cartCount()
    $('cbSum').innerHTML = homeState === 'in' ? (n ? `<b>CART ${n}</b> · ${cartTotal().toFixed(2)} tk` : 'CART empty') : ''
    $('cbGo').disabled = !n
  }
  /** Puts one bought supply (or a bundle's items) in the Bag. */
  function giveSupply(k) {
    const b = k.startsWith('bundle:') ? bundleById(k.slice(7)) : null
    if (b) { for (const i of BUNDLE_ITEMS) if (b.items[i] > 0) bag[i] = (bag[i] ?? 0) + b.items[i]; return }
    const key = k === 'summon' ? (summonItem(nextGym()), summonKey(nextGym())) : k === 'elite' ? leagueKey() : k
    bag[key] = ITEMS[key].key ? 1 : (bag[key] ?? 0) + 1
  }
  /** The checkout screen: the order, the total, your tokens before and after. */
  function drawCheckout() {
    const total = cartTotal(), short = wallet + 1e-9 < total
    $('checkout').innerHTML = `<div class="cohd">CHECKOUT</div>
      <div class="colines">${[...cart].map(([k, n]) => `<div class="coline">${k.startsWith('bundle:') || k === 'summon' || k === 'elite' || (isReal(k) && !BAG_OF[realKey(k)[1]] && realKey(k)[1] !== 'move_disc') ? '<span class="coic box"></span>' : `<span class="coic supic ${k.startsWith('disc:') || k === 'sup:move_disc' ? 'disc' : isReal(k) ? BAG_OF[realKey(k)[1]] : k}"></span>`}<span class="conm">${nameOf(k)}</span><span class="coqty">×${n}</span><span class="copr">${(priceOf(k) * n).toFixed(2)}</span></div>`).join('')}</div>
      <div class="cotot"><span>TOTAL</span><b>${total.toFixed(2)} tokens</b></div>
      <div class="cobal">Your tokens: ${wallet.toFixed(2)} → <b class="${short ? 'bad' : ''}">${short ? 'not enough' : (wallet - total).toFixed(2)}</b></div>
      <div class="cobtns"><button class="cb back" data-co="back">◀ KEEP SHOPPING</button><button class="cb go" data-co="pay" ${short ? 'disabled' : ''}>PAY ${total.toFixed(2)}</button></div>`
  }
  /** PAY: tokens out, then the machine dispenses, one item at a time, and it all goes in the Bag. */
  async function payCart() {
    const total = cartTotal(), items = [...cart], n = cartCount()
    if (!n || wallet + 1e-9 < total) return
    let collected = [], stuck = 0, freed = 0
    if (vvm()) {
      // The real checkout: the server checks the stock, your tokens and that you still hold the machine.
      const pick = (kind, f) => items.filter(([k]) => realKey(k)[0] === kind).map(([k, qty]) => f(realKey(k)[1], qty))
      const r = await vvm().checkout(pick('set', (set_code, qty) => ({ set_code, qty })), pick('ticket', (id, qty) => ({ ticket_id: +id, qty })), pick('sup', (key, qty) => ({ key, qty })), pick('box', (id, qty) => ({ box_id: +id, qty })))
      if (!r.ok) {
        sfx('blocked'); $('checkout').classList.remove('open'); cart.clear(); machine.lockedBy = null
        $('homeSub').textContent = CHECKOUT_FAIL[r.reason] ?? `checkout failed (${r.reason})`
        await syncMachine(); paintCart(); return
      }
      wallet = r.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk`; machine.lockedBy = null
      stuck = r.packs_stuck ?? 0; freed = r.packs_freed ?? 0   // a pack that jammed (no refund), one someone else left stuck that fell out for you
      collected = await collectItems()
    } else {
      wallet = Math.round((wallet - total) * 100) / 100; $('wallet').textContent = `${wallet.toFixed(2)} tk`
      for (const [k, q] of items) for (let i = 0; i < q; i++) giveSupply(k)
    }
    const packsBought = items.filter(([k]) => k.startsWith('set:')).reduce((a, [, q]) => a + q, 0) - stuck + freed
    const boxesBought = items.filter(([k]) => k.startsWith('box:')).reduce((a, [, q]) => a + q, 0)
    cart.clear(); renderTools(); window.__saveSoon?.()
    const co = $('checkout'); co.classList.add('disp')
    for (let i = 1; i <= n; i++) {
      co.innerHTML = `<p class="dsm">COLLECTING</p><p class="dbig">${i} OF ${n} TOTAL ITEM${n === 1 ? '' : 'S'}</p><div class="dline"></div><p class="dsm dim">PLEASE WAIT</p>`
      sfx('click'); await W(i === n ? 700 : 450)
    }
    if (stuck) {
      sfx('blocked'); anim(co, [{ transform: 'none' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 300, iterations: 2 })
      co.innerHTML = `<p class="dsm">VEND ERROR</p><p class="dbig">1 ITEM NOT DISPENSED</p><div class="dline"></div><p class="dsm dim">A pack jammed. No refunds. It's still in there...</p>`
      await W(2200)
    }
    if (freed) {
      sfx('click'); await W(300); sfx('click')
      co.innerHTML = `<p class="dsm">CLUNK!</p><p class="dbig">+1 PACK</p><div class="dline"></div><p class="dsm dim">Someone's stuck pack fell out with yours. Free!</p>`
      await W(2200)
    }
    sfx('tokens')
    co.innerHTML = `<p class="dbig">THANK YOU!</p><div class="dline"></div><p class="dsm">${vvm() ? [packsBought ? `${packsBought} pack${packsBought === 1 ? '' : 's'} to your collection` : '', boxesBought ? `${boxesBought} sealed box${boxesBought === 1 ? '' : 'es'} to your collection` : '', collected.length ? `${collected.length} to your Bag` : ''].filter(Boolean).join(' · ') || 'in your account' : `${n} item${n === 1 ? '' : 's'} added to your Bag`}</p><p class="dsm dim">${total.toFixed(2)} tokens · ${wallet.toFixed(2)} left</p>`
    feed(`<b>You</b> bought ${items.map(([k, q]) => `${q} ${nameOf(k)}`).join(', ')} for ${total.toFixed(2)} tokens.${stuck ? ' One pack jammed in the machine.' : ''}${freed ? " A stuck pack fell out with yours." : ''}`)
    await W(1700)
    co.classList.remove('open', 'disp'); co.innerHTML = ''
    await toIdle()
  }
  const CHECKOUT_FAIL = { not_holder: 'your turn at the machine timed out', insufficient_stock: 'someone got there first: the stock changed', set_sold_out: 'that set has sold out for good',
    insufficient_tokens: 'not enough tokens', ticket_sold_out: 'that raffle ticket just ran out', ticket_limit_reached: 'you hold the most of that ticket you can',
    ticket_unavailable: 'that raffle ticket is gone', supply_not_stocked: "that supply isn't on the shelf anymore", supply_unavailable: "that supply isn't sold anymore", empty_cart: 'the cart is empty',
    box_unavailable: "that box isn't on the shelf anymore", box_sold_out: 'that box just sold out', box_limit_reached: 'you hold the most of that box you can' }
  $('cbGo').onclick = (e) => { e.stopPropagation(); if (MODE !== 'play' || busy || !cartCount()) return; sfx('select'); drawCheckout(); $('checkout').classList.add('open') }
  $('cbBack').onclick = (e) => { e.stopPropagation(); if (MODE !== 'play' || busy) return; sfx('move'); cart.clear(); paintCart(); guard(() => toIdle())() }
  $('checkout').onclick = (e) => {
    e.stopPropagation()
    const btn = e.target.closest('[data-co]'); if (!btn || btn.disabled || MODE !== 'play' || busy) return
    if (btn.dataset.co === 'back') { sfx('move'); $('checkout').classList.remove('open'); paintCart() }
    if (btn.dataset.co === 'pay') guard(payCart)()
  }
  function bangOn(layer, x, y) {
    const bang = document.createElement('div'); bang.className = 'bang'; bang.textContent = '!'
    bang.style.left = x + 'px'; bang.style.top = y + 'px'; layer.appendChild(bang); sfx('bang')
    anim(bang, [{ transform: 'scale(.3)' }, { transform: 'scale(1.4)', offset: .5 }, { transform: 'scale(1)' }], { duration: 260 })
    return bang
  }

  /* ── toolbar and sheets ── */
  function renderTools() {
    $('partyMinis').innerHTML = party.slice(0, 3).map((m) => `<img src="${spr(m)}" alt="">`).join('') + (party.length > 3 ? `<span style="font-size:10px">+${party.length - 3}</span>` : '')
    $('partyDot').style.display = party.some((m) => m.hp < m.stats.hp) ? 'block' : 'none'
    $('bagN').textContent = String(Object.values(bag).reduce((a, b) => a + b, 0))
    $('boxN').textContent = String(box.length)
  }
  function toolsEnabled(on) { document.querySelectorAll('.tool').forEach((t) => { t.disabled = !on; t.style.opacity = on ? '1' : '.45' }) }
  const hpCol = (p) => (p > 50 ? '#22c55e' : p > 20 ? '#eab308' : '#ef4444')
  /* ── sheets: party (list, stats), bag (list, choose a Pokémon), box ── */
  const HEALS = ['potion', 'super', 'revive']
  const ivTotal = (m) => STAT_KEYS.reduce((s, k) => s + m.ivs[k], 0)
  let toast = '', toastBad = false   // toastBad: a refusal, shown in amber rather than green

  /** One item on one Pokémon. Returns what happened, for the sheet to say. */
  function useItem(key, m) {
    if (!bag[key]) return `No ${ITEMS[key].name}s left.`
    if (ITEMS[key].cure) {
      if (!m.status) return `${m.name} has no status to cure.`
      if (!ITEMS[key].cure.includes(m.status)) return `A ${ITEMS[key].name} won't help: ${m.name} is ${STATUS_WORD[m.status]}.`
      bag[key]--; m.status = null; sfx('heal'); renderTools()
      return `${m.name} is cured!`
    }
    if (ITEMS[key].revive) {
      if (m.hp > 0) return `${m.name} hasn't fainted. Revives are for fainted Pokémon.`
      bag[key]--; m.hp = Math.ceil(m.stats.hp * ITEMS[key].revive); sfx('heal'); renderTools()
      return `${m.name} was revived with ${m.hp} HP!`
    }
    if (m.hp <= 0) return `${m.name} has fainted — a Potion can't help. Use a Revive.`
    if (m.hp >= m.stats.hp) return `${m.name} is already at full HP.`
    const from = m.hp
    bag[key]--; m.hp = Math.min(m.stats.hp, m.hp + Math.ceil(m.stats.hp * ITEMS[key].heal))
    sfx('heal'); renderTools()
    return `${m.name} recovered ${m.hp - from} HP.`
  }
  function hpBar(m) {
    const pct = m.hp / m.stats.hp * 100
    return `<div class="hp"><div><i style="width:${pct}%;background:${hpCol(pct)}"></i></div>${m.hp}/${m.stats.hp}</div>`
  }
  function itemButtons(m) {
    return HEALS.map((k) => {
      const rev = !!ITEMS[k].revive
      const why = !bag[k] ? 'none left' : rev ? (m.hp <= 0 ? `back at ${Math.round(ITEMS[k].revive * 100)}%` : 'not fainted') : m.hp <= 0 ? 'fainted' : m.hp >= m.stats.hp ? 'full HP' : `+${Math.ceil(m.stats.hp * ITEMS[k].heal)} HP`
      const off = !bag[k] || (rev ? m.hp > 0 : m.hp <= 0 || m.hp >= m.stats.hp)
      return `<button class="ibtn ${k}" data-use="${k}" ${off ? 'disabled' : ''}><b>${ITEMS[k].name} ×${bag[k] ?? 0}</b><span>${why}</span></button>`
    }).join('')
  }

  function partyList() {
    const hurt = party.some((m) => m.hp < m.stats.hp || m.status)
    const caseFor = (region, label) => { const gs = GYMS.filter((g) => g.region === region), got = gs.filter((g) => badges.includes(g.gym)).length
      return `<div class="badgecase"><b>${label} ${got}/${gs.length}</b><span>${gs.map((g) => `<img class="${badges.includes(g.gym) ? 'on' : ''}" src="${badgeArt(g.badge)}" alt="${g.badge} BADGE" title="${g.badge} BADGE (${g.short})">`).join('')}</span></div>` }
    const caseRow = caseFor('johto', 'JOHTO') + (champion ? caseFor('kanto', 'KANTO') : '') +   // Kanto shows once it's unlocked
      (fame ? `<div class="badgecase champ fame"><b>HALL OF FAME</b><span>${fame.team.map((m) => `<img class="on" src="${spr(m)}" alt="${m.name}" title="${m.name} Lv ${m.level}">`).join('')}</span></div>` : '')
    const free = freeHealsLeft(), canPay = wallet + 1e-9 >= healPrice, price = `${healPrice.toFixed(2)} tk`
    const healSub = !hurt ? `Everyone is at full HP${free ? ` · ${free} free heal${free === 1 ? '' : 's'} left today` : ''}`
      : free ? `Heal the whole party, free — ${free} left today` : canPay ? `Heal the whole party for ${price} · today's ${FREE_HEALS} free heals are used` : `${price} a heal after ${FREE_HEALS} free a day · not enough tokens. Potions still work.`
    return caseRow + `<button class="heal" data-heal ${hurt && (free || canPay) ? '' : 'disabled'}><span class="cross"></span><span>POKéMON CENTER<small>${healSub}</small></span></button>` +
      party.map((m, i) => `<div class="prow${m.hp <= 0 ? ' fainted' : ''}">
        <button class="pmain" data-stat="${i}" aria-label="${m.name}'s stats"><img src="${spr(m)}" alt=""><span class="mid">
          <span class="nm"><b>${i + 1}. ${m.name}${m.shiny ? '<span class="shiny" title="Shiny">★</span>' : ''}${i === 0 ? '<span class="lead">LEAD</span>' : ''}${m.status ? `<span class="tags">${statusChip(m)}</span>` : ''}</b><span>Lv ${m.level}</span></span>
          ${hpBar(m)}<span class="sub">${m.nature[0]} · IV ${ivTotal(m)}/186 · tap for stats</span></span></button>
        <span class="ord">
          <button data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${m.name} up">▲</button>
          <button data-down="${i}" ${i === party.length - 1 ? 'disabled' : ''} aria-label="Move ${m.name} down">▼</button>
        </span></div>`).join('') +
      `<p class="note">Battle order: number 1 goes out first. Use ▲ ▼ to change it. HP carries over between battles.</p>`
  }
  function statPage(m) {
    const i = party.indexOf(m)
    const [nat, up, dn] = m.nature
    const rows = STAT_KEYS.map((k) => {
      const col = m.ivs[k] >= 30 ? '#eab308' : m.ivs[k] >= 21 ? '#22c55e' : m.ivs[k] >= 11 ? '#3b82f6' : '#94a3b8'
      const tag = up === k ? '<em class="up">▲</em>' : dn === k ? '<em class="dn">▼</em>' : ''
      return `<tr><td class="k">${STAT_LABEL[k]}${tag}</td><td class="v">${m.stats[k]}</td><td class="bar"><div><i style="width:${m.ivs[k] / 31 * 100}%;background:${col}"></i></div></td><td class="iv">${m.ivs[k]}/31</td></tr>`
    }).join('')
    return `<button class="back" data-back>◀ Party</button>
      <div class="svhead"><img src="${spr(m)}" alt=""><div>
        <div class="nm"><b>${m.name}${m.shiny ? '<span class="shiny" title="Shiny">★</span>' : ''}</b> <span>Lv ${m.level}${i === 0 ? ' · LEAD' : ` · #${i + 1} in order`}</span></div>
        <div class="types">${m.types.map((t) => `<span style="background:${TYPE_COL[t]}">${t}</span>`).join('')}</div>
        ${hpBar(m)}</div></div>
      <div class="svnat"><b>${nat}</b> nature${up ? `: <em class="up">${STAT_LABEL[up]} +10%</em>, <em class="dn">${STAT_LABEL[dn]} −10%</em>` : ': no stat changes'} · IV total <b>${ivTotal(m)}</b>/186 · starts battles with <b>${startPP(m)} PP</b>${startPP(m) > 1 ? ' (quick nature)' : ''}</div>
      <div class="svexp"><span>EXP</span><div><i style="width:${(m.exp ?? 0) / expToNext(m.level) * 100}%"></i></div><b>${m.exp ?? 0}/${expToNext(m.level)}</b><small>to Lv ${m.level + 1}</small></div>
      <table class="svt"><tr><th></th><th>Stat</th><th>IV</th><th></th></tr>${rows}</table>
      ${evoText(m) ? `<p class="note">Evolves: ${evoText(m)}</p>` : ''}
      ${bondEvolves(m) ? `<div class="svbond"><span>♥ BOND</span><div><i style="width:${(m.bond ?? 0) / BOND_FULL * 100}%"></i></div><b>${m.bond ?? 0}/${BOND_FULL}</b><small>${(m.bond ?? 0) >= BOND_FULL ? 'full: it evolves at its next level-up' : 'grows as it battles with you'}</small></div>` : ''}
      <div class="svmoves"><div class="lbl">Moves <span>change them in the Box</span></div>${movesOf(m).map((n) => `<span style="background:${TYPE_COL[moveInfo(n).type]}">${n} · ${moveCost(n)} PP</span>`).join('')}</div>
      <div class="svitems"><div class="lbl">Use an item</div>${itemButtons(m)}</div>`
  }
  /* The Bag's pockets: each item is in one, by what it is. Other holds evolution items, key items and summons. */
  const BAG_TABS = [['medicine', 'MEDICINE'], ['balls', 'BALLS'], ['discs', 'MOVE DISCS'], ['other', 'OTHER']]
  const pocketOf = (k, it) => (it.disc ? 'discs' : k === 'ball' || k === 'great' ? 'balls' : HEALS.includes(k) || it.cure || it.candy ? 'medicine' : 'other')
  const POCKET_EMPTY = { medicine: 'No medicine. Potions, Revives and status cures go here.', balls: 'No Poké Balls.', discs: 'No Move Discs. Gym Leaders give them, and the VVM sells them now and then.', other: 'Nothing here. Evolution stones, key items and summons go here.' }
  let bagTab = 'medicine'   // the pocket you last looked at, for as long as the game is open
  function bagList() {
    // Only what you actually have: an item at 0 drops out of the list.
    const all = Object.entries(ITEMS).filter(([k]) => k !== 'summon' && k !== 'elite' && k !== 'disc' && bag[k] > 0)
    const held = all.filter(([k, it]) => pocketOf(k, it) === bagTab)
    const tabs = `<div class="bagtabs" role="tablist">${BAG_TABS.map(([t, label]) => { const n = all.filter(([k, it]) => pocketOf(k, it) === t).reduce((a, [k]) => a + bag[k], 0)
      return `<button role="tab" aria-selected="${t === bagTab}" class="${t === bagTab ? 'on' : ''}" data-tab="${t}">${label}${n ? `<i>${n}</i>` : ''}</button>` }).join('')}</div>`
    return tabs + (held.length ? '' : `<p class="note">${all.length ? POCKET_EMPTY[bagTab] : 'Your Bag is empty.'}</p>`) + held.map(([k, it]) => {
      if (it.key) return `<button class="irow key" data-share="1" aria-pressed="${shareOn}"><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">KEY ITEM · ${shareOn ? 'Pokémon that sit out a battle get half its EXP' : 'off: only the Pokémon that battle get EXP'} · tap to switch</span></span><span class="onoff ${shareOn ? 'on' : ''}">${shareOn ? 'ON' : 'OFF'}</span></button>`
      if (LEAGUES[it.summon]) {
        const id = it.summon, st = leagueStep(id), L = LEAGUES[id].members[st], ok = leagueNow() === id
        const why = id === 'elite' ? (champion ? "you're already Champion" : 'needs all 8 Johto badges') : redBeaten ? "you've beaten Red" : 'needs all 16 badges'
        return `<button class="irow" data-item="${k}"${ok ? '' : ' disabled'}><img class="ic face" src="${ART[L.face]}" alt=""><span class="mid"><b>${it.name}</b><span class="sub">${!ok ? why : `next: ${L.short} (${st + 1} of 5) · tap`}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>`
      }
      if (it.summon != null) {
        const n = it.summon, L = GYMS[n], done = badges.includes(n), ready = n === nextGym() && (n < 8 || champion)
        const sub = done ? `you already have the ${L.badge} BADGE` : ready ? `challenge ${L.short} of ${L.city} · tap` : n === 8 && !champion ? 'become Champion first' : `beat ${GYMS[n - 1].short} first`
        return `<button class="irow" data-item="${k}"${ready ? '' : ' disabled'}><img class="ic face" src="${ART[L.face]}" alt=""><span class="mid"><b>${it.name}</b><span class="sub">${sub}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>`
      }
      if (it.disc) { const n = party.filter((m) => canLearnDisc(m, it.disc) && !learn(m).learned.includes(it.disc)).length
        return `<button class="irow" data-item="${k}"${n ? '' : ' disabled'}><span class="ic disc"></span><span class="mid"><b>${it.name}</b><span class="sub blk"><i class="tychip" style="background:${TYPE_COL[moveInfo(it.disc).type]}">${moveInfo(it.disc).type}</i> ${moveDetail(it.disc)} · ${moveInfo(it.disc).cost} PP</span><span class="sub blk">${n ? `${n} of your party can learn it · tap to use` : 'nobody in your party can learn it'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      if (it.evo || it.held) { const n = it.evo ? party.filter((m) => evoByItem(m, k, bag).rule).length : 0
        return `<button class="irow" data-item="${k}"${n ? '' : ' disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${it.held ? it.sub : n ? `${n === 1 ? '1 Pokémon' : `${n} Pokémon`} can evolve with it · tap to use` : `${it.sub} · nobody in your party can use it`}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      if (it.cure) { const n = party.filter((m) => m.status && it.cure.includes(m.status)).length
        return `<button class="irow" data-item="${k}"${n && bag[k] ? '' : ' disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${it.sub} · ${n ? `${n === 1 ? '1 Pokémon needs' : `${n} Pokémon need`} it · tap to use` : 'nobody needs it right now'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      if (it.candy) { const n = party.filter((m) => m.level < LEVEL_CAP).length
        return `<button class="irow" data-item="${k}"${n ? '' : ' disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${n ? `${it.sub} · tap to use` : 'your whole party is at Lv 100'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>` }
      const usable = HEALS.includes(k)
      return `<button class="irow" data-item="${k}" ${usable && bag[k] ? '' : 'disabled'}><span class="ic ${k}"></span><span class="mid"><b>${it.name}</b><span class="sub">${usable ? it.sub + ' · tap to use' : 'throw these in wild battles'}</span></span><span class="ct">×${bag[k] ?? 0}</span></button>`
    }).join('') + `<p class="note">Balls, potions, revives and bundles are bought from the VVM, alongside the packs; a bundle's items land here separately. Move Discs come from Gym Leaders and, now and then, the VVM. Beaten trainers sometimes leave a booster pack: it goes to your collection.</p>`
  }
  /** A summon's challenge page: who, how many, how strong; then the button. */
  function summonPage(k) {
    const n = ITEMS[k].summon, L = GYMS[n], ace = leaderLevels(L).at(-1)
    return `<button class="back" data-back>◀ Bag</button>
      <div class="gymcard" style="--c:${L.color}"><img src="${ART[L.face]}" alt=""><div>
        <b>${L.full}</b><span>${L.city} GYM · ${L.type.toUpperCase()} TYPE</span>
        <span>${L.team.length} Pokémon · Lv ${L.low}–${ace} · uses a Full Restore</span></div></div>
      <p class="note">${L.region === 'kanto' ? 'Kanto' : 'Johto'} gym ${(n % 8) + 1} of 8. Win and you get the ${L.badge} BADGE and ${L.tokens} tokens. The summon is used up when ${L.short} arrives, win or lose.</p>
      <div class="lbl">Your party</div>
      <div class="mvchips" style="margin-bottom:10px">${party.map((m) => `<i style="background:${TYPE_COL[m.types[0]]}">${m.name} Lv ${m.level}</i>`).join('')}</div>
      <button class="challenge" data-challenge="${n}" style="--c:${L.color}">SUMMON ${L.short}</button>`
  }
  /** A League ticket's page: the ladder, where you are on it, and the button for the next battle. */
  function elitePage(k) {
    const id = ITEMS[k].summon, st = leagueStep(id), list = LEAGUES[id].members, L = list[st], first = list[0].short, last = list.at(-1)
    return `<button class="back" data-back>◀ Bag</button>
      <div class="ladder">${list.map((E, i) => `<span class="${i < st ? 'done' : i === st ? 'next' : ''}"><img src="${ART[E.face]}" alt=""><b>${E.short}</b><i>${i < st ? 'BEATEN' : i === st ? 'NEXT' : E.role === 'CHAMPION' || E.red ? E.role : `#${i + 1}`}</i></span>`).join('')}</div>
      <div class="gymcard" style="--c:${L.color}"><img src="${ART[L.face]}" alt=""><div>
        <b>${L.full}</b><span>${L.red ? 'MT. SILVER' : `${L.type.toUpperCase()} TYPE`} · battle ${st + 1} of 5</span>
        <span>${L.team.length} Pokémon · their ace is Lv ${leaderLevels(L).at(-1)} · pays ${L.tokens} tokens</span></div></div>
      <p class="note">One ticket covers all five battles. Take as long as you like between them: heal up, buy supplies, then come back here. Win and the ticket stays for the next battle; lose and it's gone, and the next ticket starts again from ${first}. ${last.red ? `Beat ${last.short}, if you can.` : `Beat ${last.short} and you're Champion.`}</p>
      <div class="lbl">Your party</div>
      <div class="mvchips" style="margin-bottom:10px">${party.map((m) => `<i style="background:${TYPE_COL[m.types[0]]}">${m.name} Lv ${m.level} · ${m.hp}/${m.stats.hp}</i>`).join('')}</div>
      <button class="challenge" data-elite="${id}" style="--c:${L.color}">CHALLENGE ${L.short}</button>`
  }
  function bagTarget(k) {
    if (ITEMS[k].candy) return `<button class="back" data-back>◀ Bag</button><p class="note" style="margin:0 2px 8px"><b>${ITEMS[k].name}</b> ×${bag[k]} — give it to which Pokémon?</p>` +
      party.map((m, i) => { const max = m.level >= LEVEL_CAP
        return `<button class="prow tgt${max ? ' cant' : ''}" data-target="${i}" ${max ? 'disabled' : ''}><img src="${spr(m)}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${max ? 'already Lv 100' : `Lv ${m.level} → ${m.level + 1}`}</span></span>${hpBar(m)}</span></button>` }).join('')
    if (ITEMS[k].evo) return `<button class="back" data-back>◀ Bag</button><p class="note" style="margin:0 2px 8px"><b>${ITEMS[k].name}</b> ×${bag[k]} — use it on which Pokémon?</p>` +
      party.map((m, i) => { const r = evoByItem(m, k, bag)
        return `<button class="prow tgt${r.rule ? '' : ' cant'}" data-target="${i}" ${r.rule ? '' : 'disabled'}><img src="${spr(m)}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${r.rule ? `evolves into ${r.rule.to}` : r.why}</span></span>${hpBar(m)}</span></button>` }).join('')
    if (ITEMS[k].disc) return `<button class="back" data-back>◀ Bag</button>${moveCard(ITEMS[k].disc, '', ' info', 'div')}<p class="note" style="margin:0 2px 8px">MOVE DISC <b>${ITEMS[k].disc}</b> — teach it to which Pokémon?</p>` +
      party.map((m, i) => { const knows = learn(m).learned.includes(ITEMS[k].disc), can = canLearnDisc(m, ITEMS[k].disc)
        return `<button class="prow tgt${can ? '' : ' cant'}" data-target="${i}" ${knows || !can ? 'disabled' : ''}><img src="${spr(m)}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${!can ? "can't learn this" : knows ? 'already knows it' : `Lv ${m.level} · can learn`}</span></span><span class="mvchips">${movesOf(m).map((n) => `<i style="background:${TYPE_COL[moveInfo(n).type]}">${n}</i>`).join('')}</span></span></button>` }).join('')
    return `<button class="back" data-back>◀ Bag</button><p class="note" style="margin:0 2px 8px"><b>${ITEMS[k].name}</b> ×${bag[k]} — use on which Pokémon?</p>` +
      party.map((m, i) => {
        const rev = !!ITEMS[k].revive, cure = ITEMS[k].cure
        const off = !bag[k] || (cure ? !(m.status && cure.includes(m.status)) : rev ? m.hp > 0 : m.hp <= 0 || m.hp >= m.stats.hp)
        const what = cure ? (m.status ? (cure.includes(m.status) ? `${STATUS_WORD[m.status]} · cure it` : `${STATUS_WORD[m.status]} · won't help`) : 'no status') : rev ? (m.hp <= 0 ? `fainted · revive to ${Math.ceil(m.stats.hp * ITEMS[k].revive)} HP` : 'not fainted') : m.hp <= 0 ? 'fainted' : m.hp >= m.stats.hp ? 'full HP' : `+${Math.ceil(m.stats.hp * ITEMS[k].heal)} HP`
        return `<button class="prow tgt" data-target="${i}" ${off ? 'disabled' : ''}><img src="${spr(m)}" alt=""><span class="mid"><span class="nm"><b>${m.name}</b><span>${what}</span></span>${hpBar(m)}</span></button>`
      }).join('')
  }
  const everyone = () => [...party, ...box]
  /**
   * The Box: your party, then everyone else. Tap a Pokémon for its moves; the
   * button beside it moves it between party and Box. With a full party, SWAP IN
   * picks a Box Pokémon and then the party member it replaces (in that slot).
   * The party always keeps at least one.
   */
  function boxBody(pick = null) {
    const row = (m, i, side) => `<div class="prow boxrow${pick === i ? ' picked' : ''}"><button class="pmain boxmon" data-mon="${i}"><img src="${spr(m)}" alt=""><span class="mid">
        <span class="nm"><b>${m.name}</b><span>Lv ${m.level}${m.hp <= 0 ? ' · fainted' : ''}</span></span>
        <span class="mvchips">${movesOf(m).map((n) => `<i style="background:${TYPE_COL[moveInfo(n).type]}">${n}</i>`).join('')}</span></span></button>${side}</div>`
    const inParty = party.map((m, i) => row(m, i, pick != null
      ? `<button class="pbtn swap" data-swapat="${i}" aria-label="Swap ${m.name} out">⇄ SWAP<small>to Box</small></button>`
      : `<button class="pbtn" data-deposit="${i}" ${party.length > 1 ? '' : 'disabled'} aria-label="Move ${m.name} to the Box">→ BOX</button>`)).join('')
    const inBox = box.map((m, j) => row(m, party.length + j, party.length < 6
      ? `<button class="pbtn" data-withdraw="${j}" aria-label="Move ${m.name} to your party">→ PARTY</button>`
      : `<button class="pbtn${pick === party.length + j ? ' on' : ''}" data-withdraw="${j}" aria-label="Swap ${m.name} into your party">${pick === party.length + j ? 'CANCEL' : 'SWAP IN'}</button>`)).join('')
    return `<p class="note" style="margin:0 2px 8px">${pick != null ? `Now tap <b>SWAP</b> on the party Pokémon that ${everyone()[pick].name} replaces.` : 'Tap a Pokémon to choose its four moves. The button beside it moves it between your party and the Box.'}</p>` +
      `<div class="lbl">Party <span>${party.length}/6 · battle order is set in Party</span></div>${inParty}` +
      `<div class="lbl">Box <span>${box.length ? `${box.length} Pokémon` : 'empty'}</span></div>${inBox || '<p class="note">Catches land here once your party has six. You can also send party Pokémon here.</p>'}`
  }
  /** What a move does, in a line: its category and power (or its effect), and anything special about it. */
  function moveDetail(n) {
    const m = moveInfo(n)
    return m.kind === 'support' ? `${m.sub} · ${m.solo ? 'works in 1v1 too' : '2v2 only'}${INPUT_HINT[m.input] ? ` · ${INPUT_HINT[m.input]}` : ''}` : `${m.cat === 'spec' ? 'SPECIAL' : 'PHYSICAL'} · ${m.power} power${m.hits ? ` × ${m.hits} hits` : ''}${m.spread ? (m.spread === 'all' ? ' · hits everyone else' : ' · both foes') : ''}${m.prio ? ' · goes first' : ''}${m.sub ? ` · ${m.sub}` : ''}${INPUT_HINT[m.input] ? ` · ${INPUT_HINT[m.input]}` : ''}`
  }
  function moveCard(n, attrs, extra = '', tag = 'button') {
    const m = moveInfo(n)
    return `<${tag} class="mvcard${extra}" ${attrs}><span class="ty" style="background:${TYPE_COL[m.type]}">${m.type}</span><b>${n}</b><span class="pp${m.cost ? '' : ' free'}">${m.cost} PP</span><small>${moveDetail(n)}</small></${tag}>`
  }
  function movesPage(m, slot, backTo = 'Box') {
    learn(m)
    const spare = m.learned.filter((n) => !m.moves.includes(n))
    return `<button class="back" data-back>◀ ${backTo}</button>
      <div class="svhead"><img src="${spr(m)}" alt=""><div><div class="nm"><b>${m.name}</b> <span>Lv ${m.level}</span></div>
        <div class="types">${m.types.map((t) => `<span style="background:${TYPE_COL[t]}">${t}</span>`).join('')}</div></div></div>
      <div class="lbl">Equipped · ${m.moves.length}/${MAX_MOVES} <span>${slot == null ? 'tap one to swap it out' : 'now tap a learned move below'}</span></div>
      <div class="mvgrid">${m.moves.map((n, i) => moveCard(n, `data-slot="${i}"`, i === slot ? ' sel' : '')).join('')}</div>
      <div class="lbl">Learned <span>${spare.length} more</span></div>
      <div class="mvlist">${spare.map((n) => moveCard(n, `data-learn="${n}"`, slot == null ? ' dim' : '')).join('') || '<p class="note">Everything it knows is equipped.</p>'}</div>
      ${upcoming(m).length ? `<div class="lbl">Learns later <span>by leveling up</span></div><div class="later">${upcoming(m).map(([lv, n]) => `<span><b>Lv ${lv}</b> ${n}</span>`).join('')}</div>` : ''}
      <p class="note">Swap any time outside battle. Keep at least one 0 PP attack (TACKLE, SCRATCH, QUICK ATTACK…) so it always has something to hit with. HOWL, GROWTH and LIFE DEW work in 1v1 too; the rest of the support moves need a 2v2.</p>`
  }

  /**
   * Admin: battle supplies for the machine. Mirrors the app's admin "Machine
   * Items" page, where it would live beside the packs; here it's a Play-mode
   * panel and never appears in the demos. Edits apply from the next stocked tap.
   */
  function openAdmin() {
    $('sheetTitle').textContent = 'Admin · Machine items'
    const card = (k) => {
      const s = SHOP[k]
      return `<div class="adm${s.on ? '' : ' off'}">
        <div class="admhead"><span class="ic ${k}"></span><b>${ITEMS[k].name}</b>
          <label class="admsw"><input type="checkbox" data-shop="${k}:on"${s.on ? ' checked' : ''}><span>In the machine</span></label></div>
        <div class="admrow"><span>Price</span><span class="pin"><input type="number" min="0" step="0.05" value="${s.price.toFixed(2)}" data-shop="${k}:price"> tokens</span></div>
        <div class="admrow"><span>Appearance rate</span><b id="rate-${k}">${s.rate}%</b></div>
        <input type="range" min="0" max="100" step="5" value="${s.rate}" data-shop="${k}:rate" aria-label="${ITEMS[k].name} appearance rate">
      </div>`
    }
    // Bundles: a name, any mix of supplies, a price, a rate.
    const bcard = (b, i) => `<div class="adm bundle${b.on ? '' : ' off'}">
        <div class="admhead"><span class="ic bundle"></span><input class="bname" value="${esc(b.name)}" maxlength="24" data-bundle="${i}:name" aria-label="Bundle name">
          <label class="admsw"><input type="checkbox" data-bundle="${i}:on"${b.on ? ' checked' : ''}><span>In the machine</span></label></div>
        <div class="bitems">${BUNDLE_ITEMS.map((k) => `<label><span class="ic ${k}"></span><span>${ITEMS[k].name}</span><input type="number" min="0" max="20" step="1" value="${b.items[k] ?? 0}" data-bundle="${i}:item:${k}"></label>`).join('')}</div>
        <div class="admrow"><span>Price <small id="bworth-${i}">(${bundleWorth(b).toFixed(2)} tk bought separately)</small></span><span class="pin"><input type="number" min="0" step="0.05" value="${b.price.toFixed(2)}" data-bundle="${i}:price"> tokens</span></div>
        <div class="admrow"><span>Appearance rate</span><b id="brate-${i}">${b.rate}%</b></div>
        <input type="range" min="0" max="100" step="5" value="${b.rate}" data-bundle="${i}:rate" aria-label="${esc(b.name)} appearance rate">
        <button class="bdel" data-delbundle="${i}">Remove bundle</button>
      </div>`
    // Redrawn in place when bundles are added, removed or reset (reopening would leave the first open waiting forever).
    const draw = () => $('sheetBody').innerHTML = `<p class="note" style="margin:0 2px 10px">Battle supplies the machine can stock beside the packs. <b>Appearance rate</b> is the chance an item is on the shelf when the machine is stocked. Changes apply from the next stocked tap.</p>` +
      Object.keys(SHOP).map(card).join('') +
      `<h3 class="admh">Bundles</h3><p class="note" style="margin:0 2px 8px">Several supplies sold together at one price. Bought, the items go into the Bag separately.</p>` +
      BUNDLES.map(bcard).join('') + `<button class="back" data-addbundle>+ New bundle</button>` +
      `<button class="back" data-reset style="margin-top:6px">Reset to defaults</button>`
    draw()
    $('sheetBody').oninput = (e) => {
      const bl = e.target.closest('[data-bundle]')
      if (bl) {
        const [i, f, k] = bl.dataset.bundle.split(':'), b = BUNDLES[+i]
        if (f === 'name') b.name = bl.value.toUpperCase().slice(0, 24) || 'BUNDLE'
        if (f === 'on') { b.on = bl.checked; bl.closest('.adm').classList.toggle('off', !bl.checked) }
        if (f === 'price') { const v = Math.round(+bl.value * 100) / 100; if (Number.isFinite(v) && v >= 0) b.price = v }
        if (f === 'rate') { b.rate = +bl.value; $('brate-' + i).textContent = bl.value + '%' }
        if (f === 'item') { const n = Math.max(0, Math.min(20, Math.round(+bl.value) || 0)); b.items[k] = n; $('bworth-' + i).textContent = `(${bundleWorth(b).toFixed(2)} tk bought separately)` }
        saveBundles(); return
      }
      const el = e.target.closest('[data-shop]'); if (!el) return
      const [k, f] = el.dataset.shop.split(':')
      if (f === 'on') { SHOP[k].on = el.checked; el.closest('.adm').classList.toggle('off', !el.checked) }
      if (f === 'price') { const v = Math.round(+el.value * 100) / 100; if (Number.isFinite(v) && v >= 0) SHOP[k].price = v }
      if (f === 'rate') { SHOP[k].rate = +el.value; $('rate-' + k).textContent = el.value + '%' }
      saveShop()
    }
    $('sheetBody').onclick = (e) => {
      if (e.target.closest('[data-reset]')) { for (const k in SHOP) Object.assign(SHOP[k], SHOP_DEFAULT[k]); BUNDLES.splice(0, BUNDLES.length, ...structuredClone(BUNDLES_DEFAULT)); saveShop(); saveBundles(); draw() }
      if (e.target.closest('[data-addbundle]')) { BUNDLES.push({ id: 'b' + Date.now().toString(36), name: 'NEW BUNDLE', items: { potion: 2 }, price: 0.45, rate: 20, on: true }); saveBundles(); draw() }
      const del = e.target.closest('[data-delbundle]'); if (del) { BUNDLES.splice(+del.dataset.delbundle, 1); saveBundles(); draw() }
    }
    $('sheet').classList.add('open')
    return new Promise((res) => { sheetCloser = () => { closeSheetNow(); $('sheetBody').oninput = null; $('sheetBody').onclick = null; res() } })
  }

  /**
   * Opens a sheet. Every action goes through do_(), so a tap in play and a
   * step in the demo run exactly the same code.
   */
  function openSheet(kind) {
    let view = { page: 'list' }
    const title = () => kind === 'party' ? (view.page === 'stats' ? 'Stats' : `Party · ${party.length}/6`) : kind === 'bag' ? (view.page === 'target' ? 'Use item' : view.page === 'moves' ? 'Moves' : view.page === 'summon' ? 'Gym challenge' : view.page === 'elite' ? 'Elite Four' : 'Bag') : view.page === 'moves' ? 'Moves' : `Box · ${everyone().length}`
    const draw = () => {
      $('sheetTitle').textContent = title()
      const body = kind === 'party' ? (view.page === 'stats' ? statPage(view.mon) : partyList())
        : kind === 'bag' ? (view.page === 'target' ? bagTarget(view.item) : view.page === 'summon' ? summonPage(view.item) : view.page === 'elite' ? elitePage(view.item) : view.page === 'moves' ? movesPage(view.mon, view.slot, 'Bag') : bagList()) : view.page === 'moves' ? movesPage(view.mon, view.slot) : boxBody(view.pick)
      $('sheetBody').innerHTML = (toast ? `<div class="toast${toastBad ? ' bad' : ''}">${toast}</div>` : '') + body
    }
    const do_ = (a) => {
      toast = ''; toastBad = false
      if (a.heal != null) { if (freeHealsLeft()) { healAll(); const left = freeHealsLeft(); toast = `Your party is fully healed, and any status is cured! ${left ? `${left} free heal${left === 1 ? '' : 's'} left today.` : `Free heals are used for today: the next one is ${healPrice.toFixed(2)} tk.`}` } else { buyHeal(); return } }
      if (a.stat != null) { view = { page: 'stats', mon: party[a.stat] }; sfx('select') }
      if (a.back != null) { view = { page: 'list' }; sfx('move') }
      if (a.up != null && a.up > 0) { [party[a.up - 1], party[a.up]] = [party[a.up], party[a.up - 1]]; sfx('move') }
      if (a.down != null && a.down < party.length - 1) { [party[a.down + 1], party[a.down]] = [party[a.down], party[a.down + 1]]; sfx('move') }
      if (a.tab != null) { bagTab = a.tab; sfx('move') }
      if (a.share != null) { shareOn = !shareOn; sfx('select'); toast = `EXP. SHARE switched ${shareOn ? 'on' : 'off'}.`; saveGame() }
      if (a.use != null) toast = useItem(a.use, view.mon)
      if (a.item != null) { const s = ITEMS[a.item].summon; view = { page: LEAGUES[s] ? 'elite' : s != null ? 'summon' : 'target', item: a.item }; sfx('select') }
      // The Elite Four ticket isn't spent here: only a loss, or beating Lance, uses it up.
      if ((a.elite != null || a.challenge != null) && !modeOn('trainers')) { toast = modeLive.trainers ? 'Trainer battles are switched off (on the machine screen).' : "Trainer battles aren't live yet."; toastBad = true; draw(); return }
      if (a.elite != null) { pendingSummon = a.elite || 'elite'; sfx('select'); sheetCloser?.(); return }
      // Summon: spend it, close the sheet, and the leader turns up.
      if (a.challenge != null) { bag[summonKey(a.challenge)]--; pendingSummon = a.challenge; renderTools(); sfx('select'); sheetCloser?.(); return }
      if (a.target != null && ITEMS[view.item].disc) {
        // A Move Disc: learned now, equipped if there's room, otherwise straight to the move editor.
        const m = party[a.target], n = ITEMS[view.item].disc, r = teach(m, n, true)
        if (r.cant || r.already) { toast = r.cant ? `${m.name} can't learn ${n}.` : `${m.name} already knows ${n}.`; toastBad = true; draw(); return }
        bag[view.item]--; sfx('levelup')
        toast = r.equipped ? `${m.name} learned ${n}! It's equipped.` : `${m.name} learned ${n}! Tap an equipped move to swap it in, or leave it in Learned.`
        view = { page: 'moves', mon: m, slot: null }
      } else if (a.target != null && ITEMS[view.item].candy) {
        // A Rare Candy: one level, as if from EXP. New moves are learned here; an evolution it brings plays once the sheet closes.
        const m = party[a.target]
        if (m.level >= LEVEL_CAP) { toast = `${m.name} is already Lv 100.`; toastBad = true; draw(); return }
        bag[view.item]--; const hpBefore = m.stats.hp
        m.level++; m.exp = 0; m.stats = statsAt(m, m.level); if (m.hp > 0) m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore))
        sfx('levelup'); renderTools()
        const learned = learnAtLevel(m)
        toast = `${m.name} grew to Lv. ${m.level}!` + learned.map((r) => ` It learned ${r.name}${r.equipped ? '' : ' (swap it in from the Box)'}.`).join('')
        feed(`<b>You</b> gave ${m.name} a RARE CANDY: Lv ${m.level}.`)
        if (evoDue(m)) { pendingEvos.add(m); pendingEvoItem = true; sheetCloser?.(); return }
        if (!bag[view.item]) view = { page: 'list' }
      } else if (a.target != null && ITEMS[view.item].evo) {
        // An evolution item: the sheet closes and the evolution plays (the item is spent only if it isn't stopped).
        const m = party[a.target], r = evoByItem(m, view.item, bag)
        if (!r.rule) { toast = `It won't work: ${r.why}.`; toastBad = true; draw(); return }
        m.evoForce = r.rule; pendingEvos.add(m); pendingEvoItem = true; sfx('select'); sheetCloser?.(); return
      } else if (a.target != null) { toast = useItem(view.item, party[a.target]); if (!bag[view.item]) view = { page: 'list' } }
      // Box: pick a Pokémon, pick an equipped slot, pick a learned move to put there.
      if (a.mon != null) { view = { page: 'moves', mon: everyone()[a.mon], slot: null }; sfx('select') }
      // Party ⇄ Box (the Box sheet). The party never goes below one.
      if (a.deposit != null && party.length > 1) { const [m] = party.splice(a.deposit, 1); box.push(m); view.pick = null; sfx('move'); toast = `${m.name} went to the Box.` }
      if (a.withdraw != null) {
        const j = a.withdraw, m = box[j]
        if (party.length < 6) { box.splice(j, 1); party.push(m); view.pick = null; sfx('select'); toast = `${m.name} joined your party.` }
        else { view.pick = view.pick === party.length + j ? null : party.length + j; sfx('move') }   // full: pick it, then a party slot
      }
      if (a.swapat != null && view.pick != null) {
        const j = view.pick - party.length, m = box[j], out = party[a.swapat]
        party[a.swapat] = m; box[j] = out; view.pick = null; sfx('select'); toast = `${m.name} swapped in for ${out.name}, who went to the Box.`
      }
      if (a.slot != null) { view.slot = view.slot === a.slot ? null : a.slot; sfx('move') }
      if (a.learn != null) {
        if (view.slot == null) { toast = 'First tap the equipped move to swap out.'; toastBad = true }
        else { const was = view.mon.moves[view.slot], err = equip(view.mon, view.slot, a.learn); if (err) { toast = err; toastBad = true; sfx('blocked') } else { toast = `${view.mon.name} swapped ${was} for ${a.learn}.`; view.slot = null; sfx('select') } }
      }
      draw(); renderTools()
    }
    /** A heal after the day's free ones: paid in tokens (in the app, on the server, at its price). */
    let paying = false
    async function buyHeal() {
      if (paying) return
      paying = true; toast = 'Paying…'; toastBad = false; draw()
      const api = vvm()
      const r = api ? await api.buyHeal().catch(() => ({ ok: false, reason: 'error' }))
        : wallet + 1e-9 >= healPrice ? { ok: true, price: healPrice, balance: Math.round((wallet - healPrice) * 100) / 100 } : { ok: false, reason: 'insufficient_tokens' }
      paying = false
      if (!live()) return
      if (r.ok) {
        wallet = r.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk`
        healAll(); toast = `Your party is fully healed, and any status is cured! That was ${r.price.toFixed(2)} tk.`
        feed(`<b>You</b> paid ${r.price.toFixed(2)} tk for a Pokémon Center heal.`)
      } else {
        sfx('blocked'); toastBad = true
        if (r.balance != null) { wallet = r.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk` }
        toast = r.reason === 'insufficient_tokens' ? 'Not enough tokens for a heal.' : "The Pokémon Center couldn't take the payment. Try again."
      }
      draw(); renderTools()
    }
    toast = ''; draw(); $('sheet').classList.add('open')
    anim($('sheet').firstElementChild, [{ transform: 'translateY(40px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220 })
    const KEYS_ = ['heal', 'stat', 'back', 'up', 'down', 'use', 'item', 'target', 'mon', 'slot', 'learn', 'challenge', 'elite', 'deposit', 'withdraw', 'swapat', 'tab', 'share']
    const read = (el) => { for (const k of KEYS_) if (el.hasAttribute('data-' + k)) { const v = el.getAttribute('data-' + k); return { [k]: v === '' ? true : isNaN(+v) ? v : +v } } return null }
    $('sheetBody').onclick = (e) => {
      if (MODE !== 'play') return
      const el = e.target.closest('button'); if (!el || el.disabled) return
      const a = read(el); if (a) do_(a)
    }
    return {
      /** Demo: press the button matching a selector, visibly, as a tap would. */
      async tap(sel, wait = 1100) {
        const el = $('sheetBody').querySelector(sel)
        // Light it first: acting re-renders the sheet and would replace it.
        if (el) { el.classList.add('hot'); await W(260); do_(read(el)) }
        await W(wait)
      },
      closed: new Promise((res) => { sheetCloser = () => { closeSheetNow(); res() } }),
    }
  }

  /* ══════════ attack visuals, shared by 1v1 and 2v2 ══════════ */
  /* ══════════ attack effects ══════════
     Each move gets a look of its own, chosen by name (FX_BY_NAME) or else by
     its kind and type: bolts, beams, waves, orbs, jets, lobs, blades, claws,
     jaws and the rest, each in its type's colours. Every hit then lands with
     an impact of its type (impactFx): embers, droplets, sparks, shards,
     leaves, bubbles, debris, rings, wisps, smoke, sparkles or a glint, bigger
     on a super-effective or critical hit. All of it is plain elements on the
     effects layer, animated and removed as it ends. */
  const FXC = { normal: ['#ffffff', '#cbd5e1'], fire: ['#fff7ae', '#f97316'], water: ['#e0f2fe', '#3b82f6'], grass: ['#dcfce7', '#22c55e'],
    electric: ['#fefce8', '#facc15'], ice: ['#f0f9ff', '#7dd3fc'], fighting: ['#ffedd5', '#ea580c'], poison: ['#f5d0fe', '#a21caf'],
    ground: ['#fde68a', '#a16207'], flying: ['#ffffff', '#93c5fd'], psychic: ['#fce7f3', '#ec4899'], bug: ['#ecfccb', '#65a30d'],
    rock: ['#fef3c7', '#a8a29e'], ghost: ['#ede9fe', '#6d28d9'], dragon: ['#e0e7ff', '#6366f1'], dark: ['#d4d4d8', '#27272a'],
    steel: ['#f8fafc', '#94a3b8'], fairy: ['#fdf2f8', '#f472b6'] }
  const fxc = (t) => FXC[t] ?? FXC.normal
  const FX_BY_NAME = {
    'THUNDER SHOCK': 'bolt', THUNDERBOLT: 'bolt', THUNDER: 'thunder', DISCHARGE: 'discharge',
    PSYBEAM: 'beam', 'HYPER BEAM': 'beam', 'FLASH CANNON': 'beam', 'ICE BEAM': 'beam', 'AURORA BEAM': 'beam', 'SOLAR BEAM': 'beam', 'POWER GEM': 'beam',
    'HYPER VOICE': 'sound', SNORE: 'sound', CONFUSION: 'psy', EXTRASENSORY: 'psy', PSYCHIC: 'psy',
    'BUG BUZZ': 'waves', 'STRUGGLE BUG': 'waves', SNARL: 'waves', 'DARK PULSE': 'waves', 'DRAGON PULSE': 'waves', 'WATER PULSE': 'waves',
    'SHADOW BALL': 'orb', HEX: 'orb', MOONBLAST: 'orb', 'ENERGY BALL': 'orb', 'FIRE BLAST': 'blast',
    'DRAGON BREATH': 'jet', FLAMETHROWER: 'jet', 'HEAT WAVE': 'jet', 'WATER GUN': 'jet', 'HYDRO PUMP': 'jet', EMBER: 'embers',
    'ICY WIND': 'snow', BLIZZARD: 'snow', 'POWDER SNOW': 'snow',
    'SLUDGE WAVE': 'lob', 'SLUDGE BOMB': 'lob', 'GUNK SHOT': 'lob', 'MUD-SLAP': 'lob', 'MUD SHOT': 'lob', 'SEED BOMB': 'lob',
    'ROCK THROW': 'lob', 'ROCK BLAST': 'lob', 'ROCK TOMB': 'lob', 'ANCIENT POWER': 'lob', 'ROCK SLIDE': 'lob',
    'DAZZLING GLEAM': 'gleam', 'FAIRY WIND': 'sparkle', 'DRAINING KISS': 'sparkle', GUST: 'gust',
    'AIR CUTTER': 'blades', 'AIR SLASH': 'blades', 'WING ATTACK': 'blades', 'TRI ATTACK': 'tri',
    'RAZOR LEAF': 'leaves', 'PETAL DANCE': 'petals', ABSORB: 'leaves', 'GIGA DRAIN': 'leaves', 'STONE EDGE': 'spikes', 'EARTH POWER': 'erupt',
    BITE: 'bite', CRUNCH: 'bite', 'BUG BITE': 'bite', 'FIRE FANG': 'bite', 'VOLT TACKLE': 'volt', SPARK: 'volt', NUZZLE: 'volt',
    'QUICK ATTACK': 'quick', 'FAKE OUT': 'quick', 'FEINT ATTACK': 'quick', 'PHANTOM FORCE': 'phantom', ASTONISH: 'phantom',
    DIG: 'dig', ROLLOUT: 'roll', 'PLAY ROUGH': 'rough', 'DOUBLE KICK': 'strike', 'DYNAMIC PUNCH': 'strike', 'BRAVE BIRD': 'strike', 'ZEN HEADBUTT': 'strike', 'IRON HEAD': 'strike', HEADBUTT: 'strike', 'BODY SLAM': 'strike',
    'X-SCISSOR': 'xslash', 'VINE WHIP': 'whip', 'KARATE CHOP': 'chop', 'BRICK BREAK': 'chop', 'CROSS CHOP': 'chop', 'DUAL CHOP': 'chop', 'IRON TAIL': 'chop',
  }
  /** Which look a move has: its own by name, else by what it is (fx) and its type. */
  function fxRecipe(mv) {
    if (FX_BY_NAME[mv.name]) return FX_BY_NAME[mv.name]
    if (mv.fx === 'spray') return { electric: 'bolt', psychic: 'psy', dragon: 'jet', dark: 'waves', ghost: 'orb', fairy: 'sparkle', flying: 'gust', poison: 'lob', ground: 'lob', bug: 'waves', steel: 'beam', fire: 'jet', water: 'jet', ice: 'snow', grass: 'leaves', fighting: 'orb', rock: 'lob' }[mv.type] ?? 'sound'
    if (mv.fx === 'ember') return 'jet'
    if (mv.fx === 'water') return 'jet'
    if (mv.fx === 'seed' || mv.fx === 'rock' || mv.fx === 'icicle' || mv.fx === 'needle' || mv.fx === 'shuriken' || mv.fx === 'quake') return mv.fx
    if (mv.fx === 'slash') return 'claws'
    return 'strike'
  }
  /** One particle: an element at (x, y) styled by `css`, animated by `frames`, removed when done. */
  function part(x, y, css, frames, opts) {
    const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${x}px;top:${y}px;pointer-events:none;` + css
    fx.appendChild(d); anim(d, frames, opts); setTimeout(() => d.remove(), opts.duration + (opts.delay ?? 0) + 60)
    return d
  }
  const rnd = (a, b) => a + Math.random() * (b - a)
  /** A soft flash of light at c. */
  const glowAt = (c, col, size = 70, dur = 240) => part(c.x - size / 2, c.y - size / 2, `width:${size}px;height:${size}px;border-radius:50%;background:radial-gradient(circle,#fff 0,${col} 30%,transparent 68%)`,
    [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.35)', opacity: 0 }], { duration: dur, easing: 'ease-out' })
  /** A ring spreading from c. */
  const ringAt = (c, col, size = 76, dur = 380, bw = 4, delay = 0) => part(c.x - size / 2, c.y - size / 2, `width:${size}px;height:${size}px;border-radius:50%;border:${bw}px solid ${col};box-shadow:0 0 10px ${col}`,
    [{ transform: 'scale(.15)', opacity: 1 }, { transform: 'scale(1.15)', opacity: 0 }], { duration: dur, delay, easing: 'ease-out' })
  /** Streaks shooting out from c, like a comic-book hit. */
  function burstAt(c, col, n = 8, len = 34, w = 4, dur = 300) {
    for (let i = 0; i < n; i++) {
      const a = i * 360 / n + rnd(-12, 12), L = len * rnd(0.7, 1.15)
      part(c.x - w / 2, c.y - L, `width:${w}px;height:${L}px;transform-origin:50% 100%;border-radius:${w}px;background:linear-gradient(transparent,${col} 40%,#fff)`,
        [{ transform: `rotate(${a}deg) scaleY(.15) translateY(0)`, opacity: 1 }, { transform: `rotate(${a}deg) scaleY(1) translateY(-${L * 0.4}px)`, opacity: 0 }], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' })
    }
  }
  /** Bits thrown out from c: `css` for each, flying `dist`, rising (up < 0) or falling (gravity > 0) as they go. */
  function scatterAt(c, css, n, dist, dur, { gravity = 0, up = 0, spin = 0, size = 8 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = dist * rnd(0.5, 1), x = Math.cos(a) * d, y = Math.sin(a) * d * 0.7 + up, r = spin * rnd(-1, 1)
      part(c.x - size / 2, c.y - size / 2, css, [{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
        { transform: `translate(${x * 0.7}px,${y * 0.7}px) rotate(${r / 2}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x}px,${y + gravity}px) rotate(${r}deg) scale(.6)`, opacity: 0 }], { duration: dur * rnd(0.8, 1.15), delay: rnd(0, 60), easing: 'ease-out' })
    }
  }
  /** Something travelling from A to T in `dur` ms: along an arc (`arc` px up at the middle), spinning, growing. */
  function travel(A, T, css, dur, { arc = 0, spin = 0, from = 1, to = 1, delay = 0, off = 0, w = 12, h = 12 } = {}) {
    const dx = T.x - A.x, dy = T.y - A.y, nx = -dy / Math.hypot(dx, dy || 1), ny = dx / Math.hypot(dx, dy || 1)
    return part(A.x - w / 2, A.y - h / 2, `width:${w}px;height:${h}px;` + css, [
      { transform: `translate(${nx * off}px,${ny * off}px) rotate(0) scale(${from})`, opacity: 1 },
      { transform: `translate(${dx * 0.5 + nx * off * 0.5}px,${dy * 0.5 - arc + ny * off * 0.5}px) rotate(${spin / 2}deg) scale(${(from + to) / 2})`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(${to})`, opacity: 0.95 }], { duration: dur, delay, easing: arc ? 'linear' : 'ease-in' })
  }
  const SVGNS = 'http://www.w3.org/2000/svg'
  /** A jagged bolt from A to T: a glowing coloured line with a white core, flickering. */
  function boltLine(A, T, col, dur, amp = 12, delay = 0) {
    const svg = document.createElementNS(SVGNS, 'svg'); svg.setAttribute('style', 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none')
    const n = 8, pts = []
    for (let i = 0; i <= n; i++) { const k = i / n, j = i === 0 || i === n ? 0 : rnd(-amp, amp); pts.push(`${A.x + (T.x - A.x) * k + j},${A.y + (T.y - A.y) * k + j * 0.6}`) }
    for (const [w, c] of [[7, col], [2.5, '#fff']]) { const p = document.createElementNS(SVGNS, 'polyline'); p.setAttribute('points', pts.join(' ')); p.setAttribute('fill', 'none'); p.setAttribute('stroke', c); p.setAttribute('stroke-width', w); p.setAttribute('stroke-linejoin', 'round'); if (w > 3) p.setAttribute('filter', 'drop-shadow(0 0 4px ' + col + ')'); svg.appendChild(p) }
    fx.appendChild(svg)
    anim(svg, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.25, offset: 0.35 }, { opacity: 1, offset: 0.5 }, { opacity: 0.4, offset: 0.75 }, { opacity: 0 }], { duration: dur, delay })
    setTimeout(() => svg.remove(), dur + delay + 60)
  }
  /** A beam from A to T: it shoots out, holds and thins away. Rainbow for Psybeam and Aurora Beam. */
  function beamLine(A, T, col, dur, w = 14, rainbow = false) {
    const dx = T.x - A.x, dy = T.y - A.y, L = Math.hypot(dx, dy), deg = Math.atan2(dy, dx) * 180 / Math.PI
    const bg = rainbow ? 'linear-gradient(90deg,#f87171,#fbbf24,#4ade80,#60a5fa,#c084fc,#f472b6)' : `linear-gradient(180deg,transparent,${col} 25%,#fff 50%,${col} 75%,transparent)`
    const b = part(A.x, A.y - w / 2, `width:${L}px;height:${w}px;transform-origin:0 50%;border-radius:${w}px;background:${bg};box-shadow:0 0 14px ${col}`,
      [{ transform: `rotate(${deg}deg) scaleX(0) scaleY(1)`, opacity: 1 }, { transform: `rotate(${deg}deg) scaleX(1) scaleY(1)`, opacity: 1, offset: 0.3 },
        { transform: `rotate(${deg}deg) scaleX(1) scaleY(1.3)`, opacity: 1, offset: 0.7 }, { transform: `rotate(${deg}deg) scaleX(1) scaleY(.1)`, opacity: 0 }], { duration: dur })
    if (rainbow) b.style.boxShadow = '0 0 14px #fff'
    glowAt(A, col, 50, dur * 0.5)
  }
  /** A jet (flames, water, dragon fire): many blobs streaming from A to T, swelling and wobbling as they go. */
  function jet(A, T, cols, dur, n = 16, size = 14) {
    for (let i = 0; i < n; i++) travel(A, T, `border-radius:50% 50% 45% 55%;background:radial-gradient(circle at 40% 40%,${cols[0]},${cols[1]} 55%,transparent 72%);filter:blur(.4px)`, dur * 0.55,
      { delay: i * dur * 0.4 / n, from: 0.5, to: rnd(1.4, 2.1), off: rnd(-10, 10), w: size, h: size })
  }
  /** Rings or crescents rolling from A toward T, growing. */
  function wavesTo(A, T, col, dur, n = 4, crescent = true, glow = col) {
    const dx = T.x - A.x, dy = T.y - A.y, deg = Math.atan2(dy, dx) * 180 / Math.PI
    for (let i = 0; i < n; i++) part(A.x - 14, A.y - 22, `width:28px;height:44px;border-radius:50%;border:5px solid transparent;${crescent ? `border-right-color:${col}` : `border-color:${col}`};filter:drop-shadow(0 0 3px ${glow}) drop-shadow(0 0 6px ${glow})`,
      [{ transform: `translate(0,0) rotate(${deg}deg) scale(.5)`, opacity: 1 }, { transform: `translate(${dx}px,${dy}px) rotate(${deg}deg) scale(1.8)`, opacity: 0.35 }], { duration: dur * 0.6, delay: i * dur * 0.13, easing: 'ease-out' })
  }
  /** A four-point twinkle at c. */
  const twinkle = (c, col, size, delay) => part(c.x - size / 2, c.y - size / 2, `width:${size}px;height:${size}px;background:${col};clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);filter:drop-shadow(0 0 4px ${col})`,
    [{ transform: 'scale(0) rotate(0)', opacity: 1 }, { transform: 'scale(1.2) rotate(45deg)', opacity: 1, offset: 0.4 }, { transform: 'scale(0) rotate(90deg)', opacity: 0 }], { duration: 420, delay })
  /** Lines appearing across the target, as claw marks or a chop: `n` parallel, at `deg`. */
  function marks(c, col, n, deg, len = 64, w = 5, gap = 13) {
    for (let i = 0; i < n; i++) {
      const o = (i - (n - 1) / 2) * gap
      part(c.x - len / 2 + o * 0.5, c.y - w / 2 + o, `width:${len}px;height:${w}px;border-radius:${w}px;background:linear-gradient(90deg,transparent,${col} 20%,#fff 50%,${col} 80%,transparent);box-shadow:0 0 6px ${col}`,
        [{ transform: `rotate(${deg}deg) scaleX(0)`, opacity: 1 }, { transform: `rotate(${deg}deg) scaleX(1)`, opacity: 1, offset: 0.35 }, { transform: `rotate(${deg}deg) scaleX(1)`, opacity: 0 }], { duration: 340, delay: i * 45 })
    }
  }
  /** Jaws closing on c: rows of teeth from above and below. */
  function chomp(c, col = '#f8fafc') {
    const teeth = 'polygon(0 0,100% 0,100% 30%,92% 100%,84% 30%,76% 100%,68% 30%,60% 100%,52% 30%,44% 100%,36% 30%,28% 100%,20% 30%,12% 100%,4% 30%,0 30%)'
    for (const [s, y0] of [[1, -38], [-1, 38]]) part(c.x - 34, c.y - 12, `width:68px;height:24px;background:${col};clip-path:${teeth};filter:drop-shadow(0 0 3px #000)`,
      [{ transform: `translateY(${y0}px) scaleY(${s})`, opacity: 0 }, { transform: `translateY(${y0 * 0.2}px) scaleY(${s})`, opacity: 1, offset: 0.55 }, { transform: `translateY(${y0 * 0.3}px) scaleY(${s})`, opacity: 0 }], { duration: 330, easing: 'ease-in' })
  }
  /** Speed lines along the path from A to T. */
  function speedLines(A, T, col = '#fff') {
    const dx = T.x - A.x, dy = T.y - A.y, deg = Math.atan2(dy, dx) * 180 / Math.PI
    for (let i = 0; i < 6; i++) { const k = rnd(0.1, 0.8), o = rnd(-26, 26)
      part(A.x + dx * k, A.y + dy * k + o, `width:46px;height:3px;border-radius:3px;background:linear-gradient(90deg,transparent,${col})`, [{ transform: `rotate(${deg}deg) translateX(-30px)`, opacity: 0 }, { transform: `rotate(${deg}deg) translateX(0)`, opacity: 0.9, offset: 0.4 }, { transform: `rotate(${deg}deg) translateX(30px)`, opacity: 0 }], { duration: 220, delay: i * 20 }) }
  }
  /** The attacker's lunge: most of the way to the target and back, `then` at contact. */
  async function lunge(el, A, T, sp, { reach = 0.78, dur = 380 } = {}) {
    const dx = T.x - A.x, dy = T.y - A.y
    anim(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * reach}px,${dy * reach}px)`, offset: 0.5 }, { transform: 'translate(0,0)' }], { duration: dur * sp })
    await W(dur * 0.5 * sp)
  }

  /** One hit of one of your moves, from A to T (centres). `el` is the attacker's sprite. Later hits of a multi-hit move run quicker. */
  async function strikeFx(mv, A, T, el, quick = false) {
    const sp = quick ? 0.6 : 1, [c1, c2] = fxc(mv.type), R = fxRecipe(mv), D = 380 * sp
    const done = (ms) => W(ms * sp + 30)
    // A special move charges first: the attacker glows in its type's colour as it lets go.
    if (el && mv.cat === 'spec' && !quick && R !== 'volt') { anim(el, [{ filter: 'none' }, { filter: `brightness(1.3) drop-shadow(0 0 10px ${c2}) drop-shadow(0 0 4px #fff)`, offset: 0.5 }, { filter: 'none' }], { duration: 420 }); glowAt(A, c2, 64, 320) }
    switch (R) {
      case 'bolt': boltLine(A, T, c2, 300 * sp); boltLine(A, T, c2, 260 * sp, 16, 60 * sp); return done(300)
      case 'thunder': { const sky = { x: T.x + rnd(-10, 10), y: T.y - 170 }; boltLine(sky, T, c2, 360 * sp, 14); boltLine(sky, T, c2, 300 * sp, 20, 80 * sp); flash('#fef9c3', 0.45, 160); return done(340) }
      case 'discharge': for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.6; boltLine(A, { x: A.x + Math.cos(a) * 70, y: A.y + Math.sin(a) * 50 }, c2, 240 * sp, 8, i * 30 * sp) } boltLine(A, T, c2, 300 * sp, 12, 120 * sp); return done(420)
      case 'beam': beamLine(A, T, c2, 460 * sp, mv.name === 'HYPER BEAM' ? 22 : 14, mv.name === 'PSYBEAM' || mv.name === 'AURORA BEAM'); return done(330)
      case 'sound': wavesTo(A, T, '#f8fafc', D, 4, true, '#c4b5fd'); for (let i = 0; i < 2; i++) ringAt(T, '#f8fafc', 90, 320 * sp, 4, (D * 0.6) + i * 90 * sp); return done(420)
      case 'psy': glowAt(A, c2, 56, 300 * sp); for (let i = 0; i < 3; i++) ringAt(T, c2, 96, 440 * sp, 3, i * 100 * sp); glowAt(T, c1, 80, 500 * sp); return done(460)
      case 'waves': { const dark = mv.type === 'dark', col = dark ? '#3b0764' : c2, glow = dark ? '#a855f7' : c2   // dark: black rings with a violet edge, so they show on a dark sky
        wavesTo(A, T, col, D, 4, mv.type !== 'water', glow); ringAt(T, glow, 84, 340 * sp, 5, D * 0.6); if (dark) glowAt(T, '#581c87', 70, 380 * sp); return done(420) }
      case 'orb': { const big = mv.name === 'MOONBLAST' || mv.name === 'SHADOW BALL'
        travel(A, T, `border-radius:50%;background:radial-gradient(circle at 35% 35%,${c1},${c2} 55%,rgba(0,0,0,.4) 80%);box-shadow:0 0 14px ${c2}`, D, { from: 0.4, to: big ? 2.2 : 1.6, w: 18, h: 18 })
        for (let i = 1; i <= 3; i++) travel(A, T, `border-radius:50%;background:${c2};opacity:.5`, D, { delay: i * 40 * sp, from: 0.3, to: 0.8, w: 10, h: 10 }); return done(380) }
      case 'blast': travel(A, T, `border-radius:50%;background:radial-gradient(circle,${c1},${c2} 60%);box-shadow:0 0 18px ${c2}`, D, { from: 0.5, to: 2, w: 20, h: 20 }); return done(380)
      case 'jet': jet(A, T, [c1, c2], 520 * sp, mv.name === 'HYDRO PUMP' || mv.name === 'FLAMETHROWER' ? 22 : 15); return done(470)
      case 'embers': for (let i = 0; i < 5; i++) travel(A, T, `border-radius:50% 50% 50% 0;background:radial-gradient(${c1},${c2} 60%,#c2410c)`, 360 * sp, { delay: i * 50 * sp, arc: rnd(10, 30), spin: 180, off: rnd(-10, 10), w: 12, h: 12 }); return done(560)
      case 'snow': for (let i = 0; i < 18; i++) travel(A, T, `border-radius:50%;background:#fff;box-shadow:0 0 6px ${c2}`, 420 * sp, { delay: i * 22 * sp, off: rnd(-26, 26), from: rnd(0.5, 1), to: rnd(0.6, 1.3), w: 7, h: 7 }); return done(820)
      case 'lob': { const rocky = mv.type === 'rock'
        const css = rocky ? 'border-radius:40% 55% 45% 50%;background:linear-gradient(#e7d7a8,#8b6d3a);border:1px solid #57401f' : `border-radius:50% 50% 45% 55%;background:radial-gradient(circle at 35% 30%,${c1},${c2} 60%)`
        for (let i = 0; i < (rocky ? 3 : 4); i++) travel(A, T, css, 420 * sp, { delay: i * 70 * sp, arc: rnd(50, 80), spin: rocky ? 360 : 0, off: rnd(-14, 14), w: rocky ? 16 : 13, h: rocky ? 14 : 13 }); return done(620) }
      case 'gleam': flash(c1, 0.55, 220); for (let i = 0; i < 7; i++) twinkle({ x: T.x + rnd(-40, 40), y: T.y + rnd(-40, 30) }, c2, rnd(14, 24), i * 40 * sp); return done(400)
      case 'sparkle': for (let i = 0; i < 6; i++) travel(A, T, `background:${c2};clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)`, 380 * sp, { delay: i * 35 * sp, arc: rnd(-20, 30), spin: 180, off: rnd(-16, 16), w: 14, h: 14 }); return done(560)
      case 'gust': for (let i = 0; i < 3; i++) travel(A, T, 'border-radius:50%;border:3px solid transparent;border-top-color:#fff;border-left-color:#e0f2fe', D, { delay: i * 60 * sp, spin: 720, from: 0.6, to: 1.8, off: (i - 1) * 12, w: 34, h: 34 }); return done(520)
      case 'blades': for (let i = 0; i < 2; i++) travel(A, T, 'border-radius:50%;border:4px solid transparent;border-right-color:#fff;filter:drop-shadow(0 0 4px #93c5fd)', 300 * sp, { delay: i * 70 * sp, spin: -30, off: (i ? 10 : -10), w: 30, h: 46 }); return done(380)
      case 'tri': ['#f97316', '#38bdf8', '#facc15'].forEach((col, i) => travel(A, T, `border-radius:50%;background:radial-gradient(circle,#fff,${col} 60%);box-shadow:0 0 10px ${col}`, D, { off: (i - 1) * 16, from: 0.6, to: 1.3, w: 14, h: 14 })); return done(380)
      case 'leaves': case 'petals': { const col = R === 'petals' ? '#f9a8d4' : '#4ade80'
        for (let i = 0; i < 6; i++) travel(A, T, `border-radius:0 100% 0 100%;background:linear-gradient(135deg,${col},${R === 'petals' ? '#db2777' : '#15803d'})`, 380 * sp, { delay: i * 40 * sp, spin: 540, arc: rnd(-20, 30), off: rnd(-16, 16), w: 14, h: 10 }); return done(600) }
      case 'spikes': for (let i = 0; i < 4; i++) part(T.x - 30 + i * 18, T.y + 10, `width:14px;height:44px;clip-path:polygon(50% 0,100% 100%,0 100%);background:linear-gradient(#e7e5e4,#78716c)`, [{ transform: 'translateY(40px) scaleY(.2)', opacity: 0 }, { transform: 'translateY(-14px) scaleY(1)', opacity: 1, offset: 0.4 }, { transform: 'translateY(-6px) scaleY(1)', opacity: 0 }], { duration: 420 * sp, delay: i * 40 * sp }); return done(420)
      case 'erupt': scatterAt({ x: T.x, y: T.y + 30 }, 'width:10px;height:10px;border-radius:40%;background:#a16207', 10, 50, 500 * sp, { up: -50, gravity: 30, spin: 200 }); glowAt({ x: T.x, y: T.y + 26 }, '#f97316', 90, 360 * sp); return done(360)
      case 'seed': for (let i = 0; i < 3; i++) travel(A, T, 'border-radius:50%;background:radial-gradient(circle at 35% 30%,#bbf7d0,#16a34a 60%,#14532d)', 280 * sp, { delay: i * 45 * sp, off: rnd(-8, 8), w: 10, h: 12 }); return done(380)
      case 'rock': return strikeFx({ ...mv, name: 'ROCK THROW' }, A, T, el, quick)
      case 'icicle': for (let i = 0; i < 3; i++) travel(A, T, `clip-path:polygon(50% 100%,0 0,100% 0);background:linear-gradient(#f0f9ff,#38bdf8);transform-origin:center`, 280 * sp, { delay: i * 50 * sp, off: (i - 1) * 10, w: 9, h: 22 }); return done(380)
      case 'needle': for (let i = 0; i < 3; i++) travel(A, T, `background:linear-gradient(90deg,#f5f5f4,#a3a3a3);border-radius:2px`, 240 * sp, { delay: i * 40 * sp, off: (i - 1) * 8, w: 18, h: 3 }); return done(330)
      case 'shuriken': travel(A, T, 'background:#bfdbfe;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 4px #3b82f6)', 300 * sp, { spin: 900, w: 20, h: 20 }); return done(300)
      case 'quake': {
        const w = document.createElement('div'); w.className = 'groundwave'; w.style.left = (A.x - 30) + 'px'; w.style.top = (A.y + 30) + 'px'; fx.appendChild(w)
        anim(w, [{ transform: 'translate(0,0) scale(.5,.7)' }, { transform: `translate(${T.x - A.x}px,${T.y - A.y}px) scale(1.6,1.1)`, opacity: 0.95, offset: 0.9 }, { opacity: 0 }], { duration: 420 * sp, easing: 'ease-in' })
        setTimeout(() => w.remove(), 460 * sp); shake(4, 400); return W(420 * sp)
      }
      // Contact moves: a lunge, and the look happens at contact.
      case 'quick': speedLines(A, T); await lunge(el, A, T, sp, { reach: 0.85, dur: 260 }); return
      case 'phantom': anim(el, [{ opacity: 1 }, { opacity: 0, offset: 0.3 }, { opacity: 0, offset: 0.6 }, { opacity: 1 }], { duration: 520 * sp }); await W(260 * sp); scatterAt(T, `width:14px;height:14px;border-radius:50%;background:radial-gradient(${c1},${c2} 70%,transparent)`, 6, 30, 500 * sp, { up: -30 }); await W(160 * sp); return
      case 'dig': anim(el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(40px)', opacity: 0, offset: 0.35 }, { transform: 'translateY(40px)', opacity: 0, offset: 0.7 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 560 * sp }); await W(300 * sp); scatterAt({ x: T.x, y: T.y + 34 }, 'width:9px;height:9px;border-radius:40%;background:#a16207', 10, 46, 480 * sp, { up: -40, gravity: 30 }); await W(120 * sp); return
      case 'roll': anim(el, [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${(T.x - A.x) * 0.8}px,${(T.y - A.y) * 0.8}px) rotate(540deg)`, offset: 0.55 }, { transform: 'translate(0,0) rotate(720deg)' }], { duration: 520 * sp }); await W(290 * sp); return
      case 'volt': anim(el, [{ filter: 'none' }, { filter: 'brightness(1.6) drop-shadow(0 0 8px #facc15)', offset: 0.3 }, { filter: 'none' }], { duration: 420 * sp })
        await lunge(el, A, T, sp); for (let i = 0; i < 3; i++) { const a = rnd(0, Math.PI * 2); boltLine(T, { x: T.x + Math.cos(a) * 46, y: T.y + Math.sin(a) * 40 }, '#facc15', 200 * sp, 7, i * 30) } return
      default: await lunge(el, A, T, sp)   // strike, bite, claws, chops and the rest: the look lands at contact
    }
    if (R === 'bite') chomp(T, mv.name === 'FIRE FANG' ? '#fed7aa' : '#f8fafc')
    else if (R === 'claws') marks(T, mv.type === 'dragon' ? c2 : mv.type === 'steel' ? '#e2e8f0' : '#f8fafc', 3, -38)
    else if (R === 'xslash') { marks(T, c2, 1, -40, 74, 6); marks(T, c2, 1, 40, 74, 6) }
    else if (R === 'chop') { const col = mv.type === 'steel' ? '#e2e8f0' : c2; if (mv.name === 'CROSS CHOP') { marks(T, col, 1, 45, 70, 7); marks(T, col, 1, -45, 70, 7) } else marks(T, col, 1, 80, 70, 7) }
    else if (R === 'whip') for (let i = 0; i < 2; i++) part(T.x - 40, T.y - 30 + i * 22, 'width:80px;height:30px;border-radius:50%;border:4px solid transparent;border-bottom-color:#22c55e;filter:drop-shadow(0 0 3px #14532d)', [{ transform: `rotate(${i ? 20 : -20}deg) scaleX(.2)`, opacity: 1 }, { transform: `rotate(${i ? 20 : -20}deg) scaleX(1)`, opacity: 0 }], { duration: 300, delay: i * 70 })
    else if (R === 'rough') { scatterAt(T, 'width:22px;height:22px;border-radius:50%;background:radial-gradient(#fff,#e5e7eb 60%,transparent 72%)', 7, 30, 420); for (let i = 0; i < 4; i++) twinkle({ x: T.x + rnd(-30, 30), y: T.y + rnd(-30, 20) }, '#f472b6', 16, i * 60) }
    else { const col = mv.type === 'normal' ? '#fde68a' : c2   // strike: a star of impact and a shock ring at the point of contact
      twinkle(T, '#fff', 70, 0); twinkle(T, col, 50, 40); ringAt(T, col, 72, 320, 6) }
    await W(150 * sp)
  }
  /*
   * A foe's ranged attack, on its way to you while your ring closes: started
   * so that it arrives as the ring does, a cue for the timing. Contact moves
   * have the foe's lunge instead, and a feint gets none (it would give the
   * feint away).
   */
  const CONTACT_FX = new Set(['strike', 'bite', 'claws', 'xslash', 'chop', 'whip', 'rough', 'quick', 'phantom', 'dig', 'roll', 'volt'])
  const FX_LEAD = { bolt: 150, thunder: 150, discharge: 250, beam: 200, psy: 250, gleam: 150, spikes: 200, erupt: 150, sound: 300, waves: 300 }
  function incomingFx(mv, from, to, approach) {
    const shot = { ...mv, fx: mv.fx ?? 'spray' }, R = fxRecipe(shot)
    if (CONTACT_FX.has(R)) return
    setTimeout(() => { if (live()) strikeFx(shot, from, to, null) }, Math.max(0, approach - (FX_LEAD[R] ?? 420)))
  }
  window.__fx = { strike: (...a) => strikeFx(...a), impact: (...a) => impactFx(...a), recipe: (mv) => fxRecipe(mv), place: (...a) => place(...a), react: (...a) => hitReact(...a), glitch: (l) => glitchFx(l) }   // for tests: the effects, by hand
  /**
   * The target's reaction to a hit: knocked back, away from the attacker,
   * and lit up in the move's colour for a moment. Further on a big hit. Added
   * on top of whatever else the sprite is doing (composite), so it never
   * fights an idle bob or a faint.
   */
  function hitReact(el, A, T, type, big = false) {
    if (!el) return
    const d = Math.hypot(T.x - A.x, T.y - A.y) || 1, k = big ? 16 : 9, x = (T.x - A.x) / d * k, y = (T.y - A.y) / d * k * 0.6, col = fxc(type)[1]
    anim(el, [{ transform: 'translate(0,0)' }, { transform: `translate(${x}px,${y}px)`, offset: 0.25 }, { transform: 'translate(0,0)' }], { duration: big ? 320 : 240, easing: 'cubic-bezier(.2,.8,.3,1)', composite: 'add' })
    anim(el, [{ filter: 'none' }, { filter: `brightness(2.4) drop-shadow(0 0 8px ${col})`, offset: 0.15 }, { filter: 'none' }], { duration: big ? 300 : 200 })
  }
  /** A big hit (super effective, or a PERFECT crit): the screen flashes in the move's colour and everything holds for a beat. */
  async function hitStop(type) { flash(fxc(type)[1], 0.28, 180); await W(90) }
  /**
   * Team Unemployed's machine glitches follow them into battle: as their
   * Pokémon attack, the screen tears and its colours slip, a little in their
   * first story battle and more in each one after (level 0-3).
   */
  function glitchFx(level = 0) {
    const scr = $('screen'), k = 1 + level * 0.5
    anim(scr, [{ filter: 'none', transform: 'none' }, { filter: `hue-rotate(${70 * k}deg) contrast(1.5)`, transform: `translateX(${-4 * k}px) skewX(${3 * k}deg)`, offset: 0.2 },
      { filter: 'invert(1)', transform: `translateX(${5 * k}px)`, offset: 0.35 }, { filter: `hue-rotate(${-50 * k}deg) saturate(3)`, transform: `translateX(${-2 * k}px) skewX(${-2 * k}deg)`, offset: 0.6 },
      { filter: 'none', transform: 'none' }], { duration: 260 + level * 60, composite: 'add' })
    for (let i = 0; i < 2 + level * 2; i++) {
      const top = rnd(5, 90), h = rnd(3, 10 + level * 4)
      part(0, 0, `left:0;top:${top}%;width:100%;height:${h}px;background:linear-gradient(90deg,transparent,${['#22d3ee', '#f0abfc', '#a3e635', '#ffffff'][i % 4]}aa 30%,transparent 70%);mix-blend-mode:screen`,
        [{ transform: `translateX(${rnd(-40, 0)}px)`, opacity: 0.9 }, { transform: `translateX(${rnd(0, 40)}px)`, opacity: 0 }], { duration: rnd(140, 260), delay: rnd(0, 120) })
    }
  }
  /** A shiny Pokémon's sparkle as it appears: gold and white twinkles around it, and a chime. */
  function shinySparkle(c) {
    sfx('levelup')
    for (let i = 0; i < 9; i++) twinkle({ x: c.x + rnd(-44, 44), y: c.y + rnd(-54, 22) }, i % 3 ? '#fde047' : '#ffffff', rnd(14, 26), i * 70)
    ringAt(c, '#fde047', 90, 520, 3, 120)
  }
  /** Where a hit lands: a flash and a starburst in the move's colours, and what its type throws off. Bigger on a super-effective or critical hit. */
  function impactFx(c, type, big = false) {
    const [c1, c2] = fxc(type), k = big ? 1.35 : 1
    glowAt(c, c2, 76 * k, 240); burstAt(c, c2, big ? 11 : 8, 34 * k, big ? 5 : 4)
    if (big) ringAt(c, c2, 96, 380, 4)
    const blob = (col, s = 8) => `width:${s}px;height:${s}px;border-radius:50%;background:${col};box-shadow:0 0 6px ${col}`
    switch (type) {
      case 'fire': scatterAt(c, `width:9px;height:12px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(${c1},${c2} 60%,#c2410c)`, 7, 30, 620, { up: -46, size: 10 }); break
      case 'water': scatterAt(c, blob('#93c5fd', 7), 9, 44, 520, { gravity: 40, size: 7 }); break
      case 'electric': for (let i = 0; i < 4; i++) { const a = rnd(0, Math.PI * 2); boltLine(c, { x: c.x + Math.cos(a) * 44, y: c.y + Math.sin(a) * 36 }, c2, 180, 6, i * 25) } break
      case 'ice': scatterAt(c, `width:8px;height:14px;clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%);background:linear-gradient(#fff,${c2})`, 9, 46, 520, { spin: 360, size: 10 }); break
      case 'grass': scatterAt(c, 'width:12px;height:8px;border-radius:0 100% 0 100%;background:#4ade80', 8, 46, 620, { spin: 400, gravity: 20, size: 12 }); break
      case 'poison': scatterAt(c, `width:10px;height:10px;border-radius:50%;border:2px solid ${c2};background:${c1}55`, 7, 30, 640, { up: -40, size: 10 }); break
      case 'rock': case 'ground': scatterAt(c, `width:9px;height:8px;border-radius:30%;background:${type === 'rock' ? '#a8a29e' : '#a16207'}`, 9, 44, 560, { gravity: 46, spin: 300, size: 9 })
        part(c.x - 40, c.y + 22, 'width:80px;height:20px;border-radius:50%;background:radial-gradient(ellipse,rgba(214,184,120,.8),transparent 70%)', [{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520 }); break
      case 'psychic': ringAt(c, c2, 70, 420, 3, 80); break
      case 'ghost': case 'dark': scatterAt(c, `width:18px;height:18px;border-radius:50%;background:radial-gradient(${type === 'ghost' ? '#a78bfa' : '#52525b'},transparent 70%)`, 6, 26, 700, { up: -36, size: 18 }); break
      case 'fairy': for (let i = 0; i < 5; i++) twinkle({ x: c.x + rnd(-36, 36), y: c.y + rnd(-34, 24) }, c2, rnd(12, 20), i * 45); break
      case 'steel': twinkle({ x: c.x + 14, y: c.y - 14 }, '#fff', 30, 40); break
      case 'dragon': ringAt(c, '#a5b4fc', 84, 360, 3, 60); break
      case 'fighting': ringAt(c, c2, 80, 300, 6); break
      case 'bug': scatterAt(c, blob('#a3e635', 5), 8, 40, 420, { size: 5 }); break
      case 'flying': scatterAt(c, 'width:6px;height:14px;border-radius:50%;background:#f8fafc;box-shadow:0 0 3px #94a3b8', 6, 40, 620, { gravity: 30, spin: 300, size: 8 }); break
    }
  }
  /** One ball per Pokémon: red while it can fight, grey once fainted, glowing for the one out now. */
  function drawBalls(el, team, out = []) {
    const html = team.map((m) => `<i class="${m.hp <= 0 ? 'down' : out.includes(m) ? 'cur' : ''}"></i>`).join('')
    if (el.__html !== html) { el.innerHTML = html; el.__html = html }
  }
  /**
   * Keeps both rows up to date for as long as `alive()` says the battle's
   * on screen: every quarter second it redraws from the teams' current HP,
   * so faints, switches and send-outs all show without each one having to.
   */
  function watchBalls(eEl, pEl, sides, alive) {
    const tick = () => {
      if (!live() || !alive()) { eEl.hidden = pEl.hidden = true; return }
      const s = sides(); eEl.hidden = !s.enemy; pEl.hidden = false
      if (s.enemy) drawBalls(eEl, s.enemy, s.enemyOut)
      drawBalls(pEl, s.mine, s.mineOut)
      setTimeout(tick, 250)
    }
    tick()
  }
  const ACC_CLS = { PERFECT: 'gold', GREAT: 'green', GOOD: 'blue', OK: 'small', MISS: 'red small' }
  /** Little rising sparks (heals) or arrows (stat boosts) from a Pokémon at `c`. */
  function rise(c, color, kind) {
    for (let i = 0; i < (kind === 'arrow' ? 3 : 8); i++) {
      const d = document.createElement('div')
      if (kind === 'arrow') { d.className = 'uparrow'; d.style.left = (c.x - 24 + i * 18) + 'px'; d.style.top = (c.y + 10) + 'px' }
      else d.style.cssText = `position:absolute;left:${c.x - 30 + (i * 37) % 60}px;top:${c.y + 20}px;width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color}`
      fx.appendChild(d); anim(d, [{ transform: 'translateY(0)', opacity: kind === 'arrow' ? 0 : 1 }, { opacity: 1, offset: .3 }, { transform: 'translateY(-64px)', opacity: 0 }], { duration: 700, delay: i * (kind === 'arrow' ? 90 : 50) })
      setTimeout(() => d.remove(), 900 + i * 90)
    }
  }
  /**
   * Your trainer level. The full app would track it on its own; here your
   * best Pokémon's level stands in for it.
   */
  const trainerLevel = () => Math.max(1, ...party.map((m) => m.level))
  /**
   * A scalper's Pokémon for one battle, drawn from their pool: only ones they
   * can have at your trainer level, at about your level. How many they carry
   * grows with you: 1 below Lv 10, 1-2 from Lv 10, 2-3 from Lv 20. `force`
   * names them outright (the demos).
   */
  /*
   * Opponent levels, set around your lead Pokémon (the first one in your party
   * that can fight), so your strongest doesn't make every fight hard for the
   * rest. Herb and Paul: 1 below to 1 above. Everyone else (the everyday
   * trainers, Brian): 2 to 3 below. A trainer's ace, their last Pokémon, is one
   * above the rest. Gym leaders, the Elite Fours, Red, Alex, Herb and Paul's
   * story battles have set levels (leaderLevels). Aim: you win about 3
   * trainer battles in 4.
   *
   * Trainers (and wild Pokémon) only keep pace with you up to a few levels
   * below your next challenge, though: never above its ace less its `gap` (3
   * at the Johto gyms, widening to 8 before Red; the next gym leader, the
   * Elite Four member you're on, or, in the Kanto League, the member you're
   * on there). Training up for a gym still works; out-levelling it to farm
   * doesn't pay as well, since their Pokémon stop growing and EXP follows
   * the foe's level.
   */
  const leadLevel = () => (party.find((m) => m.hp > 0) ?? party[0])?.level ?? 5
  // Balanced from Lv 10 (tests/rpg/sim.mjs): Herb and Paul at your level to 2 above, everyone else 1 below to even; gentler before that.
  const levelBand = (T, lv = leadLevel()) => (T === HERB || T === PAUL ? (lv < 10 ? [-1, 1] : [0, 2]) : (lv < 10 ? [-3, -2] : [-1, 0]))
  /**
   * The highest a trainer's ace (or a wild Pokémon) can be: the next
   * challenge's `gap` below its ace, so everyday battles stay below the
   * upcoming gym (Falkner: Lv 10). No cap once there's no challenge left.
   */
  function trainerCap() {
    const n = nextChallenge(badges, champion)
    const L = n === 'elite' ? ELITE[eliteStep] : n != null ? GYMS[n] : leagueNow() === 'kanto' ? KANTO_ELITE[kantoStep] : null
    return L ? L.min - L.gap : LEVEL_CAP
  }
  /**
   * A wild Pokémon's level: up to 3 below your lead, and, like a trainer's,
   * never above your next challenge's (trainerCap()). Roaming legendaries keep
   * their own level.
   */
  function wildLevel(species) {
    // Not capped at the species' evolution level any more: one caught above it evolves at its next level-up.
    return Math.max(2, Math.min(LEVEL_CAP, trainerCap(), leadLevel() - 3 + Math.floor(Math.random() * 4)))
  }
  function deckFor(T, lv, force) {
    const tl = trainerLevel()
    const names = force ?? (() => {
      const size = rand() < 0.5 ? 2 : 3   // every trainer brings two or three
      // What your level has unlocked from their pool, topped up with the next in line when that's fewer than they bring.
      const pool = [...POOLS[T.short]].sort((a, b) => a.min - b.min), out = []
      const avail = pool.filter((p) => p.min <= tl).map((p) => p.name)
      for (const p of pool) if (avail.length < size && !avail.includes(p.name)) avail.push(p.name)
      while (out.length < Math.min(size, avail.length)) { const n = avail[Math.floor(rand() * avail.length)]; if (!out.includes(n)) out.push(n) }
      return out
    })()
    // Levels from the band for this kind of trainer, around `lv` (your lead); their ace, last, one above the rest,
    // and never above your next challenge's (trainerCap()).
    const [lo, hi] = levelBand(T, lv), base = Math.min(lv + lo + Math.floor(rand() * (hi - lo + 1)), trainerCap() - 1)
    return names.map((n, i) => individual(DATA.trainer.find((t) => t.name === n), Math.max(2, Math.min(LEVEL_CAP, base + (i === names.length - 1 && names.length > 1 ? 1 : 0))), rand))
  }
  /** A partner's timing ring, tapped by them: usually GREAT, sometimes PERFECT, now and then GOOD. */
  async function autoTap(cx, cy, label, approach = 820) {
    const rg = ring(cx, cy, approach, label), q = flavor(), dt = q < 0.35 ? 20 : q < 0.85 ? 90 : 180
    await W(approach - dt)
    const acc = accuracy(dt)
    rg.el.getAnimations().forEach((a) => a.pause()); rg.el.style.borderColor = acc.color
    await W(dt + 240); rg.clear()
    return acc
  }
  /** Scalpers turning up at the machine: one or two of them, then BLOCKED! Returns the second figure (to remove later). */
  async function campOut(crew) {
    $('homeLoiterer').src = ART[crew[0].body]; $('homeLoiterer').style.display = 'block'
    anim($('homeLoiterer'), [{ transform: 'translateX(220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' })
    let second = null
    if (crew[1]) {
      second = $('homeLoiterer').cloneNode(); second.id = 'homeLoiterer2'; second.src = ART[crew[1].body]; second.classList.add('second'); $('homeLoiterer').after(second)
      anim(second, [{ transform: 'translateX(-220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, delay: 120, fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)' })
    }
    await W(700)
    $('home').classList.add('blocked')
    $('homeLine').textContent = 'BLOCKED!'; $('homeSub').textContent = crew[1] ? `${crew[0].short} and ${crew[1].short} are camping the machine` : `${crew[0].short} is camping the machine`
    sfx('blocked'); const b = bangOn($('home'), 214, 92); await W(700); b.remove()
    return second
  }
  /** The VS splash for a 2v2: the tag team's split portrait, or one scalper's. */
  function vsSplash(crew, onField) {
    const vs = $('vs'); vs.style.display = 'block'
    if (crew[1]) {
      $('vsImg').src = ART[crew[1].vs]; $('vsName').textContent = `${crew[0].short} & ${crew[1].short}`; vs.classList.add('duo')   // whoever the pair is
      const two = $('vsImg').parentElement.cloneNode(true); two.classList.add('who2'); two.querySelector('img').removeAttribute('id'); two.querySelector('img').src = ART[crew[0].vs]; $('vsImg').parentElement.before(two)
      vs.querySelector('.name span').textContent = 'TAG TEAM · 2 VS 2'
      anim(two, [{ transform: 'translateX(-260px)' }, { transform: 'none' }], { duration: 420, delay: 520, fill: 'both', easing: 'cubic-bezier(.2,.8,.3,1)' })
    } else {
      $('vsImg').src = ART[crew[0].vs]; $('vsName').textContent = crew[0].full
      vs.querySelector('.name span').textContent = `${crew[0].easy ? 'RESELLER · ' : ''}DOUBLE BATTLE · ${onField} VS 2`
    }
    vsIn(vs)
  }
  /** The same splash in blue for someone on your side, with ALLY where VS goes. */
  function allySplash(T, sub) {
    const vs = $('vs'); vs.classList.add('ally'); vs.style.display = 'block'
    $('vsImg').src = ART[T.vs]; $('vsName').textContent = T.full; vs.querySelector('.name span').textContent = sub; vs.querySelector('.big').textContent = 'ALLY'
    vsIn(vs)
  }
  function vsHide() {
    const vs = $('vs'); vs.style.display = 'none'; vs.getAnimations({ subtree: true }).forEach((a) => a.cancel())
    vs.querySelector('.who2')?.remove(); vs.querySelector('.name span').textContent = 'SCALPER'; vs.querySelector('.big').textContent = 'VS'
    vs.classList.remove('duo', 'ally', 'gym')
  }
  /** "HERB sent out GHOLDENGO!", or, for Brian, what he thinks it's called. */
  const sentOut = (T, mon) => T.calls?.[mon.name] ? [`${T.short} sent out "${T.calls[mon.name]}"!`, `(It's ${mon.name}.)`] : [`${T.short} sent out`, `${mon.name}!`]
  /** A wasted turn from a scalper who doesn't know what they're doing: true if it happened. */
  async function blunder(T, mon) {
    if (!T?.blunder || flavor() >= T.blunder) return false
    await blunderLine(T, mon)
    return true
  }
  async function blunderLine(T, mon) {
    const [a, b] = pickOf(T.blunders).map((x) => x.replaceAll('{mon}', mon.name))
    sfx('blocked'); await say(a, b, READ_MS)
  }
  /**
   * What a beaten scalper leaves behind. The tokens are paid by the caller and
   * always come; these are only sometimes there: a Potion (or a Super Potion)
   * about a third of the time, a booster pack about one time in seven (in the
   * app a real one, into your collection), and now and then an evolution
   * item. Move Discs aren't dropped: they come from Gym Leaders and the VVM.
   */
  async function loot(T) {
    const got = []
    if (flavor() < 0.35) { const k = flavor() < 0.25 ? 'super' : 'potion'; bag[k]++; got.push(`a ${ITEMS[k].name}`) }
    if (flavor() < 0.15) { const p = await givePack('trainer'); if (p) got.push(p) }
    if (flavor() < 0.08) { const k = pickOf(EVO_DROPS); bag[k] = (bag[k] ?? 0) + 1; got.push(`a ${ITEMS[k].name}`) }
    if ((T === HERB || T === PAUL) && flavor() < 0.1) { bag.rarecandy = (bag.rarecandy ?? 0) + 1; got.push('a RARE CANDY') }   // Team Unemployed's everyday battles, 1 in 10
    renderTools()
    if (got.length) { sfx('click'); await say(`${T.short} dropped`, `${got.join(' and ')}!`, 700) }
  }
  /** Rare Candy as a battle reward: Gym Leaders, Alex and Herb's and Paul's story battles hand one over (or more). */
  async function giveCandy(T, n = 1) {
    bag.rarecandy = (bag.rarecandy ?? 0) + n; renderTools()
    sfx('click'); await say(`${T.short} gave you`, n === 1 ? 'a RARE CANDY!' : `${n} RARE CANDIES!`, 700)
  }
  /** A Move Disc a Gym Leader hands over: one of their type you don't have yet, if there is one. */
  function gymDisc(L) {
    const mine = DISC_POOL.filter((n) => moveInfo(n).type === L.type), fresh = mine.filter((n) => !bag[discKey(n)])
    const n = pickOf(fresh.length ? fresh : mine.length ? mine : DISC_POOL)
    discItem(n); return n
  }
  /** After an attack's announcement, presses this soon (ms) don't count yet: a double tap on the text isn't an early parry. */
  const DEFEND_SETTLE_MS = 200
  /** How long a foe's move name stays up before its attack starts: time to read it and pick parry, dodge or jump. */
  const READ_MS = demo ? 850 : 1150

  /**
   * The timing target for an attack you have to JUMP: not the white ring
   * around the body but an amber oval closing in on the ground at the
   * Pokémon's feet, with chevrons pointing up. `fy` is where the feet are.
   */
  function groundRing(cx, fy, approach) {
    const W2 = 112, H2 = 30
    const box = `left:${cx - W2 / 2}px;top:${fy - H2 / 2}px;width:${W2}px;height:${H2}px`
    const t = document.createElement('div'); t.className = 'target low'; t.style.cssText = box
    const r = document.createElement('div'); r.className = 'ring low'; r.style.cssText = box
    const g = document.createElement('div'); g.className = 'glyph low'; g.textContent = 'JUMP'; g.style.left = cx + 'px'; g.style.top = (fy + H2 / 2 + 2) + 'px'
    const chev = [0, 1, 2].map((i) => { const c = document.createElement('div'); c.className = 'chev'; c.style.left = (cx - 8) + 'px'; c.style.top = (fy - 34 - i * 12) + 'px'; return c })
    fx.append(t, r, g, ...chev)
    anim(r, [{ transform: 'scale(2.4)', opacity: .15 }, { transform: 'scale(1)', opacity: 1 }], { duration: approach, easing: 'linear' })
    chev.forEach((c, i) => c.animate([{ transform: 'translateY(6px)', opacity: 0 }, { opacity: 1, offset: .4 }, { transform: 'translateY(-8px)', opacity: 0 }], { duration: 520, delay: i * 120, iterations: Infinity }))
    return { el: r, clear: () => { t.remove(); r.remove(); g.remove(); chev.forEach((c) => c.remove()) } }
  }

  /**
   * EXP for one Pokémon, filling `bar` (its HUD's EXP bar) as it goes and
   * rolling over on a level-up: new stats, the HP it gained added on, and a
   * call to `onLevel` so the HUD can redraw its level and HP.
   */
  /**
   * The EXP. SHARE (a key item): every Pokémon in the party that didn't fight
   * gets half of each foe's EXP, as long as it hasn't fainted. Given quietly,
   * with one line for the lot; only level-ups and new moves are announced.
   */
  async function shareExp(amount, fought) {
    if (!bag.expshare || !shareOn) return
    const rest = party.filter((m) => m.hp > 0 && !fought.includes(m)); if (!rest.length) return
    const half = Math.max(1, Math.round(amount / 2))
    await say(`The rest of your party got ${half} EXP.`, 'thanks to the EXP. SHARE.', 300)
    for (const m of rest) {
      m.exp ??= 0; addBond(m, 4)
      let left = half
      while (left > 0 && m.level < LEVEL_CAP) {
        const need = expToNext(m.level), take = Math.min(left, need - m.exp)
        m.exp += take; left -= take
        if (m.exp < need) break
        const hpBefore = m.stats.hp
        m.level++; m.exp = 0; m.stats = statsAt(m, m.level); m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore))
        sfx('levelup'); await say(`${m.name} grew to`, `Lv. ${m.level}!`, 500)
        if (evoDue(m)) pendingEvos.add(m)
        for (const r of learnAtLevel(m)) await say(`${m.name} learned ${r.name}!`, r.equipped ? '' : 'Swap it in from the Box.', 500)
      }
    }
    renderTools()
  }
  async function gainExp(m, amount, bar, onLevel) {
    m.exp ??= 0
    addBond(m, 10)   // fought in it
    await say(`${m.name} gained`, `${amount} EXP. Points!`, 180)
    let left = amount
    while (left > 0) {
      const need = expToNext(m.level), take = Math.min(left, need - m.exp)
      const a = m.exp / need * 100; m.exp += take; left -= take
      const b = m.exp / need * 100
      sfx('exp')
      if (bar) {
        bar.getAnimations().forEach((x) => x.cancel())
        const A = anim(bar, [{ width: a + '%' }, { width: b + '%' }], { duration: 300 + (b - a) * 10, easing: 'linear' })
        await A.finished; bar.style.width = b + '%'; A.cancel()
      } else await W(250)
      if (m.exp >= need) {
        const hpBefore = m.stats.hp
        m.level++; m.exp = 0; m.stats = statsAt(m, m.level); m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore))
        sfx('levelup')
        if (bar) { anim(bar.parentElement, [{ boxShadow: '0 0 0 2px #fde047, 0 0 10px #fde047' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 700 }); await W(250); bar.style.width = '0%' }
        onLevel?.(m)
        await say(`${m.name} grew to`, `Lv. ${m.level}!`, 600)
        if (evoDue(m)) pendingEvos.add(m)   // evolves after the battle
        for (const r of learnAtLevel(m)) { sfx('levelup'); await say(`${m.name} learned ${r.name}!`, r.equipped ? '' : 'Swap it in from the Box.', 700) }
      }
    }
    renderTools()
  }

  /* ══════════ 2v2: the framework ══════════
   * Two Pokémon a side. Each turn every Pokémon on the field picks an action,
   * then they all resolve in order: priority bracket first (Helping Hand +5,
   * After You +4, Quick Attack +1), then Speed (Tailwind doubles it), ties at
   * random. Ring timing carries over: STRIKE at the foe you picked, defend
   * (parry / dodge / jump) at whichever of yours is targeted, and support
   * moves get an ASSIST ring that sets how strong the effect is.
   * Not in yet: items, switching, running, and trainers with more than one
   * Pokémon each - the shapes below (slots, bench, side state) leave room.
   */
  const DUO_AT = {
    e: [{ x: 194, y: 118, maxH: 92, maxW: 104, scale: 1.3 }, { x: 266, y: 108, maxH: 84, maxW: 94, scale: 1.2 }],
    p: [{ x: 58, y: 206, maxH: 118, maxW: 118, scale: 1.7 }, { x: 146, y: 200, maxH: 110, maxW: 108, scale: 1.6 }],
  }
  const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s))

  /**
   * `foes`: [{ mon, owner }] on the field at the start (one or two). `bench`:
   * the same, waiting; when one of an owner's Pokémon faints they send the
   * next (in a solo double, any of theirs).
   */
  async function duoBattle(o) { try { return await duoBattleCore(o) } finally { restoreForms() } }
  async function duoBattleCore({ foes, bench: foeBench = [], trainers, allies = [], tips = null, plan }) {
    // Tips: what a partner says the first time each thing happens (TUTORIAL_TIPS).
    const shownTips = new Set()
    const tip = async (k) => { if (!tips?.[k] || shownTips.has(k)) return; shownTips.add(k); await talk(tips.who, tips[k]) }
    plan = plan ? plan.map((t) => ({ ...t, cmds: [...(t.cmds ?? [])], foes: { ...(t.foes ?? {}) }, defend: [...(t.defend ?? [])] })) : null
    const ts = $('ts'), made = []
    const mk = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; ts.appendChild(d); made.push(d); return d }
    const sides = { p: { slots: [], tailwind: 0 }, e: { slots: [], tailwind: 0 } }
    const st = new Map()   // per Pokémon, for this battle: stat stages, Helping Hand boost
    const S = (m) => { if (!st.has(m)) st.set(m, { atk: 0, spa: 0, spe: 0, boost: 1, acc: 0, eva: 0 }); return st.get(m) }
    let dpp = 0
    let weather = null   // { kind: 'rain' | 'sun', turns }
    $('battleL').dataset.wx = ''
    const ppChip = mk('dpp', 'PP ' + '<i></i>'.repeat(5))
    const setDPP = (n, gained) => {
      dpp = Math.max(0, Math.min(5, n)); [...ppChip.querySelectorAll('i')].forEach((p, i) => p.classList.toggle('on', i < dpp))
      if (gained) { sfx('pp'); anim(ppChip, [{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260 }) }
    }
    setDPP(0)

    /* ── the field ── */
    function hudHtml(s) {
      const m = s.mon
      return `<div class="row"><span>${m.name}${s.owner?.ally ? `<em class="own">${s.owner.short}</em>` : ''}</span><span class="lv">Lv${m.level}</span></div>` +
        `<div class="hpl"><b>HP</b><div class="hpb"><i style="width:${m.hp / m.stats.hp * 100}%;background:${hpColor(m.hp / m.stats.hp * 100)}"></i></div></div>` +
        (s.side === 'p' ? `<div class="dhn">${m.hp}/${m.stats.hp}</div><div class="exp"><i style="width:${(m.exp ?? 0) / expToNext(m.level) * 100}%"></i></div>` : '') + `<div class="tags"></div>`
    }
    function tags(s) {
      const t = S(s.mon), out = [...statTags(t)]
      if (sides[s.side].tailwind) out.push('TAILWIND')
      if (sides[s.side].reflect) out.push('REFLECT')
      if (sides[s.side].light) out.push('L.SCREEN')
      if (t.protect) out.push('PROTECT')
      if (t.taunt) out.push('TAUNT')
      if (t.boost > 1) out.push('HELPED')
      out.push(...stageTags(t), ...volTags(t))
      s.hud.querySelector('.tags').innerHTML = statusChip(s.mon) + out.map((x) => `<span>${x}</span>`).join('')
    }
    const retag = () => [...sides.p.slots, ...sides.e.slots].forEach((s) => s.mon.hp > 0 && tags(s))
    async function hpTo(s, to) {
      const m = s.mon, from = m.hp; m.hp = Math.max(0, Math.min(m.stats.hp, to))
      const bar = s.hud.querySelector('.hpb i'), a = from / m.stats.hp * 100, b = m.hp / m.stats.hp * 100
      const dur = Math.min(650, 160 + Math.abs(from - m.hp) * 36)
      anim(bar, [{ width: a + '%', background: hpColor(a) }, { width: b + '%', background: hpColor(b) }], { duration: dur })
      const n = s.hud.querySelector('.dhn')
      if (n) { const steps = Math.max(1, Math.abs(from - m.hp)); for (let i = 1; i <= steps; i++) { await W(dur / steps); n.textContent = `${Math.round(from + (m.hp - from) * i / steps)}/${m.stats.hp}` } } else await W(dur)
      renderTools()
    }
    async function enter(side, i, mon, owner = null) {
      const at = DUO_AT[side][i]
      const el = mk(`mon duo ${side}${i}`, '<img alt="">')
      el.style.opacity = '0'   // hidden while its image loads; it used to show, then pop in again
      const r = await place(el, spr(mon, side === 'p'), at.x, at.y, at.scale, at.maxH, at.maxW)
      st.delete(mon); mon.toxN = 0   // a fresh start: no stages, confusion or seed, and bad poison counts from 1 again
      const s = { side, i, mon, owner, ally: !!owner?.ally, el, c: { x: r.x, y: Math.min(r.y, side === 'p' ? 196 : 200) }, hud: mk(`hud dh ${side}${i}`), turns: 0 }
      s.hud.innerHTML = hudHtml(s); s.hud.style.opacity = '0'; sides[side].slots[i] = s; tags(s)
      sfx('ball'); flash('#fff', .35, 140)
      cry(mon); await anim(el, [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 360 }).finished
      // In for good: drop the load-time opacity 0, or the next effect that cancels this sprite's animations would hide it again.
      el.style.opacity = ''; el.getAnimations().forEach((x) => x.cancel())
      anim(s.hud, [{ transform: `translateX(${side === 'p' ? 180 : -180}px)`, opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 260 })
      return s
    }
    const alive = (side) => sides[side].slots.filter((s) => s && s.mon.hp > 0)
    /** One of yours fainted: which of the bench goes in (your pick when there's a choice; the demo takes the first). */
    async function pickIncoming(list) {
      if (demo || list.length < 2) return list[0]
      $('pParty').classList.remove('six')
      $('pParty').innerHTML = [0, 1, 2, 3].map((i) => { const m = list[i]; if (!m) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const pct = m.hp / m.stats.hp * 100
        return `<button class="btn fm${i} t-party pmon" data-act="p${i}"><img src="${spr(m)}" alt=""><span style="flex:1;min-width:0">${m.name}<small>${m.hp}/${m.stats.hp} HP</small><span class="hpm"><i style="width:${pct}%;background:${hpColor(pct)}"></i></span></span></button>` }).join('')
      panel('pParty'); msg0('Send out which Pokémon?', '')
      const p = await pick('pParty', null); panel(null)
      return list[+p.slice(1)]
    }
    const allyOf = (s) => sides[s.side].slots.find((x) => x && x !== s && x.mon.hp > 0)
    const other = (side) => (side === 'p' ? 'e' : 'p')
    const bench = () => party.filter((m) => m.hp > 0 && !sides.p.slots.some((s) => s?.mon === m))

    /* ── openers ── */
    $('msg').style.display = 'block'
    await say(`${trainers.map((t) => t.short).join(' and ')}`, trainers.length > 1 ? 'want to battle!' : 'wants to battle!', 300)
    for (let i = 0; i < foes.length; i++) { await say(...sentOut(foes[i].owner, foes[i].mon), 60); await enter('e', i, foes[i].mon, foes[i].owner) }
    if (foes.length === 1) await say(`${foes[0].owner.short} only has`, 'one Pokémon ready. 2 on 1!', 300)
    // Yours fill the slots a partner isn't using.
    const firstTwo = party.filter((m) => m.hp > 0).slice(0, 2 - allies.length)
    await say(`Go! ${firstTwo.map((m) => m.name).join(' and ')}!`, '', 80)
    for (let i = 0; i < firstTwo.length; i++) await enter('p', i, firstTwo[i])
    for (const [j, a] of allies.entries()) { await say(...sentOut(a.owner, a.mon), 80); await enter('p', firstTwo.length + j, a.mon, a.owner) }
    // The shared pool starts with what each of yours brings: 1, or 2 for a quick nature.
    setDPP(firstTwo.reduce((n, m) => n + startPP(m), 0), true)

    // Each side's whole team (started once the field and its helpers exist): on the field and on the bench. A partner's Pokémon aren't yours.
    const foeTeam = [...foes.map((f) => f.mon), ...foeBench.map((b) => b.mon)]
    const eRow = mk('balls ebs duo'), pRow = mk('balls pbs duo')
    watchBalls(eRow, pRow, () => ({ enemy: foeTeam, enemyOut: alive('e').map((s) => s.mon), mine: party, mineOut: alive('p').filter((s) => !s.ally).map((s) => s.mon) }), () => eRow.isConnected)

    /* ── damage, with stages and Helping Hand ── */
    function dmgOf(att, def, mv, mult) {
      const key = mv.cat === 'spec' ? 'spa' : 'atk', side = slotOf(def)?.side
      mult *= weatherMult(weather?.kind, mv.type) * (side && sides[side][mv.cat === 'spec' ? 'light' : 'reflect'] ? 0.5 : 1)
      const A = (mv.cat === 'spec' ? att.stats.spa : att.stats.atk) * stageMult(S(att)[key]), D = (mv.cat === 'spec' ? def.stats.spd : def.stats.def) * stageMult(S(def)[mv.cat === 'spec' ? 'spd' : 'def'] ?? 0)
      const base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * mv.power * A / D) / 50) + 2
      const stab = att.types.includes(mv.type) ? 1.5 : 1, eff = soften(gameMult(mv.type, def.types))
      const burn = att.status === 'brn' && mv.cat !== 'spec' ? 0.5 : 1
      return { dmg: Math.max(1, Math.round(base * stab * eff * mult * S(att).boost * burn)), eff }
    }
    const speed = (s) => s.mon.stats.spe * stageMult(S(s.mon).spe) * (sides[s.side].tailwind ? 2 : 1) * (s.mon.status === 'par' ? 0.5 : 1)
    const slotOf = (m) => [...sides.p.slots, ...sides.e.slots].find((x) => x && x.mon === m && !x.gone)
    async function afflict(s, st) {
      if (!s || !st || !canTake(s.mon, st)) return false
      setStatus(s.mon, st, rand); tags(s); sfx(STATUS_SFX[st])
      await say(s.mon.name, STATUS_GOT[st], 350); return true
    }
    /** At its turn: can it move? Flinch, sleep (yours: mash A to wake), freeze, paralysis, then confusion. */
    async function blockedByStatus(s) {
      const t = S(s.mon)
      if (t.recharge) { t.recharge = false; await say(`${s.mon.name} must`, 'recharge!', 400); return true }
      if (t.flinch) { t.flinch = false; await say(s.mon.name, "flinched and couldn't move!", 400); return true }
      if (s.side === 'p' && !s.ally && s.mon.status === 'slp' && !demo && (await mashWake(s.c))) { s.mon.status = null; tags(s); await say(s.mon.name, 'woke up!', 300) }
      else {
        const r = statusAtAction(s.mon, rand)
        if (r) { tags(s); await say(s.mon.name, STATUS_TEXT[r], r === 'thaw' || r === 'wake' ? 250 : 450); if (r !== 'thaw' && r !== 'wake') return true }
      }
      if (t.conf) {
        if (!--t.conf) { tags(s); await say(s.mon.name, 'snapped out of its confusion!', 300); return false }
        sfx('shadow'); await say(s.mon.name, 'is confused!', 250)
        if (rand() < 1 / 3) { sfx('hit'); await Promise.all([blink(s.el, 2), hpTo(s, s.mon.hp - confusionDmg(s.mon, t.atk))]); await say('It hurt itself', 'in its confusion!', 350); return true }
      }
      return false
    }
    /** A sleep, poison, confusion, Leech Seed or Yawn move from `user` on `T`. False if it failed. */
    async function applyStatusMove(mv, user, T, acc) {
      const t = S(T.mon)
      if (mv.effect === 'status') return statusLands(mv, acc, rand) && afflict(T, mv.status)
      if (mv.effect === 'confuse' || mv.effect === 'swagger') {
        if (mv.effect === 'swagger' && acc.label !== 'MISS') { t.atk = Math.min(6, t.atk + 2); tags(T); buffFx(T); await say(`${T.mon.name}'s ATTACK`, 'rose sharply!', 250) }
        if (t.conf || !statusLands(mv, acc, rand)) return false
        t.conf = 2 + Math.floor(rand() * 3); sfx('shadow'); tags(T); await say(T.mon.name, 'became confused!', 300); return true
      }
      if (mv.effect === 'seed') {
        if (t.seeded || T.mon.types.includes('grass') || !statusLands(mv, acc, rand)) return false
        t.seeded = user; sfx('whoosh'); rise(T.c, '#86efac', 'dot'); tags(T); await say(T.mon.name, 'was seeded!', 300); return true
      }
      if (mv.effect === 'yawn') {
        if (t.drowsy || !canTake(T.mon, 'slp') || !statusLands(mv, acc, rand)) return false
        t.drowsy = 2; sfx('shadow'); tags(T); await say(T.mon.name, 'grew drowsy!', 300); return true
      }
      return false
    }

    /* ── choosing ── */
    function pick(panelId, scripted) {
      return new Promise((resolve, reject) => {
        if (demo) {
          setTimeout(() => { if (!live()) return reject(STOP); hot($(panelId).querySelector(`[data-act="${scripted}"]`)); sfx('select'); setTimeout(() => resolve(scripted), 200) }, 700)
          return
        }
        const cleanup = () => { $(panelId).removeEventListener('pointerdown', onTap); $(panelId).removeEventListener('click', onTap); offKey() }
        const onTap = (e) => {
          const b = e.target.closest('[data-act]'); if (!b || (e.type === 'click') !== !!b.closest('.bagscroll')) return   // the scrolling list answers clicks
          if (b.disabled || b.classList.contains('off') || !live()) return
          e.preventDefault(); hot(b); cleanup(); sfx('select'); resolve(b.dataset.act)
        }
        const offKey = listen((k) => { if (k === 'b' && $(panelId).querySelector('[data-act="back"]:not([disabled])')) { cleanup(); resolve('back') } })
        $(panelId).addEventListener('pointerdown', onTap); $(panelId).addEventListener('click', onTap)
      })
    }
    function drawMoves(s, budget, canBack) {
      const ms = duoMovesOf(s.mon), ally = allyOf(s)
      $('pFight').innerHTML = [0, 1, 2, 3].map((i) => ms[i]).map((n, i) => {
        if (!n) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const m = moveInfo(n), noAlly = (m.target === 'ally' && !ally) || (m.kind === 'support' && !!S(s.mon).taunt)
        const sub = m.kind === 'support' ? (S(s.mon).taunt ? 'taunted' : m.sub) : m.spread ? `${m.spread === 'all' ? 'ALL · hits partner' : 'BOTH FOES'} · PP ${m.cost}` : `${m.type.toUpperCase()}${m.hits ? ` · ${m.hits} HITS` : ''}${m.prio ? ' · FIRST' : ''} · ${m.cost ? `PP ${m.cost}` : '+1 PP'}`
        return `<button class="btn fm${i} t-${m.type}${m.kind === 'support' ? ' sup' : ''}${m.cost > budget || noAlly ? ' off' : ''}" data-act="m${i}">${n}<small>${sub}</small></button>`
      }).join('') + `<button class="btn fback t-run" data-act="back">◀ BACK · PP is shared by both</button>`
    }
    function drawTargets(list) {
      $('pFight').classList.toggle('six', list.length > 4)   // an item on the bench: up to six to choose from
      $('pFight').innerHTML = list.map((t, i) => `<button class="btn fm${i} t-${t.mon.types[0]} tgt" data-act="t${i}"><img src="${spr(t.mon)}" alt=""><span>${t.mon.name}<small>${t.bench ? 'bench · ' : ''}${Math.round(t.mon.hp / t.mon.stats.hp * 100)}% HP</small></span></button>`).join('') +
        `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
    }
    async function commands(step) {
      const mine = alive('p').filter((s) => !s.ally), acts = []
      for (let k = 0; k < mine.length; k++) {
        const s = mine[k], scripted = step?.cmds?.[k]
        if (S(s.mon).recharge) { acts.push({ actor: s, move: { name: 'RECHARGE', kind: 'recharge', prio: 0, cost: 0 } }); continue }   // after a Hyper Beam: nothing to choose
        const spent = acts.reduce((n, a) => n + (a.move.cost ?? 0), 0)
        const undo = () => { const a = acts.pop(); if (a?.move.kind === 'item') { bag[a.move.item]++; renderTools() } }
        // FIGHT, BAG, POKéMON, and RUN (or BACK to your first Pokémon's choice).
        $('pMain').innerHTML = `<button class="btn bFight" data-act="fight">FIGHT</button><button class="btn bm3 a t-bag" data-act="bag">BAG</button>` +
          `<button class="btn bm3 b t-party" data-act="party">POKéMON</button>` + (k ? `<button class="btn bm3 c t-run" data-act="back">◀ BACK</button>` : `<button class="btn bm3 c t-run" data-act="run">RUN</button>`)
        panel('pMain'); msg0(`What will ${s.mon.name} do?`, k ? '' : 'Pick for each of yours, then it plays out.')
        s.el.classList.add('choosing')
        const top = await pick('pMain', scripted ? (scripted.menu ?? 'fight') : null)
        s.el.classList.remove('choosing')
        if (top === 'back') { undo(); k -= 2; continue }
        if (top === 'run') { panel(null); await say("There's no running", 'from a trainer battle!'); k--; continue }
        if (top === 'bag') {
          // Items go first, before any attack, and are spent as soon as they're chosen.
          // Potions only for someone who's hurt, as in 1v1: no wasting one on full HP. On the field or on the bench.
          const benched = bench().map((mon) => ({ mon, bench: true }))
          const hurt = [...alive('p').filter((x) => !x.ally && x.mon.hp < x.mon.stats.hp), ...benched.filter((b) => b.mon.hp < b.mon.stats.hp)]
          // Revive: anyone of yours who's fainted (and isn't already being revived this turn).
          const down = party.filter((m) => m.hp <= 0 && !acts.some((a) => a.move.item === 'revive' && a.target.mon === m)).map((mon) => ({ mon }))
          // Everything you have, scrolling. A cure lights up when one of yours has the status it fixes.
          const sickFor = (k) => [...alive('p').filter((x) => !x.ally), ...benched].filter((x) => x.mon.status && ITEMS[k].cure.includes(x.mon.status))
          $('pBag').classList.remove('six')
          $('pBag').innerHTML = bagPanel(BATTLE_ITEMS.filter((k) => bag[k] > 0).map((k) => {
            const it = ITEMS[k], ball = k === 'ball' || k === 'great'
            const off = ball || (it.revive ? !down.length : it.cure ? !sickFor(k).length : !hurt.length)
            const why = ball ? "not on a trainer's" : it.revive ? (down.length ? it.sub : 'nobody has fainted') : it.cure ? (sickFor(k).length ? it.sub : 'nobody has that status') : hurt.length ? it.sub : 'everyone is at full HP'
            return bagButton(k, bag[k], off, why)
          }))
          bagMore($('pBag'))
          panel('pBag'); msg0('Use which item?', 'Items go before any attack.')
          const it = await pick('pBag', scripted?.item ?? null)
          if (it === 'back') { k--; continue }
          const up = it === 'revive' ? down : ITEMS[it].cure ? sickFor(it) : hurt; let target = up[0]
          if (up.length > 1) {
            drawTargets(up); panel('pFight'); msg0(`${ITEMS[it].name}: on which one?`, '')
            const t = await pick('pFight', scripted ? 't' + (scripted.target ?? 0) : null)
            if (t === 'back') { k--; continue }
            target = up[+t.slice(1)]
          }
          const key = it
          bag[key]--; renderTools()
          acts.push({ actor: s, move: { name: ITEMS[key].name, kind: 'item', item: key, prio: 6, cost: 0 }, target })
          continue
        }
        if (top === 'party') {
          const free = bench().filter((m) => !acts.some((a) => a.to === m))
          if (!free.length) { panel(null); await say('There are no other Pokémon', 'ready to come in!'); k--; continue }
          $('pParty').innerHTML = [0, 1, 2, 3].map((i) => { const m = free[i]; if (!m) return `<button class="btn fm${i} t-empty" disabled>—</button>`
            const pct = m.hp / m.stats.hp * 100
            return `<button class="btn fm${i} t-party pmon" data-act="p${i}"><img src="${spr(m)}" alt=""><span style="flex:1;min-width:0">${m.name}<small>${m.hp}/${m.stats.hp} HP</small><span class="hpm"><i style="width:${pct}%;background:${hpColor(pct)}"></i></span></span></button>` }).join('') +
            `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
          panel('pParty'); msg0(`Switch ${s.mon.name} for?`, 'Switches go before any attack.')
          const p = await pick('pParty', scripted?.to ?? null)
          if (p === 'back') { k--; continue }
          acts.push({ actor: s, move: { name: 'SWITCH', kind: 'switch', prio: 6, cost: 0 }, to: free[+p.slice(1)] })
          continue
        }
        drawMoves(s, dpp - spent, true); panel('pFight'); msg0(`${s.mon.name}: which move?`, '')
        const ms = duoMovesOf(s.mon)
        const a = await pick('pFight', scripted ? 'm' + ms.indexOf(scripted.move) : null)
        if (a === 'back') { k--; continue }
        const move = moveInfo(ms[+a.slice(1)])
        let target = null
        if (move.spread) target = null   // spread moves hit everyone they can
        else if (move.kind === 'strike' || move.target === 'foe') {
          const foesUp = alive('e')
          if (foesUp.length > 1) {
            drawTargets(foesUp); msg0(`${move.name}: which one?`, '')
            const t = await pick('pFight', scripted ? 't' + (scripted.target ?? 0) : null)
            if (t === 'back') { k--; continue }
            target = foesUp[+t.slice(1)]
          } else target = foesUp[0]
        } else if (move.target === 'ally') target = allyOf(s)
        else target = s
        acts.push({ actor: s, move, target, planned: scripted?.planned })
      }
      panel(null); $('pFight').classList.remove('six')
      return acts
    }
    /** A partner's choice: Recover once when low, otherwise the attack that does most to either foe. */
    function allyCommands() {
      return alive('p').filter((s) => s.ally).map((s) => {
        const ms = s.owner.moves.map(moveInfo)
        const heal = ms.find((m) => m.effect === 'heal')
        if (heal && !s.healed && s.mon.hp < s.mon.stats.hp * 0.4) { s.healed = true; return { actor: s, move: heal, target: s } }
        let pick = null
        for (const m of ms.filter((x) => x.kind === 'strike')) for (const f of alive('e')) {
          const v = m.power * soften(gameMult(m.type, f.mon.types)) * (s.mon.types.includes(m.type) ? 1.5 : 1)
          if (!pick || v > pick.v) pick = { v, m, f }
        }
        return pick && { actor: s, move: pick.m, target: pick.f }
      }).filter(Boolean)
    }
    function foeCommands(step) {
      return alive('e').map((s) => {
        const scripted = step?.foes?.[s.mon.name]
        const atk = TRAINER_MOVES[s.mon.name] ?? WILD_MOVES[s.mon.types[0]] ?? WILD_MOVES.normal
        const heal = TRAINER_SUPPORT[s.mon.name]
        if (scripted?.move && SUPPORT[scripted.move]) return { actor: s, move: moveInfo(scripted.move), target: s }
        if (s.charged) { const up = alive('p'); return { actor: s, move: s.charged, target: up[Math.floor(rand() * up.length)] } }
        // Decided now, when it would pick a move: the wasted turn still happens in speed order.
        if (!scripted && s.owner?.blunder && flavor() < s.owner.blunder) return { actor: s, move: { name: 'BLUNDER', kind: 'blunder', prio: 0, cost: 0 } }
        if (!scripted && heal && s.mon.hp < s.mon.stats.hp * 0.45 && rand() < 0.7) return { actor: s, move: moveInfo(heal), target: s }
        // Now and then, once per Pokémon: its type's accuracy or evasion move.
        if (!scripted && !s.usedStatus && !S(s.mon).taunt && (window.__forceStatusMove || rand() < 0.1)) {
          // A move that would work on at least one of yours (aimed at one it works on), or on itself; with none, it attacks.
          const up = alive('p'), works = (n) => (SUPPORT[n]?.target === 'foe' ? up.some((x) => moveWorks(n, s.mon, x.mon, S, { weather: weather?.kind })) : moveWorks(n, s.mon, s.mon, S, { weather: weather?.kind, ...sides.e }))
          const sn = demo ? statusOf(s.mon) : foeStatusMove(s.mon, rand, !!s.owner?.hard, works)
          if (sn) {
            s.usedStatus = true; const sm = moveInfo(sn), fits = up.filter((x) => demo || moveWorks(sn, s.mon, x.mon, S, { weather: weather?.kind }))
            return { actor: s, move: sm, target: sm.target === 'foe' ? fits[Math.floor(rand() * fits.length)] ?? up[0] : s }
          }
        }
        s.turn = (s.turn ?? 0)
        let mv = (scripted?.move && atk.find((m) => m.name === scripted.move)) || atk[s.turn++ % atk.length]
        if (S(s.mon).disabled?.name === mv.name) mv = atk.find((m) => m.name !== mv.name) ?? mv   // Disable: it reaches for something else
        const up = alive('p')
        // Prefer whichever of yours the move hits hardest; otherwise either.
        const best = up.slice().sort((x, y) => soften(gameMult(mv.type, y.mon.types)) - soften(gameMult(mv.type, x.mon.types)))
        const target = scripted?.target != null ? (up[scripted.target] ?? up[0]) : !s.owner?.easy && rand() < 0.6 ? best[0] : up[Math.floor(rand() * up.length)]
        return { actor: s, move: { ...mv, kind: mv.kind ?? 'strike', foe: true }, target }
      })
    }

    /* ── resolving ── */
    /**
     * One hit of one of your attacks on one foe: its STRIKE ring, the visual,
     * the damage. Returns { eff, crit }, or null when a multi-hit move's ring
     * was missed (that hit whiffs).
     */
    /** A draining move in a 2v2: the slot that used it gets back `amt` HP. */
    async function sapSlot(s, amt) {
      const from = s.mon.hp; if (amt <= 0 || from <= 0 || from >= s.mon.stats.hp) return
      sfx('heal'); rise(s.c, '#86efac', 'dot')
      await hpTo(s, Math.min(s.mon.stats.hp, from + amt)); pop(`+${s.mon.hp - from}`, s.c.x + 30, s.c.y - 40, 'green')
      await say(`${s.mon.name} drained`, 'some HP!', 200)
    }
    async function hitOnce(actor, T, mv, planned, label, approach, mult, whiffOnMiss, h = 0) {
      if (S(T.mon).protect) { sfx('clang'); pop('PROTECTED', T.c.x, T.c.y - 70, 'blue'); await say(T.mon.name, 'protected itself!', 250); return null }
      let acc
      const sr = strikeRing(ringNet(S(actor.mon).acc, S(T.mon).eva)); approach = Math.round(approach * sr.speed)
      if (actor.ally) acc = await autoTap(T.c.x, T.c.y, label, approach)   // a partner hits their own ring
      else {
        await tip('strike')
        panel('pStrike'); $('bStrike').innerHTML = `${label === 'STRIKE' ? 'STRIKE!' : label}<small style="font-size:12px;margin-top:6px">tap as the ring closes</small><span class="key">A</span>`
        const conf = !!S(actor.mon).conf; wobble = conf   // confused: its rings wobble and its windows tighten
        veil = Math.max(0, S(T.mon).eva ?? 0)   // an evasive target: its rings flicker
        try { acc = await strikeInput(mv, h, T.c.x, T.c.y, label, approach, sr.tight * (conf ? 0.85 : 1), planned) } finally { wobble = false; veil = 0 }
        panel(null)
      }
      if (whiffOnMiss && acc.label === 'MISS') { pop('MISSED', T.c.x, T.c.y - 70, 'red small'); sfx('dodge'); return null }
      pop(`${acc.label} ×${acc.mult.toFixed(1)}`, T.c.x - 24, T.c.y - 72, ACC_CLS[acc.label])
      sfx(mv.snd); await strikeFx(mv, actor.c, T.c, actor.el, approach < 820)
      const { dmg, eff } = dmgOf(actor.mon, T.mon, mv, acc.mult * mult)
      const from = T.mon.hp
      sfx(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit'); if (eff > 1 || acc.crit) shake(5, 280)
      impactFx(T.c, mv.type, eff > 1 || acc.crit); hitReact(T.el, actor.c, T.c, mv.type, eff > 1 || acc.crit)
      if (eff > 1 || acc.crit) await hitStop(mv.type)
      await Promise.all([blink(T.el, 2), hpTo(T, from - dmg)])
      pop(`-${from - T.mon.hp}`, T.c.x + 30, T.c.y - 30, acc.crit ? 'gold' : '')
      if (mv.drain) await sapSlot(actor, Math.round((from - T.mon.hp) * mv.drain))
      if (mv.recoil && actor.mon.hp > 1) { await hpTo(actor, Math.max(1, actor.mon.hp - Math.max(1, Math.round((from - T.mon.hp) * mv.recoil)))); await say(actor.mon.name, 'is damaged by recoil!', 250) }
      if (T.mon.hp > 0 && T.mon.status === 'frz' && mv.type === 'fire') { T.mon.status = null; tags(T); await say(T.mon.name, STATUS_TEXT.thaw, 250) }
      if (T.mon.hp > 0) await afflict(T, statusFromHit(T.mon, mv, rand))
      if (T.mon.hp > 0 && FLINCH[mv.name] && (acc.label === 'PERFECT' || acc.label === 'GREAT') && chance() < FLINCH[mv.name]) S(T.mon).flinch = true
      if (mv.accDown && acc.label !== 'MISS' && T.mon.hp > 0) { const t = S(T.mon); if (t.acc > -STAGE_MAX) { t.acc--; tags(T); await say(`${T.mon.name}'s accuracy`, 'fell!', 250) } }
      return { eff, crit: acc.crit, label: acc.label }
    }

    async function strike(act, step) {
      const { actor, move: mv } = act
      const planned = [].concat(act.planned ?? 'great')
      const results = []
      if (mv.sleepOk && !act.snoring) { await announce(`${actor.mon.name} used`, `${mv.name}!`, 100); if (!actor.ally) setDPP(dpp - (mv.cost ?? 0)); await say('But it failed!', `${actor.mon.name} isn't asleep.`, 250); return }
      {
        // Power worked out now (the flags are cleared on the copy, so this runs once).
        const t = S(actor.mon); let m2 = mv
        if (mv.flail) m2 = { ...m2, power: flailPower(actor.mon) }
        if (mv.furyCutter) { t.fury = t.lastMove === mv.name ? Math.min(2, (t.fury ?? 0) + 1) : 0; m2 = { ...m2, power: mv.power * 2 ** t.fury } }
        if (mv.knockOff) m2 = { ...m2, power: Math.round(mv.power * 1.5) }   // a 2v2 is always against trainers
        t.lastMove = mv.name
        if (m2 !== mv) return strike({ ...act, move: { ...m2, flail: false, furyCutter: false, knockOff: false } }, step)
      }
      if (mv.firstTurn && actor.turns) {
        await announce(`${actor.mon.name} used`, `${mv.name}!`, 100); if (!actor.ally) setDPP(dpp - (mv.cost ?? 0))
        await say('But it failed!', `It only works on ${actor.mon.name}'s first turn out.`, 250); return
      }
      if (mv.spread) {
        const foesUp = alive('e'); if (!foesUp.length) return
        await announce(`${actor.ally ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, `${mv.name}! ${mv.spread === 'all' ? '(hits everyone else)' : '(hits both foes)'}`, 140)
        if (!actor.ally) setDPP(dpp - (mv.cost ?? 0))
        if (mv.fx === 'quake') { sfx('quake'); shake(9, 600) }
        // One ring per foe; with two of them each takes 0.75×.
        const mult = foesUp.length > 1 ? 0.75 : 1
        for (const [k, F] of foesUp.entries()) {
          if (F.mon.hp <= 0) continue
          results.push(await hitOnce(actor, F, mv, planned[k] ?? planned.at(-1), foesUp.length > 1 ? `FOE ${k + 1}/${foesUp.length}` : 'STRIKE', k ? 620 : 820, mult, false))
        }
        // Earthquake, Surf and the like roll on into your own partner. It can jump.
        const ally = mv.spread === 'all' ? allyOf(actor) : null
        if (ally) {
          await say(`It's coming at ${ally.mon.name} too!`, '', 120)
          await defendHit(ally, actor, { ...mv, kind: 'low' }, 0, step, 0.75, true)
        }
      } else {
        let T = act.target && !act.target.gone && act.target.mon.hp > 0 ? act.target : alive('e')[0]
        if (!T) return
        await announce(`${actor.ally ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, `${mv.name}!`, 120)
        if (!actor.ally) setDPP(dpp - (mv.cost ?? 0))   // a partner's moves don't spend your PP
        const hits = mv.hits ?? 1
        for (let h = 0; h < hits && T.mon.hp > 0; h++) {
          results.push(await hitOnce(actor, T, mv, planned[h] ?? planned.at(-1), hits > 1 ? `HIT ${h + 1}/${hits}` : 'STRIKE', h ? 560 : 820, 1, hits > 1, h))
        }
        if (hits > 1) { const n = results.filter(Boolean).length; await say(n === hits ? `Hit ${hits} times — full damage!` : `Hit ${n} of ${hits} times.`, '', 260) }
      }
      S(actor.mon).boost = 1; if (actor.mon.hp > 0) tags(actor)
      if (mv.recharge) S(actor.mon).recharge = true
      if (mv.rampage && actor.mon.hp > 0 && !results.some((r) => r?.crit) && !S(actor.mon).conf) { S(actor.mon).conf = 2 + Math.floor(rand() * 2); tags(actor); await say(actor.mon.name, 'became confused from fatigue!', 300) }
      const landed = results.filter(Boolean)
      // A 0-PP move that lands (any timing but MISS) builds PP: +1 per attack (yours, not a partner's).
      if (!actor.ally && !(mv.cost ?? 0) && landed.some((r) => r.label !== 'MISS')) { setDPP(dpp + 1, true); pop('+1 PP', 236, 136, 'blue small') }
      if (landed.some((r) => r.crit)) await say('A critical hit!')
      if (!mv.spread && landed.length && landed.at(-1).eff > 1) await say("It's super effective!")
      if (!mv.spread && landed.length && landed.at(-1).eff < 1) await say("It's not very effective...")
    }

    /**
     * One incoming hit on one of yours: the ring (the amber ground oval when
     * it has to be jumped), the press, and what follows. `ownPartner` is your
     * other Pokémon's spread move rolling into this one: jumping it dodges the
     * hit but earns no PP. Returns 'parry', 'dodge', 'jump' or 'miss'.
     */
    let defendShownAt = 0   // when the last attack's announcement was moved on (see DEFEND_SETTLE_MS)
    async function defendHit(T, actor, mv, h, step, mult, ownPartner = false) {
      const dr = defendRing(ringNet(S(actor.mon).acc, S(T.mon).eva)); if (T.mon.status === 'par') dr.wide *= 0.8
      // Every ring closes at its own speed, after a wind-up of its own (see attackPace).
      const pace = attackPace(ownPartner ? null : actor.owner, leadLevel())
      const vary = demo ? 1 : paceRoll(pace.speed), windup = demo || ownPartner ? 0 : Math.round(Math.random() * pace.wait)
      const approach = Math.round((mv.fast ? 640 : h === 0 ? 820 : 560) * dr.speed * vary)
      let first = null
      const auto = T.ally   // a partner's Pokémon: they defend it, and your presses don't count here
      // Armed through the wind-up, so tapping early still counts as your press (and misses), after a moment's grace once the text is gone.
      const armed = Math.max(performance.now(), defendShownAt + DEFEND_SETTLE_MS)
      const off = auto ? () => {} : listen((btn, t) => { if (!first && t >= armed && ['a', 'b', 'up'].includes(btn)) first = { btn, t } })
      if (auto) panel(null); else { panel('pDefend'); document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.add('armed')) }
      if (windup) await W(windup)
      const t0 = performance.now(), hitAt = t0 + approach
      if (demo && !auto) {
        const p = ownPartner ? 'jump' : step?.defend?.shift() ?? (mv.kind === 'low' ? 'jump' : 'parry')
        const at = { parry: approach - 10, dodge: approach - 120, jump: approach - 10, late: approach + 190 }[p]
        setTimeout(() => { if (!live()) return; const b = { parry: 'a', dodge: 'b', jump: 'up', late: 'a' }[p]; hot($('pDefend').querySelector(`[data-btn="${b}"]`)); press(b) }, at)
      }
      const rg = mv.kind === 'low' ? groundRing(T.c.x, DUO_AT.p[T.i].y - 4, approach) : ring(T.c.x, T.c.y, approach, '')
      const dx = T.c.x - actor.c.x, dy = T.c.y - actor.c.y
      if (mv.kind === 'low') {
        const w = document.createElement('div'); w.className = 'groundwave'; w.style.left = (actor.c.x - 30) + 'px'; w.style.top = (actor.c.y + 30) + 'px'; fx.appendChild(w)
        anim(w, [{ transform: 'translate(0,0) scale(.4,.6)', opacity: .9 }, { transform: `translate(${dx}px,${dy}px) scale(1.4,1)`, opacity: .9, offset: .95 }, { opacity: 0 }], { duration: approach + 60, easing: 'ease-in' }); setTimeout(() => w.remove(), approach + 120)
        if (mv.fx === 'quake' && !ownPartner) anim(actor.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: .82 }, { transform: 'translateY(0)' }], { duration: approach, easing: 'ease-in' })
      } else if (mv.ranged) anim(actor.el, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) translateY(-6px)', offset: .5 }, { transform: 'scale(1)' }], { duration: approach })
      if (mv.ranged && mv.kind !== 'low' && !ownPartner) incomingFx(mv, actor.c, T.c, approach)
      else { const k = approach / (approach + 160); anim(actor.el, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx * .8}px,${dy * .8}px)`, offset: k }, { transform: 'translate(0,0)' }], { duration: approach + 160, easing: 'ease-in' }) }
      await W(approach); rg.clear()
      if (!first) await W(240)
      off(); document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.remove('armed')); panel(null)
      if (T.mon.status === 'frz' || T.mon.status === 'slp') first = null   // frozen solid or asleep: no parry, dodge or jump
      const dt = first ? first.t - hitAt : Infinity
      // A partner defends their own: usually good, now and then PERFECT.
      const res = auto ? (flavor() < (mv.kind === 'low' ? 0.8 : 0.65) ? { r: mv.kind === 'low' ? 'jump' : 'parry', perfect: flavor() < 0.3 } : { r: 'miss' })
        : defendResult(first, dt, mv.kind === 'low', dr.wide)
      const { r, perfect } = res, taken = takenOf(res)
      if (mv.fx === 'quake' && !ownPartner) { sfx('quake'); shake(8, 420) }
      if (r === 'parry') { sfx('parry'); pop(perfect ? 'PERFECT!' : 'PARRY', T.c.x, T.c.y - 64, perfect ? 'gold' : 'gold small'); if (perfect) sparks(T.c.x + 20, T.c.y - 20) }
      else if (r === 'dodge') { sfx('dodge'); pop('DODGE', T.c.x, T.c.y - 64, 'blue'); anim(T.el, [{ transform: 'translateX(0)' }, { transform: 'translateX(-26px)', offset: .4 }, { transform: 'translateX(0)' }], { duration: 340 }) }
      else if (r === 'jump') { sfx('jump'); pop(perfect ? 'PERFECT JUMP!' : 'JUMP!', T.c.x, T.c.y - 76, 'green'); anim(T.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-50px)', offset: .45 }, { transform: 'translateY(0)' }], { duration: 520 }) }
      // A clean hit does it all; a dodge or a good-but-not-PERFECT parry or jump lets some through (DEFEND_TAKEN).
      if (taken > 0) {
        const hit = r === 'miss'
        if (hit && mv.snd && mv.snd !== 'coin' && mv.snd !== 'shadow') sfx(mv.snd)
        const { dmg, eff } = dmgOf(actor.mon, T.mon, mv, mult * taken)
        sfx(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit'); flash('#ef4444', hit ? .2 : .1, 140); if (!auto) buzz(hit ? (eff > 1 ? 60 : 30) : 15)
        impactFx(T.c, mv.type, hit && eff > 1); if (hit) hitReact(T.el, actor.c, T.c, mv.type, eff > 1)
        const from = T.mon.hp
        await Promise.all([hit ? blink(T.el, 2) : null, hpTo(T, Math.max(demo ? 1 : 0, from - dmg))])
        pop(`-${from - T.mon.hp}`, T.c.x + 36, T.c.y - 40, hit ? 'red' : 'red small')
        if (mv.drain) await sapSlot(actor, Math.round((from - T.mon.hp) * mv.drain))
        if (hit && ownPartner) await say(`${T.mon.name} got caught in it!`, '', 200)
        if (hit && T.mon.hp > 0 && T.mon.status === 'frz' && mv.type === 'fire') { T.mon.status = null; tags(T); await say(T.mon.name, STATUS_TEXT.thaw, 250) }
        if (hit && T.mon.hp > 0) await afflict(T, statusFromHit(T.mon, mv, rand))
        if (hit && T.mon.hp > 0 && FLINCH[mv.name] && chance() < FLINCH[mv.name]) S(T.mon).flinch = true
      }
      await W(mv.hits > 1 ? 70 : 160)
      return res
    }

    async function incoming(act, step) {
      const { actor, move: mv } = act
      if (!mv || mv.kind === 'blunder') return
      if (mv.splash) { await announce(`${actor.owner ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, 'SPLASH!', 200); anim(actor.el, [{ transform: 'translateY(0)' }, { transform: 'translateY(-20px)', offset: .5 }, { transform: 'translateY(0)' }], { duration: 300, iterations: 2 }); await W(600); await say('But nothing happened!'); return }
      const spread = SPREAD.has(mv.name)
      const aimed = act.target?.gone ? sides.p.slots[act.target.i] : act.target
      let targets = spread ? alive('p') : [aimed && aimed.mon.hp > 0 ? aimed : alive('p')[0]]
      targets = targets.filter(Boolean); if (!targets.length) return
      // A charged move (Hyper Beam): a turn gathering power, then it goes off fast, then a turn to recharge.
      if (mv.charge && !demo && actor.charged !== mv) {
        actor.charged = mv; sfx('levelup'); await announce(`${actor.mon.name} is gathering`, 'power!', 300)
        anim(actor.el, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) drop-shadow(0 0 10px #fde047)' }, { filter: 'brightness(1)' }], { duration: 700, iterations: 2 }); return
      }
      const released = actor.charged === mv; actor.charged = null
      S(actor.mon).lastMove = mv.name; for (const x of targets) S(x.mon).lastFoe = mv.name
      // A rampage (Outrage): 3 to 5 hits in a fast row on one target, then it's confused from the effort.
      const rampage = mv.rampage && !demo ? 3 + Math.floor(Math.random() * 3) : 0
      const hitsOf = rampage || (mv.hits ?? 1), mvHit = released ? { ...mv, fast: true } : mv
      // Only the dialogue while the move is announced (see the 1v1); the buttons come with the first ring.
      panel(null)
      await announce(`${actor.owner ? `${actor.owner.short}'s ` : ''}${actor.mon.name} used`, `${mv.name}!${spread ? ' (hits all around it)' : ''}`, READ_MS)
      defendShownAt = performance.now()
      let rings = 0, evaded = 0
      for (const T of targets) {
        let allParried = true, countered = 0
        if (S(T.mon).protect) {
          // Yours: hold B through the wind-up and let go as the ring closes. A partner's and the demo's always hold.
          if (T.ally || demo || (await holdGuard(T.c.x, T.c.y, 900))) { sfx('clang'); pop('PROTECTED', T.c.x, T.c.y - 70, 'blue'); await say(T.mon.name, 'protected itself!', 250); continue }
          S(T.mon).protect = false; sfx('flinch'); tags(T); await say(`${T.mon.name}'s PROTECT`, 'slipped!', 250)
        }
        for (let h = 0; h < hitsOf; h++) {
          if (T.mon.hp <= 0) break
          if (h === 0) await tip(T.ally ? 'partner' : mv.kind === 'low' ? 'jump' : 'defend')
          const { r, perfect } = await defendHit(T, actor, mvHit, h, step, spread ? 0.75 : 1)
          if (!T.ally) { rings++; if (r === 'parry' || r === 'jump') evaded++ }   // PP is yours: only your rings count
          if (r !== 'parry' || !perfect) allParried = false
          if (r === 'parry' && S(T.mon).counter === mv.cat) countered += dmgOf(actor.mon, T.mon, mv, spread ? 0.75 : 1).dmg * 2   // Counter / Mirror Coat
        }
        if (countered && actor.mon.hp > 0) {
          sfx('counter'); pop(`${S(T.mon).counter === 'phys' ? 'COUNTER' : 'MIRROR COAT'} ×2`, T.c.x + 40, T.c.y - 90, 'orange'); await W(120)
          sparks(actor.c.x, actor.c.y, '#fdba74'); const from = actor.mon.hp
          await Promise.all([blink(actor.el, 2), hpTo(actor, from - countered)]); pop(`-${from - actor.mon.hp}`, actor.c.x + 30, actor.c.y - 30)
          await say(`${T.mon.name} hit back`, `for ${from - actor.mon.hp} damage!`, 250)
        }
        // A PERFECT parry of every hit earns a counter, as in 1v1.
        if (allParried && mv.kind !== 'low' && T.mon.hp > 0 && actor.mon.hp > 0) {
          sfx('counter'); pop('COUNTER!', T.c.x + 40, T.c.y - 90, 'orange'); await W(120)
          await strikeFx({ fx: 'dash' }, T.c, actor.c, T.el)
          const { dmg } = dmgOf(T.mon, actor.mon, { ...MOVEDEX.TACKLE }, 0.8), from = actor.mon.hp
          sparks(actor.c.x, actor.c.y, '#fdba74')
          await Promise.all([blink(actor.el, 2), hpTo(actor, from - dmg)]); pop(`-${from - actor.mon.hp}`, actor.c.x + 30, actor.c.y - 30)
        }
      }
      if (released) S(actor.mon).recharge = true
      if (rampage && actor.mon.hp > 0 && !S(actor.mon).conf) { S(actor.mon).conf = 2 + Math.floor(rand() * 2); tags(actor); await say(actor.mon.name, 'became confused from fatigue!', 250) }
      // One PP per attack, only when every ring of it was parried or jumped.
      if (rings && evaded === rings) { setDPP(dpp + 1, true); pop('+1 PP', 236, 136, 'blue small'); await tip('pp') }
      else if (evaded) pop(`${evaded}/${rings} — no PP`, 236, 136, 'small')
      // Their spread moves hit their own partner too.
      const partner = spread ? allyOf(actor) : null
      if (partner && actor.mon.hp > 0) {
        const { dmg } = dmgOf(actor.mon, partner.mon, mv, 0.75), from = partner.mon.hp
        if (mv.snd && mv.snd !== 'coin') sfx(mv.snd); sfx('hit')
        await Promise.all([blink(partner.el, 2), hpTo(partner, from - dmg)])
        pop(`-${from - partner.mon.hp}`, partner.c.x + 30, partner.c.y - 30, 'red')
        await say(`It hit its own partner,`, `${partner.mon.name}, too!`, 200)
      }
    }

    /** The signature moves (SPECIAL_EFFECTS) in a 2v2. False if it failed. */
    async function specialDuo(act, acc, queue) {
      const { actor, move: mv } = act, T = act.target, t = S(actor.mon), miss = acc.label === 'MISS', mine = actor.side === 'p'
      switch (mv.effect) {
        case 'metronome': {
          const n = metronomePick(false), m = { ...moveInfo(n), cost: 0 }; sfx('select'); await say('Waggling a finger let it use', `${n}!`, 300)
          const foes = alive(mine ? 'e' : 'p'), target = m.target === 'foe' || m.kind === 'strike' ? foes[Math.floor(Math.random() * foes.length)] : m.target === 'ally' ? allyOf(actor) : actor
          if (!target) return false
          if (m.kind === 'support') await support({ actor, move: m, target, planned: 'great' }, queue)
          else if (mine) await strike({ actor, move: m, target, planned: ['great'] }, null)
          else await incoming({ actor, move: m, target }, null)
          return true
        }
        case 'sketch': {
          const n = t.lastFoe; if (!mine || actor.ally || !n || (!MOVEDEX[n] && !SUPPORT[n]) || learn(actor.mon).learned.includes(n)) return false
          const r = teach(actor.mon, n); sfx('levelup'); await say(`${actor.mon.name} sketched`, `${n}!${r.equipped ? '' : ' (swap it in from the Box)'}`, 350); return true
        }
        case 'transform': {
          if (miss || !mine || actor.ally || actor.mon.form?.stats || !T) return false
          const m = actor.mon, into = T.mon
          m.form ??= { id: m.id, types: m.types, stats: m.stats, moves: m.moves }
          const names = levelMoves({ name: into.name, types: into.types }).filter(([lv, n]) => lv <= m.level && MOVEDEX[n]).map(([, n]) => n).slice(-4)
          m.id = into.id; m.types = [...into.types]; m.stats = { ...into.stats, hp: m.stats.hp }; if (names.length) m.moves = names
          sfx('shadow'); const at = DUO_AT.p[actor.i]; await place(actor.el, spr(m, true), at.x, at.y, at.scale, at.maxH, at.maxW)
          await say(`${m.name} transformed`, `into ${into.name}!`, 300); return true
        }
        case 'curse': {
          const cost = Math.floor(actor.mon.stats.hp / 2), ct = S(T.mon)
          if (!T || ct.cursed || actor.mon.hp <= cost) return false
          sfx('shadow'); await hpTo(actor, actor.mon.hp - cost); ct.cursed = true; tags(T)
          await say(`${actor.mon.name} cut its own HP`, `and laid a curse on ${T.mon.name}!`, 300); return true
        }
        case 'rest': {
          if (actor.mon.hp >= actor.mon.stats.hp) return false
          sfx('heal'); healFx(actor); await hpTo(actor, actor.mon.stats.hp); actor.mon.status = 'slp'; actor.mon.sleep = 2; tags(actor)
          await say(`${actor.mon.name} slept`, 'and became healthy!', 300); return true
        }
        case 'wish': {
          const sd = sides[actor.side]; if (sd.wish) return false
          sd.wish = { turns: 2, amt: Math.floor(actor.mon.stats.hp / 2), i: actor.i }; sfx('perfect'); await say(`${actor.mon.name} made a wish!`, '', 250); return true
        }
        case 'disable': {
          const ct = T && S(T.mon); if (miss || !ct?.lastMove || ct.disabled) return false
          ct.disabled = { name: ct.lastMove, turns: 3 }; sfx('flinch'); tags(T); await say(`${T.mon.name}'s ${ct.lastMove}`, 'was disabled!', 300); return true
        }
        case 'perish': {
          for (const x of [...alive('p'), ...alive('e')]) if (!S(x.mon).perish) { S(x.mon).perish = 3; tags(x) }
          sfx('shadow'); await say('All Pokémon that heard the song', 'will faint in three turns!', 400); return true
        }
        case 'baton': {
          if (!mine || actor.ally) return false
          const next = await pickIncoming(bench()); if (!next) return false
          const keep = Object.fromEntries(['atk', 'spa', 'def', 'spd', 'spe', 'acc', 'eva'].map((k) => [k, t[k] ?? 0]))
          await switchDuo({ actor, to: next }); Object.assign(S(next), keep); const ns = slotOf(next); if (ns) tags(ns)
          await say(`${next.name} took over`, 'with the stat changes!', 250); return true
        }
        case 'conversion': {
          const n = duoMovesOf(actor.mon)[0], ty = (MOVEDEX[n] ?? SUPPORT[n])?.type, m = actor.mon
          if (!ty || (m.types.length === 1 && m.types[0] === ty)) return false
          m.form ??= { id: m.id, types: m.types, stats: m.stats, moves: m.moves }; m.types = [ty]; sfx('zap')
          await say(`${m.name} became`, `the ${ty.toUpperCase()} type!`, 300); return true
        }
        case 'teleport': {
          // No fleeing a trainer battle: a flash that lowers the other side's accuracy, then it switches out.
          sfx('zap'); flash('#fff', .85, 280)
          for (const x of alive(mine ? 'e' : 'p')) { const xt = S(x.mon); if (xt.acc > -STAGE_MAX) { xt.acc--; tags(x) } }
          await say('A flash!', `${mine ? "The foes'" : "Your Pokémon's"} accuracy fell!`, 300)
          if (mine && !actor.ally) { const next = await pickIncoming(bench()); if (next) await switchDuo({ actor, to: next }) }
          else if (!mine) {
            const j = foeBench.findIndex((b) => trainers.length === 1 || b.owner === actor.owner); if (j < 0) return true
            const nx = foeBench.splice(j, 1)[0]; foeBench.push({ mon: actor.mon, owner: actor.owner })
            await anim(actor.el, [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0, filter: 'brightness(3)' }], { duration: 320 }).finished
            st.delete(actor.mon); actor.gone = true; actor.el.remove(); actor.hud.remove()
            await say(...sentOut(nx.owner, nx.mon), 120); await enter('e', actor.i, nx.mon, nx.owner)
          }
          return true
        }
        default: return false   // Mean Look: there's no fleeing a trainer battle
      }
    }
    async function support(act, queue) {
      const { actor, move: mv } = act
      const mine = actor.side === 'p'
      let T = act.target
      if (mv.target === 'ally' && (!T || T.mon.hp <= 0 || T === actor)) { await say(`${actor.mon.name} used ${mv.name}!`, 'But there was no partner to help...'); return }
      await announce(`${actor.mon.name} used`, `${mv.name}!`, 100)
      if (mine && !actor.ally) setDPP(dpp - (mv.cost ?? 0))
      // Yours get a ring over whoever it's for; better timing, stronger effect.
      let acc = { label: 'GOOD', mult: 1, crit: false }
      if (actor.ally) acc = await autoTap(T.c.x, T.c.y, 'ASSIST')
      else if (mine) {
        panel('pStrike'); $('bStrike').innerHTML = 'ASSIST!<small style="font-size:12px;margin-top:6px">time it for a stronger effect</small><span class="key">A</span>'
        acc = mv.input === 'rhythm' && !demo ? byShare((await rhythmTap(T.c.x, T.c.y)) / 4) : await timedTap(act.planned ?? 'great', T.c.x, T.c.y, 'ASSIST')
        panel(null); pop(acc.label, T.c.x - 20, T.c.y - 72, ACC_CLS[acc.label])
      }
      const strong = acc.crit, weak = acc.label === 'MISS'
      const who = mv.target === 'side' ? alive(actor.side) : [T]
      if (mv.effect === 'heal') {
        sfx('heal')
        for (const s of who) {
          if (s.mon.hp >= s.mon.stats.hp) { pop('FULL', s.c.x, s.c.y - 60, 'small'); continue }
          const amt = Math.ceil(s.mon.stats.hp * Math.min(0.6, mv.amount * (mine ? acc.mult : 1)))
          healFx(s); const from = s.mon.hp
          await hpTo(s, from + amt); pop(`+${s.mon.hp - from}`, s.c.x + 30, s.c.y - 40, 'green')
        }
        await say(who.length > 1 ? `${who.map((s) => s.mon.name).join(' and ')}` : `${who[0].mon.name}'s HP`, who.length > 1 ? 'recovered HP!' : 'was restored!', 200)
      } else if (mv.effect === 'atkUp' || mv.effect === 'growth') {
        const n = strong ? 2 : 1
        for (const s of who) {
          const t = S(s.mon); t.atk = Math.min(6, t.atk + n); if (mv.effect === 'growth') t.spa = Math.min(6, t.spa + n)
          buffFx(s); tags(s)
        }
        sfx('levelup')
        await say(`${who.map((s) => s.mon.name).join(' and ')}'s`, `${mv.effect === 'growth' ? 'ATK and SP.A' : 'ATTACK'} ${n > 1 ? 'rose sharply' : 'rose'}!`, 200)
      } else if (mv.effect === 'boost') {
        S(T.mon).boost = strong ? 1.75 : weak ? 1.25 : 1.5; tags(T)
        sfx('perfect'); pop(`×${S(T.mon).boost}`, T.c.x, T.c.y - 70, 'gold'); buffFx(T)
        await say(`${actor.mon.name} is ready to help`, `${T.mon.name}! (×${S(T.mon).boost})`, 200)
      } else if (mv.effect === 'hurry') {
        const i = queue.findIndex((q) => q.actor === T)
        if (i < 0) { await say('But it failed...', `${T.mon.name} already moved.`); return }
        queue.unshift(...queue.splice(i, 1))
        sfx('perfect'); pop('NEXT!', T.c.x, T.c.y - 70, 'gold'); buffFx(T)
        await say(`${T.mon.name} took the kind offer`, 'and moves next!', 200)
      } else if (mv.effect === 'cure') {
        const sick = who.filter((s) => s.mon.status)
        if (!sick.length) await say('But it failed!', 'No status to cure.', 250)
        for (const s of sick) { s.mon.status = null; tags(s); healFx(s); await say(`${s.mon.name}'s status`, 'returned to normal!', 250) }
      } else if (['status', 'confuse', 'swagger', 'seed', 'yawn'].includes(mv.effect)) {
        if (S(T.mon).protect) await say(T.mon.name, 'protected itself!', 250)
        else if (!(await applyStatusMove(mv, actor, T, acc))) await say('But it failed!', '', 250)
      } else if (mv.effect === 'accDown' || mv.effect === 'evaUp') {
        const key = mv.effect === 'accDown' ? 'acc' : 'eva', by = (mv.effect === 'accDown' ? -1 : 1) * (strong ? 2 : 1)
        for (const s of who) {
          const t = S(s.mon), from = t[key]; t[key] = Math.max(-STAGE_MAX, Math.min(STAGE_MAX, t[key] + by)); tags(s)
          await say(`${s.mon.name}'s ${key === 'acc' ? 'accuracy' : 'evasiveness'}`, t[key] === from ? `won't go any ${by > 0 ? 'higher' : 'lower'}!` : `${by > 0 ? 'rose' : 'fell'}${Math.abs(by) > 1 ? ' sharply' : ''}!`, 250)
        }
      } else if (mv.effect === 'stat') {
        const tgt = mv.target === 'foe' ? T : actor
        if (tgt !== actor && weak) { await say('But it failed!', '', 250); return }
        if (tgt !== actor && S(tgt.mon).protect) { await say(tgt.mon.name, 'protected itself!', 250); return }
        for (const [k, by] of Object.entries(mv.stages)) {
          const t = S(tgt.mon), from = t[k] ?? 0; t[k] = Math.max(-6, Math.min(6, from + by * (strong ? 2 : 1))); tags(tgt)
          if (t[k] > from) buffFx(tgt); sfx(t[k] > from ? 'levelup' : 'flinch')
          await say(`${tgt.mon.name}'s ${STAGE_WORD[k]}`, t[k] === from ? `won't go any ${by > 0 ? 'higher' : 'lower'}!` : `${t[k] > from ? 'rose' : 'fell'}${Math.abs(t[k] - from) > 1 ? ' sharply' : ''}!`, 250)
        }
      } else if (mv.effect === 'protect') {
        const t = S(actor.mon)
        if (weak || !protectWorks(t, chance)) { t.protectRun = 0; await say('But it failed!', '', 250); return }
        t.protect = true; t.protectRun = (t.protectRun ?? 0) + 1; sfx('clang'); buffFx(actor); tags(actor); await say(actor.mon.name, 'protected itself!', 250)
      } else if (mv.effect === 'counter') {
        if (weak) { await say('But it failed!', '', 250); return }
        S(actor.mon).counter = mv.cat; sfx('clang'); await say(actor.mon.name, `is ready to ${mv.cat === 'phys' ? 'COUNTER' : 'reflect special hits'}!`, 250)
      } else if (mv.effect === 'weather') {
        if (weak || weather?.kind === mv.weather) { await say('But it failed!', '', 250); return }
        weather = { kind: mv.weather, turns: strong ? 6 : 5 }; $('battleL').dataset.wx = mv.weather; sfx('whoosh'); await say(WEATHER_TEXT[mv.weather][0], '', 300)
      } else if (mv.effect === 'screen') {
        const sd = sides[actor.side]
        if (weak || sd[mv.screen]) { await say('But it failed!', '', 250); return }
        sd[mv.screen] = strong ? 6 : 5; sfx('clang'); retag(); await say(`${actor.side === 'p' ? 'Your' : "The foe's"} side is guarded by`, `${mv.screen === 'reflect' ? 'REFLECT' : 'LIGHT SCREEN'}!`, 250)
      } else if (mv.effect === 'taunt') {
        const t = S(T.mon)
        if (weak || t.taunt) { await say('But it failed!', '', 250); return }
        if (t.protect) { await say(T.mon.name, 'protected itself!', 250); return }
        t.taunt = 3; sfx('flinch'); tags(T); await say(T.mon.name, 'fell for the taunt!', 250)
      } else if (SPECIAL_EFFECTS.includes(mv.effect)) {
        if (!(await specialDuo(act, acc, queue))) await say('But it failed!', '', 250)
      } else if (mv.effect === 'tailwind') {
        sides[actor.side].tailwind = strong ? 5 : 4; windFx(actor.side); sfx('whoosh'); retag()
        await say('A tailwind blew from behind', `your team! (${sides[actor.side].tailwind - 1} more turns)`, 200)
      }
    }
    function healFx(s) {
      for (let i = 0; i < 8; i++) {
        const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${s.c.x - 30 + (i * 37) % 60}px;top:${s.c.y + 20}px;width:8px;height:8px;border-radius:50%;background:#86efac;box-shadow:0 0 8px #22c55e`
        fx.appendChild(d); anim(d, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-70px)', opacity: 0 }], { duration: 700, delay: i * 50 }); setTimeout(() => d.remove(), 800 + i * 50)
      }
    }
    function buffFx(s) {
      for (let i = 0; i < 3; i++) {
        const d = document.createElement('div'); d.className = 'uparrow'; d.style.left = (s.c.x - 24 + i * 18) + 'px'; d.style.top = (s.c.y + 10) + 'px'
        fx.appendChild(d); anim(d, [{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: .3 }, { transform: 'translateY(-60px)', opacity: 0 }], { duration: 700, delay: i * 90 }); setTimeout(() => d.remove(), 900)
      }
    }
    function windFx(side) {
      for (let i = 0; i < 9; i++) {
        const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${side === 'p' ? -40 : 340}px;top:${40 + i * 20}px;width:46px;height:2px;background:rgba(255,255,255,.75);border-radius:2px`
        fx.appendChild(d); anim(d, [{ transform: 'translateX(0)' }, { transform: `translateX(${side === 'p' ? 400 : -400}px)` }], { duration: 520, delay: i * 40 }); setTimeout(() => d.remove(), 620 + i * 40)
      }
    }

    async function useItemDuo(act) {
      if (act.move.item === 'revive') {
        const m = act.target.mon
        await say('You used', `a REVIVE on ${m.name}!`, 200)
        if (m.hp > 0) { await say("It didn't have any effect."); return }
        m.hp = Math.ceil(m.stats.hp * ITEMS.revive.revive); m.status = null; sfx('heal')
        await say(`${m.name} was revived!`, 'It can come in when a spot opens.')
        return
      }
      const it = act.move.item
      // One on the bench: healed or cured where it sits (or on the field, if it's been switched in this turn).
      if (act.target?.bench) {
        const m = act.target.mon, out = alive('p').find((x) => x.mon === m)
        if (!out) {
          await say('You used', `a ${ITEMS[it].name} on ${m.name}!`, 200)
          if (ITEMS[it].cure) {
            if (!m.status || !ITEMS[it].cure.includes(m.status)) { await say("It didn't have any effect."); return }
            m.status = null; sfx('heal'); await say(`${m.name} is cured.`); return
          }
          if (m.hp <= 0 || m.hp >= m.stats.hp) { await say("It didn't have any effect."); return }
          const from = m.hp; m.hp = Math.min(m.stats.hp, m.hp + Math.ceil(m.stats.hp * ITEMS[it].heal)); sfx('heal')
          await say(`${m.name} recovered`, `${m.hp - from} HP.`); return
        }
        act.target = out
      }
      const T = act.target?.gone ? sides.p.slots[act.target.i] : act.target
      await say('You used', `a ${ITEMS[it].name} on ${T.mon.name}!`, 200)
      if (ITEMS[it].cure) {
        if (!T.mon.status || !ITEMS[it].cure.includes(T.mon.status)) { await say("It didn't have any effect."); return }
        T.mon.status = null; tags(T); sfx('heal'); healFx(T); await say(`${T.mon.name} is cured.`); return
      }
      if (T.mon.hp <= 0 || T.mon.hp >= T.mon.stats.hp) { await say("It didn't have any effect."); return }
      sfx('heal'); healFx(T); const from = T.mon.hp
      await hpTo(T, from + Math.ceil(T.mon.stats.hp * ITEMS[it].heal)); pop(`+${T.mon.hp - from}`, T.c.x + 30, T.c.y - 40, 'green')
      await say(`${T.mon.name} recovered`, `${T.mon.hp - from} HP.`)
    }
    async function switchDuo(act) {
      const s = act.actor
      await say(`Come back, ${s.mon.name}!`, '', 160)
      await anim(s.el, [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(0)', opacity: 0, filter: 'brightness(3) sepia(1) hue-rotate(-50deg)' }], { duration: 320 }).finished
      st.delete(s.mon); s.gone = true; s.el.remove(); s.hud.remove()   // stat changes go with it, as in the games
      await say(`Go! ${act.to.name}!`, '', 60)
      await enter('p', s.i, act.to)
    }

    /** EXP for one fainted foe, to each of your Pokémon on the field (not a partner's), and the rest of the party with the EXP. SHARE. */
    const pendingExp = []
    async function expFor(foeMon) {
      await shareExp(expYield(foeMon, true), alive('p').map((x) => x.mon))
      for (const p of alive('p').filter((x) => !x.ally)) {
        await gainExp(p.mon, expYield(foeMon, true), p.hud.querySelector('.exp i'), (m) => {
          p.hud.querySelector('.lv').textContent = 'Lv' + m.level; p.hud.querySelector('.dhn').textContent = `${m.hp}/${m.stats.hp}`
          const bar = p.hud.querySelector('.hpb i'); bar.getAnimations().forEach((x) => x.cancel()); bar.style.width = m.hp / m.stats.hp * 100 + '%'
        })
      }
    }
    async function faints() {
      for (const side of ['e', 'p']) for (const s of sides[side].slots) {
        if (!s || s.mon.hp > 0 || s.out) continue
        s.out = true; sfx('faint')
        await anim(s.el, [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(90px)', clipPath: 'inset(0 0 90px 0)' }], { duration: 480, easing: 'ease-in' }).finished
        s.el.style.visibility = 'hidden'; s.hud.style.visibility = 'hidden'
        await say(`${side === 'e' ? `${s.owner?.short ?? 'The foe'}'s ` : ''}${s.mon.name}`, 'fainted!')
        // EXP now while the battle goes on; for the faint that ends it, after the scalpers' parting words.
        if (side === 'e') { if (!alive('e').length && !foeBench.length) pendingExp.push(s.mon); else await expFor(s.mon) }
        if (side === 'e') {
          // Next one up from the same scalper (in a solo double, whichever is next).
          const j = foeBench.findIndex((b) => trainers.length === 1 || b.owner === s.owner)
          if (j >= 0) { const nx = foeBench.splice(j, 1)[0]; await say(...sentOut(nx.owner, nx.mon), 120); s.el.remove(); s.hud.remove(); await enter('e', s.i, nx.mon, nx.owner) }
        }
        if (side === 'p' && !s.ally) {
          const next = await pickIncoming(bench())
          if (next) { await say(`Go! ${next.name}!`, '', 60); s.el.remove(); s.hud.remove(); await enter('p', s.i, next) }
        }
      }
    }

    /* ── the turn loop ── */
    for (let turn = 0; ; turn++) {
      const step = demo ? (plan[turn] ?? null) : null
      if (step?.cap) cap(step.cap[0], step.cap[1])
      // Past the end of the script, the demo just keeps attacking.
      const best = (s) => movesOf(s.mon).map(moveInfo).filter((m) => m.kind === 'strike' && m.cost <= dpp / 2).sort((a, b) => b.power * (b.hits ?? 1) - a.power * (a.hits ?? 1))[0]?.name ?? movesOf(s.mon)[0]
      if (turn === 0) await tip('start')
      const mineActs = await commands(step ?? (demo ? { cmds: alive('p').filter((s) => !s.ally).map((s) => ({ move: best(s), target: 0, planned: 'perfect' })) } : null))
      const queue = [...mineActs, ...allyCommands(), ...foeCommands(step)]
      // Priority bracket, then Speed (Tailwind ×2), ties at random.
      queue.forEach((q) => { q.roll = rand() })
      queue.sort((a, b) => (b.move.prio ?? (b.move.fast ? 1 : 0)) - (a.move.prio ?? (a.move.fast ? 1 : 0)) || speed(b.actor) - speed(a.actor) || a.roll - b.roll)
      while (queue.length) {
        const act = queue.shift()
        if (act.actor.mon.hp <= 0 || act.actor.gone) continue   // fainted, or switched out (Teleport) before its turn
        if (step?.capAt?.[act.move.name]) cap(...step.capAt[act.move.name])
        if (act.move.kind === 'blunder') await blunderLine(act.actor.owner, act.actor.mon)
        else if (act.move.kind === 'item') await useItemDuo(act)
        else if (act.move.kind === 'switch') await switchDuo(act)
        else if (act.move.sleepOk && act.actor.mon.status === 'slp') { if (act.actor.mon.sleep > 0) act.actor.mon.sleep--; await say(act.actor.mon.name, 'is fast asleep.', 250); await strike({ ...act, snoring: true }, step) }
        else if (await blockedByStatus(act.actor)) { /* frozen or fully paralyzed: the turn is lost */ }
        else if (act.move.kind === 'support') await support(act, queue)
        else if (act.actor.side === 'p') await strike(act, step)
        else await incoming(act, step)
        await faints()
        if (!alive('e').length || !alive('p').length) break
      }
      for (const s of [...alive('p'), ...alive('e')]) {
        const t = S(s.mon), d = statusTick(s.mon)
        if (d) { sfx('hitWeak'); await hpTo(s, s.mon.hp - d); await say(s.mon.name, `is hurt by ${s.mon.status === 'brn' ? 'its burn' : 'poison'}!`, 250) }
        if (s.mon.hp > 0 && t.seeded) {
          const sap = Math.min(s.mon.hp, Math.max(1, Math.floor(s.mon.stats.hp / 8))), to = t.seeded
          sfx('hitWeak'); await hpTo(s, s.mon.hp - sap)
          if (to.mon.hp > 0 && !to.gone) { rise(to.c, '#86efac', 'dot'); await hpTo(to, to.mon.hp + sap) }
          await say(`${s.mon.name}'s health is sapped`, 'by LEECH SEED!', 250)
        }
        if (s.mon.hp > 0 && t.drowsy && !--t.drowsy) await afflict(s, 'slp')
        if (s.mon.hp > 0 && t.cursed) { sfx('shadow'); await hpTo(s, s.mon.hp - Math.max(1, Math.floor(s.mon.stats.hp / 4))); await say(s.mon.name, 'is afflicted by the curse!', 250) }
        if (s.mon.hp > 0 && t.perish && !--t.perish) { sfx('faint'); await hpTo(s, 0); await say(`${s.mon.name}'s perish count`, 'fell to 0!', 300) }
        if (t.disabled && !--t.disabled.turns) { t.disabled = null; await say(`${s.mon.name} is no longer`, 'disabled.', 250) }
        if (t.taunt && !--t.taunt) await say(`${s.mon.name}'s taunt`, 'wore off.', 250)
        if (!t.protect) t.protectRun = 0
        t.flinch = false; t.protect = false; t.counter = null; s.turns++
      }
      await faints()
      for (const side of ['p', 'e']) if (sides[side].tailwind) { sides[side].tailwind--; if (!sides[side].tailwind) await say(`The tailwind on ${side === 'p' ? 'your' : 'the foe'}'s side`, 'petered out.') }
      for (const side of ['p', 'e']) for (const k of ['reflect', 'light']) if (sides[side][k] && !--sides[side][k]) await say(`${side === 'p' ? 'Your' : "The foe's"} ${k === 'reflect' ? 'REFLECT' : 'LIGHT SCREEN'}`, 'wore off.', 250)
      if (weather && !--weather.turns) { await say(WEATHER_TEXT[weather.kind][1], '', 250); weather = null; $('battleL').dataset.wx = '' }
      for (const side of ['p', 'e']) {
        const w = sides[side].wish; if (!w || --w.turns) continue
        sides[side].wish = null; const x = sides[side].slots[w.i]
        if (x && !x.gone && x.mon.hp > 0 && x.mon.hp < x.mon.stats.hp) { sfx('heal'); healFx(x); await hpTo(x, x.mon.hp + w.amt); await say('The wish came true', `for ${x.mon.name}!`, 250) }
      }
      for (const s of [...sides.p.slots, ...sides.e.slots]) if (s) { S(s.mon).boost = 1 }
      retag()
      if (!alive('e').length || !alive('p').length) break
    }
    const won = !alive('e').length
    const cleanup = () => made.forEach((d) => d.remove())
    // `exp`: the EXP held back from the faint that ended it, for after the parting words.
    return { result: won ? 'won' : 'lost', cleanup, exp: async () => { for (const m of pendingExp.splice(0)) await expFor(m) } }
  }

  /* ══════════ 2v2 at the machine ══════════
   * 'tag': Herb and Paul together, one Pokémon each on the field, any others
   * on deck. 'solo': one scalper with two out at once, or, when they only
   * carry one, a 2-on-1. Either way your first two Pokémon fight.
   */
  /** Trainer battles play one of two themes, picked at random each time (not from the game's own rolls, which it would shift; the demos keep the first). */
  const trainerTheme = () => (demo || Math.random() < 0.5 ? 'battle' : 'battleB')
  async function duoEncounter(demoPlan, variant = 'tag', state = 'in') {
    toolsEnabled(false)
    if (!party.some((m) => m.hp > 0)) { $('homeSub').textContent = 'heal your party first'; toolsEnabled(true); return }
    const lead = party.filter((m) => m.hp > 0).slice(0, 2)
    const lv = Math.round(lead.reduce((n, m) => n + m.level, 0) / lead.length)   // your first two, on average: deckFor() sets the band around it
    // A tag team is any two trainers; the demo's is Herb and Paul. Solo: one trainer with two out.
    const crew = demoPlan ? (variant === 'tag' ? [HERB, PAUL] : [pickOf(SCALPERS)]) : randomTrainers(variant === 'tag' ? 2 : 1)
    const decks = crew.map((T) => deckFor(T, lv, demoPlan ? [T.mon] : null).map((mon) => ({ mon, owner: T })))
    // On the field: one from each in a tag team; up to two of the one scalper's otherwise.
    const field = variant === 'tag' ? decks.map((d) => d.shift()) : decks[0].splice(0, 2)
    const waiting = decks.flat()
    renderHome(state); if (state === 'in') sfx('restock'); await W(demo ? 1000 : 700)
    const second = await campOut(crew)
    Sound.music('vs')
    await wipeTrainer(async () => {
      second?.remove()
      setScene(SCALPER_SCENES, sceneRoll); showLayer('battle')
      vsSplash(crew, field.length)
    })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    if (demo) cap('TAG TEAM', "Sometimes both scalpers show up. That's a 2v2: your first two Pokémon against both of theirs.")
    await W(1500)
    if (crew[1] && crew.includes(HERB) && crew.includes(PAUL)) { const [h, p] = demoPlan ? TAG_BANTER[0] : pickOf(TAG_BANTER); await talk(HERB, [h]); await talk(PAUL, [p]) }
    else if (crew[1]) { for (const T of crew) await talk(T, [pickOf(TEAM_UP[T.short])]) }
    else await talk(crew[0], pickOf(SOLO_DOUBLE[crew[0].short]))
    vsHide()
    Sound.music(trainerTheme())
    const out = await duoBattle({ foes: field, bench: waiting, trainers: crew, plan: demoPlan })
    if (out.result === 'won') {
      restBeaten(crew)   // they stay away for a while
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      for (const T of crew) { await trainerOn(T, 'down'); await talk(T, pickOf(T.outro), 'faceDown'); await trainerOff() }
      await out.exp(); out.cleanup()   // EXP after their parting words, then tokens
      await payTokens(crew.reduce((n, T) => n + +T.tokens, 0), 'duo', 'The VVM is free!')   // always
      for (const T of crew) await loot(T)   // sometimes
      Sound.stopMusic(); await backToMachine(state)
    } else {
      out.cleanup()
      for (const T of crew) { await trainerOn(T); await talk(T, pickOf(T.gloat)); await trainerOff() }
      Sound.stopMusic(); await say(`${crew.map((T) => T.short).join(' and ')} ${crew[1] ? 'are' : 'is'} still`, 'at the VVM...'); await backToMachine(state, true)
    }
  }
  /* ══════════ the first time: Herb and Paul, and Alex ══════════
   * Your first restock, before you have a Pokémon. Herb and Paul are camping
   * the machine; Alex steps in, has you pick a starter, and fights beside you
   * with his Porygon, coaching as you go. Afterwards the game opens up.
   * Assumes campOut() already showed them at the machine.
   */
  let tutorialDone = false, gifted = false

  /* ══════════ gym battles ══════════ */
  /** A leader's team for this fight: their set levels (leaderLevels), every IV at least their floor (`ivs`, 20 unless set). */
  function gymTeam(n) {
    // leaderLevels(): set levels, from `low` up to the ace at `min`.
    const L = GYMS[n], lv = leaderLevels(L)
    return L.team.map((name, i) => {
      const m = individual(DATA.trainer.find((t) => t.name === name) ?? speciesByName(name), lv[i], rand)
      for (const k of STAT_KEYS) m.ivs[k] = Math.max(L.ivs ?? 20, m.ivs[k])
      m.stats = statsAt(m, m.level); m.hp = m.stats.hp
      return m
    })
  }
  /** Summoned from the Bag: the leader's VS, their words, the battle, a badge. The summon is spent either way. */
  async function gymBattle(n, demoPlan) {
    const L = GYMS[n]
    toolsEnabled(false)
    Sound.music('gymIntro')   // the fanfare, then the intro loop under their words
    await wipeTrainer(async () => {
      setScene([L.scene]); showLayer('battle')
      const vs = $('vs'); vs.classList.add('gym'); vs.style.setProperty('--gym', L.color)
      $('vsImg').src = ART[L.vs]; $('vsName').textContent = L.full; vs.querySelector('.name span').textContent = L.title; vs.style.display = 'block'
      vsIn(vs)
    })
    if (demo) cap('GYM LEADER', `${L.short} of ${L.city}: ${L.team.length} Pokémon, above your level, with sharp move choices and a Full Restore for the last one.`)
    await W(1400)
    await talk(L, L.intro)
    vsHide()
    Sound.music('gym')
    const team = gymTeam(n)
    const out = await battle({ kind: 'trainer', foe: team[0], roster: team.slice(1), trainer: L, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(L); await talk(L, L.outro); await trainerOff()
      await out.exp?.()
      badges.push(n); sfx('levelup'); showBadge(L)
      await say(`You got the ${L.badge} BADGE`, `from ${L.short}!`, 1100)
      await payMilestone(`gym:${n}`, L.tokens)
      // A Move Disc of the leader's type, and half the time a booster pack.
      const disc = gymDisc(L); bag[discKey(disc)] = (bag[discKey(disc)] ?? 0) + 1
      sfx('click'); await say(`${L.short} gave you a MOVE DISC:`, `${disc}!`, 900)
      await giveCandy(L)
      if (flavor() < 0.5) { const p = await givePack('gym'); if (p) await say(`${L.short} also gave you`, `${p}!`, 700) }
      renderTools()
    } else {
      await trainerOn(L); await talk(L, L.gloat); await trainerOff()
      await say(`${L.short} headed back to the ${L.city} GYM.`, 'The SUMMON was used up.')
    }
    Sound.stopMusic(); await backToMachine('idle')
  }
  /** An Elite Four member's team: levels as leaderLevels() sets them, every IV at least their floor (`ivs`, 20 unless set). */
  function eliteTeam(L) {
    const lv = leaderLevels(L)
    return L.team.map((name, i) => {
      const m = individual(DATA.trainer.find((t) => t.name === name) ?? speciesByName(name), lv[i], rand)
      for (const k of STAT_KEYS) m.ivs[k] = Math.max(L.ivs ?? 20, m.ivs[k])
      m.stats = statsAt(m, m.level); m.hp = m.stats.hp
      return m
    })
  }
  /**
   * The next rung of a League's ladder (`id`: 'elite', Johto's; 'kanto',
   * Kanto's), from its ticket in the Bag. Win: tokens, and the ticket stays
   * for the next one (after Lance you're Champion; after Red, it's done).
   * Lose: the ticket is gone and the ladder starts again from the first.
   */
  async function leagueBattle(id = 'elite', demoPlan) {
    const G = LEAGUES[id], list = G.members, st = leagueStep(id), L = list[st], key = summonKey(id), name = G.card.summonName
    const setStep = (n) => { if (id === 'kanto') kantoStep = n; else eliteStep = n }
    toolsEnabled(false)
    // Each member's own intro under the splash and their words; Red says nothing, under the start of their theme.
    Sound.music(L.red ? G.battle(L) : L.introSong ?? LEAGUE_INTRO[L.short.toLowerCase()] ?? 'gymIntro')
    await wipeTrainer(async () => {
      setScene([L.scene]); showLayer('battle')
      const vs = $('vs'); vs.classList.add('gym'); vs.style.setProperty('--gym', L.color)
      $('vsImg').src = ART[L.vs]; $('vsName').textContent = L.full; vs.querySelector('.name span').textContent = `${L.title} · ${st + 1} OF 5`; vs.style.display = 'block'
      vsIn(vs)
    })
    await W(1400)
    await talk(L, L.intro)
    vsHide()
    if (!L.red) Sound.music(G.battle(L))
    const team = eliteTeam(L)
    const out = await battle({ kind: 'trainer', foe: team[0], roster: team.slice(1), trainer: L, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(L); await talk(L, L.outro); await trainerOff()
      await out.exp?.()
      await payMilestone(`${id === 'kanto' ? 'kanto' : 'elite'}:${L.short}`, L.tokens)
      { const p = await givePack('elite'); if (p) { sfx('click'); await say(`${L.short} gave you`, `${p}!`, 700) } }
      setStep(st + 1)
      if (st + 1 === list.length) {
        setStep(0); bag[key] = Math.max(0, (bag[key] ?? 0) - 1); sfx('levelup')
        if (id === 'kanto') { redBeaten = true; await say('RED nodded,', 'then turned back to the snow.', 1300); await say('You beat RED!', `The ${name} is spent.`, 1500) }
        else { champion = true; await say("You're the new CHAMPION!", `The ${name} is spent. Kanto's gyms are open.`, 1500) }
      } else await say(`Next up: ${list[st + 1].full}.`, `Use your ${name} whenever you're ready.`, 900)
    } else {
      await trainerOn(L); await talk(L, L.gloat); await trainerOff()
      bag[key] = Math.max(0, (bag[key] ?? 0) - 1)
      setStep(0)
      await say(`The ${name} was used up.`, st ? `The next ticket starts again from ${list[0].short}.` : 'Train up and try again.', 900)
    }
    renderTools(); saveGame()
    Sound.stopMusic(); await backToMachine('idle')
  }
  /** The badge, popped in the middle of the screen. */
  function showBadge(L) {
    const b = document.createElement('div'); b.className = 'badgepop'; b.style.setProperty('--c', L.color); b.innerHTML = `<img src="${badgeArt(L.badge)}" alt=""><b>${L.badge} BADGE</b>`
    fx.appendChild(b)
    anim(b, [{ transform: 'translate(-50%,-50%) scale(.2) rotate(-30deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1.15) rotate(6deg)', opacity: 1, offset: .5 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 1, offset: .7 }, { transform: 'translate(-50%,-50%) scale(1)', opacity: 0 }], { duration: 2600 })
    setTimeout(() => b.remove(), 2700)
  }
  /** Watch gym: a party of three buys a summon, uses it from the Bag, and takes on Falkner. */
  async function gymDemo() {
    for (const name of ['FUECOCO', 'QUAXLY', 'SPRIGATITO']) { const m = individual(DATA.starters.find((s) => s.name === name), 18, rand); m.hp = m.stats.hp; party.push(m) }
    tutorialDone = true; gifted = true; showTools(true); renderTools()
    cap('GYMS', "Gym Leaders from Johto: eight of them, beaten in order. You can't run into one. You summon them, with a token from the machine.")
    await backToMachine('idle'); await W(1600)
    setMachine('in')
    cap('SUMMON', "A stocked machine sometimes carries a summon. It's always for your next gym: right now that's FALKNER, so it's a ZEPHYR SUMMON.")
    hot($('home')); await tapMachine({ enc: null, items: ['summon', 'potion'] }); await W(2000)
    hot($('supplies').querySelector('[data-buy="summon"]')); buySupply('summon'); await W(1800)
    await toIdle(); await W(600)
    cap('BAG', "Summons are used from the Bag. The challenge page shows who you'll face; the summon is spent when the leader arrives, win or lose.")
    hot($('tBag')); sfx('select')
    const sh = openSheet('bag'); await W(1400)
    await sh.tap('[data-tab="other"]', 700)
    await sh.tap(`[data-item="${summonKey(0)}"]`, 2600)
    await sh.tap('[data-challenge]', 400)
    pendingSummon = null
    await gymBattle(0, { turns: [], defend: [] })
    cap('BADGES', 'The ZEPHYR BADGE goes in your badge case, in the Party sheet. Now the machine offers HIVE SUMMONS, for BUGSY.')
    hot($('tParty')); sfx('select'); openSheet('party'); await W(3200)
    hot($('sheetClose')); closeSheetNow()
    cap('NEXT', 'Next up: BUGSY of Azalea Town.')
    await W(2600)
  }
  /** After the first battle, win or lose: Alex hands over five Potions and five Poké Balls (once). */
  async function starterKit() {
    if (gifted) return
    gifted = true
    await talk(ALEX, ALEX.gift)
    bag.potion += 5; bag.ball += 5; renderTools(); sfx('levelup')
    await say('ALEX gave you 5 POTIONS', 'and 5 POKé BALLS!', 900)
  }
  /** Party, Bag and Box: hidden until you have a Pokémon and the first battle is behind you. */
  function showTools(on) { $('tools').hidden = !on; $('poolPanel').hidden = !on; $('home').classList.toggle('haswallet', on); $('wallet').textContent = `${wallet.toFixed(2)} tk`; if (on) renderPool(); fit() }
  /**
   * One tap of TOUCH TO START. Two separate rolls: the machine's state
   * (stocked, sold out, maintenance), and whether something's waiting: a
   * wild Pokémon or a scalper can turn up whatever the stock. `force` pins
   * either (the demo, and the "Next tap" picker in Play); `force.plan` is a
   * demo script for the encounter.
   */
  /*
   * The machine is shared: its stock state (stocked, sold out, maintenance)
   * is the same for every trainer, and only one trainer at a time can be on
   * its purchase screen (`lockedBy`). What happens when you tap is yours
   * alone: each trainer's tap rolls its own encounter, so trainers tapping at
   * the same moment get independent results, which may match or differ.
   * Battles never take the lock. In the app the stock state and the lock live
   * on the server; the encounter roll belongs there too, made per trainer per
   * tap, so it can't be predicted or replayed from the client.
   */
  const machine = { state: 'in', lockedBy: null }
  const YOU = 'YOU'
  /** One trainer's encounter roll: nothing, a wild Pokémon, a scalper, or a 2v2. */
  const ENC_RATES = { none: 0.5, wild: 0.3, scalper: 0.13, duo: 0.07 }
  function rollEncounter(r) {
    let x = r()
    for (const [k, p] of Object.entries(ENC_RATES)) { if (x < p) return k === 'none' ? null : k; x -= p }
    return null
  }
  /*
   * Empty taps. After PITY_AFTER empty taps in a row, the next one always
   * turns something up: it's rolled again among the encounters alone, at
   * their usual odds against each other. And an empty tap can still find
   * something small at the machine (FIND_CHANCE): a stray Poké Ball or
   * Potion, or a few cents of tokens left in the change slot. Each trainer's
   * run of empty taps is their own. In the app, both belong on the server
   * with the encounter roll.
   */
  const PITY_AFTER = 2, FIND_CHANCE = 0.35
  const emptyRun = {}
  /** A trainer's tap with the pity rule; `forced` (anything but undefined) pins it and skips the rule. */
  function rollTap(who, r, forced) {
    let enc = forced !== undefined ? forced : rollEncounter(r), pity = false
    if (forced === undefined && !enc && (emptyRun[who] ?? 0) >= PITY_AFTER) {
      let x = r() * (1 - ENC_RATES.none); enc = 'wild'
      for (const [k, p] of Object.entries(ENC_RATES)) { if (k === 'none') continue; if (x < p) { enc = k; break } x -= p }
      pity = true
    }
    emptyRun[who] = enc ? 0 : (emptyRun[who] ?? 0) + 1
    return { enc, pity }
  }
  /** Something small found on an empty tap ({ item } or { tokens }), or null. `sure` skips the chance. */
  function rollFind(sure = false) {
    if (!sure && flavor() >= FIND_CHANCE) return null
    const x = flavor()
    return x < 0.4 ? { item: 'ball' } : x < 0.7 ? { item: 'potion' } : { tokens: (1 + Math.floor(flavor() * 5)) * 0.05 }
  }
  const findText = (f) => f.item ? `a stray ${ITEMS[f.item].name}` : `${f.tokens.toFixed(2)} tokens in the change slot`
  /** Yours: into the Bag or the wallet, with a little pop on the machine's screen. */
  function collectFind(f) {
    if (f.item) bag[f.item] = (bag[f.item] ?? 0) + 1
    else if (vvm()) vvm().awardTokens(f.tokens, 'find').then((r) => { wallet = r.balance; $('wallet').textContent = `${wallet.toFixed(2)} tk` }).catch(() => {})
    else wallet = Math.round((wallet + f.tokens) * 100) / 100
    renderTools(); $('wallet').textContent = `${wallet.toFixed(2)} tk`
    sfx(f.item ? 'click' : 'tokens')
    homePop(`${f.item ? `<span class="supic ${f.item}"></span>` : '<span class="coin">¢</span>'}<b>Found ${findText(f)}!</b>`)
    feed(`<b>You</b> found ${findText(f)} by the machine.`)
  }
  /** A little note that pops up over the machine's screen and fades: a find, a switch flipped. */
  function homePop(html) {
    $('home').querySelector('.find')?.remove()
    const el = document.createElement('div'); el.className = 'find'; el.innerHTML = html
    $('home').appendChild(el)
    anim(el, [{ transform: 'translate(-50%, 12px) scale(.92)', opacity: 0 }, { transform: 'translate(-50%, 0) scale(1)', opacity: 1, offset: 0.12 }, { transform: 'translate(-50%, 0)', opacity: 1, offset: 0.85 }, { transform: 'translate(-50%, -10px)', opacity: 0 }], { duration: 2800, easing: 'ease-out' }).finished.then(() => el.remove(), () => el.remove())
  }
  // Each trainer rolls from their own stream (seeded in the demos, so they replay the same).
  const OTHERS = ['MAYA', 'SAM', 'JO']
  /** One of each legendary, roaming. A fresh one replaces any that's knocked out or caught. */
  const ROAM = {}
  const spawnLegend = (name) => { const m = individual(DATA.trainer.find((t) => t.name === name), LEGEND_LEVEL, rand); m.roamer = true; ROAM[name] = m; renderRoamers(); return m }
  const pickLegend = (r = flavor) => ROAM[LEGENDS[Math.floor(r() * LEGENDS.length)]]
  const pct = (m) => Math.round(m.hp / m.stats.hp * 100)
  /** The testing panel's line: each one's HP as it stands. */
  function renderRoamers() { const el = $('roamers'); if (el) el.innerHTML = LEGENDS.filter((n) => ROAM[n]).map((n) => `${n} <b>${pct(ROAM[n])}%</b>`).join(' · ') }
  /**
   * After a legendary battle, for any trainer: a fresh one if it was knocked
   * out or caught, otherwise it keeps its HP for whoever meets it next.
   */
  function legendAfter(m, result, who) {
    if (result === 'caught' || result === 'fainted') {
      feed(`<b>${who}</b> ${result === 'caught' ? 'caught' : 'knocked out'} the roaming <b>${m.name}</b>! A new ${m.name} is roaming, at full HP.`)
      spawnLegend(m.name)
    } else feed(`The roaming <b>${m.name}</b> got away from <b>${who}</b> with <b>${pct(m)}%</b> HP left.`)
    renderRoamers()
  }
  /** Another trainer meets one: they chip at it (sometimes finish it, very rarely catch it), and it runs. */
  function otherLegend(name, r) {
    const m = pickLegend(r), hit = Math.round(m.stats.hp * (0.08 + r() * 0.3))
    m.hp = Math.max(0, m.hp - hit)
    const caught = m.hp > 0 && r() < 0.03 * (1 - m.hp / m.stats.hp)
    feed(`<b>${name}</b> tapped: the roaming legendary <b>${m.name}</b> burst out!`)
    legendAfter(m, caught ? 'caught' : m.hp <= 0 ? 'fainted' : 'fled', name)
  }
  const streams = Object.fromEntries([YOU, ...OTHERS].map((n, i) => [n, demo ? rng(101 + i * 17) : Math.random]))
  const ENC_TEXT = { null: 'nothing jumped out', wild: 'a wild Pokémon jumped out', scalper: 'a trainer stopped them', duo: 'a double battle stopped them' }

  /*
   * Wild pools, one per real machine. Each machine's pool is six species
   * drawn from the wild list, picked fresh every week (Monday) from the
   * machine's code and the week, so everyone on that machine sees the same
   * six and nobody can predict next week's from this week's.
   *
   * A trainer's seed is the machine of their latest timer report. With no
   * reports yet, they're given a random active machine, fixed for the week
   * (from their id and the week) so it doesn't reshuffle every tap. In the
   * app, MACHINES is the `machines` table and the report is a `timer_reports`
   * row; the seed lookup and the weekly pick belong on the server.
   */
  const MACHINES = [
    { code: 'VVM-101', venue: 'Riverside Mall', city: 'food court' },
    { code: 'VVM-114', venue: 'Union Station', city: 'main concourse' },
    { code: 'VVM-127', venue: 'Northgate Plaza', city: 'east entrance' },
    { code: 'VVM-139', venue: 'Harbor Arcade', city: 'pier level' },
    { code: 'VVM-152', venue: 'West Commons', city: 'lower level' },
    { code: 'VVM-166', venue: 'Campus Center', city: 'student union' },
  ]
  const POOL_SIZE = 6
  const hashStr = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0 }
  // Weeks since the epoch, rolling over on Monday. The demo is pinned to one week so it always plays the same.
  let weekShift = 0
  const thisWeek = () => (demo ? 2900 : Math.floor((Date.now() / 864e5 + 3) / 7)) + weekShift
  const nextRotation = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d - Date.now() }
  /**
   * A machine's six species for a week, drawn by rarity (RARITY_WEIGHT): a
   * rare one is in about 1 machine's pool in 7. The demo keeps its old
   * even draw, so it plays out the same.
   */
  function poolFor(code, week = thisWeek()) {
    const r = rng(hashStr(`${code}:${week}`))
    if (demo) {
      const names = DATA.wild.map((w) => w.name)
      for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]] }
      return names.slice(0, POOL_SIZE)
    }
    const left = [...DATA.wild], out = []
    while (out.length < POOL_SIZE && left.length) out.push(left.splice(left.indexOf(weightedPick(left, rarityWeight, r)), 1)[0].name)
    return out
  }
  /** Each trainer's seed: the machine of their latest report, or a random one for the week. */
  const trainerId = (() => { if (demo) return 'demo-trainer'; try { let id = localStorage.getItem('vvm-trainer-id'); if (!id) { id = Math.random().toString(36).slice(2); localStorage.setItem('vvm-trainer-id', id) } return id } catch { return 'guest' } })()
  const reports = {}   // trainer -> { code, week } of their latest timer report
  // In the app: your real seed, from the Timers tab (gameBridge wildSeed): { report, machines }.
  let realSeed = null
  function seedOf(who) {
    if (who === YOU && realSeed) {
      if (realSeed.report) return { m: realSeed.report, why: 'report' }
      if (realSeed.machines.length) return { m: realSeed.machines[hashStr(`${APP.uid || trainerId}:${thisWeek()}`) % realSeed.machines.length], why: 'random' }
    }
    if (reports[who]) return { m: MACHINES.find((x) => x.code === reports[who].code), why: 'report' }
    return { m: MACHINES[hashStr(`${who === YOU ? trainerId : who}:${thisWeek()}`) % MACHINES.length], why: 'random' }
  }
  /** In the app: read your latest real timer report, so the wild pool is that machine's. */
  async function syncSeed() {
    const api = vvm(); if (!api?.wildSeed) return
    const s = await api.wildSeed().catch(() => null); if (!s || !live()) return
    const was = seedOf(YOU).m?.code
    realSeed = s
    if (!$('poolPanel').hidden) renderPool(was !== undefined && was !== seedOf(YOU).m?.code)
  }
  /** A timer report: the trainer moves to that machine's pool. */
  function reportTimer(who, code) {
    reports[who] = { code, week: thisWeek() }
    if (who === YOU) { renderPool(true); feed(`<b>You</b> reported a timer at <b>${code}</b>. Your wild Pokémon now come from its pool.`) }
    else feed(`<b>${who}</b> reported a timer at <b>${code}</b>.`)
  }
  /** A wild Pokémon from that trainer's pool: by rarity again, so a rare one in the pool is still a rare find. */
  const wildFrom = (who, roll = Math.random) => {
    const pool = poolFor(seedOf(who).m.code).map((n) => DATA.wild.find((w) => w.name === n))
    return demo ? pool[Math.floor(roll() * pool.length)] : weightedPick(pool, rarityWeight, roll)
  }
  function renderPool(flash = false) {
    const { m, why } = seedOf(YOU), ms = nextRotation(), dd = Math.floor(ms / 864e5), hh = Math.floor(ms / 36e5) % 24
    $('poolWhere').innerHTML = `<b>${esc(m.code)}</b> · ${esc(m.venue)}${m.city ? `, ${esc(m.city)}` : ''}<small>${why === 'report' ? 'from your latest timer report' : `random machine this week (no timer reports yet) · report a timer${realSeed ? ' on the Timers tab' : ''} to choose`}</small>`
    $('poolWhen').textContent = demo ? 'changes every Monday' : weekShift ? `week +${weekShift}` : `changes in ${dd}d ${hh}h`
    $('poolMons').innerHTML = poolFor(m.code).map((n) => { const w = DATA.wild.find((x) => x.name === n), k = rarityOf(w); return `<span class="${k}"><img src="${ART[w.id]}" alt=""><b class="nm">${n.replace(/[♀♂]/, (g) => `<i class="sx ${g === '♀' ? 'f' : 'm'}">${g}</i>`)}</b>${k === 'common' ? '' : `<em>${k}</em>`}</span>` }).join('')
    if (flash) anim($('poolPanel'), [{ boxShadow: '0 0 0 3px #facc15' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 900 })
  }

  function feed(text) {
    $('feed').hidden = false
    const li = document.createElement('li'); li.innerHTML = text
    $('feedList').prepend(li); while ($('feedList').children.length > 6) $('feedList').lastChild.remove()
    anim(li, [{ background: 'rgba(250, 204, 21, .35)' }, { background: 'transparent' }], { duration: 900 })
  }
  function setMachine(state) {
    machine.state = state; $('machineState').value = state
    if (state !== 'in' && machine.lockedBy) machine.lockedBy = null
    if (homeState === 'idle') renderHome('idle')
  }
  // Each hold of the purchase screen gets its own ticket, so a finished visit's
  // timer can't release a later visit by the same trainer.
  let lockSeq = 0
  function lockFor(name) { machine.lockedBy = name; machine.lockId = ++lockSeq; if (homeState === 'idle') renderHome('idle'); return machine.lockId }
  function unlock(name, id = machine.lockId) { if (machine.lockedBy === name && machine.lockId === id) machine.lockedBy = null; if (homeState === 'idle') renderHome('idle') }

  /**
   * Another trainer's tap, against the same machine: their own roll, and the
   * purchase screen if they get through to it and it's free.
   */
  function otherTaps(name, forced) {
    const { enc } = rollTap(name, streams[name], forced)
    const found = !enc && forced === undefined ? rollFind() : null
    if (found) feed(`<b>${name}</b> found ${findText(found)} by the machine.`)
    if (enc === 'wild' && streams[name]() < LEGEND_RATE) return otherLegend(name, streams[name])
    if (enc === 'wild') { const w = wildFrom(name, streams[name]); return feed(`<b>${name}</b> tapped: a wild <b>${w.name}</b> jumped out <small>(${seedOf(name).m.code}'s pool)</small>.`) }
    if (enc) return feed(`<b>${name}</b> tapped: ${ENC_TEXT[enc]}.`)
    if (machine.state !== 'in') return feed(`<b>${name}</b> tapped: ${machine.state === 'out' ? 'sold out' : 'under maintenance'}.`)
    if (machine.lockedBy) return feed(`<b>${name}</b> tapped, but ${machine.lockedBy === YOU ? 'you are' : machine.lockedBy + ' is'} on the purchase screen.`)
    const id = lockFor(name); feed(`<b>${name}</b> is on the purchase screen.`)
    setTimeout(() => { if (!live() || machine.lockId !== id) return; unlock(name, id); feed(`<b>${name}</b> finished buying.`) }, 7000 + Math.floor(Math.random() * 4000))
  }

  /**
   * Your tap. The stock state is the machine's; the encounter is your own
   * roll. With nothing waiting on a stocked machine you go to the purchase
   * screen, unless another trainer is already on it. `force` pins the
   * encounter (the demo, "Your next tap"); `force.plan` is a demo script.
   */
  /** This restock's shelf: each enabled supply (and bundle) with its rate as the chance; a MOVE DISC slot becomes one random disc. */
  function rollShelf() {
    return [...Object.keys(SHOP).filter((k) => SHOP[k].on && (k !== 'summon' || (nextGym() < GYMS.length && (nextGym() < 8 || champion))) && (k !== 'elite' || (leagueNow() && !bag[summonKey(leagueNow())])) && !(ITEMS[k].key && bag[k]) && flavor() * 100 < SHOP[k].rate)
      .map((k) => { if (k !== 'disc') return k; const n = pickOf(DISC_POOL); discItem(n); return discKey(n) }),
      ...BUNDLES.filter((b) => b.on && BUNDLE_ITEMS.some((i) => b.items[i] > 0) && flavor() * 100 < b.rate).map((b) => 'bundle:' + b.id)]
  }
  /**
   * The purchase screen is one trainer at a time: on a stocked machine, hold it
   * for you (in the app, claim the real one). `waiting`: someone else has it;
   * `refused`: the machine said no (your cooldown, no tokens, nothing left).
   */
  async function holdMachine(state) {
    const api = vvm()
    let waiting = state === 'in' && machine.lockedBy && machine.lockedBy !== YOU, refused = null
    if (state === 'in' && !waiting) {
      if (!api) lockFor(YOU)
      else {
        // The real machine: claim it. It can say no (someone beat you to it, your cooldown, no tokens, nothing left).
        const r = await api.claim().catch(() => ({ ok: false, reason: 'error' }))
        await syncMachine()
        if (r.ok) lockFor(YOU)
        else if (r.reason === 'busy') { waiting = true; machine.lockedBy = r.holder_name ?? machine.lockedBy ?? 'SOMEONE' }
        else refused = r
      }
    }
    return { waiting, refused }
  }
  /** The machine's screen for `state`, or, if holdMachine couldn't get it for you, why not. */
  function paintShelf(state, { waiting, refused }, blocked = false) {
    renderHome(refused && (refused.reason === 'not_stocked' || refused.reason === 'empty') ? 'out' : state, blocked)
    if (refused && refused.reason !== 'not_stocked' && refused.reason !== 'empty') {
      $('home').classList.add('waiting'); $('home').classList.remove('has-sup'); $('supplies').innerHTML = ''
      $('homeLine').textContent = { cooldown: 'COOLING DOWN', no_tokens: 'NO TOKENS' }[refused.reason] ?? "CAN'T START"
      $('homeSub').textContent = refused.reason === 'cooldown' ? `you just bought · back ${refused.expires_at ? `at ${new Date(refused.expires_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'soon'} · tap to go back`
        : refused.reason === 'no_tokens' ? 'no tokens left this month · tap to go back' : 'the machine said no · tap to go back'
    }
    if (waiting) { $('home').classList.add('waiting'); $('home').classList.remove('has-sup'); $('supplies').innerHTML = ''; $('homeLine').textContent = `${machine.lockedBy} IS USING IT`; $('homeSub').textContent = 'the purchase screen is one trainer at a time · tap to go back' }
  }
  async function tapMachine(force = {}) {
    const api = vvm()
    if (api) await syncMachine()   // the real stock state and holder, as of now
    const state = machine.state
    tickRest()   // beaten trainers' rest counts down with your taps
    if (rivalWait > 0) rivalWait--   // so does Alex's, after beating you
    for (const s of Object.values(story)) if (s.wait > 0) s.wait--   // and Herb's and Paul's
    if (storyGap.taps > 0) storyGap.taps--   // and the gap between story battles
    let { enc, pity } = rollTap(YOU, streams[YOU], 'enc' in force ? force.enc : undefined)
    // A kind of battle that's off (yours, or not live) doesn't jump out: the tap is an empty one.
    if ((enc === 'wild' && !modeOn('wild')) || ((enc === 'scalper' || enc === 'duo') && !modeOn('trainers'))) { enc = null; pity = false }
    // A rival battle that's due takes this tap: Alex is waiting at the machine (with trainer battles on, and a Pokémon that can fight).
    if (force.enc === 'rival' || (!demo && !('enc' in force) && rivalDue() && modeOn('trainers') && party.some((m) => m.hp > 0))) { enc = 'rival'; pity = false }
    // If not, a glitcher battle that's due: Herb or Paul caught at the machine.
    let glitcher = force.enc === 'story' ? force.who ?? storyDue() : null
    if (!glitcher && enc !== 'rival' && !demo && !('enc' in force) && modeOn('trainers') && party.some((m) => m.hp > 0)) glitcher = storyDue()
    if (glitcher) { enc = 'story'; pity = false }
    // Either way, the other story characters keep their distance for a while.
    if (!demo && (enc === 'rival' || glitcher)) storyGap = { taps: STORY_GAP + Math.floor(flavor() * 5), who: enc === 'rival' ? 'ALEX' : glitcher }
    // An empty tap may still turn up something small ("Your next tap" can ask for one; the demo's pinned taps never do).
    const found = enc ? null : force.find ? rollFind(true) : 'enc' in force ? null : rollFind()
    // Each enabled supply is on a stocked shelf with its appearance rate as the chance.
    // Bundles the same way, each with its own rate.
    if (state === 'in' && !api) shelfItems = force.items ?? rollShelf()
    $('tts').textContent = 'STARTING…'; sfx('select'); await W(450)
    // The purchase screen is one trainer at a time; encounters don't need it (a battle claims it on the way back, in backToMachine).
    const hold = enc ? { waiting: false, refused: null } : await holdMachine(state)
    await fadeThrough(async () => paintShelf(state, hold))
    if (found) collectFind(found)
    if (pity) feed(`<b>You</b>: after two empty taps, this one was sure to turn something up.`)
    if (enc === 'wild') return wildEncounter(force.plan, state, force.legend)
    if (enc === 'scalper') return scalperEncounter(force.plan, state)
    if (enc === 'rival') return rivalEncounter(state)
    if (enc === 'story') return storyEncounter(glitcher, state)
    if (enc === 'duo') return duoEncounter(force.plan, flavor() < 0.5 ? 'tag' : 'solo', state)
  }
  /** Back to idle, giving up the purchase screen if you had it. */
  const toIdle = () => fadeThrough(async () => { if (machine.lockedBy === YOU) { machine.lockedBy = null; vvm()?.release() } renderHome('idle') })
  async function firstEncounter(demoPlan) {
    toolsEnabled(false)
    const crew = [HERB, PAUL]
    Sound.music('vs')
    await wipeTrainer(async () => { $('homeLoiterer2')?.remove(); setScene(SCALPER_SCENES, sceneRoll); showLayer('battle'); vsSplash(crew, 2) })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    if (demo) cap('FIRST RESTOCK', "Your very first restock, and two scalpers are already camping it. You don't even have a Pokémon yet.")
    await W(1400)
    await talk(HERB, FIRST_TAUNT.HERB); await talk(PAUL, FIRST_TAUNT.PAUL)
    vsHide()
    // Alex steps in.
    sfx('select'); allySplash(ALEX, 'TRAINER · HERE TO HELP')
    if (demo) cap('ALEX', 'Alex steps in. He has you pick a starter, then fights beside you as your partner in a 2v2.')
    await W(1100)
    if (!party.length) {
      await talk(ALEX, ALEX.hello)
      vsHide()
      const me = await pickStarter()
      party.push(me); renderTools()
      if (demo) cap('IVS', `These numbers are this ${me.name}'s alone: a hidden value (IV) from 0 to 31 per stat, and a nature that boosts one stat 10% and lowers another.`)
      await summary(me, `Every ${me.name} rolls its own IVs and nature. No two are alike.`, `${me.name} joined your party!`, 'Its stats are its own.')
      allySplash(ALEX, 'YOUR PARTNER'); await W(500)
      await talk(ALEX, ALEX.picked(me.name))
    } else await talk(ALEX, ALEX.again)
    vsHide()
    Sound.music(trainerTheme())
    if (demo) cap('TUTORIAL', 'You command your Pokémon; Alex commands Porygon and hits his own rings. He explains each thing the first time it comes up.')
    // Gentle opponents, and a partner a little ahead of you.
    const foes = crew.map((T) => ({ mon: individual(DATA.trainer.find((t) => t.name === T.mon), 4, rand), owner: T }))
    const porygon = individual(DATA.trainer.find((t) => t.name === ALEX.mon), 8, rand)
    const out = await duoBattle({ foes, trainers: crew, allies: [{ mon: porygon, owner: ALEX }], tips: { who: ALEX, ...TUTORIAL_TIPS }, plan: demoPlan })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      for (const T of crew) { await trainerOn(T, 'down'); await talk(T, pickOf(T.outro), 'faceDown'); await trainerOff() }
      await out.exp(); out.cleanup()   // EXP after their parting words, then tokens
      await payTokens(1.75, 'tutorial', 'The VVM is free!')
      for (const T of crew) await loot(T)
      await trainerOn(ALEX); await talk(ALEX, ALEX.won); await starterKit(); await trainerOff()
      tutorialDone = true; showTools(true)
      Sound.stopMusic(); await backToMachine('idle')
    } else {
      out.cleanup()
      await trainerOn(ALEX); await talk(ALEX, ALEX.lost); await starterKit(); await trainerOff()
      showTools(true)
      party.forEach((m) => { m.hp = m.stats.hp })   // Alex patches you up
      Sound.stopMusic(); await backToMachine('in', true)
      await campOut(crew)
    }
  }
  /** The VS splash's slide-ins. `fill: 'both'` holds each one at its start during
   *  its delay; without it they sat in place, jumped out, then slid in again. */
  function vsIn(vs) {
    const o = (delay, duration, easing = 'ease-out') => ({ delay, duration, easing, fill: 'both' })
    anim(vs.querySelector('.b1'), [{ transform: 'skewY(-12deg) translateX(-110%)' }, { transform: 'skewY(-12deg) translateX(0)' }], o(250, 300))
    anim(vs.querySelector('.b2'), [{ transform: 'skewY(-12deg) translateX(110%)' }, { transform: 'skewY(-12deg) translateX(0)' }], o(250, 300))
    anim($('vsImg').parentElement, [{ transform: 'translateX(240px)' }, { transform: 'none' }], o(400, 420, 'cubic-bezier(.2,.8,.3,1)'))
    anim(vs.querySelector('.big'), [{ transform: 'scale(3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], o(760, 260))
    anim(vs.querySelector('.name'), [{ transform: 'translateX(-260px)' }, { transform: 'none' }], o(620, 320))
  }

  /** Watch 2v2: a party of two, straight to the tag team. */
  async function duoDemo() {
    for (const n of ['FUECOCO', 'QUAXLY']) {
      const m = individual(DATA.starters.find((s) => s.name === n), 15, rand); m.hp = m.stats.hp; party.push(m)
      // The script's moves, equipped (the level schedule alone would carry others).
      learn(m); m.moves = n === 'FUECOCO' ? ['TACKLE', 'DOUBLE HIT', 'HOWL', 'HEAT WAVE'] : ['POUND', 'WATER SHURIKEN', 'LIFE DEW', 'SURF']
      for (const x of m.moves) if (!m.learned.includes(x)) m.learned.push(x)
    }
    discItem('HELPING HAND'); bag[discKey('HELPING HAND')] = 1
    showTools(true); renderTools()
    cap('2V2', 'A party of two at Lv 15: FUECOCO and QUAXLY. Each carries four moves into battle.')
    await backToMachine('out'); await W(1300)
    // Moves come with levels: the Box shows what each has learned, and what's next.
    cap('LEVELS', 'Moves are learned with levels: a type move at 3, QUICK ATTACK at 6, multi-hit at 9, support at 12, spread at 15. At Lv 15 FUECOCO knows six and carries four.')
    hot($('tBox')); sfx('select')
    let sh = openSheet('box'); await W(1400)
    await sh.tap('[data-mon="0"]', 3600)
    hot($('sheetClose')); closeSheetNow(); await W(500)
    // ...and Move Discs teach anything else.
    cap('MOVE DISC', 'Move Discs teach a move straight away. QUAXLY learns HELPING HAND from one, then swaps it in for WATER SHURIKEN.')
    hot($('tBag')); sfx('select')
    sh = openSheet('bag'); await W(1300)
    await sh.tap('[data-tab="discs"]', 700)
    await sh.tap(`[data-item="${discKey('HELPING HAND')}"]`, 1200)
    await sh.tap('[data-target="1"]', 2200)
    await sh.tap('[data-slot="1"]', 800); await sh.tap('[data-learn="HELPING HAND"]', 1800)
    hot($('sheetClose')); closeSheetNow(); await W(600)
    await duoEncounter([
      { cap: ['PRIORITY', "QUAXLY's HELPING HAND has +5 priority: it goes before everyone and powers up FUECOCO's next move ×1.5 (×1.75 on a PERFECT)."],
        cmds: [{ move: 'DOUBLE HIT', target: 1, planned: ['perfect', 'great'] }, { move: 'HELPING HAND', planned: 'perfect' }],
        foes: { GHOLDENGO: { move: 'MAKE IT RAIN', target: 1 }, HIPPOWDON: { move: 'BULLDOZE' } },
        defend: ['parry', 'parry', 'parry', 'jump', 'jump'],
        capAt: { 'MAKE IT RAIN': ['TARGETS', 'Attacks pick a target: the ring shows up on whichever of yours is hit. Parry all three for a counter.'],
          BULLDOZE: ['SPREAD', 'BULLDOZE hits both of yours: two rings, two jumps.'],
          'DOUBLE HIT': ['MULTI-HIT', 'DOUBLE HIT hits twice: one ring per hit, and only landing both deals full damage.'] } },
      { cap: ['BUFF', 'HOWL raises ATTACK for both of yours, so physical hits like DOUBLE HIT land harder from here on.'],
        cmds: [{ move: 'HOWL', planned: 'perfect' }, { move: 'LIFE DEW', planned: 'great' }],
        foes: { GHOLDENGO: { move: 'LOW KICK', target: 0 }, HIPPOWDON: { move: 'CRUNCH', target: 1 } },
        defend: ['late', 'dodge'],
        capAt: { 'LIFE DEW': ['HEAL', 'LIFE DEW heals both of yours. The ASSIST ring scales it: a GREAT heals more than an OK.'] } },
      { cap: ['SPREAD', 'HEAT WAVE hits both foes. SURF hits everyone else, FUECOCO included, so FUECOCO jumps it.'],
        cmds: [{ move: 'HEAT WAVE', planned: ['perfect', 'great'] }, { move: 'SURF', planned: ['great', 'perfect'] }],
        foes: { GHOLDENGO: { move: 'SHADOW BALL', target: 1 }, HIPPOWDON: { move: 'SLACK OFF' } },
        defend: ['parry'],
        capAt: { 'SLACK OFF': ['THEIRS TOO', 'Scalpers\' Pokémon have support moves as well: HIPPOWDON patches itself up with SLACK OFF.'],
          SURF: ['FRIENDLY FIRE', 'SURF rolls on into your own partner. Its ring is the amber JUMP oval: jump it and FUECOCO takes nothing.'] } },
      { cap: ['STACKED', 'ATTACK is up two stages from HOWL: DOUBLE HIT lands twice as hard.'],
        cmds: [{ move: 'DOUBLE HIT', target: 1, planned: ['perfect', 'perfect'] }, { move: 'SURF', planned: ['perfect', 'perfect'] }] },
      { cmds: [{ move: 'HEAT WAVE', planned: ['perfect', 'perfect'] }, { move: 'SURF', planned: ['perfect', 'perfect'] }] },
      { cmds: [{ move: 'HEAT WAVE', planned: ['perfect', 'perfect'] }, { move: 'POUND', target: 0, planned: 'perfect' }] },
    ])
    cap('FREE', 'Both scalpers beaten: their tokens add up, and the machine is back to normal.')
    await W(3000)
  }
  /* ── effects ── */
  function pop(text, x, y, cls = '') {
    const el = document.createElement('div'); el.className = 'pop ' + cls
    el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px'; fx.appendChild(el)
    anim(el, [{ transform: 'translate(-50%,8px) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-4px) scale(1.15)', opacity: 1, offset: .25 },
      { transform: 'translate(-50%,-14px) scale(1)', opacity: 1, offset: .75 }, { transform: 'translate(-50%,-22px)', opacity: 0 }], { duration: 950 })
    setTimeout(() => el.remove(), 1000)
  }
  function sparks(x, y, color = '#fde047', n = 10) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('div'), a = (i / n) * Math.PI * 2, d = 26 + (i % 3) * 9
      s.style.cssText = `position:absolute;left:${x - 3}px;top:${y - 3}px;width:6px;height:6px;background:${color};box-shadow:0 0 6px ${color}`
      fx.appendChild(s)
      anim(s, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`, opacity: 0 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' })
      setTimeout(() => s.remove(), 460)
    }
  }
  function flash(color = '#fff', o = .8, dur = 160) { const f = $('flash'); f.style.background = color; anim(f, [{ opacity: o }, { opacity: 0 }], { duration: dur }) }
  function shake(px = 6, dur = 360) { $('screen').animate([0, -px, px, -px * .7, px * .7, -px * .3, 0].map((v) => ({ transform: `translate(${v}px, ${v * .3}px)` })), { duration: dur }) }
  async function blink(el, n = 3) { for (let i = 0; i < n; i++) { el.style.opacity = '0'; await W(65); el.style.opacity = '1'; await W(65) } }
  function ring(cx, cy, approach, label) {
    // An evasive target (veil, its evasion stage) is a smaller mark: about a fifth smaller each stage.
    const R = veil > 0 ? Math.round(32 * (1 - 0.18 * Math.min(3, veil))) : 32
    const t = document.createElement('div'); t.className = 'target'; t.style.cssText = `left:${cx - R}px;top:${cy - R}px;width:${R * 2}px;height:${R * 2}px`
    const r = document.createElement('div'); r.className = 'ring'; r.style.cssText = `left:${cx - R}px;top:${cy - R}px;width:${R * 2}px;height:${R * 2}px`
    if (wobble) { t.classList.add('wobble'); r.classList.add('wobble') }
    if (veil > 0) for (const el of [t, r]) { el.classList.add('veil'); el.dataset.veil = String(Math.min(3, veil)) }
    fx.append(t, r)
    let g = null
    if (label) { g = document.createElement('div'); g.className = 'glyph'; g.textContent = label; g.style.left = cx + 'px'; g.style.top = (cy - R - 20) + 'px'; fx.appendChild(g) }
    anim(r, [{ transform: 'scale(2.6)', opacity: .1 }, { transform: 'scale(1)', opacity: 1 }], { duration: approach, easing: 'linear' })
    return { el: r, clear: () => { t.remove(); r.remove(); g?.remove() } }
  }
  function accuracy(dt) {
    if (dt <= 40) return { label: 'PERFECT', mult: 1.6, crit: true, color: '#fde047' }
    if (dt <= 320) {
      const mult = 1.45 - (dt - 40) / 280 * 0.65
      const label = dt <= 120 ? 'GREAT' : dt <= 220 ? 'GOOD' : 'OK'
      return { label, mult, crit: false, color: label === 'GREAT' ? '#86efac' : label === 'GOOD' ? '#7dd3fc' : '#e2e8f0' }
    }
    return { label: 'MISS', mult: 0.7, crit: false, color: '#fca5a5' }
  }
  /** `tight` < 1 narrows every grade's window (an accuracy drop). */
  /**
   * Mash A as fast as you can for `ms`: the taps counted. The button counts
   * them up and fills as you go; `goal` is where it's full.
   */
  async function mash(label, goal, ms = 1600) {
    let n = 0
    panel('pStrike'); const b = $('bStrike')
    const draw = () => { b.innerHTML = `${label}<small style="font-size:12px;margin-top:6px">${n} / ${goal} · mash A!</small><span class="key">A</span>`; b.style.background = `linear-gradient(90deg, rgb(255 255 255 / .28) ${Math.min(100, n / goal * 100)}%, transparent 0)` }
    draw()
    const off = listen((btn) => { if (btn === 'a' && n < goal) { n++; sfx('select'); draw() } })
    await W(ms); off(); b.style.background = ''; panel(null)
    return n
  }
  /** One of yours is asleep at its turn: mash A to wake it early. */
  async function mashWake(at) {
    pop('Zzz…', at.x, at.y - 70, 'small')
    return (await mash('WAKE UP!', 12)) >= 12
  }
  /*
   * Other ways to land a move than one STRIKE ring (`input` on the move).
   * Each gives back a grade like a ring does: PERFECT ×1.6 (a crit), GREAT
   * ×1.35, GOOD ×1.1, OK ×0.9, MISS ×0.7. The scripted demo sticks to rings.
   *  · charge (Hyper Beam, Fire Blast…): hold A, let go in the gold zone.
   *    Hold on past full and it fizzles.
   *  · mash (Outrage, Thrash…): tap A as fast as you can.
   *  · swipe (Cross Chop, X-Scissor…): enter the arrows shown, in time.
   *  · twin (Double Kick, Dual Chop…): two rings close one after the other.
   *  · track (Psychic, Ice Beam…): hold A while the dot is in the bright arc.
   *  · rhythm (Sing): tap on the beat, four times.
   */
  const GRADE = { PERFECT: { mult: 1.6, crit: true, color: '#fde047' }, GREAT: { mult: 1.35, color: '#86efac' }, GOOD: { mult: 1.1, color: '#7dd3fc' }, OK: { mult: 0.9, color: '#e2e8f0' }, MISS: { mult: 0.7, color: '#fca5a5' } }
  const grade = (label, mult) => ({ label, crit: false, ...GRADE[label], ...(mult != null ? { mult } : {}) })
  const byShare = (x) => grade(x >= 1 ? 'PERFECT' : x >= 0.75 ? 'GREAT' : x >= 0.5 ? 'GOOD' : x >= 0.25 ? 'OK' : 'MISS')
  function strikeBtn(title, how) { panel('pStrike'); $('bStrike').innerHTML = `${title}<small style="font-size:12px;margin-top:6px">${how}</small><span class="key">A</span>` }
  async function chargeTap(cx, cy) {
    strikeBtn('HOLD A', 'let go in the gold zone')
    const m = document.createElement('div'); m.className = 'meter'; m.style.left = (cx + 46) + 'px'; m.style.top = (cy - 62) + 'px'
    m.innerHTML = '<div class="zone" style="bottom:82%;height:14%"></div><div class="fill"></div>'; fx.appendChild(m)
    const fill = m.querySelector('.fill'), FILL = 1100, start = performance.now()
    let t0 = null, out = null
    const offD = listen((b, t) => { if (b === 'a' && t0 == null) t0 = t })
    const offU = listenUp((b, t) => { if (b === 'a' && t0 != null && out == null) out = t })
    let over = false
    for (;;) {
      const now = performance.now()
      if (out != null) break
      if (t0 == null) { if (now - start > 3500) break }
      else { const f = (now - t0) / FILL; fill.style.height = Math.min(100, f * 100) + '%'; if (f >= 1) m.classList.add('over'); if (f > 1 + 300 / FILL) { over = true; break } }
      await W(16)
    }
    offD(); offU(); panel(null)
    const f = t0 == null ? 0 : ((out ?? performance.now()) - t0) / FILL
    const g = t0 == null ? grade('MISS') : over ? grade('MISS', 0.5) : f >= 0.82 && f <= 0.96 ? grade('PERFECT') : f >= 0.96 ? grade('GOOD') : f >= 0.65 ? grade('GREAT') : f >= 0.45 ? grade('GOOD') : f >= 0.25 ? grade('OK') : grade('MISS')
    if (over) pop('FIZZLED', cx, cy - 70, 'red small')
    await W(200); m.remove(); return g
  }
  async function mashStrike(goal = 14) { return byShare((await mash('MASH A!', goal, 2000)) / goal) }
  async function swipeSeq(n = 3, ms = 2400) {
    const keys = ['left', 'up', 'down', 'right'], glyph = { left: '◀', up: '▲', down: '▼', right: '▶' }
    const want = Array.from({ length: n }, () => keys[Math.floor(Math.random() * 4)])
    const cue = $('padCue'); cue.innerHTML = want.map((k) => `<i>${glyph[k]}</i>`).join(''); panel('pPad')
    let i = 0, bad = false
    const off = listen((b) => { if (bad || i >= n || !keys.includes(b)) return; const ok = b === want[i]; cue.children[i].className = ok ? 'ok' : 'bad'; sfx(ok ? 'select' : 'flinch'); if (ok) i++; else bad = true })
    const t0 = performance.now(); while (performance.now() - t0 < ms && i < n && !bad) await W(30)
    off(); await W(160); panel(null)
    return grade(i >= n ? 'PERFECT' : i === n - 1 ? 'GREAT' : i >= 1 ? 'OK' : 'MISS')
  }
  async function twinTap(cx, cy, approach, tight) {
    strikeBtn('HIT 1 · HIT 2', 'two rings: tap each as it closes')
    const gap = 300, t0 = performance.now(), closes = [t0 + approach, t0 + approach + gap]
    const rgs = [ring(cx - 22, cy + 6, approach, '1'), ring(cx + 22, cy - 6, approach + gap, '2')], taps = []
    const off = listen((b, t) => { if (b !== 'a' || taps.length >= 2) return; const k = taps.length; taps.push(t); rgs[k].el.getAnimations().forEach((a) => a.pause()); rgs[k].el.style.borderColor = accuracy(Math.abs(t - closes[k]) / tight).color })
    await W(approach + gap + 240); off(); await W(120); rgs.forEach((r) => r.clear()); panel(null)
    return closes.map((c, k) => accuracy(taps[k] == null ? Infinity : Math.abs(taps[k] - c) / tight))
  }
  async function trackHold(cx, cy, ms = 2200) {
    strikeBtn('HOLD A', 'only while the dot is in the bright arc')
    const box = document.createElement('div'); box.className = 'track'; box.style.left = (cx - 56) + 'px'; box.style.top = (cy - 56) + 'px'
    box.innerHTML = '<div class="arc"></div><div class="dot"></div>'; fx.appendChild(box)
    const arc = box.querySelector('.arc'), dot = box.querySelector('.dot'), SPAN = 70
    let inT = 0, inHeld = 0, outT = 0, outHeld = 0, last = performance.now(); const t0 = last
    while (performance.now() - t0 < ms) {
      const now = performance.now(), dt = now - last, k = (now - t0) / 1000; last = now
      const a = (k * 200) % 360, c = (360 - (k * 90) % 360 + 140) % 360   // the dot goes round one way, the arc the other
      arc.style.background = `conic-gradient(from ${c - SPAN / 2}deg, rgb(250 204 21 / .75) 0 ${SPAN}deg, rgb(255 255 255 / .15) ${SPAN}deg)`
      dot.style.left = (56 + 49 * Math.sin(a * Math.PI / 180)) + 'px'; dot.style.top = (56 - 49 * Math.cos(a * Math.PI / 180)) + 'px'
      const inside = Math.abs(((a - c + 540) % 360) - 180) <= SPAN / 2, on = !!btnDown.a
      box.classList.toggle('on', on)
      if (inside) { inT += dt; if (on) inHeld += dt } else { outT += dt; if (on) outHeld += dt }
      await W(16)
    }
    panel(null); box.remove()
    return byShare(Math.max(0, (inT ? inHeld / inT : 0) - (outT ? outHeld / outT : 0) * 0.6) / 0.85)
  }
  /** Four beats after two count-in clicks: tap on each. How many of the four you hit. */
  async function rhythmTap(cx, cy, gap = 440) {
    strikeBtn('SING!', 'tap A on the beat · 4 beats')
    const row = document.createElement('div'); row.className = 'beats'; row.style.left = cx + 'px'; row.style.top = (cy - 92) + 'px'
    row.innerHTML = '<i></i>'.repeat(4); fx.appendChild(row)
    const t0 = performance.now() + gap * 2, beats = [0, 1, 2, 3].map((i) => t0 + i * gap), hits = [false, false, false, false]
    const off = listen((b, t) => { if (b !== 'a') return; const i = beats.findIndex((x) => Math.abs(t - x) <= 110); if (i >= 0 && !hits[i]) { hits[i] = true; row.children[i].className = 'hit' } })
    for (let i = -2; i < 4; i++) {
      const at = t0 + i * gap; while (performance.now() < at) await W(8)
      sfx(i < 0 ? 'select' : 'perfect'); if (i >= 0) row.children[i].classList.add('now')
      if (i > 0 && !hits[i - 1]) row.children[i - 1].className = 'miss'
    }
    await W(150); if (!hits[3]) row.children[3].className = 'miss'
    off(); await W(250); row.remove(); panel(null)
    return hits.filter(Boolean).length
  }
  /**
   * Protect against an incoming hit: hold B through the wind-up and let go
   * as the ring closes (within 0.15s). True if it held.
   */
  async function holdGuard(cx, cy, approach) {
    strikeBtn('HOLD B', 'let go as the ring closes'); const b = $('bStrike'); b.dataset.btn = 'b'
    const t0 = performance.now(), hitAt = t0 + approach, rg = ring(cx, cy, approach, 'GUARD')
    let downAt = btnDown.b || null, upAt = null
    const offD = listen((k, t) => { if (k === 'b' && downAt == null) downAt = t })
    const offU = listenUp((k, t) => { if (k === 'b' && downAt != null && upAt == null) upAt = t })
    await W(approach + 200); offD(); offU(); rg.clear(); b.dataset.btn = 'a'; panel(null)
    return downAt != null && downAt < hitAt - 250 && upAt != null && Math.abs(upAt - hitAt) <= 150
  }
  /** Lands one hit of a move by its `input`: a strike ring unless the move says otherwise. `h` is which hit. */
  let twinNext = null
  async function strikeInput(mv, h, cx, cy, label, approach, tight, planned) {
    if (demo || !mv.input) return timedTap(planned, cx, cy, label, approach, tight)
    if (mv.input === 'twin') {
      if (h === 1 && twinNext?.mv === mv && performance.now() - twinNext.at < 4000) { const a = twinNext.acc; twinNext = null; return a }
      const [a, b] = await twinTap(cx, cy, approach, tight); twinNext = { mv, acc: b, at: performance.now() }; return a
    }
    if (mv.input === 'charge') return chargeTap(cx, cy)
    if (mv.input === 'mash') return mashStrike()
    if (mv.input === 'swipe') return swipeSeq()
    if (mv.input === 'track') return trackHold(cx, cy)
    return timedTap(planned, cx, cy, label, approach, tight)
  }
  /** A one-off chance roll that never fires in the scripted demo, so the demo plays out the same each time. */
  const chance = demo ? () => 1 : Math.random
  let wobble = false   // a confused Pokémon's strike rings wobble
  let veil = 0   // the target's evasion stage (1-3) when raised: your strike rings shrink, flicker and fade, more with each stage
  async function timedTap(planned, cx, cy, label, approach = 820, tight = 1) {
    const t0 = performance.now(), closeAt = t0 + approach
    let first = null
    const rg = ring(cx, cy, approach, label)
    const off = listen((btn, t) => {
      if (first || btn !== 'a' || t < t0) return
      first = t; rg.el.getAnimations().forEach((a) => a.pause()); rg.el.style.borderColor = accuracy(Math.abs(t - closeAt) / tight).color
    })
    if (demo) setTimeout(() => { if (live()) { hot($('bStrike')); press('a') } }, planned === 'perfect' ? approach - 20 : planned === 'great' ? approach - 90 : approach + 160)
    await W(approach); if (!first) await W(240)
    off(); await W(120); rg.clear()
    return accuracy(first == null ? Infinity : Math.abs(first - closeAt) / tight)
  }

  /* ── sprites, HUD ── */
  function place(el, src, cx, by, scale, maxH = Infinity, maxW = Infinity) {
    return new Promise((res) => {
      const img = el.querySelector('img'); let done = false
      const fin = () => {
        if (done) return; done = true
        // Tall or wide species shrink to fit, so none of them clip.
        const k = Math.min(scale, maxH / img.naturalHeight, maxW / img.naturalWidth)
        const w = img.naturalWidth * k, h = img.naturalHeight * k
        el.style.width = w + 'px'; el.style.height = h + 'px'; el.style.left = (cx - w / 2) + 'px'; el.style.top = (by - h) + 'px'
        res({ x: cx, y: by - h / 2 })
      }
      img.onload = fin; img.src = src
      if (img.complete && img.naturalWidth) fin()
    })
  }
  const C = { e: { x: 220, y: 74 }, p: { x: 100, y: 150 } }
  // Where each side's feet meet its platform, and the most room a sprite gets
  // there: the enemy stays below the top edge, the player below the foe's HUD.
  const FOOT = { e: { x: 220, y: 114, maxH: 106, maxW: 190 }, p: { x: 100, y: 194, maxH: 132, maxW: 190 } }
  const hpColor = (p) => (p > 50 ? '#4ade80' : p > 20 ? '#facc15' : '#f87171')
  function setHP(which, hp, max) {
    const bar = $(which === 'p' ? 'php' : 'ehp'), pct = Math.max(0, hp) / max * 100
    bar.getAnimations().forEach((a) => a.cancel()); bar.style.width = pct + '%'; bar.style.background = hpColor(pct)
    if (which === 'p') $('pnum').textContent = `${Math.max(0, hp)}/${max}`
  }
  async function drain(which, from, to, max) {
    const bar = $(which === 'p' ? 'php' : 'ehp')
    const a = from / max * 100, b = Math.max(0, Math.min(max, to)) / max * 100
    const dur = Math.min(700, 180 + Math.abs(from - to) * 40)
    anim(bar, [{ width: a + '%', background: hpColor(a) }, { width: b + '%', background: hpColor(b) }], { duration: dur })
    if (which === 'p') {
      const steps = Math.max(1, Math.abs(from - to))
      for (let i = 1; i <= steps; i++) { await W(dur / steps); $('pnum').textContent = `${Math.max(0, Math.round(from + (to - from) * i / steps))}/${max}` }
    } else await W(dur)
  }
  let pp = 3
  function setPP(n, gained = false) {
    pp = Math.max(0, Math.min(5, n))
    const pips = [...$('ppips').querySelectorAll('i')]; pips.forEach((p, i) => p.classList.toggle('on', i < pp))
    if (gained) { sfx('pp'); const p = pips[pp - 1]; if (p) anim(p, [{ transform: 'scale(2)' }, { transform: 'scale(1)' }], { duration: 280 }) }
  }

  function showSummary(mon, extra = '') {
    const [nat, up, dn] = mon.nature
    const rows = STAT_KEYS.map((k) => {
      const cls = up === k ? 'up' : dn === k ? 'dn' : '', mark = up === k ? ' ▲' : dn === k ? ' ▼' : ''
      const pct = mon.ivs[k] / 31 * 100
      const col = mon.ivs[k] >= 30 ? '#fde047' : mon.ivs[k] >= 21 ? '#4ade80' : mon.ivs[k] >= 11 ? '#60a5fa' : '#94a3b8'
      return `<tr><td class="k ${cls}">${STAT_LABEL[k]}${mark}</td><td class="v">${mon.stats[k]}</td><td class="bar"><div><i style="width:${pct}%;background:${col}"></i></div></td><td class="iv">IV <b>${mon.ivs[k]}</b>/31</td></tr>`
    }).join('')
    const total = STAT_KEYS.reduce((s, k) => s + mon.ivs[k], 0)
    const natLine = up ? `<b>${nat}</b> nature: <em>${STAT_LABEL[up]} +10%</em>, <i>${STAT_LABEL[dn]} −10%</i>` : `<b>${nat}</b> nature: no stat changes`
    $('sum').innerHTML = `<div class="pic"><img src="${spr(mon)}" style="height:80px" alt=""></div>
      <div class="hd"><b>${mon.name}</b><span class="lv">Lv ${mon.level}</span>
        <div class="types">${mon.types.map((t) => `<span style="background:${TYPE_COL[t]};color:#111">${t}</span>`).join('')}<span class="ivt">IV total <b>${total}</b>/186</span></div>
        <div class="nat">${natLine}</div></div>
      <table>${rows}</table><div class="evo">${extra}</div>`
    $('sum').style.display = 'block'
    anim($('sum'), [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 260 })
  }
  async function summary(mon, extra, line1, line2) {
    showSummary(mon, extra)
    panel('pNext'); msg0(line1, line2)
    if (demo) await demoPress('a', 3600, $('pNext').firstElementChild); else await waitFor(['a'])
    sfx('select'); panel(null); $('sum').style.display = 'none'
  }

  /* ── trainer on the field, and talking ── */
  function trainerOn(T, pose = 'body') {
    return new Promise((res) => {
      const el = $('trainer'), img = el.querySelector('img')
      const go = () => {
        // Scalpers stand on the far platform; a partner (Alex) on yours, nearer and bigger.
        const near = !!T.ally, h = near ? 150 : 108, w = img.naturalWidth / img.naturalHeight * h
        el.style.height = h + 'px'; el.style.width = w + 'px'; el.style.left = ((near ? 92 : 220) - w / 2) + 'px'; el.style.top = ((near ? 196 : 117) - h) + 'px'
        el.style.display = 'block'; el.style.visibility = 'visible'
        anim(el, [{ transform: `translateX(${near ? -200 : 200}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' }).finished.then(res)
      }
      img.style.imageRendering = T.pixel ? 'pixelated' : ''
      img.onload = go; img.src = ART[T[pose]]
      if (img.complete && img.naturalWidth) { img.onload = null; go() }
    })
  }
  async function trainerOff() {
    const near = parseFloat($('trainer').style.left) < 160
    await anim($('trainer'), [{ transform: 'none', opacity: 1 }, { transform: `translateX(${near ? -180 : 180}px)`, opacity: 0 }], { duration: 340, easing: 'ease-in' }).finished
    $('trainer').style.display = 'none'
  }
  async function talk(T, lines, face = 'face') {
    $('msg').style.display = 'none'; panel(null)
    $('face').src = ART[T[face]]; $('tag').textContent = T.short; $('talk').querySelector('.sub').textContent = T.role ?? 'SCALPER'; $('talk').style.display = 'block'
    for (const line of lines) {
      $('say').textContent = ''; $('hint').textContent = ''
      for (let i = 1; i <= line.length; i++) { $('say').textContent = line.slice(0, i); await W(Math.round(18 * APP.charMs / 13)) }
      $('hint').textContent = demo ? '' : matchMedia('(pointer: coarse)').matches ? 'TAP ▶' : 'A ▶'
      if (demo) await W(950); else await waitFor(['a'])
      sfx('advance')
    }
    $('talk').style.display = 'none'; $('msg').style.display = 'block'
  }

  /* ══════════ the battle, wild or trainer ══════════ */
  /** Transform and Conversion only last the battle: put everyone back after it, however it ends. */
  function restoreForms() { for (const m of party) if (m.form) { Object.assign(m, unformed(m)); delete m.form } }
  /** `m` as it really is, without a Transform or Conversion on it (a copy). */
  function unformed(m) {
    if (!m.form) return m
    const r = { ...m, id: m.form.id, types: m.form.types, moves: m.form.moves }; delete r.form
    r.stats = statsAt(r, r.level); r.hp = Math.min(r.hp, r.stats.hp); return r
  }
  async function battle(o) { try { return await battleCore(o) } finally { restoreForms() } }
  async function battleCore({ kind, foe, trainer, roster = [], plan, planD }) {
    let me = party.find((m) => m.hp > 0)
    const foeTeam = kind === 'trainer' ? [foe, ...roster] : null   // a wild Pokémon has no team to show
    watchBalls($('eBalls'), $('pBalls'), () => ({ enemy: foeTeam, enemyOut: [foe], mine: party, mineOut: [me] }), () => getComputedStyle($('battleL')).display !== 'none')
    // Stat stages for this battle (Howl, Growth). Switching out clears them, as in the games.
    const stg = new Map(), ST = (m) => { if (!stg.has(m)) stg.set(m, { atk: 0, spa: 0, acc: 0, eva: 0 }); return stg.get(m) }
    for (const m of party) m.toxN = 0   // bad poison counts up again from the start
    let weather = null   // { kind: 'rain' | 'sun', turns }
    const scr = { p: {}, e: {} }   // each side's REFLECT / LIGHT SCREEN turns left
    $('battleL').dataset.wx = ''
    let foeLast = null     // the last move the foe used on you (for Sketch and Disable)
    let wish = null        // { turns, amt }: Wish, healing whoever of yours is out
    let escaped = false    // Teleport
    const showTags = () => {
      const field = (m) => { const c = scr[m === me ? 'p' : 'e']; return [c.reflect && 'REFLECT', c.light && 'L.SCREEN', ST(m).protect && 'PROTECT', m === me && weather && WEATHER_TEXT[weather.kind][2]] }
      const line = (m) => { const t = ST(m); return statusChip(m) + [...statTags(t), ...stageTags(t), ...volTags(t), t.taunt && 'TAUNT', ...field(m)].filter(Boolean).map((x) => `<span>${x}</span>`).join('') }
      $('ptags').innerHTML = line(me); $('etags').innerHTML = line(foe)
    }
    const who = (m) => `${m === foe && kind === 'wild' ? 'The wild ' : ''}${m.name}`
    /** Inflict a status (from a hit or a move); false if it can't take it. */
    async function afflict(m, st) {
      if (!st || !canTake(m, st)) return false
      setStatus(m, st, rand); sfx(STATUS_SFX[st]); showTags()
      await say(who(m), STATUS_GOT[st], 400); return true
    }
    /** HP bar for either side. */
    const setHPOf = async (m, to) => { const from = m.hp; m.hp = Math.max(0, Math.min(m === foe ? foe.max : m.stats.hp, to)); await drain(m === me ? 'p' : 'e', from, m.hp, m === foe ? foe.max : m.stats.hp); renderTools() }
    /**
     * At its turn: can it move? Says why not. Flinching, sleep (one of yours
     * can be woken early by mashing A), freezing and paralysis, then
     * confusion, which may make it hurt itself instead.
     */
    async function blockedByStatus(m) {
      const t = ST(m)
      if (t.recharge) { t.recharge = false; await say(`${who(m)} must`, 'recharge!', 400); return true }
      if (t.flinch) { t.flinch = false; await say(who(m), "flinched and couldn't move!", 400); return true }
      if (m === me && m.status === 'slp' && !demo && (await mashWake(C.p))) { m.status = null; showTags(); await say(who(m), 'woke up!', 300) }
      else {
        const r = statusAtAction(m, rand)
        if (r === 'thaw' || r === 'wake') { showTags(); await say(who(m), STATUS_TEXT[r], 300) }
        else if (r) { await say(who(m), STATUS_TEXT[r], 500); return true }
      }
      if (t.conf) {
        if (!--t.conf) { showTags(); await say(who(m), 'snapped out of its confusion!', 300); return false }
        sfx('shadow'); await say(who(m), 'is confused!', 250)
        if (rand() < 1 / 3) {
          sfx('hit'); await Promise.all([blink(m === me ? $('player') : $('enemy')), setHPOf(m, m.hp - confusionDmg(m, t.atk))])
          await say('It hurt itself', 'in its confusion!', 350); return true
        }
      }
      return false
    }
    /** End of a turn for one Pokémon: burn or poison, Leech Seed (to `other`), Yawn, and the turn count. */
    async function endTurn(m, other) {
      if (m.hp <= 0) return
      const t = ST(m), d = statusTick(m)
      if (d) { sfx('hitWeak'); await setHPOf(m, m.hp - d); await say(who(m), `is hurt by ${m.status === 'brn' ? 'its burn' : 'poison'}!`, 300) }
      if (m.hp > 0 && t.seeded) {
        const sap = Math.min(m.hp, Math.max(1, Math.floor(m.stats.hp / 8))); sfx('hitWeak'); await setHPOf(m, m.hp - sap)
        if (other.hp > 0) { rise(other === me ? C.p : C.e, '#86efac', 'dot'); await setHPOf(other, other.hp + sap) }
        await say(`${who(m)}'s health is sapped`, 'by LEECH SEED!', 300)
      }
      if (m.hp > 0 && t.drowsy && !--t.drowsy) await afflict(m, 'slp')
      if (m.hp > 0 && t.cursed) { sfx('shadow'); await setHPOf(m, m.hp - Math.max(1, Math.floor(m.stats.hp / 4))); await say(who(m), 'is afflicted by the curse!', 300) }
      if (m.hp > 0 && t.perish && !--t.perish) { sfx('faint'); await setHPOf(m, 0); await say(`${who(m)}'s perish count`, 'fell to 0!', 350) }
      if (t.disabled && !--t.disabled.turns) { t.disabled = null; await say(`${who(m)} is no longer`, 'disabled.', 250) }
      if (t.taunt && !--t.taunt) await say(`${who(m)}'s taunt`, 'wore off.', 250)
      if (!t.protect) t.protectRun = 0
      t.flinch = false; t.protect = false; t.counter = null; t.turns = (t.turns ?? 0) + 1; showTags()
    }
    /** End of a turn for the field: the weather and each side's screens count down. */
    async function endField() {
      if (wish && !--wish.turns) { const amt = wish.amt; wish = null; if (me.hp > 0 && me.hp < me.stats.hp) { sfx('heal'); rise(C.p, '#86efac', 'dot'); await setHPOf(me, me.hp + amt); await say('The wish came true', `for ${me.name}!`, 300) } }
      if (weather && !--weather.turns) { await say(WEATHER_TEXT[weather.kind][1], '', 300); weather = null; $('battleL').dataset.wx = '' }
      for (const side of ['p', 'e']) for (const k of ['reflect', 'light']) if (scr[side][k] && !--scr[side][k]) await say(`${side === 'p' ? 'Your' : "The foe's"} ${k === 'reflect' ? 'REFLECT' : 'LIGHT SCREEN'}`, 'wore off.', 250)
      showTags()
    }
    /**
     * Stat moves, Protect, Counter, weather, screens and Taunt from `user`
     * (you or the foe). `acc` is its ASSIST timing (a foe's counts as GOOD).
     * False if it failed.
     */
    async function fieldMove(mv, user, acc) {
      const other = user === me ? foe : me, t = ST(user), side = user === me ? 'p' : 'e', miss = acc.label === 'MISS', n = acc.label === 'PERFECT' ? 2 : 1
      if (mv.effect === 'stat') {
        const target = mv.target === 'foe' ? other : user
        if (miss && target !== user) return false
        if (target !== user && ST(target).protect) { await say(who(target), 'protected itself!', 300); return true }
        for (const [k, by] of Object.entries(mv.stages)) await stage(target, k, by * n, target === foe)
        return true
      }
      if (mv.effect === 'protect') {
        if (miss || !protectWorks(t, chance)) { t.protectRun = 0; return false }
        t.protect = true; t.protectRun = (t.protectRun ?? 0) + 1; sfx('clang'); rise(user === me ? C.p : C.e, '#93c5fd', 'dot'); showTags()
        await say(who(user), 'protected itself!', 300); return true
      }
      if (mv.effect === 'counter') { if (miss) return false; t.counter = mv.cat; sfx('clang'); await say(who(user), `is ready to ${mv.cat === 'phys' ? 'COUNTER' : 'reflect special hits'}!`, 300); return true }
      if (mv.effect === 'weather') {
        if (miss || weather?.kind === mv.weather) return false
        weather = { kind: mv.weather, turns: acc.label === 'PERFECT' ? 6 : 5 }; $('battleL').dataset.wx = mv.weather; sfx('whoosh'); showTags()
        await say(WEATHER_TEXT[mv.weather][0], '', 350); return true
      }
      if (mv.effect === 'screen') {
        if (miss || scr[side][mv.screen]) return false
        scr[side][mv.screen] = acc.label === 'PERFECT' ? 6 : 5; sfx('clang'); showTags()
        await say(`${side === 'p' ? 'Your' : "The foe's"} side is guarded by`, `${mv.screen === 'reflect' ? 'REFLECT' : 'LIGHT SCREEN'}!`, 300); return true
      }
      if (mv.effect === 'taunt') {
        if (miss || ST(other).taunt) return false
        if (ST(other).protect) { await say(who(other), 'protected itself!', 300); return true }
        ST(other).taunt = 3; sfx('flinch'); showTags(); await say(who(other), 'fell for the taunt!', 300); return true
      }
      return false
    }
    /**
     * A sleep, poison, confusion, Leech Seed or Yawn move from `user` on
     * `target`, timed by `acc` (a foe's counts as GOOD). False if it failed.
     */
    async function applyStatusMove(mv, target, acc) {
      const t = ST(target), isFoe = target === foe
      if (mv.effect === 'status') return statusLands(mv, acc, rand) && afflict(target, mv.status)
      if (mv.effect === 'confuse' || mv.effect === 'swagger') {
        if (mv.effect === 'swagger' && acc.label !== 'MISS') await stage(target, 'atk', 2, isFoe)
        if (t.conf || !statusLands(mv, acc, rand)) return false
        t.conf = 2 + Math.floor(rand() * 3); sfx('shadow'); showTags(); await say(who(target), 'became confused!', 350); return true
      }
      if (mv.effect === 'seed') {
        if (t.seeded || target.types.includes('grass') || !statusLands(mv, acc, rand)) return false
        t.seeded = true; sfx('whoosh'); rise(isFoe ? C.e : C.p, '#86efac', 'dot'); showTags(); await say(who(target), 'was seeded!', 350); return true
      }
      if (mv.effect === 'yawn') {
        if (t.drowsy || !canTake(target, 'slp') || !statusLands(mv, acc, rand)) return false
        t.drowsy = 2; sfx('shadow'); showTags(); await say(who(target), 'grew drowsy!', 350); return true
      }
      return false
    }
    /** Transform: you become the foe for this battle (put back by restoreForms()). */
    async function transformInto(m, into) {
      m.form ??= { id: m.id, types: m.types, stats: m.stats, moves: m.moves }
      const names = levelMoves({ name: into.name, types: into.types }).filter(([lv, n]) => lv <= m.level && MOVEDEX[n]).map(([, n]) => n).slice(-4)
      m.id = into.id; m.types = [...into.types]; m.stats = { ...into.stats, hp: m.stats.hp }; m.moves = names.length ? names : m.moves
      sfx('shadow'); const pr = await place($('player'), spr(m, true), FOOT.p.x, FOOT.p.y, 2.0, FOOT.p.maxH, FOOT.p.maxW); C.p = { x: pr.x, y: Math.min(pr.y, 200) }
      if (m.shiny) shinySparkle(C.p)
      await say(`${m.name} transformed`, `into ${into.name}!`, 350)
    }
    /**
     * The signature moves (SPECIAL_EFFECTS) from `user`: you, or the foe for
     * the few it uses. False if it failed.
     */
    async function specialMove(mv, user, acc) {
      const other = user === me ? foe : me, t = ST(user), ot = ST(other), miss = acc.label === 'MISS'
      switch (mv.effect) {
        case 'metronome': {
          const n = metronomePick(true); sfx('select'); await say(`Waggling a finger let it use`, `${n}!`, 350)
          if (SUPPORT[n]) await useSupport(n, null, { free: true }); else await useMove(n, null, { free: true })
          return true
        }
        case 'sketch': {
          if (!foeLast || (!MOVEDEX[foeLast] && !SUPPORT[foeLast]) || learn(me).learned.includes(foeLast)) return false
          const r = teach(me, foeLast); sfx('levelup'); await say(`${me.name} sketched`, `${foeLast}!${r.equipped ? '' : ' (swap it in from the Box)'}`, 400); return true
        }
        case 'transform': if (miss || user !== me || user.form?.stats) return false; await transformInto(user, other); return true
        case 'curse': {
          const cost = Math.floor(user.stats.hp / 2)
          if (ot.cursed || user.hp <= cost) return false   // not enough HP left to pay for it
          sfx('shadow'); await setHPOf(user, user.hp - cost)
          ot.cursed = true; showTags(); await say(`${who(user)} cut its own HP`, `and laid a curse on ${who(other).replace(/^The/, 'the')}!`, 400); return true
        }
        case 'rest': {
          if (user.hp >= user.stats.hp) return false
          sfx('heal'); await setHPOf(user, user.stats.hp); user.status = 'slp'; user.sleep = 2; showTags()
          await say(`${who(user)} slept`, 'and became healthy!', 400); return true
        }
        case 'wish': if (wish) return false; wish = { turns: 2, amt: Math.floor(user.stats.hp / 2) }; sfx('perfect'); await say(`${who(user)} made a wish!`, '', 300); return true
        case 'disable': {
          if (miss || !foeLast || ot.disabled) return false
          ot.disabled = { name: foeLast, turns: 3 }; sfx('flinch'); showTags(); await say(`${who(other)}'s ${foeLast}`, 'was disabled!', 350); return true
        }
        case 'trap': if (ot.trapped) return false; ot.trapped = true; sfx('shadow'); showTags(); await say(`${who(other)} can no longer`, 'escape!', 350); return true
        case 'perish': {
          for (const m of [me, foe]) if (m.hp > 0 && !ST(m).perish) ST(m).perish = 3
          sfx('shadow'); showTags(); await say('All Pokémon that heard the song', 'will faint in three turns!', 450); return true
        }
        case 'baton': {
          const others = party.filter((m) => m.hp > 0 && m !== me); if (!others.length) return false
          let next = others[0]
          if (others.length > 1 && !demo) { drawParty(); panel('pParty'); msg0('Pass to which Pokémon?', ''); const p = await choose('pParty', null); panel(null); if (p !== 'back' && party[+p.slice(1)]?.hp > 0 && party[+p.slice(1)] !== me) next = party[+p.slice(1)] }
          const keep = Object.fromEntries(['atk', 'spa', 'def', 'spd', 'spe', 'acc', 'eva'].map((k) => [k, t[k] ?? 0]))
          await switchTo(next); Object.assign(ST(me), keep); showTags(); await say(`${me.name} took over`, 'with the stat changes!', 300); return true
        }
        case 'conversion': {
          const n = movesOf(user)[0], ty = (MOVEDEX[n] ?? SUPPORT[n])?.type
          if (!ty || (user.types.length === 1 && user.types[0] === ty)) return false
          user.form ??= { id: user.id, types: user.types, stats: user.stats, moves: user.moves }; user.types = [ty]; sfx('zap')
          await say(`${who(user)} became`, `the ${ty.toUpperCase()} type!`, 350); return true
        }
        case 'teleport': {
          if (kind === 'wild') {
            if (t.trapped) return false   // Mean Look holds it
            sfx('run'); await anim(user === me ? $('player') : $('enemy'), [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0, filter: 'brightness(3)' }], { duration: 360 }).finished
            if (user === me) { escaped = true; await say(`${me.name} teleported away!`, '', 350) }
            else { $('enemy').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'; fled = true; await say(`${who(foe)} teleported away!`, '', 500) }
            return true
          }
          // A trainer battle: a flash that lowers the other side's accuracy, then it switches out.
          sfx('zap'); flash('#fff', .85, 280); await stage(other, 'acc', -1, other === foe)
          if (user === me) {
            const others = party.filter((m) => m.hp > 0 && m !== me)
            if (!others.length || t.trapped) return true
            let next = others[0]
            if (others.length > 1 && !demo) { drawParty(); panel('pParty'); msg0('Switch to which Pokémon?', ''); const p = await choose('pParty', null); panel(null); const c = party[+p.slice(1)]; if (p !== 'back' && c?.hp > 0 && c !== me) next = c }
            await switchTo(next)
          } else if (roster.length) await foeSwap()
          return true
        }
      }
      return false
    }
    /** A stage change from a status move (or Mud-Slap), with its line. */
    async function stage(m, key, by, isFoe) {
      const t = ST(m), from = t[key] ?? 0, lim = key === 'acc' || key === 'eva' ? STAGE_MAX : 6; t[key] = Math.max(-lim, Math.min(lim, from + by))
      const name = `${isFoe && kind === 'wild' ? 'The wild ' : ''}${m.name}'s ${STAGE_WORD[key]}`
      if (t[key] === from) return say(name, `won't go any ${by > 0 ? 'higher' : 'lower'}!`)
      sfx(by > 0 ? 'levelup' : 'flinch'); rise(isFoe ? C.e : C.p, by > 0 ? '#93c5fd' : '#94a3b8', by > 0 ? 'arrow' : 'dot'); showTags()
      await say(name, `${by > 0 ? 'rose' : 'fell'}${Math.abs(by) > 1 ? ' sharply' : ''}!`, 300)
    }
    foe.max = foe.stats.hp; foe.turn = 0
    const movesFor = (f) => (f.roamer && LEGEND_MOVES[f.name]) || (kind === 'trainer' && trainer?.movesFor?.(f)) || (kind === 'trainer' && trainer?.sig && !roster.length && trainer.sig) || (kind === 'trainer' && (trainer?.region === 'kanto' || (trainer?.strong && roster.length)) && strongMoves(f)) || (kind === 'trainer' && TRAINER_MOVES[f.name]) || (f.name === 'MAGIKARP' ? MAGIKARP : WILD_MOVES[f.types[0]] ?? WILD_MOVES.normal)   // a leader's ace (their last) fights with the leader's own moves
    let restores = trainer?.hard ? trainer.restores ?? 1 : 0   // Full Restores in the bag: a Gym Leader's one, Alex's one to three
    let switches = trainer?.switches ?? 0   // times this trainer may still pull a Pokémon out (switchPick)
    let sigUsed = false    // a leader's signature status move, once a battle
    let quipped = false    // a leader's first tell always gets a quip; later ones, half the time
    let fled = false       // a roaming legendary ran
    let foeMoves = movesFor(foe)
    plan = plan ? [...plan] : null; planD = planD ? [...planD] : null

    $('ename').textContent = foe.name; $('elv').textContent = foe.level; setHP('e', foe.hp, foe.max)
    const er = await place($('enemy'), spr(foe), FOOT.e.x, FOOT.e.y, 1.6, FOOT.e.maxH, FOOT.e.maxW)
    C.e = { x: er.x, y: er.y }

    if (kind === 'wild') {
      Sound.music('wild')
      $('enemy').style.visibility = 'visible'
      await anim($('enemy'), [{ transform: 'translateX(-230px)', filter: 'brightness(0)' }, { transform: 'none', filter: 'brightness(0)', offset: .75 }, { transform: 'none', filter: 'brightness(1)' }], { duration: 760, easing: 'ease-out' }).finished
      $('enemy').getAnimations().forEach((a) => a.cancel())
      $('ehud').style.visibility = 'visible'; anim($('ehud'), [{ transform: 'translateX(-180px)' }, { transform: 'none' }], { duration: 280 })
      cry(foe)
      if (foe.roamer) { shake(8, 500); await say(`The roaming legendary ${foe.name}`, `appeared! (${Math.round(foe.hp / foe.max * 100)}% HP)`, 700) }
      else if (foe.shiny) { shinySparkle(C.e); await W(500); await say(`A wild shiny ${foe.name}`, 'appeared!', 600) }
      else await say(`A wild ${foe.name}`, 'appeared!', 300)
    } else {
      await trainerOn(trainer)
      if (roster.length) await say(`${trainer.short} has`, `${roster.length + 1} Pokémon on deck!`, 300)
      await say(...sentOut(trainer, foe), 120)
      sfx('ball'); await trainerOff()
      $('enemy').style.visibility = 'visible'; flash('#fff', .5, 180)
      cry(foe); await anim($('enemy'), [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380 }).finished
      $('ehud').style.visibility = 'visible'; anim($('ehud'), [{ transform: 'translateX(-180px)' }, { transform: 'none' }], { duration: 280 })
    }

    async function sendOut(m) {
      m.toxN = 0
      // A faint leaves its slide-and-clip held on the sprite (anim fills forwards); clear it or the next one comes out invisible.
      $('player').getAnimations().forEach((a) => a.cancel())
      const pr = await place($('player'), spr(m, true), FOOT.p.x, FOOT.p.y, 2.0, FOOT.p.maxH, FOOT.p.maxW)
      if (m.shiny) shinySparkle({ x: pr.x, y: Math.min(pr.y, 200) })
      C.p = { x: pr.x, y: Math.min(pr.y, 200) }
      await say(`Go! ${m.name}!`, '', 100)
      sfx('ball'); $('player').style.visibility = 'visible'; flash('#fff', .5, 180)
      cry(m); await anim($('player'), [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380 }).finished
      $('pname').textContent = m.name; $('plv').textContent = m.level; setHP('p', m.hp, m.stats.hp)
      $('pexp').getAnimations().forEach((a) => a.cancel()); $('pexp').style.width = (m.exp ?? 0) / expToNext(m.level) * 100 + '%'
      $('phud').style.visibility = 'visible'; anim($('phud'), [{ transform: 'translateX(180px)' }, { transform: 'none' }], { duration: 280 })
    }
    await sendOut(me); setPP(startPP(me)); showTags()   // PP: 1, or 2 for a quick nature

    /** A draining move: the user (its HUD `side` and spot `at`) gets back `amt` HP. */
    async function sapHP(mon, side, at, amt) {
      const max = mon.stats?.hp ?? mon.max, from = mon.hp; if (amt <= 0 || from <= 0 || from >= max) return
      mon.hp = Math.min(max, from + amt); sfx('heal'); rise(at, '#86efac', 'dot')
      await drain(side, from, mon.hp, max); pop(`+${mon.hp - from}`, at.x + 34, at.y - 40, 'green'); renderTools()
      await say(`${who(mon)} drained`, 'some HP!', 200)
    }
    function damage(att, def, mv, mult) {
      const spec = mv.cat === 'spec', guard = scr[def === me ? 'p' : 'e'][spec ? 'light' : 'reflect'] ? 0.5 : 1
      mult *= weatherMult(weather?.kind, mv.type) * guard
      const A = (spec ? att.stats.spa : att.stats.atk) * stageMult(ST(att)[spec ? 'spa' : 'atk']), D = (spec ? def.stats.spd : def.stats.def) * stageMult(ST(def)[spec ? 'spd' : 'def'] ?? 0)
      const base = Math.floor(Math.floor(Math.floor(2 * att.level / 5 + 2) * mv.power * A / D) / 50) + 2
      const stab = att.types.includes(mv.type) ? 1.5 : 1
      const eff = soften(gameMult(mv.type, def.types))
      const burn = att.status === 'brn' && mv.cat !== 'spec' ? 0.5 : 1
      return { dmg: Math.max(1, Math.round(base * stab * eff * mult * burn)), eff }
    }

    /* ── menus: one top level, each with its own page ── */
    function drawMain() {
      $('pMain').innerHTML =
        `<button class="btn bFight" data-act="fight">FIGHT</button>` +
        `<button class="btn bm3 a t-bag" data-act="bag">BAG</button>` +
        `<button class="btn bm3 b t-party" data-act="party">POKéMON</button>` +
        `<button class="btn bm3 c t-run" data-act="run">RUN</button>`
    }
    function drawFight() {
      const ms = movesOf(me)
      $('pFight').innerHTML = [0, 1, 2, 3].map((i) => {
        const n = ms[i]; if (!n) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const m = moveInfo(n)
        if (m.kind === 'support') return m.solo ? `<button class="btn fm${i} t-${m.type} sup${m.cost > pp || ST(me).taunt ? ' off' : ''}" data-act="m${i}">${n}<small>${ST(me).taunt ? 'taunted' : m.solo} · PP ${m.cost}</small></button>`
          : `<button class="btn fm${i} t-${m.type} sup off" data-act="m${i}">${n}<small>2v2 only</small></button>`
        return `<button class="btn fm${i} t-${m.type}${m.cost > pp ? ' off' : ''}" data-act="m${i}">${n}<small>${m.type.toUpperCase()}${m.hits ? ` · ${m.hits} HITS` : ''}${m.prio ? ' · FIRST' : ''} · ${m.cost ? `PP ${m.cost}` : '+1 PP'}</small></button>`
      }).join('') + `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
    }
    function drawBag() {
      // Everything you have, scrolling: balls, heals, Revive, then status cures.
      const down = party.some((m) => m.hp <= 0)
      $('pBag').classList.remove('six')
      $('pBag').innerHTML = bagPanel(BATTLE_ITEMS.filter((k) => bag[k] > 0).map((k) => {
        const it = ITEMS[k], ball = k === 'ball' || k === 'great'
        // Potions and cures for anyone in the party who needs one, out now or on the bench.
        const helps = !ball && !it.revive && helpedBy(k).length > 0
        const why = ball ? (kind === 'trainer' ? "not on a trainer's" : it.sub) : it.revive ? (down ? it.sub : 'nobody has fainted')
          : helps ? it.sub : it.cure ? 'nobody has that status' : 'everyone is at full HP'
        const off = ball ? kind === 'trainer' : it.revive ? !down : !helps
        return bagButton(k, bag[k], off, why)
      }))
      bagMore($('pBag'))
    }
    /** Who in your party an item can help: a Potion anyone hurt, a cure anyone with the status it fixes (not the fainted). */
    const helpedBy = (k) => party.filter((m) => m.hp > 0 && (ITEMS[k].cure ? !!m.status && ITEMS[k].cure.includes(m.status) : m.hp < m.stats.hp))
    /** Choose one of `list` (your Pokémon, up to six) for an item; null for back. */
    async function pickMon(list, line, sub = (m) => `${m.hp}/${m.stats.hp} HP`) {
      $('pParty').classList.toggle('six', list.length > 4)
      $('pParty').innerHTML = list.map((d, i) => `<button class="btn fm${i} t-party pmon" data-act="r${i}"><img src="${spr(d)}" alt=""><span style="flex:1;min-width:0">${d.name}<small>${sub(d)}${d === me ? ' · out now' : ''}</small></span></button>`).join('') +
        `<button class="btn fback t-run" data-act="back">◀ BACK</button>`
      panel('pParty'); msg0(line, '')
      const r = await choose('pParty', null); panel(null)
      return r === 'back' ? null : list[+r.slice(1)]
    }
    /** The party panel: all six (switching), or, `sending` after a faint, who goes in next (no going back). */
    function drawParty(sending = false) {
      const n = party.length > 4 ? 6 : 4
      $('pParty').classList.toggle('six', n === 6)
      $('pParty').innerHTML = [...Array(n).keys()].map((i) => {
        const m = party[i]; if (!m) return `<button class="btn fm${i} t-empty" disabled>—</button>`
        const pct = m.hp / m.stats.hp * 100
        return `<button class="btn fm${i} t-party pmon${m.hp <= 0 ? ' off' : ''}${m === me ? ' sel' : ''}" data-act="p${i}"><img src="${spr(m)}" alt=""><span style="flex:1;min-width:0">${m.name}<small>${m.hp}/${m.stats.hp} HP</small><span class="hpm"><i style="width:${pct}%;background:${hpColor(pct)}"></i></span></span></button>`
      }).join('') + (sending ? '' : `<button class="btn fback t-run" data-act="back">◀ BACK</button>`)
    }
    function choose(panelId, scripted) {
      return new Promise((resolve, reject) => {
        if (demo) {
          setTimeout(() => {
            if (!live()) return reject(STOP)
            hot($(panelId).querySelector(`[data-act="${scripted}"]`)); sfx('select')
            setTimeout(() => resolve(scripted), 200)
          }, 760)
          return
        }
        const cleanup = () => { $(panelId).removeEventListener('pointerdown', onTap); $(panelId).removeEventListener('click', onTap); offKey() }
        const onTap = (e) => {
          const b = e.target.closest('[data-act]')
          if (!b || (e.type === 'click') !== !!b.closest('.bagscroll')) return   // the scrolling list answers clicks, the rest pointerdown
          if (b.disabled || b.classList.contains('off') || !live()) return
          e.preventDefault(); hot(b); cleanup(); sfx('select'); resolve(b.dataset.act)
        }
        // B backs out of a sub-menu from the keyboard.
        const offKey = listen((k) => { if (k === 'b' && $(panelId).querySelector('[data-act="back"]')) { cleanup(); resolve('back') } })
        $(panelId).addEventListener('pointerdown', onTap); $(panelId).addEventListener('click', onTap)
      })
    }

    async function useMove(name, planned, opts = {}) {
      let mv = MOVEDEX[name]
      const hits = mv.hits ?? 1, plan_ = [].concat(planned ?? []), t = ST(me)
      await announce(`${me.name} used`, `${name}!`, 160)
      if (!opts.free) setPP(pp - mv.cost)
      if (mv.firstTurn && t.turns) { await say('But it failed!', `It only works on ${me.name}'s first turn out.`, 300); return }
      if (mv.sleepOk && !opts.snoring) { await say('But it failed!', `${me.name} isn't asleep.`, 300); return }
      // Moves whose power is worked out now: Flail by HP, Fury Cutter by its run, Knock Off on a trainer's Pokémon.
      if (mv.flail) mv = { ...mv, power: flailPower(me) }
      if (mv.furyCutter) { t.fury = t.lastMove === name ? Math.min(2, (t.fury ?? 0) + 1) : 0; mv = { ...mv, power: mv.power * 2 ** t.fury } }
      if (mv.knockOff && kind === 'trainer') mv = { ...mv, power: Math.round(mv.power * 1.5) }
      t.lastMove = name
      let landed = 0, crit = false, eff = 1, clean = false
      const sr = strikeRing(ringNet(ST(me).acc, ST(foe).eva))
      if (ST(me).conf) sr.tight *= 0.85
      wobble = !!ST(me).conf   // confused: its rings wobble
      veil = Math.max(0, ST(foe).eva ?? 0)   // an evasive foe: its rings flicker
      try {
        for (let h = 0; h < hits && foe.hp > 0; h++) {
          panel('pStrike'); $('bStrike').innerHTML = `${hits > 1 ? `HIT ${h + 1} / ${hits}` : 'STRIKE!'}<small style="font-size:12px;margin-top:6px">tap as the ring closes</small><span class="key">A</span>`
          const acc = await strikeInput(mv, h, C.e.x, C.e.y, hits > 1 ? `HIT ${h + 1}/${hits}` : 'STRIKE', Math.round((h ? 560 : 820) * sr.speed), sr.tight, plan_[h] ?? plan_.at(-1) ?? null)
          panel(null)
          // One ring per hit. Miss a ring and that hit misses, so only landing
          // every ring deals the move's full damage.
          if (hits > 1 && acc.label === 'MISS') { pop('MISSED', C.e.x, C.e.y - 70, 'red small'); sfx('dodge'); continue }
          pop(`${acc.label} ×${acc.mult.toFixed(1)}`, C.e.x - 24, C.e.y - 72, ACC_CLS[acc.label])
          sfx(mv.snd)
          await strikeFx(mv, C.p, C.e, $('player'), h > 0)
          const r = damage(me, foe, mv, acc.mult)
          if (mv.furyCutter && acc.label === 'MISS') t.fury = -1   // a miss starts the run over
          const from = foe.hp; foe.hp = Math.max(demo && kind === 'wild' ? 1 : 0, foe.hp - r.dmg)
          sfx(r.eff > 1 ? 'hitSuper' : r.eff < 1 ? 'hitWeak' : 'hit')
          if (r.eff > 1 || acc.crit) shake(6, 320)
          impactFx(C.e, mv.type, r.eff > 1 || acc.crit); hitReact($('enemy'), C.p, C.e, mv.type, r.eff > 1 || acc.crit)
          if (r.eff > 1 || acc.crit) await hitStop(mv.type)
          pop(`-${from - foe.hp}`, C.e.x + 34, C.e.y - 30, acc.crit ? 'gold' : '')
          await Promise.all([blink($('enemy'), hits > 1 ? 2 : 3), drain('e', from, foe.hp, foe.max)])
          if (mv.drain) await sapHP(me, 'p', C.p, Math.round((from - foe.hp) * mv.drain))
          if (mv.recoil && me.hp > 1) { await setHPOf(me, Math.max(1, me.hp - Math.max(1, Math.round((from - foe.hp) * mv.recoil)))); await say(me.name, 'is damaged by recoil!', 250) }   // it can't knock itself out
          if (mv.knockOff && restores > 0 && foe.hp > 0) { restores--; sfx('flinch'); await say(`${me.name} knocked away`, `${trainer.short}'s FULL RESTORE!`, 400) }
          if (acc.crit) addBond(me, 2)
          landed++; crit ||= acc.crit; eff = r.eff; if (acc.label !== 'MISS') clean = true
          if (foe.hp > 0 && foe.status === 'frz' && mv.type === 'fire') { foe.status = null; showTags(); await say(who(foe), STATUS_TEXT.thaw, 300) }
          if (foe.hp > 0) await afflict(foe, statusFromHit(foe, { ...mv, name }, rand))
          if (foe.hp > 0 && FLINCH[name] && (acc.label === 'PERFECT' || acc.label === 'GREAT') && chance() < FLINCH[name]) ST(foe).flinch = true
        }
      } finally { wobble = false; veil = 0 }
      // A 0-PP move that lands (any timing but MISS) builds PP: +1 per attack.
      if (mv.cost === 0 && clean) { setPP(pp + 1, true); pop('+1 PP', C.p.x - 30, C.p.y - 96, 'blue small') }
      if (mv.accDown && clean && foe.hp > 0) await stage(foe, 'acc', -mv.accDown, true)
      if (hits > 1) await say(landed === hits ? `Hit ${hits} times — full damage!` : `Hit ${landed} of ${hits} times.`)
      if (mv.recharge) ST(me).recharge = true
      if (mv.rampage && !crit && !ST(me).conf && me.hp > 0) { ST(me).conf = 2 + Math.floor(rand() * 2); showTags(); await say(me.name, 'became confused from fatigue!', 300) }
      if (crit) await say('A critical hit!')
      if (landed && eff > 1) await say("It's super effective!")
      if (landed && eff < 1) await say("It's not very effective...")
    }

    /** A self-targeting support move in a 1v1: Howl, Growth, Life Dew. The ASSIST ring sets how strong it is. */
    async function useSupport(name, planned, opts = {}) {
      const mv = moveInfo(name)
      await announce(`${me.name} used`, `${name}!`, 160)
      if (!opts.free) setPP(pp - mv.cost)
      panel('pStrike'); $('bStrike').innerHTML = 'ASSIST!<small style="font-size:12px;margin-top:6px">time it for a stronger effect</small><span class="key">A</span>'
      const acc = mv.input === 'rhythm' && !demo ? byShare((await rhythmTap(C.e.x, C.e.y)) / 4) : await timedTap(planned, C.p.x, C.p.y, 'ASSIST')
      panel(null); pop(acc.label, C.p.x, C.p.y - 72, ACC_CLS[acc.label])
      if (mv.effect === 'heal') {
        if (me.hp >= me.stats.hp) { await say(`${me.name}'s HP is full.`); return }
        const from = me.hp; me.hp = Math.min(me.stats.hp, me.hp + Math.ceil(me.stats.hp * Math.min(0.6, mv.amount * acc.mult)))
        sfx('heal'); rise(C.p, '#86efac', 'dot')
        await drain('p', from, me.hp, me.stats.hp); pop(`+${me.hp - from}`, C.p.x + 34, C.p.y - 40, 'green'); renderTools()
        await say(`${me.name} recovered`, `${me.hp - from} HP.`)
      } else if (mv.effect === 'cure') {
        if (!me.status) await say('But it failed!', `${me.name} has no status to cure.`, 300)
        else { me.status = null; sfx('heal'); rise(C.p, '#86efac', 'dot'); showTags(); await say(`${me.name}'s status`, 'returned to normal!', 300) }
      } else if (['status', 'confuse', 'swagger', 'seed', 'yawn'].includes(mv.effect)) { if (!(await applyStatusMove(mv, foe, acc))) await say('But it failed!', '', 300) }
      else if (FIELD_EFFECTS.includes(mv.effect)) { if (!(await fieldMove(mv, me, acc))) await say('But it failed!', '', 300) }
      else if (SPECIAL_EFFECTS.includes(mv.effect)) { if (!(await specialMove(mv, me, acc))) await say('But it failed!', '', 300) }
      else if (mv.effect === 'accDown') await stage(foe, 'acc', acc.crit ? -2 : -1, true)
      else if (mv.effect === 'evaUp') await stage(me, 'eva', acc.crit ? 2 : 1, false)
      else {
        const n = acc.crit ? 2 : 1, t = ST(me)
        t.atk = Math.min(6, t.atk + n); if (mv.effect === 'growth') t.spa = Math.min(6, t.spa + n)
        sfx('levelup'); rise(C.p, '#f87171', 'arrow'); showTags()
        await say(`${me.name}'s ${mv.effect === 'growth' ? 'ATK and SP.A' : 'ATTACK'}`, n > 1 ? 'rose sharply!' : 'rose!')
      }
    }

    async function throwBall(k, planned, forcedShakes) {
      if (kind === 'trainer') {
        await say("The trainer blocked the ball!", "Don't be a thief!"); return 'blocked'
      }
      bag[k]--; renderTools()
      await say('You threw a', `${ITEMS[k].name}!`, 120)
      panel('pStrike'); $('bStrike').innerHTML = 'THROW!<small style="font-size:12px;margin-top:6px">release as the ring closes</small><span class="key">A</span>'
      const acc = await timedTap(planned, C.e.x, C.e.y, 'THROW')
      panel(null)
      const throwMult = { PERFECT: 1.8, GREAT: 1.5, GOOD: 1.25, OK: 1.1, MISS: 1 }[acc.label]
      const tName = { PERFECT: 'Excellent!', GREAT: 'Great!', GOOD: 'Nice!', OK: '', MISS: '' }[acc.label]
      if (tName) pop(tName, C.e.x - 20, C.e.y - 72, acc.label === 'PERFECT' ? 'gold' : 'blue')
      sfx('throw')
      const ball = document.createElement('div'); ball.className = 'bigball' + (k === 'great' ? ' great' : '')
      // Thrown by the trainer behind the camera: it enters from the bottom-
      // left corner, below the top screen, rather than from the Pokémon.
      // Starting at the Pokémon left only ~140px across to climb ~100px, which
      // crammed the whole bend into a tight hook - the "ceiling".
      const S = { x: 6, y: 262 }
      ball.style.left = (S.x - 9) + 'px'; ball.style.top = (S.y - 9) + 'px'; fx.appendChild(ball)
      const dx = C.e.x - S.x, dy = (C.e.y + 2) - S.y
      // A real arc, sampled from a parabola: x moves evenly, y follows the
      // curve, and a constant step in time is what makes it slow near the top
      // and speed up on the way down.
      const SAMPLES = 32
      // Peak ~44px above the target, but never within 26px of the top edge.
      const peakY = Math.max(26, (C.e.y + 2) - 44)
      const apex = Math.min(peakY - S.y, Math.min(0, dy) - 4)
      // Vertex form through (0,0), (tPeak, apex) and (1, dy):
      //   y(t) = a·t² + b·t,  a = −apex / tPeak²,  b = −2·a·tPeak
      const tPeak = Math.sqrt(-apex) / (Math.sqrt(-apex) + Math.sqrt(dy - apex))
      const a = -apex / (tPeak * tPeak), b = -2 * a * tPeak
      const yAt = (t) => a * t * t + b * t
      const arc = Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const t = i / SAMPLES
        return { transform: `translate(${dx * t}px,${yAt(t)}px) rotate(${-720 * t}deg)` }
      })
      await anim(ball, arc, { duration: 620, easing: 'linear' }).finished
      sfx('absorb'); flash('#fecaca', .5, 200)
      await anim($('enemy'), [{ transform: 'scale(1)', filter: 'brightness(1)' }, { transform: 'scale(0)', filter: 'brightness(4) sepia(1) hue-rotate(-50deg)' }], { duration: 360, easing: 'ease-in' }).finished
      $('enemy').style.visibility = 'hidden'
      await anim(ball, [{ transform: `translate(${dx}px,${dy}px)` }, { transform: `translate(${dx}px,${dy + 38}px)`, offset: .6 }, { transform: `translate(${dx}px,${dy + 30}px)`, offset: .8 }, { transform: `translate(${dx}px,${dy + 38}px)` }], { duration: 420, easing: 'ease-in' }).finished
      let shakes = forcedShakes
      if (shakes == null) {
        const a = ((3 * foe.max - 2 * foe.hp) * foe.capture * (k === 'great' ? 1.5 : 1) * throwMult) / (3 * foe.max)
        const b = a >= 255 ? 65536 : 65536 / Math.pow(255 / a, 0.1875)
        shakes = 0; while (shakes < 4 && Math.random() * 65536 < b) shakes++
      }
      for (let i = 0; i < Math.min(3, shakes); i++) {
        await W(450); sfx('wobble')
        await anim(ball, [{ transform: `translate(${dx}px,${dy + 38}px) rotate(0)` }, { transform: `translate(${dx}px,${dy + 38}px) rotate(-24deg)`, offset: .3 }, { transform: `translate(${dx}px,${dy + 38}px) rotate(18deg)`, offset: .7 }, { transform: `translate(${dx}px,${dy + 38}px) rotate(0)` }], { duration: 420 }).finished
      }
      await W(420)
      if (shakes === 4) {
        sfx('click')
        for (let i = 0; i < 3; i++) { const s = document.createElement('div'); s.className = 'star'; s.style.left = (C.e.x - 5) + 'px'; s.style.top = (C.e.y + 34) + 'px'; fx.appendChild(s); anim(s, [{ transform: 'translate(0,0) scale(.4)', opacity: 1 }, { transform: `translate(${(i - 1) * 26}px,-30px) scale(1.2)`, opacity: 0 }], { duration: 700 }); setTimeout(() => s.remove(), 720) }
        Sound.music('caught')
        buzz([20, 50, 20, 50, 60])
        await say('Gotcha!', `${foe.name} was caught!`, 900)
        ball.remove(); return 'caught'
      }
      sfx('breakout'); flash('#fff', .6, 160); ball.remove()
      $('enemy').getAnimations().forEach((a) => a.cancel())
      $('enemy').style.visibility = 'visible'
      await anim($('enemy'), [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: .7 }, { transform: 'scale(1)' }], { duration: 300 }).finished
      await say(['Oh no! It broke free!', 'Aww! It appeared to be caught!', 'Aargh! Almost had it!', 'Gah! It was so close, too!'][Math.min(3, shakes)])
      return 'free'
    }

    const onLevel = (m) => { if (m === me) { $('plv').textContent = m.level; setHP('p', m.hp, m.stats.hp) } }
    const winExp = async () => { const n = expYield(foe, kind === 'trainer'); await gainExp(me, n, $('pexp'), onLevel); await shareExp(n, [me]) }

    /** The foe fainted: EXP, then the scalper's next Pokémon if they have one. Returns the result, or null to fight on. */
    async function foeDown() {
      sfx('faint')
      await anim($('enemy'), [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(100px)', clipPath: 'inset(0 0 100px 0)' }], { duration: 520, easing: 'ease-in' }).finished
      $('enemy').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'
      await say(`${kind === 'wild' ? 'The wild ' : `${trainer.short}'s `}${foe.name}`, 'fainted!')
      // A scalper's last one: they say their piece first, so EXP is handed back to run after it.
      if (kind === 'trainer' && !roster.length) return { result: 'won', exp: winExp }
      await winExp()
      if (kind !== 'trainer' || !roster.length) return { result: kind === 'wild' ? 'fainted' : 'won' }
      if (trainer.hard && roster.length === 1) { await trainerOn(trainer); await talk(trainer, trainer.last ?? [pickOf(LAST_MON).replaceAll('{mon}', roster[0].name)]); await trainerOff() }   // a battle's own words, if it has them (Alex unveiling Mewtwo)
      await sendInFoe(roster.shift())
      return null
    }
    /** Teleport in a trainer battle: the foe flashes out, and the trainer sends in their next one (it goes to the back of the line). */
    async function foeSwap() {
      await anim($('enemy'), [{ opacity: 1, filter: 'brightness(1)' }, { opacity: 0, filter: 'brightness(3)' }], { duration: 320 }).finished
      $('enemy').style.visibility = 'hidden'; stg.delete(foe); foe.charged = null; roster.push(foe)
      await say(`${trainer.short} called back`, `${foe.name}!`, 200)
      await sendInFoe(roster.shift())
    }
    /** A leader pulls its Pokémon out for `to`: the one coming back goes on the bench, ahead of the ace. */
    async function foeSwitchTo(to) {
      await say(`${trainer.short} withdrew`, `${foe.name}!`, 200)
      await anim($('enemy'), [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.1)' }], { duration: 320 }).finished
      $('enemy').style.visibility = 'hidden'; stg.delete(foe); foe.charged = null
      roster.splice(roster.indexOf(to), 1); roster.splice(roster.length - 1, 0, foe)
      await sendInFoe(to)
    }
    /** A trainer's next Pokémon comes out. */
    async function sendInFoe(next) {
      foe = next; foe.max = foe.stats.hp; foe.turn = 0; foeMoves = movesFor(foe); showTags()   // the new one starts with no stage changes
      await say(...sentOut(trainer, foe), 200)
      $('ename').textContent = foe.name; $('elv').textContent = foe.level; setHP('e', foe.hp, foe.max)
      $('enemy').getAnimations().forEach((a) => a.cancel())
      const er = await place($('enemy'), spr(foe), FOOT.e.x, FOOT.e.y, 1.6, FOOT.e.maxH, FOOT.e.maxW)
      C.e = { x: er.x, y: er.y }
      $('enemy').style.visibility = 'visible'; sfx('ball'); flash('#fff', .5, 180)
      cry(foe); await anim($('enemy'), [{ transform: 'scale(.1)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: .7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 380 }).finished
      $('ehud').style.visibility = 'visible'; anim($('ehud'), [{ transform: 'translateX(-180px)' }, { transform: 'none' }], { duration: 280 })
    }

    async function switchTo(m) {
      await say(`Come back, ${me.name}!`, '', 200)
      await anim($('player'), [{ transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }, { transform: 'scale(0)', opacity: 0, filter: 'brightness(3) sepia(1) hue-rotate(-50deg)' }], { duration: 320 }).finished
      $('player').getAnimations().forEach((a) => a.cancel()); $('player').style.visibility = 'hidden'
      stg.delete(me); me = m; await sendOut(me); showTags()
    }

    /**
     * Ground attacks, each timed to reach the player's feet at `approach` ms.
     * The ring and its ▲ JUMP! label are drawn by the caller.
     */
    function lowFx(mv, approach, E) {
      const a = FOOT.e, b = FOOT.p, dx = b.x - a.x, dy = b.y - a.y
      const COL = { water: ['#bfdbfe', '#3b82f6'], poison: ['#e9d5ff', '#9333ea'], psychic: ['#fbcfe8', '#db2777'], fire: ['#fed7aa', '#ea580c'], ice: ['#e0f2fe', '#38bdf8'], steel: ['#f1f5f9', '#64748b'], fighting: ['#fee2e2', '#dc2626'], dragon: ['#ddd6fe', '#6d28d9'] }
      const [hi, lo] = COL[mv.type] ?? ['#f8fafc', '#94a3b8']
      const piece = (css, frames, opts) => {
        const d = document.createElement('div'); d.style.cssText = 'position:absolute;pointer-events:none;' + css; fx.appendChild(d)
        anim(d, frames, { fill: 'both', ...opts }); setTimeout(() => d.remove(), opts.duration + Math.max(0, opts.delay ?? 0) + 40)
      }
      if (mv.fx === 'quake') {
        // A small hop (it used to clear 28px, enough to lift tall ones off the top), then the ground shakes.
        anim(E, [{ transform: 'translateY(0)' }, { transform: 'translateY(-14px)', offset: .82 }, { transform: 'translateY(0)' }], { duration: approach, easing: 'ease-in' })
      } else if (mv.fx === 'roll') {
        // The Pokémon itself rolls down to the player's feet and back, glowing in its move's colour.
        const glow = mv.type === 'normal' || mv.type === 'rock' ? 'brightness(1)' : `drop-shadow(0 0 6px ${lo})`
        const k = approach / (approach + 220)
        anim(E, [{ transform: 'translate(0,0) rotate(0)', filter: glow }, { transform: `translate(${dx}px,${dy}px) rotate(-900deg)`, filter: glow, offset: k }, { transform: 'translate(0,0) rotate(-1080deg)', filter: 'brightness(1)' }], { duration: approach + 220, easing: 'linear' })
        for (let i = 1; i <= 4; i++) piece(`left:${a.x - 6}px;top:${a.y - 3}px;width:12px;height:6px;border-radius:50%;background:rgba(255,255,255,.45)`,
          [{ transform: `translate(${dx * i / 5}px,${dy * i / 5}px)`, opacity: .9 }, { transform: `translate(${dx * i / 5}px,${dy * i / 5 - 6}px) scale(2)`, opacity: 0 }], { duration: 320, delay: approach * i / 5 })
      } else if (mv.fx === 'sweep') {
        // A low lunge, and a crescent that skims the platform at ankle height.
        const k = approach / (approach + 160)
        anim(E, [{ transform: 'translate(0,0)' }, { transform: 'translate(10px,-4px)', offset: k * .6 }, { transform: `translate(${dx + 30}px,${dy - 40}px)`, offset: k }, { transform: 'translate(0,0)' }], { duration: approach + 160, easing: 'ease-in' })
        piece(`left:${b.x - 84}px;top:${b.y - 24}px;width:130px;height:30px;border-radius:50%;border-bottom:5px solid ${hi};filter:drop-shadow(0 0 4px ${lo});opacity:0`,
          [{ transform: 'translateX(120px) scaleX(.3)', opacity: 0 }, { transform: 'translateX(0) scaleX(1)', opacity: 1, offset: .75 }, { transform: 'translateX(-50px) scaleX(1.1)', opacity: 0 }], { duration: 280, delay: approach - 210 })
      } else if (mv.fx === 'wave') {
        // A wave rises at the foe's platform and rolls across the ground, growing as it comes.
        anim(E, [{ transform: 'scale(1)' }, { transform: 'scale(1.06) translateY(-6px)', offset: .3 }, { transform: 'scale(1)' }], { duration: approach })
        piece(`left:${a.x - 40}px;top:${a.y - 36}px;width:80px;height:38px;border-radius:60% 60% 8px 8px / 100% 100% 8px 8px;background:linear-gradient(${hi},${lo} 65%);border-top:3px solid #fff;opacity:.92;transform-origin:50% 100%`,
          [{ transform: 'translate(0,0) scale(.3,.2)' }, { transform: `translate(${dx * .15}px,${dy * .15}px) scale(.8,.9)`, offset: .25 }, { transform: `translate(${dx}px,${dy}px) scale(1.7,1.1)`, offset: .92 }, { transform: `translate(${dx * 1.15}px,${dy * 1.08}px) scale(1.9,.3)`, opacity: 0 }], { duration: approach + 80, easing: 'ease-in' })
      } else if (mv.fx === 'current') {
        // Sparks crawl along the ground from the foe to the player.
        anim(E, [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) drop-shadow(0 0 6px #facc15)', offset: .3 }, { filter: 'brightness(1)' }], { duration: approach })
        for (let i = 0; i < 7; i++) piece(`left:${a.x - 6}px;top:${a.y - 6}px;width:12px;height:12px;background:#fde047;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);filter:drop-shadow(0 0 4px #facc15)`,
          [{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${dx * .5 + (i % 2 ? 9 : -9)}px,${dy * .5}px) rotate(180deg)`, offset: .5 }, { transform: `translate(${dx}px,${dy}px) rotate(360deg)` }], { duration: approach * .7, delay: approach * .3 + i * 22 - 130, easing: 'linear' })
      } else if (mv.fx === 'shadow') {
        // The foe's shadow peels off and slides under the player, then lunges up.
        anim(E, [{ opacity: 1 }, { opacity: .45, offset: .2 }, { opacity: .45, offset: .9 }, { opacity: 1 }], { duration: approach })
        piece(`left:${a.x - 32}px;top:${a.y - 9}px;width:64px;height:18px;border-radius:50%;background:radial-gradient(ellipse,rgba(30,10,60,.95),rgba(30,10,60,0) 70%)`,
          [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px)`, offset: .85 }, { transform: `translate(${dx}px,${dy - 30}px) scale(.6,3)`, opacity: 0 }], { duration: approach + 60, easing: 'ease-in' })
      } else if (mv.fx === 'vines') {
        // Grass ripples toward the player, and a knot of vines snaps up at the feet.
        anim(E, [{ transform: 'scale(1)' }, { transform: 'scale(1.06) translateY(-4px)', offset: .3 }, { transform: 'scale(1)' }], { duration: approach })
        for (let i = 1; i <= 5; i++) piece(`left:${a.x + dx * i / 6 - 6}px;top:${a.y + dy * i / 6 - 12}px;width:12px;height:12px;background:#4ade80;clip-path:polygon(0 100%,25% 20%,45% 100%,60% 0,80% 100%,100% 30%,100% 100%);transform-origin:50% 100%;opacity:0`,
          [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1, offset: .4 }, { transform: 'scaleY(0)', opacity: 0 }], { duration: 300, delay: approach * i / 6 - 200 })
        piece(`left:${b.x - 32}px;top:${b.y - 32}px;width:64px;height:32px;background:linear-gradient(#86efac,#15803d);clip-path:polygon(0 100%,15% 10%,30% 100%,45% 0,60% 100%,75% 15%,90% 100%,100% 40%,100% 100%);transform-origin:50% 100%;opacity:0`,
          [{ transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1.2)', opacity: 1, offset: .5 }, { transform: 'scaleY(0)', opacity: 0 }], { duration: 380, delay: approach - 170 })
      }
    }

    /** A leader's tell, by their Pokémon's type: fliers and tricksters feint, fighters go low then high, the rest strike twice. */
    const leaderTell = (m) => (['flying', 'psychic', 'ghost', 'dark'].includes(m.types[0]) ? 'feint' : ['fighting', 'rock', 'ground'].includes(m.types[0]) ? 'lowHigh' : 'double')
    const TELL_LABEL = { feint: 'FEINT!', double: '×2!', lowHigh: 'LOW → HIGH!' }
    /** Leaders' signature status moves (by art key). */
    const LEADER_STATUS = { koga: 'POISON POWDER', janine: 'POISON POWDER', erika: 'POISON POWDER', bugsy: 'POISON POWDER',
      karen: 'WILL-O-WISP', morty: 'WILL-O-WISP', blaine: 'WILL-O-WISP', lt_surge: 'THUNDER WAVE', sabrina: 'THUNDER WAVE', will: 'THUNDER WAVE', lance: 'THUNDER WAVE' }
    async function foeTurn() {
      // A roaming legendary attacks once, then runs on its second turn, keeping whatever HP it has left.
      if (foe.roamer && foe.turn >= 1 && !ST(foe).trapped) {
        sfx('run'); await anim($('enemy'), [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(260px)', opacity: 0 }], { duration: 520, easing: 'ease-in' }).finished
        $('enemy').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'
        await say(`${foe.name} fled!`, `It still has ${Math.round(foe.hp / foe.max * 100)}% of its HP.`, 700)
        fled = true; return
      }
      if (kind === 'trainer' && !demoNoBlunder && (await blunder(trainer, foe))) return
      if (await blockedByStatus(foe)) return
      // A wild Abra, Kadabra or Alakazam may just teleport away (not if Mean Look holds it).
      if (kind === 'wild' && TELEPORTERS.has(foe.name) && !ST(foe).trapped && chance() < TELEPORT_CHANCE) {
        await announce(`${who(foe)} used`, 'TELEPORT!', 300); foeLast = 'TELEPORT'
        await specialMove(SUPPORT.TELEPORT, foe, { label: 'GOOD', mult: 1 }); return
      }
      // The toughest leaders pull a Pokémon out of a bad matchup (switchPick), most of the time.
      if (switches > 0 && roster.length > 1 && !ST(foe).trapped && !foe.charged && !demo && rand() < 0.7) {
        const to = switchPick(foe, roster.slice(0, -1), me, movesOf(me).map((n) => MOVEDEX[n]), movesFor)
        if (to) { switches--; await foeSwitchTo(to); return }
      }
      // A Full Restore when a Pokémon is low: a Gym Leader keeps their one for the last Pokémon; with more
      // (Alex, later on), any Pokémon may get one, but the last of them is always kept for the last Pokémon.
      if (restores > 0 && (!roster.length || restores > 1) && foe.hp < foe.max * 0.35) {
        restores--
        await say(`${trainer.short} used`, 'a FULL RESTORE!', 300); sfx('heal')
        const from = foe.hp; foe.hp = foe.max; await drain('e', from, foe.hp, foe.max)
        await say(`${foe.name}'s HP was restored!`); return
      }
      // Leaders choose: usually the move that hits you hardest, sometimes the next best.
      const pickHard = () => {
        const score = (m) => (m.power ?? 0) * (m.hits ?? 1) * soften(gameMult(m.type, me.types)) * (foe.types.includes(m.type) ? 1.5 : 1)
        const ranked = foeMoves.filter((m) => !m.splash).slice().sort((a, b) => score(b) - score(a))
        return ranked[rand() < 0.7 ? 0 : Math.min(1, ranked.length - 1)]
      }
      // Leaders with a signature status move use it on purpose, once a battle, early, on a Pokémon that can take it.
      const sig = LEADER_STATUS[trainer?.key]
      if (sig && !sigUsed && !ST(foe).taunt && foe.turn < 2 && canTake(me, SUPPORT[sig].status) && rand() < 0.6) {
        sigUsed = true
        await announce(`${trainer.short}'s ${foe.name} used`, `${sig}!`, READ_MS)
        if (ST(me).protect) await say(who(me), 'protected itself!', 300)
        else if (!statusLands(SUPPORT[sig], { label: 'GOOD' }, rand)) await say('But it failed!', '', 300)   // never certain, a leader's included
        else await afflict(me, SUPPORT[sig].status)
        foe.turn++
        return
      }
      // Now and then (more often for leaders), once per Pokémon: its type's accuracy or evasion move.
      const statusTurn = !foe.roamer && !foe.usedStatus && !ST(foe).taunt && (window.__forceStatusMove || rand() < (trainer?.hard ? 0.25 : 0.1))   // __forceStatusMove: testing only
      // Only a move that would do something (moveWorks); with none, it attacks instead and may try again later.
      const sn = !statusTurn ? null : demo ? statusOf(foe) : foeStatusMove(foe, rand, !!trainer?.hard, (n) => moveWorks(n, foe, me, ST, { weather: weather?.kind, ...scr.e }))
      if (sn) {
        foe.usedStatus = true
        const sm = SUPPORT[sn]
        await announce(`${kind === 'trainer' ? '' : 'The wild '}${foe.name} used`, `${sn}!`, 300)
        if (FIELD_EFFECTS.includes(sm.effect)) { if (!(await fieldMove(sm, foe, { label: 'GOOD', mult: 1 }))) await say('But it failed!', '', 300); return }
        foeLast = sn
        if (SPECIAL_EFFECTS.includes(sm.effect)) { if (ST(me).protect) await say(who(me), 'protected itself!', 300); else if (!(await specialMove(sm, foe, { label: 'GOOD', mult: 1 }))) await say('But it failed!', '', 300); return }
        if (sm.target === 'foe' && ST(me).protect) { await say(who(me), 'protected itself!', 300); return }
        if (sm.effect === 'accDown') await stage(me, 'acc', -1, false)
        else if (sm.effect === 'evaUp') await stage(foe, 'eva', 1, true)
        else if (!(await applyStatusMove(sm, me, { label: 'GOOD', mult: 1 }))) await say('But it failed!', '', 300)
        return
      }
      let mv = foe.charged ?? (trainer?.hard || trainer?.smart ? pickHard() : foe.roamer ? (foe.turn++, foeMoves[Math.floor(rand() * foeMoves.length)]) : foeMoves[foe.turn++ % foeMoves.length])
      if (ST(foe).disabled?.name === mv.name) mv = foeMoves.find((m) => m.name !== mv.name) ?? mv   // Disable: it reaches for something else
      // A charged move (Hyper Beam): a turn spent gathering power, then a fast ring, then a turn to recharge.
      if (mv.charge && !demo && foe.charged !== mv) {
        foe.charged = mv; await announce(`${who(foe)} is gathering`, 'power!', 300); sfx('levelup')
        anim($('enemy'), [{ filter: 'brightness(1)' }, { filter: 'brightness(1.8) drop-shadow(0 0 10px #fde047)' }, { filter: 'brightness(1)' }], { duration: 700, iterations: 2 })
        return
      }
      const released = foe.charged === mv; foe.charged = null
      foeLast = mv.name
      if (mv.splash) { await announce(`${foe.name} used`, 'SPLASH!', 200); anim($('enemy'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-20px)', offset: .5 }, { transform: 'translateY(0)' }], { duration: 300, iterations: 2 }); await W(600); await say('But nothing happened!'); return }
      if (demo && planD.length) {
        const next = planD[0]
        cap(mv.kind === 'low' ? 'JUMP' : mv.hits > 1 ? 'PARRY THE COMBO' : next === 'dodge' ? 'DODGE' : next === 'late' ? 'MISSED' : 'PARRY',
          mv.kind === 'low' ? `${mv.name} comes along the ground — it can't be parried or dodged. Jump it with ▲ for +1 PP.`
          : mv.hits > 1 ? `${mv.name} hits ${mv.hits} times. The timing ring sits in front of ${me.name} for every hit — parry all of them for a counter.`
          : next === 'dodge' ? 'Dodge works here too: a wider window and less damage, but no PP.'
          : next === 'late' ? `Too late — ${me.name} takes the hit, and keeps the damage after the battle.`
          : 'Parry with A: a tight window, +1 PP. Hit it PERFECT for no damage and a counter.')
      }
      // Only the dialogue while the move is announced: a tap there moves the text on, and can never land on PARRY.
      panel(null)
      await announce(`${kind === 'trainer' ? '' : 'The wild '}${foe.name} used`, `${mv.name}!`, READ_MS)
      // Protect: hold B through the wind-up and let go as the ring closes (the demo's always holds).
      if (ST(me).protect) {
        panel(null)
        if (demo || (await holdGuard(C.p.x, C.p.y, 900))) { sfx('clang'); pop('PROTECTED', C.p.x, C.p.y - 70, 'blue'); await say(who(me), 'protected itself!', 350); if (released) ST(foe).recharge = true; return }
        ST(me).protect = false; sfx('flinch'); showTags(); await say(`${me.name}'s PROTECT`, 'slipped!', 300)
      }
      // A tell, on some attacks: a feint, a second ring, or low-then-high. Leaders most, scalpers and veterans now and then.
      const pace = attackPace(kind === 'trainer' ? trainer : null, me.level)
      const tell = trainer?.hard ? (rand() < (trainer.tellRate ?? 0.4) ? leaderTell(foe) : null) : !demo && Math.random() < pace.tell ? leaderTell(foe) : null
      // A rampage (Outrage): 3 to 5 hits in a fast row, then it's confused from the effort.
      const rampage = mv.rampage && !demo ? 3 + Math.floor(Math.random() * 3) : 0
      const hits = rampage || (tell === 'double' ? (mv.hits ?? 1) + 1 : tell === 'lowHigh' ? 2 : mv.hits)
      const kindOf = (h) => (tell === 'lowHigh' ? (h === 0 ? 'low' : 'strike') : mv.kind)
      if (tell) { pop(TELL_LABEL[tell], C.e.x - 10, C.e.y - 86, 'orange'); sfx('blocked'); await W(350) }
      // Now the buttons. Presses in their first moments (a quick double tap on the text) don't count as an early miss.
      panel('pDefend'); const shownAt = performance.now()
      let allParried = true, evaded = 0, countered = 0
      for (let h = 0; h < hits; h++) {
        const kind_ = kindOf(h), feint = tell === 'feint' && h === 0 ? 450 : 0   // a feint holds the ring still this long
        // Leaders' attacks close faster: less time to react.
        const dr = defendRing(ringNet(ST(foe).acc, ST(me).eva)); if (me.status === 'par') dr.wide *= 0.8
        // Every ring closes at its own speed, after a wind-up of its own: no two attacks share a rhythm.
        const vary = demo ? 1 : paceRoll(pace.speed), windup = demo ? 0 : Math.round(Math.random() * pace.wait)
        const quick = Math.max(0.7, 1 + 0.08 * ((ST(me).spe ?? 0) - (ST(foe).spe ?? 0)))   // Speed stages: more (or less) time on its rings
        const base = released ? 560 : rampage && h ? 400 : mv.fast ? 640 : h === 0 ? 860 : 560   // a released charge and a rampage's follow-ups come fast
        const approach = Math.round(base * (trainer?.hard ? trainer.ringFast ?? 0.8 : 1) * dr.speed * vary * quick)
        // Armed through the wind-up, so tapping early still counts as your press (and misses).
        const armed = Math.max(performance.now(), shownAt + DEFEND_SETTLE_MS)
        let first = null
        const off = listen((btn, t) => { if (!first && t >= armed && ['a', 'b', 'up'].includes(btn)) first = { btn, t } })
        document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.add('armed'))
        if (windup) await W(windup)
        const t0 = performance.now(), hitAt = t0 + approach + feint
        if (demo) {
          const p = planD.shift() ?? (kind_ === 'low' ? 'jump' : 'parry')
          const at = feint + { parry: approach - 10, dodge: approach - 120, jump: approach - 10, late: approach + 190 }[p]
          setTimeout(() => { if (!live()) return; const b = { parry: 'a', dodge: 'b', jump: 'up', late: 'a' }[p]; hot($('pDefend').querySelector(`[data-btn="${b}"]`)); press(b) }, at)
        }
        const rg = kind_ === 'low' ? groundRing(FOOT.p.x, FOOT.p.y - 4, approach) : ring(C.p.x, C.p.y, approach, '')
        if (feint) setTimeout(() => {   // the feint: the ring stops halfway and flickers, then carries on
          if (!live()) return
          rg.el.getAnimations().forEach((x) => x.pause()); rg.el.classList.add('feint')
          setTimeout(() => { rg.el.getAnimations().forEach((x) => x.play()); rg.el.classList.remove('feint') }, feint)
        }, approach * 0.5)
        const E = $('enemy')
        if (mv.fx === 'coins') { const c = document.createElement('div'); c.style.cssText = `position:absolute;left:${C.p.x - 30 + h * 26}px;top:-16px;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff7c2,#facc15 55%,#b45309);border:1px solid #92400e`; fx.appendChild(c); anim(c, [{ transform: 'translateY(0)' }, { transform: `translateY(${C.p.y - 10}px)` }], { duration: approach, easing: 'ease-in' }); setTimeout(() => c.remove(), approach + 40) }
        if (mv.fx === 'orb') { const o = document.createElement('div'); o.style.cssText = `position:absolute;left:${C.e.x - 14}px;top:${C.e.y - 14}px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#e9d5ff 0,#7c3aed 45%,#2e1065 100%);box-shadow:0 0 14px #8b5cf6`; fx.appendChild(o); anim(o, [{ transform: 'translate(0,0) scale(.4)' }, { transform: 'translate(0,0) scale(1)', offset: .45 }, { transform: `translate(${C.p.x - C.e.x}px,${C.p.y - C.e.y}px) scale(1.2)` }], { duration: approach, easing: 'ease-in' }); setTimeout(() => o.remove(), approach + 30) }
        if (kind_ === 'low') lowFx(mv.kind === 'low' ? mv : { ...mv, fx: 'sweep' }, approach, E)
        else if (mv.ranged) anim(E, [{ transform: 'scale(1)' }, { transform: 'scale(1.08) translateY(-6px)', offset: .5 }, { transform: 'scale(1)' }], { duration: approach })
        if (mv.ranged && !feint && kind_ !== 'low') incomingFx(mv, C.e, C.p, approach)
        if (trainer?.story && Math.random() < 0.4 + trainer.step * 0.15) setTimeout(() => { if (live()) glitchFx(trainer.step) }, approach * rnd(0.2, 0.7))   // their machine glitches follow them in
        else { const k = approach / (approach + 160); anim(E, [{ transform: 'translate(0,0)' }, { transform: 'translate(12px,-6px)', offset: k * .8 }, { transform: 'translate(-96px,70px)', offset: k }, { transform: 'translate(0,0)' }], { duration: approach + 160, easing: 'ease-in' }) }
        await W(approach + feint); rg.clear()
        if (!first) await W(kind_ === 'low' ? 260 : 230)
        off(); document.querySelectorAll('#pDefend .btn').forEach((b) => b.classList.remove('armed'))
        if (me.status === 'frz' || me.status === 'slp') first = null   // frozen solid or asleep: no parry, dodge or jump
        const dt = first ? first.t - hitAt : Infinity
        const res = defendResult(first, dt, kind_ === 'low', dr.wide), { r, perfect } = res, taken = takenOf(res)
        if (mv.fx === 'quake') { sfx('quake'); shake(10, 520) }
        if (mv.snd === 'coin') sfx('coin')
        if (r !== 'parry' || !perfect) allParried = false   // the counter takes PERFECT parries
        if (r === 'parry' && ST(me).counter === mv.cat) countered += damage(foe, me, mv, 1).dmg * 2   // Counter / Mirror Coat
        if (r === 'parry') { addBond(me, perfect ? 2 : 1); sfx('parry'); pop(perfect ? 'PERFECT!' : 'PARRY', C.p.x + h * 14, C.p.y - 64 - h * 18, perfect ? 'gold' : 'gold small'); if (perfect) { sparks(C.p.x + 30, C.p.y - 26); flash('#fff', .35, 90) } evaded++ }
        else if (r === 'dodge') { sfx('dodge'); pop('DODGE', C.p.x, C.p.y - 64, 'blue'); anim($('player'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-34px)', offset: .4 }, { transform: 'translateX(0)' }], { duration: 360 }) }
        else if (r === 'jump') { sfx('jump'); pop(perfect ? 'PERFECT JUMP!' : 'JUMP!', C.p.x, C.p.y - 80, 'green'); anim($('player'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-60px)', offset: .45 }, { transform: 'translateY(0)' }], { duration: 540 }); evaded++ }
        // A clean hit does it all; a dodge or a good-but-not-PERFECT parry or jump lets some through (DEFEND_TAKEN).
        if (taken > 0) {
          const hit = r === 'miss'
          if (hit && mv.snd && mv.snd !== 'coin' && mv.snd !== 'shadow') sfx(mv.snd)
          const { dmg, eff } = damage(foe, me, mv, taken)
          const from = me.hp; me.hp = Math.max(0, me.hp - dmg)
          sfx(eff > 1 ? 'hitSuper' : eff < 1 ? 'hitWeak' : 'hit'); flash('#ef4444', hit ? .25 : .12, 160); buzz(hit ? (eff > 1 ? 60 : 30) : 15)
          impactFx(C.p, mv.type, hit && eff > 1); if (hit) hitReact($('player'), C.e, C.p, mv.type, eff > 1)
          pop(`-${dmg}`, C.p.x + 40, C.p.y - 40, hit ? 'red' : 'red small')
          await Promise.all([hit ? blink($('player')) : null, drain('p', from, me.hp, me.stats.hp)])
          if (mv.drain) await sapHP(foe, 'e', C.e, Math.round((from - me.hp) * mv.drain))
          renderTools()
          if (me.hp <= 0) { panel(null); return }
          if (hit && me.status === 'frz' && mv.type === 'fire') { me.status = null; showTags(); await say(who(me), STATUS_TEXT.thaw, 300) }
          if (hit) await afflict(me, statusFromHit(me, mv, rand))
        }
        await W(hits > 1 ? 80 : 220)
      }
      panel(null)
      // One PP per attack, and only for a clean sweep: parry (or jump) 2 of 3 hits and it's nothing.
      if (evaded === hits) { setPP(pp + 1, true); pop('+1 PP', C.p.x - 30, C.p.y - 96, 'blue small') }
      else if (evaded) pop(`${evaded}/${hits} — no PP`, C.p.x - 30, C.p.y - 96, 'small')
      if (released) ST(foe).recharge = true
      if (rampage && foe.hp > 0 && !ST(foe).conf) { ST(foe).conf = 2 + Math.floor(rand() * 2); showTags(); await say(who(foe), 'became confused from fatigue!', 300) }
      if (countered && foe.hp > 0) {
        sfx('counter'); pop(`${ST(me).counter === 'phys' ? 'COUNTER' : 'MIRROR COAT'} ×2`, 168, 96, 'orange'); await W(120)
        sparks(C.e.x, C.e.y, '#fdba74', 10); await Promise.all([blink($('enemy')), setHPOf(foe, foe.hp - countered)])
        await say(`${me.name} hit back`, `for ${countered} damage!`, 300)
        if (foe.hp <= 0) return
      }
      if (allParried && mv.kind === 'strike' && foe.hp > 0) {
        sfx('counter'); pop('COUNTER!', 168, 96, 'orange'); await W(120)
        anim($('player'), [{ transform: 'translate(0,0)' }, { transform: 'translate(120px,-110px)', offset: .45 }, { transform: 'translate(0,0)' }], { duration: 420 })
        await W(210)
        const dmg = Math.max(1, Math.round(damage(me, foe, MOVEDEX.TACKLE, 1).dmg * 0.8))
        const from = foe.hp; foe.hp = Math.max(kind === 'wild' ? 1 : 0, foe.hp - dmg)
        sparks(C.e.x, C.e.y, '#fdba74'); pop(`-${from - foe.hp}`, C.e.x + 34, C.e.y - 30)
        await Promise.all([blink($('enemy')), drain('e', from, foe.hp, foe.max)])
      }
      if (tell && foe.hp > 0 && me.hp > 0 && (!quipped || rand() < 0.5)) { quipped = true; await tellQuip(tell, evaded === hits) }
    }
    /**
     * After a tell: the leader steps out in front of their Pokémon for a snarky
     * line (their own, or one for the tell), or a grudging one if you read it.
     */
    async function tellQuip(tell, clean) {
      const own = TELL_QUIPS[trainer.short]
      const line = clean ? pickOf(TELL_QUIP.clean) : own && rand() < 0.5 ? own : pickOf([...TELL_QUIP.hit, ...TELL_QUIP[tell]])
      const E = $('enemy')
      await anim(E, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).finished
      await trainerOn(trainer); await talk(trainer, [line]); await trainerOff()
      await anim(E, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 }).finished
      E.getAnimations().forEach((a) => a.cancel())
    }

    /* the turn loop */
    for (;;) {
      // If the script runs short (rolls differ), keep attacking rather than stall.
      const affordable = () => movesOf(me).filter((n) => !SUPPORT[n] && moveCost(n) <= pp).sort((a, b) => (MOVEDEX[b].power * (MOVEDEX[b].hits ?? 1)) - (MOVEDEX[a].power * (MOVEDEX[a].hits ?? 1)))[0] ?? movesOf(me)[0]
      const step = demo ? (plan.shift() ?? { menu: 'fight', move: affordable(), planned: 'perfect' }) : null
      if (demo && step?.cap) cap(step.cap[0], step.cap[1])
      drawMain(); panel('pMain'); msg0('What will', `${me.name} do?`)
      const top = ST(me).recharge ? 'recharge' : await choose('pMain', demo ? step.menu : null)
      let used = false
      if (top === 'recharge') { ST(me).recharge = false; panel(null); await say(`${me.name} must`, 'recharge!', 400); used = true }
      if (top === 'run') {
        if (kind === 'trainer') { panel(null); await say("There's no running", 'from a trainer battle!'); continue }
        if (ST(me).trapped) { panel(null); await say("Can't escape!", '', 300); continue }
        panel(null); sfx('run'); await say('Got away safely!')
        return { result: 'ran' }
      }
      if (top === 'fight') {
        drawFight(); panel('pFight'); msg0('Choose a move.', '')
        const a = await choose('pFight', demo ? 'm' + movesOf(me).indexOf(step.move) : null)
        if (a === 'back') continue
        const name = movesOf(me)[+a.slice(1)]
        if (moveCost(name) > pp) { pop('NO PP!', 160, 120, 'red small'); continue }
        panel(null)
        const snoring = MOVEDEX[name]?.sleepOk && me.status === 'slp'   // Snore: the one move that works asleep
        if (snoring) { if (me.sleep > 0) me.sleep--; await say(who(me), 'is fast asleep.', 250); await useMove(name, null, { snoring }) }
        else if (await blockedByStatus(me)) setPP(pp)   // frozen or fully paralyzed: the turn is lost
        else if (SUPPORT[name]) await useSupport(name, demo ? step.planned : null); else await useMove(name, demo ? step.planned : null)
        used = true
        if (escaped) return { result: 'ran' }
        if (foe.hp <= 0) { const r = await foeDown(); if (r) return r; continue }
      }
      if (top === 'bag') {
        drawBag(); panel('pBag'); msg0('Use which item?', '')
        const it = await choose('pBag', demo ? step.item : null)
        if (it === 'back') continue
        panel(null)
        if (it === 'ball' || it === 'great') {
          const r = await throwBall(it, demo ? step.planned : null, demo ? step.shakes : null)
          if (r === 'caught') { await winExp(); return { result: 'caught' } }   // catching earns EXP too
          if (r === 'blocked') continue
          used = true
        } else if (it !== 'revive') {
          // A Potion or a cure, for whoever needs it: the one out, or one on the bench (you choose, unless it's only the one out).
          const up = helpedBy(it)
          if (!up.length) { await say(ITEMS[it].cure ? "It won't have any effect." : 'Everyone is at full HP.'); continue }
          let m = up.includes(me) ? me : up[0]
          if (!demo && (up.length > 1 || m !== me)) { m = await pickMon(up, `${ITEMS[it].name}: on which Pokémon?`); if (!m) continue }
          bag[it]--; renderTools(); sfx('heal')
          if (ITEMS[it].cure) {
            m.status = null; if (m === me) showTags()
            await say(`You used a ${ITEMS[it].name}!`, `${m.name} is cured.`)
          } else {
            const from = m.hp; m.hp = Math.min(m.stats.hp, m.hp + Math.ceil(m.stats.hp * ITEMS[it].heal))
            if (m === me) await drain('p', from, m.hp, m.stats.hp)
            await say(`${m.name} recovered`, `${m.hp - from} HP.`)
          }
          used = true
        } else {
          // On one of your others who's fainted: back at half HP, ready to switch in.
          const down = party.filter((m) => m.hp <= 0)
          if (!down.length) { await say('Nobody has fainted.'); continue }
          let m = down[0]
          if (down.length > 1) { m = await pickMon(down, 'Revive which Pokémon?', () => 'fainted'); if (!m) continue }
          bag.revive--; renderTools(); sfx('heal')
          m.hp = Math.ceil(m.stats.hp * ITEMS.revive.revive); m.status = null
          await say(`${m.name} was revived!`, `It's back with ${m.hp} HP.`); used = true
        }
      }
      if (top === 'party') {
        drawParty(); panel('pParty'); msg0('Switch to which Pokémon?', '')
        const p = await choose('pParty', demo ? step.to : null)
        if (p === 'back') continue
        const m = party[+p.slice(1)]
        panel(null)
        if (m === me) { await say(`${me.name} is already out!`); continue }
        if (ST(me).trapped) { await say(`${me.name} can't`, 'escape!', 300); continue }
        await switchTo(m); used = true
      }
      if (!used) continue
      if (me.hp > 0) await foeTurn()   // (it may have hurt itself in confusion and fainted)
      if (fled) return { result: 'fled' }
      await endTurn(me, foe); await endTurn(foe, me); await endField()
      if (foe.hp <= 0) { const r = await foeDown(); if (r) return r }
      if (me.hp <= 0) {
        sfx('faint')
        await anim($('player'), [{ transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' }, { transform: 'translateY(120px)', clipPath: 'inset(0 0 120px 0)' }], { duration: 520 }).finished
        $('player').style.visibility = 'hidden'
        await say(`${me.name} fainted!`); addBond(me, -10)
        const up = party.filter((m) => m.hp > 0)
        if (!up.length) { $('phud').style.visibility = 'hidden'; return { result: 'lost' } }
        // Your call who goes in next (the demo takes the first).
        let next = up[0]
        if (!demo && up.length > 1) {
          drawParty(true); panel('pParty'); msg0('Send out which Pokémon?', '')
          next = party[+(await choose('pParty', null)).slice(1)]; panel(null)
        }
        me = next; await sendOut(me)
      }
    }
  }

  let demoNoBlunder = false
  /* ══════════ encounters, from the machine ══════════ */
  /**
   * Evolutions due from this battle, one at a time, on the battle screen: the
   * old and new forms flicker faster and faster to the evolution music, and
   * holding STOP (B) for 3 seconds cancels it, for another try 5 levels
   * later. The demo lets it run.
   */
  const EVO_HOLD_MS = 3000
  async function runEvolutions() {
    for (const m of [...pendingEvos]) {
      pendingEvos.delete(m)
      const e = evoDue(m); if (!e) continue
      const to = speciesByName(e.to); if (!to) continue
      for (const w of ['enemy', 'player', 'trainer']) { $(w).getAnimations().forEach((a) => a.cancel()); $(w).style.visibility = 'hidden' }
      ;['ehud', 'phud'].forEach((h) => { $(h).style.visibility = 'hidden' }); fx.innerHTML = ''
      const stage = document.createElement('div'); stage.className = 'evostage'
      stage.innerHTML = `<img class="a" src="${spr(m)}" alt=""><img class="b" src="${spr({ id: to.id, shiny: m.shiny })}" alt="">`
      $('ts').appendChild(stage)
      const [a, b] = stage.querySelectorAll('img')
      Sound.music('evolution')
      await say('What?', `${m.name} is evolving!`, 500)
      $('pEvo').querySelector('small').textContent = e.item ? `keeps the ${EVO_ITEM_NAME[e.item]}` : 'tries again in 5 levels'
      panel(demo ? null : 'pEvo')
      // Stopping takes holding B for EVO_HOLD_MS (the button fills as you hold); a tap does nothing.
      let stopped = false
      const shownAt = performance.now(), stopBtn = $('pEvo').querySelector('.bEvoStop')
      const held = () => (btnDown.b ? performance.now() - Math.max(btnDown.b, shownAt) : 0)
      const tick = () => { const h = held(); stopBtn.style.setProperty('--hold', Math.min(1, h / EVO_HOLD_MS)); if (h >= EVO_HOLD_MS) stopped = true }
      // The flicker: white silhouettes swapping, faster as it goes (about 6 s).
      a.classList.add('glow'); b.classList.add('glow')
      const rays = document.createElement('div'); rays.className = 'rays'; stage.prepend(rays)
      const spark = () => { const s = document.createElement('i'); s.className = 'spark'; s.style.left = rnd(15, 85) + '%'; s.style.bottom = rnd(5, 95) + '%'; s.style.setProperty('--s', rnd(0.6, 1.4)); stage.appendChild(s); setTimeout(() => s.remove(), 900) }
      for (let i = 0, gap = 520; i < 26 && !stopped; i++, gap = Math.max(70, gap * 0.86)) {
        const showNew = i % 2 === 1
        if (i % 2 === 0) spark(); rays.style.opacity = Math.min(1, 0.15 + i / 26)
        a.style.opacity = showNew ? 0 : 1; b.style.opacity = showNew ? 1 : 0
        for (const end = performance.now() + gap; performance.now() < end && !stopped;) { tick(); await W(30) }
      }
      // Still holding when the flicker ends: it waits for you to finish the hold or let go.
      for (let i = 0; btnDown.b && !stopped; i++) { a.style.opacity = i % 6 < 3 ? 0 : 1; b.style.opacity = i % 6 < 3 ? 1 : 0; tick(); await W(30) }
      stopBtn.style.setProperty('--hold', 0); panel(null)
      a.classList.remove('glow'); b.classList.remove('glow')
      if (stopped) {
        a.style.opacity = 1; b.style.opacity = 0
        sfx('flinch'); Sound.stopMusic()
        await say(`Huh? ${m.name}`, 'stopped evolving!', 500)
        // Stopped with an item: the item isn't used. On a level-up: another try in 5 levels.
        if (e.item) { delete m.evoForce; await say(`The ${EVO_ITEM_NAME[e.item]} wasn't used.`, '', 700) }
        else { m.evoWait = m.level + 5; await say(`It will try again at Lv ${m.evoWait}.`, '', 700) }
      } else {
        if (e.item) { bag[e.item]--; if (e.needs) bag[e.needs]-- }   // the item (and Seadra's Dragon Scale) is used up
        a.style.opacity = 0; b.style.opacity = 1
        flash('#fff', 0.95, 600); Sound.music('evolved'); cry(to)
        stage.classList.add('done'); for (let i = 0; i < 10; i++) setTimeout(spark, i * 60)
        const was = m.name
        evolveInto(m, to.name)
        await say('Congratulations! Your', `${was} evolved into ${m.name}!`, 1400)
        for (const r of learnAtLevel(m)) await say(`${m.name} learned ${r.name}!`, r.equipped ? '' : 'Swap it in from the Box.', 600)
        renderTools()
      }
      stage.remove()
      Sound.stopMusic()
    }
  }
  async function backToMachine(state, blocked = false) {
    await runEvolutions()
    // Status conditions carry over, like HP: a fainted Pokémon loses its, the rest keep theirs until cured.
    for (const m of [...party, ...box]) if (m.hp <= 0) m.status = null
    // Back on a stocked shelf after a battle: hold the machine for you now, as a plain tap does, so you can buy
    // without tapping out and back in (a battle at the machine doesn't hold it). Not while scalpers are camping it.
    const hold = state === 'in' && !blocked ? await holdMachine(state) : { waiting: false, refused: null }
    await fadeThrough(async () => {
      for (const w of ['enemy', 'player']) { $(w).getAnimations().forEach((a) => a.cancel()); $(w).style.visibility = 'hidden' }
      ;['ehud', 'phud'].forEach((h) => { $(h).style.visibility = 'hidden' })
      fx.innerHTML = ''; panel(null); msg0('', '')
      paintShelf(state, hold, blocked); showLayer('home')
    })
    renderTools(); toolsEnabled(true); saveGame()
  }

  async function wildEncounter(demoPlan, state = homeState, legend = false) {
    if (!party.some((m) => m.hp > 0)) { renderHome(homeState); $('homeSub').textContent = 'your party has fainted. Heal them first!'; sfx('blocked'); return }
    toolsEnabled(false)
    // The machine shudders, and something leaps out from behind it.
    sfx('rustle')
    await anim($(state === 'maint' ? 'maint' : 'attractRows'), [0, -4, 4, -3, 3, 0].map((v) => ({ transform: `translateX(${v}px)` })), { duration: 360 }).finished
    const b = bangOn($('home'), 150, 160); await W(560); b.remove()
    // Now and then, one of the roaming legendaries instead: the shared one, HP and all.
    const roamer = legend || (!demoPlan && flavor() < LEGEND_RATE) ? pickLegend() : null
    const species = demoPlan ? DATA.wild.find((w) => w.name === demoPlan.wild) : wildFrom(YOU)   // from your seed's pool this week
    const foe = roamer ?? individual(species, demoPlan ? 4 : wildLevel(species), rand)
    if (!roamer && !demoPlan && SHINY_IDS.has(foe.id) && (window.__forceShiny || Math.random() < 1 / SHINY_ODDS)) foe.shiny = true   // __forceShiny: testing only
    if (roamer) { sfx('quake'); $('homeSub').textContent = `a powerful presence... ${roamer.name} burst out!` }
    await wipeWild(async () => { setScene(WILD_SCENES, sceneRoll); showLayer('battle') })
    const out = await battle({ kind: 'wild', foe, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'caught') {
      foe.hp = foe.stats.hp
      if (party.length < 6) party.push(foe); else box.push(foe)
      $('player').style.visibility = 'hidden'; $('phud').style.visibility = 'hidden'; $('ehud').style.visibility = 'hidden'
      renderTools()
      if (demo) cap('CAUGHT', `It arrives with its own IVs and nature, rolled the moment it appeared. ${party[0].name} kept its damage — HP carries over.`)
      await summary(foe, evoText(foe) ? `Evolves: ${evoText(foe)}` : 'It does not evolve.', `${foe.name} joined your party!`, `Party ${party.length}/6`)
      Sound.stopMusic()
    }
    else if (out.result === 'lost') { await say('You have no Pokémon left', 'that can fight!') }
    if (roamer) { if (out.result === 'caught') foe.roamer = false; legendAfter(roamer, out.result, 'You') }
    Sound.stopMusic()
    await backToMachine(state)
  }

  /* ══════════ Alex, the rival ══════════ */
  /** Alex's team for a rival battle: levels as a Gym Leader's (leaderLevels), IVs at least the phase's floor. */
  function rivalTeam(R) {
    const lv = leaderLevels(R), floor = R.ivs
    return R.team.map((name, i) => {
      const m = individual(speciesByName(name), lv[i], rand)
      for (const k of STAT_KEYS) m.ivs[k] = Math.max(floor, m.ivs[k])
      m.stats = statsAt(m, m.level); m.hp = m.stats.hp
      return m
    })
  }
  /**
   * The next rival battle (RIVAL_BATTLES), with Alex waiting at the machine:
   * the encounter music under the VS splash and their words, then the phase's
   * theme. A win pays tokens (and maybe a pack; always after the last) and
   * moves the story on; a loss brings Alex back for the same battle a few taps later.
   */
  /**
   * The Hall of Fame, after Alex's last battle: each of your Pokémon in turn,
   * with its cry, then the team together, every badge, and the credits. The
   * team is kept (`fame`) and shows in the Party sheet from then on.
   */
  async function hallOfFame() {
    fame = { at: Date.now(), team: party.map((m) => ({ id: m.id, name: m.name, level: m.level, shiny: !!m.shiny })) }
    saveGame()
    Sound.music('hallOfFame')
    showLayer('battle'); panel(null)
    const h =document.createElement('div'); h.className = 'hof'; h.id = 'hof'
    h.innerHTML = '<b class="hoft">HALL OF FAME</b><div class="hofone"></div><div class="hofteam"></div><div class="hofbadges"></div>'
    $('ts').appendChild(h)
    await anim(h, [{ opacity: 0 }, { opacity: 1 }], { duration: 700 }).finished
    const one = h.querySelector('.hofone'), row = h.querySelector('.hofteam')
    await say('Welcome to the HALL OF FAME!', '', 900)
    for (const m of party) {
      one.innerHTML = `<img src="${spr(m)}" alt=""><b>${m.name}</b><span>Lv ${m.level} · ${m.types.map((t) => `<i style="background:${TYPE_COL[t]}">${t}</i>`).join('')}</span>`
      anim(one, [{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.3,1)' })
      cry(m)
      await say(`${m.name}, Lv ${m.level}.`, pickOf(['A true champion.', 'Never backed down.', 'There at every badge.', 'ALEX never saw it coming.']), demo ? 600 : 1300)
      const s = document.createElement('img'); s.src = spr(m); s.alt = m.name; row.appendChild(s)
      anim(s, [{ transform: 'scale(0)' }, { transform: 'scale(1.2)', offset: .7 }, { transform: 'none' }], { duration: 360 })
    }
    one.innerHTML = ''
    const bx = h.querySelector('.hofbadges')
    bx.innerHTML = GYMS.filter((g) => badges.includes(g.gym)).map((g) => `<img src="${badgeArt(g.badge)}" alt="${g.badge} BADGE">`).join('')
    bx.querySelectorAll('img').forEach((b, i) => anim(b, [{ opacity: 0, transform: 'translateY(-14px)' }, { opacity: 1, transform: 'none' }], { duration: 300, delay: i * 70, fill: 'backwards' }))
    sfx('levelup')
    await say(`${badges.length} badges. Johto and Kanto.`, 'The Champion, RED... and ALEX.', 1400)
    // The credits, on the lower screen.
    for (const [a, b] of [['CONGRATULATIONS!', 'Your team is in the HALL OF FAME.'], ['ALEX, the rival', '"See you around, Champion."'],
      ['Pokémon art and cries', 'PokéAPI · Pokémon Showdown'], ['Trainer art', 'Bulbagarden Archives'], ['Music', 'Played live by the VVM, note by note'],
      ['Pokémon', '© Nintendo · Creatures · GAME FREAK'], ['THE END', 'Thanks for playing!']]) await say(a, b, demo ? 500 : 1500)
    if (!demo) { $('msg').classList.add('wait'); try { await waitFor(['a']) } finally { $('msg').classList.remove('wait') } }
    await anim(h, [{ opacity: 1 }, { opacity: 0 }], { duration: 700 }).finished
    h.remove()
    await say('The machine hums on.', 'Battles and packs are still here.', 900)
  }
  async function rivalEncounter(state = 'in') {
    const n = Math.min(rivalStep, RIVAL_BATTLES.length - 1), R = rivalTrainer(n), look = RIVAL_LOOKS[R.phase]
    toolsEnabled(false)
    Sound.music('rivalTalk')
    await wipeTrainer(async () => {
      setScene([look.scene]); showLayer('battle')
      const vs = $('vs'); vs.classList.add('gym'); vs.style.setProperty('--gym', look.color)
      $('vsImg').src = ART[R.vs]; $('vsName').textContent = R.full; vs.querySelector('.name span').textContent = R.title; vs.style.display = 'block'
      vsIn(vs)
    })
    await W(1300)
    await talk(R, rivalLost ? RIVAL_AGAIN[R.phase] : R.intro)
    vsHide()
    Sound.music(look.theme)
    const team = rivalTeam(R)
    const out = await battle({ kind: 'trainer', foe: team[0], roster: team.slice(1), trainer: R })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(R, 'down'); await talk(R, R.outro, 'faceDown'); await trainerOff()
      await out.exp?.()
      await payMilestone(`rival:${n}`, R.tokens)
      await giveCandy(R, n === RIVAL_BATTLES.length - 1 ? 3 : 1)   // three after the last battle
      if (n === RIVAL_BATTLES.length - 1 || flavor() < 0.5) { const p = await givePack('rival'); if (p) { sfx('click'); await say('ALEX gave you', `${p}!`, 700) } }
      rivalStep = n + 1; rivalLost = false; rivalWait = 0
      renderTools()
    } else {
      await trainerOn(R); await talk(R, R.gloat); await trainerOff()
      rivalLost = true; rivalWait = RIVAL_REMATCH_TAPS
    }
    // The first battle, win or lose: Alex hands over the EXP. SHARE.
    if (n === 0 && !bag.expshare) {
      await trainerOn(R); await talk(R, RIVAL_GIFT); await trainerOff()
      bag.expshare = 1; renderTools(); sfx('levelup')
      await say('ALEX gave you', 'the EXP. SHARE!', 900)
      await say('Pokémon that sit out a battle', 'now get half of its EXP.', 700)
    }
    if (out.result !== 'won') await say('ALEX headed off.', "There'll be a rematch soon.")
    else if (n === RIVAL_BATTLES.length - 1) await hallOfFame()
    Sound.stopMusic(); saveGame(); await backToMachine(state)
  }
  /**
   * Herb's or Paul's next glitcher battle (STORY): caught at the machine as
   * it glitches, the VS splash and their words, then the battle. A win pays
   * tokens, hands back a pack from their card-show stock and moves their
   * story on; a loss brings them back for the same battle a few taps later.
   */
  async function storyEncounter(who, state = 'in') {
    const s = story[who], S = STORY[who], n = Math.min(s.step, S.battles.length - 1), T = storyTrainer(who, n)
    toolsEnabled(false)
    // At the machine: them, and the screen glitching.
    renderHome(state); await W(demo ? 600 : 400)
    $('homeLoiterer').src = ART[T.body]; $('homeLoiterer').style.display = 'block'
    anim($('homeLoiterer'), [{ transform: 'translateX(220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' })
    await W(560)
    sfx('blocked')
    await anim($('home'), [{ transform: 'none', filter: 'none' }, { transform: 'translateX(-4px) skewX(6deg)', filter: 'hue-rotate(90deg) contrast(1.6)', offset: 0.2 },
      { transform: 'translateX(5px)', filter: 'invert(1)', offset: 0.35 }, { transform: 'translateX(-2px) skewX(-4deg)', filter: 'hue-rotate(-60deg) saturate(3)', offset: 0.6 },
      { transform: 'none', filter: 'none' }], { duration: 700 }).finished
    Sound.music('vs')
    await wipeTrainer(async () => {
      setScene([T.scene]); showLayer('battle')
      const vs = $('vs'); vs.classList.add('gym'); vs.style.setProperty('--gym', T.color)
      $('vsImg').src = ART[T.vs]; $('vsName').textContent = T.full; vs.querySelector('.name span').textContent = T.title; vs.style.display = 'block'
      vsIn(vs)
    })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    await W(1300)
    await talk(T, s.lost ? S.again : T.intro)
    vsHide()
    Sound.music(T.theme)
    const team = rivalTeam(T)
    const out = await battle({ kind: 'trainer', foe: team[0], roster: team.slice(1), trainer: T })
    if (out.result === 'won') {
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(T, 'down'); await talk(T, T.outro, 'faceDown'); await trainerOff()
      await out.exp?.()
      await payMilestone(`${who.toLowerCase()}:${n}`, T.tokens)
      const p = await givePack(who.toLowerCase()); if (p) { sfx('click'); await say(`${T.short} handed back`, `${p}!`, 700) }
      await giveCandy(T, n === S.battles.length - 1 ? 2 : 1)   // two after their last
      Object.assign(s, { step: n + 1, wait: 0, lost: false })
      if (n === S.battles.length - 1) await say(`${T.short} is done glitching.`, 'The machines run a little better now.', 900)
    } else {
      await trainerOn(T); await talk(T, T.gloat); await trainerOff()
      Object.assign(s, { lost: true, wait: RIVAL_REMATCH_TAPS })
      await say(`${T.short} ran off`, 'with a bag of glitched packs...')
    }
    Sound.stopMusic(); saveGame(); await backToMachine(state)
  }
  async function scalperEncounter(demoPlan, state = 'in') {
    toolsEnabled(false)
    if (demoPlan?.who) scalper = demoPlan.who
    // Who's camping it. The demo always meets Herb; in Play it's anyone, at random.
    if (!demoPlan && $('homeLoiterer').style.display !== 'block') scalper = randomTrainers(1)[0]
    const T = scalper
    // The machine restocks... and someone's already standing at it.
    renderHome(state); if (state === 'in') sfx('restock'); await W(demo ? 1200 : 700)
    $('homeLoiterer').src = ART[T.body]
    $('homeLoiterer').style.display = 'block'
    anim($('homeLoiterer'), [{ transform: 'translateX(220px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)' })
    await W(560)
    renderHome(state, true); $('homeLoiterer').style.display = 'block'
    sfx('blocked'); const b = bangOn($('home'), 214, 92); await W(700); b.remove()
    if (!party.some((m) => m.hp > 0)) { $('homeSub').textContent = 'heal your party to take them on'; toolsEnabled(true); return }
    Sound.music('vs')
    await wipeTrainer(async () => {
      setScene(SCALPER_SCENES, sceneRoll); showLayer('battle')
      const vs = $('vs'); $('vsImg').src = ART[T.vs]; $('vsName').textContent = T.full; vs.querySelector('.name span').textContent = T.title ?? 'SCALPER'; vs.style.display = 'block'
      vsIn(vs)
    })
    setTimeout(() => { if (live()) Sound.music('encounter') }, 1500)
    if (demo) cap('SCALPER', 'Scalpers get their own wipe and a VS splash, then say their piece. They block the restock for everyone until someone beats them.')
    await W(1300)
    await talk(T, demoPlan ? T.intro[0] : pickOf(T.intro))
    $('vs').style.display = 'none'; $('vs').getAnimations({ subtree: true }).forEach((a) => a.cancel())
    Sound.music(trainerTheme())
    // Their Pokémon for this battle, from their pool; the demo always meets Herb's GHOLDENGO.
    const deck = deckFor(T, leadLevel(), demoPlan ? [T.mon] : null)   // around your lead: see levelBand()
    demoNoBlunder = !!demoPlan?.noBlunder
    const out = await battle({ kind: 'trainer', foe: deck[0], roster: deck.slice(1), trainer: T, plan: demoPlan?.turns, planD: demoPlan?.defend })
    if (out.result === 'won') {
      restBeaten([T])   // they stay away for a while
      Sound.music('victory'); setTimeout(() => { if (live()) Sound.music('win') }, 3450)
      await trainerOn(T, 'down')
      anim($('trainer'), [{ transform: 'none' }, { transform: 'translateY(3px) scaleY(.97)', offset: .5 }, { transform: 'none' }], { duration: 520, easing: 'ease-in-out' })
      await talk(T, pickOf(T.outro), 'faceDown'); await trainerOff()
      await out.exp?.()   // EXP after their parting words, then tokens
      await payTokens(T.tokens, 'trainer', 'The VVM is free!')   // always
      await loot(T)   // sometimes
      Sound.stopMusic()
      await backToMachine(state)
    } else {
      Sound.stopMusic()
      await trainerOn(T); await talk(T, pickOf(T.gloat)); await trainerOff()
      await say(`${T.short} is still`, 'at the VVM...')
      await backToMachine(state, true)
      $('homeLoiterer').src = ART[T.body]
    }
  }

  /* ══════════ starter pick ══════════ */
  async function pickStarter() {
    Sound.music('win')
    let region = 0, sel = 1
    const S = (r) => DATA.starters.filter((s) => s.region === r)
    $('showcase').style.display = 'block'
    // One region at a time: ◀ the name ▶, rather than nine three-letter tabs too small to read or tap.
    $('chips').innerHTML = `<button class="chip arrow" data-step="-1" aria-label="Previous region">◀</button><span class="rlabel" id="rlabel" aria-live="polite"></span><button class="chip arrow" data-step="1" aria-label="Next region">▶</button>`
    function draw() {
      const three = S(region)
      $('regionName').innerHTML = `${DATA.regions[region].toUpperCase()}<small>CHOOSE YOUR PARTNER · ${region + 1}/9</small>`
      three.forEach((m, i) => { const slot = $('slot' + i), img = slot.querySelector('img'); img.src = spr(m); img.style.height = '84px'; slot.style.left = (36 + i * 92) + 'px'; slot.classList.toggle('dim', i !== sel) })
      $('pick3').innerHTML = three.map((m, i) => `<button class="btn t-${m.types[0]}${i === sel ? ' sel' : ''}" data-pick="${i}">${m.name}<small>${m.types.join(' / ').toUpperCase()}</small></button>`).join('')
      $('rlabel').innerHTML = `${DATA.regions[region].toUpperCase()}<small>${region + 1} of ${DATA.regions.length}</small>`
      $('bChoose').textContent = `CHOOSE ${three[sel].name}`
    }
    draw(); panel('pPick'); msg0('Choose your first partner!', "Any region's starter.")
    cap('STARTER', demo ? "Your first Pokémon can be any region's starter — 27 of them, Kanto to Paldea, all level 5." : 'Pick a region with ◀ ▶, then a starter. ← → region, ↑ ↓ starter, A chooses.')
    const onTap = (e) => {
      if (MODE !== 'play' || !live()) return
      const r = e.target.closest('[data-step]'), p = e.target.closest('[data-pick]')
      if (r) { region = (region + Number(r.dataset.step) + DATA.regions.length) % DATA.regions.length; sfx('move'); draw() }
      if (p) { sel = +p.dataset.pick; sfx('move'); draw() }
    }
    $('pPick').addEventListener('pointerdown', onTap)
    try {
      if (demo) {
        for (const r of [3, 6, 8]) { await W(420); region = r; sfx('move'); draw() }
        sel = S(region).findIndex((m) => m.name === 'FUECOCO'); await W(450); sfx('move'); draw()
        await demoPress('a', 600, $('bChoose'))
      } else {
        for (;;) {
          const b = await waitFor(['a', 'left', 'right', 'up', 'down'])
          if (b === 'a') break
          if (b === 'left') region = (region + 8) % 9
          if (b === 'right') region = (region + 1) % 9
          if (b === 'up') sel = (sel + 2) % 3
          if (b === 'down') sel = (sel + 1) % 3
          sfx('move'); draw()
        }
      }
    } finally { $('pPick').removeEventListener('pointerdown', onTap) }
    sfx('select')
    const chosen = individual(S(region)[sel], 5, rand)
    flash('#fff', .7, 200); $('showcase').style.display = 'none'; panel(null)
    return chosen
  }

  /* ══════════ the run ══════════ */
  fit(); await W(200)
  if (MODE === 'duo') { await duoDemo(); if (live()) start(); return }
  if (MODE === 'gym') { await gymDemo(); if (live()) start(); return }
  for (const n of LEGENDS) spawnLegend(n)
  // Before any interaction: the idle screen, and no toolbar yet.
  showLayer('home'); renderHome('idle'); showTools(false)
  $('feedList').innerHTML = ''; $('feed').hidden = true   // a fresh run: nobody else at the machine yet
  /** The first tap of all: a restock, with Herb and Paul already camping it. */
  async function firstRestock(demoPlan) {
    $('tts').textContent = 'STARTING…'; sfx('select'); await W(450)
    await fadeThrough(async () => renderHome('in')); sfx('restock'); await W(500)
    await campOut([HERB, PAUL])
    await firstEncounter(demoPlan)
  }

  if (demo) {
    // 1. The first tap: a restock, Herb and Paul, Alex, a starter, and a 2v2 beside him.
    cap('IDLE', 'Before anything happens the machine shows its usual idle screen. No Party, Bag or Box yet: you have no Pokémon.')
    await W(2600); hot($('home'))
    await firstRestock([
      { cmds: [{ move: 'EMBER', target: 0, planned: 'perfect' }],
        foes: { GHOLDENGO: { move: 'MAKE IT RAIN', target: 0 }, HIPPOWDON: { move: 'BULLDOZE' } },
        defend: ['parry', 'parry', 'parry', 'jump'] },
      { cmds: [{ move: 'TACKLE', target: 1, planned: 'great' }],
        foes: { GHOLDENGO: { move: 'SHADOW BALL', target: 0 }, HIPPOWDON: { move: 'CRUNCH', target: 1 } },
        defend: ['dodge'] },
    ])
    // 2. Back to the idle screen, now with the toolbar. Every tap rolls an outcome.
    cap('TAP', "Party, Bag and Box are here now, under the same idle screen. The machine's state is shared, the same for every trainer: right now it's sold out...")
    setMachine('out')
    await W(2600); hot($('home')); await tapMachine({ enc: null }); await W(1700)
    hot($('home')); await toIdle(); await W(700)
    cap('TAP', '...or under maintenance. Nobody gets to the packs then, whoever taps.')
    setMachine('maint')
    hot($('home')); await tapMachine({ enc: null }); await W(1700)
    hot($('home')); await toIdle(); await W(700)
    setMachine('in')
    // What happens on a tap is each trainer's own roll.
    // The wild pool: random until you report a timer, then the machine you reported at.
    const eeveeAt = MACHINES.find((m) => poolFor(m.code).includes('EEVEE') && m.code !== seedOf(YOU).m.code) ?? MACHINES[0]
    cap('WILD POOL', `Each real machine has its own pool of wild Pokémon, six that change every Monday. With no timer reports yet, you're on a random one: ${seedOf(YOU).m.code}.`)
    await W(3200)
    cap('REPORT', `Report a timer at a machine and your pool moves there. You report one at ${eeveeAt.code}, ${eeveeAt.venue}: its pool this week has EEVEE in it.`)
    reportTimer(YOU, eeveeAt.code); await W(3400)
    cap('TOGETHER', 'What happens when you tap is rolled for each trainer on their own. Three trainers tapping in the same second can all get something different.')
    otherTaps('MAYA', 'wild'); await W(500); otherTaps('SAM', null); await W(2400)
    // 1. Tap the sold-out machine: a wild Eevee.
    cap('WILD', "SAM is on the purchase screen, and only one trainer can be at a time. But battles don't need it: your tap still rolls, and an EEVEE jumps out.")
    await W(1600); hot($('home'))
    await tapMachine({ enc: 'wild', items: ['potion', 'ball'], plan: {
      wild: 'EEVEE',
      turns: [
        { menu: 'fight', move: 'EMBER', planned: 'good', cap: ['MENUS', 'FIGHT, BAG, POKéMON and RUN are separate now. FIGHT opens its own page with every move.'] },
        { menu: 'bag', item: 'ball', planned: 'good', shakes: 2, cap: ['BAG', 'BAG is its own page too: balls and potions. At high HP a catch is a long shot.'] },
        { menu: 'fight', move: 'TACKLE', planned: 'perfect', cap: ['CATCHING', 'Weaken it with a gentler move so it stays awake to be caught.'] },
        { menu: 'bag', item: 'ball', planned: 'perfect', shakes: 4, cap: ['THROW', 'An Excellent throw nearly doubles the catch chance.'] },
      ],
      defend: ['dodge', 'jump', 'late'],
    } })
    unlock('SAM'); lockFor(YOU)   // SAM's done; the stocked screen you're back on is yours
    // Supplies on the stocked shelf: buy a Potion.
    cap('SUPPLIES', "A stocked machine can carry battle supplies beside the packs, each with its own price, and they don't turn up every time. Tap one to buy it with tokens.")
    await W(2200); hot($('supplies').querySelector('[data-buy="potion"]')); buySupply('potion'); await W(1800)
    // 2. Use a Potion from the Bag, on the Pokémon you choose.
    await W(900)
    cap('BAG', 'Items work from the Bag outside battle too: pick the item, then the Pokémon. Balls stay greyed out — they\'re for wild battles.')
    hot($('tBag')); sfx('select')
    let sh = openSheet('bag')
    await W(1700)
    await sh.tap('[data-tab="medicine"]', 500)
    await sh.tap('[data-item="potion"]', 1500)
    await sh.tap(`[data-target="${party.indexOf(party.find((m) => m.name === 'FUECOCO'))}"]`, 2000)
    hot($('sheetClose')); closeSheetNow(); await W(500)

    // 3. The Party: tap a Pokémon for its stats, and change the battle order.
    cap('PARTY', 'Tap a Pokémon for its full stat page — numbers, IVs, nature — with item buttons right there. ▲ ▼ set the battle order.')
    hot($('tParty')); sfx('select')
    sh = openSheet('party')
    await W(1600)
    await sh.tap('[data-stat="1"]', 3200)
    await sh.tap('[data-back]', 1000)
    cap('ORDER', 'Number 1 goes out first. Moving EEVEE up makes it the lead...')
    await sh.tap('[data-up="1"]', 1600)
    cap('ORDER', '...and ▲ again puts FUECOCO back in front.')
    await sh.tap('[data-up="1"]', 1500)
    hot($('sheetClose')); closeSheetNow(); await W(500)
    // 4. Another tap: Brian, who doesn't know the first thing about Pokémon.
    await toIdle(); await W(600)
    cap('BRIAN', "Not every scalper knows Pokémon. Brian's in it for the resale money, and his \"kid\". He's the easy one.")
    await W(1400); hot($('home'))
    await tapMachine({ enc: 'scalper', plan: {
      who: BRIAN,
      turns: [
        { menu: 'fight', move: 'TACKLE', planned: 'perfect', cap: ['EASY', 'Brian picks Pokémon by price and calls them whatever. Nearly half his turns go to waste.'] },
        { menu: 'fight', move: 'QUICK ATTACK', planned: 'perfect' },
      ],
      defend: ['parry', 'parry'],
    } })
    cap('FREE', 'Brian is gone too. He paid less, but he was a lot less trouble.')
    await W(3200)
    if (live()) start()
    return
  }

  /* Play: everything hangs off the machine and the toolbar. Until the first
     restock is cleared (with Alex), every tap leads there. */
  const playCap = () => cap('PLAY', "Tap TOUCH TO START. The machine's state is shared by everyone; what jumps out is rolled for you alone. Other trainers are using it too (see the feed): only the purchase screen is one at a time.")
  cap('PLAY', "This is the machine's idle screen. You don't have a Pokémon yet. Tap TOUCH TO START.")
  const guard = (fn) => async () => { if (busy || !live()) return; busy = true; try { await fn() } catch (e) { if (e !== STOP) console.error(e) } finally { busy = false } }
  /** Other trainers use the same machine every few seconds, once you're past the tutorial. */
  const othersLoop = () => {
    if (vvm()) return   // in the app the other trainers are real (see syncMachine)
    const tick = () => { if (!live()) return; if (tutorialDone) otherTaps(OTHERS[Math.floor(Math.random() * OTHERS.length)]); setTimeout(tick, 5000 + Math.random() * 5000) }
    setTimeout(tick, 3000)
  }
  /*
   * Saving: the party and Box (each Pokémon's level, EXP, moves, HP and
   * status), the Bag, tokens, badges, the Elite Four ladder and Champion,
   * today's free heal, timer reports and the roaming legendaries. SAVE under
   * the machine saves now; it also saves on its own after every battle,
   * purchase or Bag/Party/Box visit, and every 30 s.
   *
   * Play mode keeps the save in this browser. In the app it's the account's
   * (game_saves, v60), with the browser copy as a cache and for when the
   * server can't be reached. Each account save has a revision; a write names
   * the one it was made from, so a device holding an older copy can't
   * overwrite newer progress made elsewhere: it loads the newer save instead.
   */
  // In the app, the browser copy is per account.
  const SAVE_KEY = 'vvm-save' + (APP.uid ? ':' + APP.uid : '')
  let saveRev = null          // app: the account save's revision this game is built on (null: never synced here)
  let cloudReady = !APP.on    // app: the account save has been checked; until then, taps wait
  let pushing = false, pushNext = null
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) } catch { return null } }
  const writeLocal = (data) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); return true } catch { return false } }
  function saveGame(why = 'auto') {
    if (demo || !tutorialDone) return false
    // Saved as they really are: leaving mid-battle mustn't keep a Transform or Conversion for good.
    const data = { v: 1, at: Date.now(), rev: saveRev, party: party.map(unformed), box, bag, wallet, badges, champion, eliteStep, kantoStep, redBeaten, fame, shareOn, rival: { step: rivalStep, wait: rivalWait, lost: rivalLost }, story, storyGap, heals, gifted, roam: ROAM, weekShift, reports }
    const kept = writeLocal(data)
    if (vvm() && cloudReady) pushSave(data)
    else if (!kept) return false
    const t = `saved ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    $('saveN').textContent = why === 'manual' ? 'saved!' : t
    if (why === 'manual') { sfx('select'); feed(`<b>You</b> saved the game.`); setTimeout(() => { $('saveN').textContent = t }, 1500) }
    return true
  }
  /** Sends a save to the account (app). One at a time; a save made meanwhile goes next. */
  async function pushSave(data) {
    if (pushing) { pushNext = data; return }
    pushing = true
    try {
      const r = await vvm().putSave(JSON.parse(JSON.stringify({ ...data, rev: saveRev })), saveRev)
      if (r.ok) { saveRev = r.rev; const l = readLocal(); if (l && l.at === data.at) writeLocal({ ...l, rev: saveRev }) }
      else if (r.reason === 'conflict' && r.data) return newerElsewhere(r.data, r.rev)
    } catch {}   // offline: the browser copy has it, and the next save tries again
    finally { pushing = false }
    if (pushNext) { const d = pushNext; pushNext = null; pushSave(d) }
  }
  /** The account's save moved on (played on another device): that one is the game now. */
  function newerElsewhere(data, rev) {
    pushNext = null
    writeLocal({ ...data, rev })
    feed('<b>Your game was saved on another device</b>, so that newer save was loaded.')
    start()
  }
  /**
   * App: which save is the game? The account's, unless this browser holds
   * progress made on top of it that never reached the server (played offline):
   * then that goes up. A browser save from before account saves goes up the
   * first time. Returns the save to load, or null.
   */
  async function syncSave() {
    const local = readLocal(), mine = local?.v && local.party?.length ? local : null
    let acct
    try { acct = await vvm().loadSave() } catch { return mine }   // can't reach the server: play on the browser copy
    if (!acct) {
      if (mine) { saveRev = null; cloudReady = true; await pushSave(mine) }
      return mine
    }
    saveRev = acct.rev
    if (mine && mine.rev === acct.rev && (mine.at ?? 0) > (acct.data?.at ?? 0)) { cloudReady = true; await pushSave(mine); return mine }
    writeLocal({ ...acct.data, rev: acct.rev })
    return acct.data
  }
  /** Back where you were: the toolbar, the feed, the save time. */
  function resumed(at) {
    showTools(true); toolsEnabled(true); playCap(); othersLoop()
    feed(`<b>Welcome back.</b> Loaded your save from ${at.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`)
    $('saveN').textContent = `saved ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }
  /** Puts a save back: the time it was made, or false if there was none. */
  function loadGame(s = readLocal()) {
    if (!s?.v || !s.party?.length) return false
    party.splice(0, party.length, ...s.party); box.splice(0, box.length, ...(s.box ?? []))
    restoreForms()   // a save from before that fix may still have one in it
    for (const k of Object.keys(bag)) delete bag[k]
    for (const [k, n] of Object.entries(s.bag ?? {})) {
      // Discs and summons are registered as items the first time one turns up: do that again.
      if (k.startsWith('disc:')) discItem(k.slice(5))
      if (k.startsWith('summon:')) summonItem(LEAGUES[k.slice(7)] ? k.slice(7) : +k.slice(7))
      if (ITEMS[k]) bag[k] = n
    }
    wallet = s.wallet ?? wallet; badges.splice(0, badges.length, ...(s.badges ?? []))
    champion = !!s.champion; eliteStep = s.eliteStep ?? 0; kantoStep = s.kantoStep ?? 0; redBeaten = !!s.redBeaten; fame = s.fame ?? null; shareOn = s.shareOn ?? true; heals = s.heals ?? (s.healedOn ? { day: s.healedOn, used: 1 } : { day: null, used: 0 }); gifted = s.gifted ?? true
    ;({ step: rivalStep = 0, wait: rivalWait = 0, lost: rivalLost = false } = s.rival ?? {})
    for (const who of Object.keys(story)) Object.assign(story[who], { step: 0, wait: 0, lost: false }, s.story?.[who])
    storyGap = { taps: 0, who: null, ...s.storyGap }
    for (const [n, m] of Object.entries(s.roam ?? {})) ROAM[n] = m
    weekShift = s.weekShift ?? 0; Object.assign(reports, s.reports ?? {})
    tutorialDone = true
    $('wallet').textContent = `${wallet.toFixed(2)} tk`; renderRoamers?.(); renderPool?.(); renderTools()
    return new Date(s.at)
  }
  const first = async () => { await (homeState === 'idle' ? firstRestock() : firstEncounter()); if (tutorialDone) { playCap(); toolsEnabled(true); othersLoop(); saveGame(); collectItems() } }
  // A save from before: straight back to where you were. (In the app, once the account's save has been checked, below.)
  let loaded = APP.on ? false : loadGame()
  $('saveN').textContent = 'not saved yet'
  if (loaded) resumed(loaded)
  setInterval(() => { if (live() && !busy) saveGame() }, 30000)
  // In the app: the real machine. Its state and holder are read now and every few seconds while you're on the idle screen,
  // and supplies you bought (here or on the app's VVM page) come into the Bag when you open the game or come back to it.
  if (APP.on) {
    ;(async () => {
      for (let i = 0; i < 50 && !vvm(); i++) await W(100)
      loaded = loadGame(vvm() ? await syncSave() : readLocal())
      cloudReady = true
      if (!live()) return
      if (loaded) resumed(loaded)
      if (!vvm()) return
      await syncMachine(); if (loaded) await collectItems()
    })().catch(() => { cloudReady = true })
    setInterval(() => { if (live() && vvm() && homeState === 'idle' && !busy) syncMachine() }, 8000)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && live() && vvm() && !busy) { syncMachine(); collectItems() } })
  }
  window.__saveSoon = () => setTimeout(() => { if (live()) saveGame() }, 200)
  // The app's exit button saves before it leaves.
  window.__saveNow = () => { if (live()) saveGame() }
  $('tSave').onclick = () => { if (!busy) saveGame('manual') }
  $('bNewGame').onclick = async () => {
    if (!confirm('Delete your save and start a new game?')) return
    try { localStorage.removeItem(SAVE_KEY) } catch {}
    if (vvm()) await vvm().deleteSave().catch(() => {})   // the account's too, or it would just load again
    start()
  }
  $('reportAt').innerHTML = MACHINES.map((m) => `<option value="${m.code}">${m.code} · ${m.venue}</option>`).join('')
  $('bReport').onclick = () => { if (tutorialDone) reportTimer(YOU, $('reportAt').value) }
  // Testing: jump to the League (all 8 Johto badges, the party at Lv 45, healed, and 10 more tokens).
  $('bLeague').onclick = guard(async () => {
    if (!tutorialDone) return
    for (let i = 0; i < 8; i++) if (!badges.includes(i)) badges.push(i)
    for (const m of party) { m.level = Math.max(m.level, 45); m.exp = 0; m.stats = statsAt(m, m.level); m.hp = m.stats.hp; learnAtLevel(m) }
    if (!vvm()) wallet = Math.round((wallet + 10) * 100) / 100
    $('wallet').textContent = `${wallet.toFixed(2)} tk`; renderTools()
    feed('Skipped to the League: all 8 Johto badges, the party at Lv 45. ELITE FOUR TICKETS can now turn up on a stocked machine.')
  })
  // Testing: every party Pokémon goes up a level (as a real level-up would), and any evolution plays out.
  $('bLevel').onclick = guard(async () => {
    if (!tutorialDone || !party.length) return
    for (const m of party) { const hpBefore = m.stats.hp; m.level = Math.min(LEVEL_CAP, m.level + 1); m.exp = 0; m.stats = statsAt(m, m.level); m.hp = Math.min(m.stats.hp, m.hp + (m.stats.hp - hpBefore)); if (evoDue(m)) pendingEvos.add(m); learnAtLevel(m) }
    feed(`Testing: your party is now ${party.map((m) => `${m.name} Lv ${m.level}`).join(', ')}.`)
    if (!pendingEvos.size) return renderTools()
    toolsEnabled(false)
    await fadeThrough(async () => { setScene(['plain']); showLayer('battle') })
    await backToMachine('idle')
  })
  $('bWeek').onclick = () => { if (!tutorialDone) return; weekShift++; renderPool(true); feed(`A new week: every machine's wild pool has changed.${Object.keys(reports).includes(YOU) ? '' : ' With no report, you are on a new random machine.'}`) }
  // Other trainers report timers now and then too, moving their own pools.
  setInterval(() => { if (live() && tutorialDone && Math.random() < 0.25) reportTimer(OTHERS[Math.floor(Math.random() * OTHERS.length)], MACHINES[Math.floor(Math.random() * MACHINES.length)].code) }, 9000)
  window.__vvm = { machine, otherTaps, rollEncounter, poolFor, seedOf, reportTimer, MACHINES, thisWeek, bumpWeek: () => { weekShift++; renderPool() }, party, bag, get wallet() { return wallet }, renderTools, emptyRun, PITY_AFTER, rollTap,
    box, trainerTheme, rollShelf, givePack, gymDisc, syncMachine, collectItems, backToMachine, get realShelf() { return realShelf }, evolveNow: (m) => { pendingEvos.add(m); return runEvolutions() }, deckFor, trainerCap, wildLevel,
    badges, rivalDue, rivalTeam, get rival() { return { step: rivalStep, wait: rivalWait, lost: rivalLost } }, setRival: (step, wait = 0) => { rivalStep = step; rivalWait = wait },
    storyDue, story, get storyGap() { return storyGap }, setStory: (who, step, wait = 0) => Object.assign(story[who], { step, wait, lost: false }),
    get heals() { return heals }, setHeals: (h) => { heals = h }, FREE_HEALS, get healPrice() { return healPrice },
    leagueNow, leagueKey, get league() { return { elite: eliteStep, kanto: kantoStep, champion, red: redBeaten } }, get fame() { return fame }, hallOfFame, get shareOn() { return shareOn }, setLeague: (o) => { champion = o.champion ?? champion; redBeaten = o.red ?? redBeaten; kantoStep = o.kanto ?? kantoStep } }   // for tests: the shared machine, the other trainers, and your party, Bag and tokens
  $('machineState').onchange = () => { setMachine($('machineState').value); feed(`The machine is now <b>${{ in: 'stocked', out: 'sold out', maint: 'under maintenance' }[machine.state]}</b>, for everyone.`) }
  // Three trainers tap in the same instant: three independent rolls. Yours then plays out.
  $('bTogether').onclick = guard(async () => {
    if (!tutorialDone || homeState !== 'idle') return
    const mine = rollEncounter(streams[YOU])
    for (const n of ['MAYA', 'SAM']) otherTaps(n)
    feed(`<b>You</b> tapped: ${ENC_TEXT[mine].replace('them', 'you')}.`)
    await tapMachine({ enc: mine })
  })
  for (const k of ['wild', 'trainers']) $(MODE_BTN[k]).onclick = (e) => {
    e.stopPropagation()
    if (MODE !== 'play' || busy || !live() || !modeLive[k]) return
    playerOn[k] = !playerOn[k]
    try { localStorage.setItem(MODE_KEY(k), playerOn[k] ? 'on' : 'off') } catch {}
    sfx(playerOn[k] ? 'select' : 'move'); paintBattles()
    // A scalper camping the machine leaves with the trainer battles.
    if (homeState === 'idle' || (!modeOn('trainers') && $('homeLoiterer').style.display === 'block')) renderHome('idle')
    feed(k === 'wild' ? (playerOn.wild ? '<b>Wild Pokémon on</b>: they can jump out when you tap.' : '<b>Wild Pokémon off</b>.')
      : playerOn.trainers ? '<b>Trainer battles on</b>: scalpers and 2v2s can turn up, and gyms can be challenged.' : '<b>Trainer battles off</b>.')
    // The feed isn't shown in the app, so say it on the machine too.
    homePop(`<b>${!battlesActive() ? 'Battles off: taps go straight to the machine'
      : k === 'wild' ? (playerOn.wild ? 'Wild Pokémon on' : 'Wild Pokémon off') : playerOn.trainers ? 'Trainer battles on' : 'Trainer battles off'}</b>`)
  }
  paintBattles()
  $('home').onclick = guard(async () => {
    if (!cloudReady) { $('tts').innerHTML = 'LOADING YOUR SAVE…'; return }   // app: the account save is still being checked
    // Battles off: just the machine. Back to idle from any other screen; from idle, straight to it.
    if (!battlesActive()) return homeState !== 'idle' ? toIdle() : tapMachine({ enc: null })
    if (!tutorialDone) return first()
    // A scalper who beat you is still camping it; otherwise a state screen goes back to idle, and idle rolls a tap.
    if ($('homeLoiterer').style.display === 'block' && modeOn('trainers')) return scalperEncounter(null, homeState)
    if (homeState !== 'idle') return toIdle()
    const v = $('nextTap').value
    await tapMachine(!v ? {} : v === 'find' ? { enc: null, find: true } : v === 'legend' ? { enc: 'wild', legend: true } : { enc: v === 'none' ? null : v })
  })
  $('bAdmin').onclick = guard(() => openAdmin())
  // Listen to any song, including ones for battles that aren't in the game yet (rivals).
  $('musicPick').onchange = () => { const v = $('musicPick').value; if (!v) return Sound.stopMusic(); Sound.setOn(true); syncSnd(); Sound.music(v) }
  for (const [b, k] of [['tParty', 'party'], ['tBag', 'bag'], ['tBox', 'box']]) {
    $(b).onclick = guard(async () => {
      if (!party.length) return
      const sh = openSheet(k); await sh.closed
      saveGame()
      // A summon chosen in the Bag: the Gym Leader appears once the sheet is closed.
      if (pendingSummon != null) { const n = pendingSummon; pendingSummon = null; await (LEAGUES[n] ? leagueBattle(n) : gymBattle(n)) }
      // An evolution item used in the Bag: the evolution plays on the battle screen, then back to the machine.
      if (pendingEvoItem) {
        pendingEvoItem = false; toolsEnabled(false)
        const was = homeState
        await fadeThrough(async () => { setScene(['plain']); showLayer('battle') })
        await backToMachine(was)
      }
    })
  }
}

try { if (localStorage.getItem('vvm-sound') === '1') Sound.setOn(true) } catch {}
// In the app, sound follows Settings → Sound effects (the app's 'vm-sound' switch).
if (APP.on) { let off = false; try { off = localStorage.getItem('vm-sound') === 'off' } catch {} ; Sound.setOn(!off) }
syncSnd(); setMode(MODE)
document.fonts.ready.then(() => { fit(); start() })

